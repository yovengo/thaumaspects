#!/usr/bin/env python3
"""Build a versioned furnace catalog from GTNH Oracle essentia recipes."""

import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import glob
import gzip
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = 'https://gtnhplanner.com'


def normalize(name):
    name = re.sub(r'§[0-9a-fk-or]', '', name, flags=re.I)
    return unicodedata.normalize('NFKC', name).casefold().strip()


def read_atlas_index(path):
    data = gzip.open(path, 'rb').read()
    ints = memoryview(data).cast('i')

    def read_string(pointer):
        if pointer < 0:
            return ''
        length = ints[pointer]
        return data[pointer * 4 + 4:pointer * 4 + 4 + length].decode('utf-8')

    offset = ints[1]
    index = defaultdict(list)
    for pointer in ints[offset + 1:offset + 1 + ints[offset]]:
        index[normalize(read_string(ints[pointer + 5]))].append({
            'id': int(ints[pointer + 9]),
            'mod': read_string(ints[pointer + 6]).casefold(),
        })
    return index


def file_name(path):
    return hashlib.sha1(path.encode('utf-8')).hexdigest()[:18] + '.png'


def download_icon(path, output_dir):
    target = output_dir / file_name(path)
    if target.exists() and target.stat().st_size > 8:
        return
    request = Request(BASE_URL + path, headers={'User-Agent': 'thaumaspects-catalog/1.0'})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=45) as response:
                data = response.read()
            if not data.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError(f'Invalid PNG: {path}')
            target.write_bytes(data)
            return
        except Exception:
            if attempt == 2:
                raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-274', type=Path, required=True)
    parser.add_argument('--resource-index', type=Path, required=True)
    parser.add_argument('--shards-dir', type=Path, required=True)
    parser.add_argument('--catalog', type=Path, default=ROOT / 'public/item-aspects-gtnh.json')
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()

    source = json.load(gzip.open(args.resource_index, 'rt'))
    old = read_atlas_index(args.data_274)
    resource_by_id = {entry['id']: entry for entry in source['resources'] if entry['kind'] == 'item'}
    items = []
    aspects = set()
    remote_paths = set()
    for shard_path in sorted(glob.glob(str(args.shards_dir / 'shard-*.json.gz'))):
        for recipe in json.load(gzip.open(shard_path, 'rt'))['recipes']:
            if recipe['kind'] != 'essentia_smelting':
                continue
            inputs = [entry for entry in recipe['inputs'] if entry['kind'] == 'item']
            if len(inputs) != 1:
                continue
            source_item = inputs[0]
            item_aspects = {entry['id'].rsplit(':', 1)[-1]: int(entry['amount'])
                            for entry in recipe['outputs'] if entry['kind'] == 'aspect' and entry['amount'] > 0}
            if not item_aspects:
                continue
            aspects.update(item_aspects)
            item_id = source_item['id']
            icon_path = source_item.get('iconPath') or resource_by_id.get(item_id, {}).get('iconPath')
            matches = [entry for entry in old.get(normalize(source_item['displayName']), [])
                       if entry['mod'] == (source_item.get('modId') or item_id.split(':', 1)[0]).casefold()]
            if len(matches) == 1:
                icon = {'kind': 'atlas', 'id': matches[0]['id'], 'quality': 'exact'}
            elif icon_path and icon_path.startswith('/') and icon_path.endswith('.png'):
                icon = {'kind': 'rendered', 'file': file_name(icon_path), 'quality': 'exact'}
                remote_paths.add(icon_path)
            else:
                # Do not pass off an unrelated texture as the exact item.
                icon = None
            items.append({'name': source_item['displayName'], 'registryId': item_id,
                          'aspects': item_aspects, **({'icon': icon} if icon else {})})

    ids = [item['registryId'] for item in items]
    if len(ids) != len(set(ids)):
        raise ValueError('Oracle smelting recipes contain duplicate item IDs')
    items.sort(key=lambda item: (normalize(item['name']), item['registryId']))
    counts = Counter(item['icon']['quality'] if item.get('icon') else 'missing' for item in items)
    catalog = {
        'aspects': sorted(aspects),
        'items': items,
        'aspectSource': {'version': source['gtnhVersion'], 'datasetVersionId': source['datasetVersionId'],
                         'kind': 'essentia_smelting', 'count': len(items)},
        'iconSource': {'atlas': 'GTNH Calculator 2.7.4', 'rendered': source['gtnhVersion'], 'counts': dict(counts)},
    }
    args.catalog.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'items': len(items), 'aspects': len(aspects), 'renderedIcons': len(remote_paths)}, ensure_ascii=False))

    if args.download:
        output_dir = ROOT / 'public/gt-icons/rendered'
        output_dir.mkdir(parents=True, exist_ok=True)
        missing = [path for path in remote_paths if not (output_dir / file_name(path)).exists()]
        print(f'downloading {len(missing)} rendered icons')
        with ThreadPoolExecutor(max_workers=24) as pool:
            futures = [pool.submit(download_icon, path, output_dir) for path in missing]
            for future in as_completed(futures):
                future.result()


if __name__ == '__main__':
    main()

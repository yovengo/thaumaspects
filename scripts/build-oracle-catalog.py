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
import subprocess
import sys
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


def read_legacy_aspects(path):
    """Read exact item aspect recipes from a GTNH Calculator v3/v5 export."""
    data = gzip.open(path, 'rb').read()
    ints = memoryview(data).cast('i')

    def read_string(pointer):
        if pointer < 0:
            return ''
        length = ints[pointer]
        return data[pointer * 4 + 4:pointer * 4 + 4 + length].decode('utf-8')

    def read_slice(pointer):
        return ints[pointer + 1:pointer + 1 + ints[pointer]]

    if ints[0] not in (3, 5):
        raise ValueError(f'Unsupported GTNH Calculator data format: {ints[0]}')
    aspect_types = {pointer for pointer in read_slice(ints[4])
                    if read_string(ints[pointer]).casefold() == 'item aspects'}
    profiles = {}
    for pointer in read_slice(ints[5]):
        if ints[pointer + 6] not in aspect_types:
            continue
        entries = read_slice(ints[pointer + 5])
        inputs = [entries[offset + 1] for offset in range(0, len(entries), 5)
                  if entries[offset] == 0]
        if len(inputs) != 1:
            continue
        item_pointer = inputs[0]
        old_id = read_string(ints[item_pointer + 4])
        if not old_id.startswith('i:') or ':' not in old_id[2:]:
            continue
        registry_base, damage = old_id[2:].rsplit(':', 1)
        if not damage.isdigit():
            continue
        item_id = f'{registry_base}@{damage}'
        aspects = {}
        for offset in range(0, len(entries), 5):
            if entries[offset] != 3:
                continue
            output_pointer = entries[offset + 1]
            aspect_name = read_string(ints[output_pointer + 5])
            if aspect_name.startswith('Aspect: ') and entries[offset + 3] > 0:
                aspect = aspect_name.removeprefix('Aspect: ').casefold()
                aspects[aspect] = aspects.get(aspect, 0) + int(entries[offset + 3])
        if aspects:
            profiles[item_id] = (read_string(ints[item_pointer + 5]),
                                 read_string(ints[item_pointer + 6]), aspects,
                                 int(ints[item_pointer + 9]))
    return profiles


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
    parser.add_argument('--data-274', type=Path, required=True, help='Icon atlas index only')
    parser.add_argument('--data-280', type=Path, required=True, help='Fallback aspect profiles')
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
    known_ids = set(ids)
    historical_sources = [('2.8.0', read_legacy_aspects(args.data_280))]
    unprofiled = []
    fallback_counts = Counter()
    for item_id, resource in resource_by_id.items():
        if item_id in known_ids:
            continue
        for version, profiles in historical_sources:
            old_profile = profiles.get(item_id)
            if not old_profile:
                continue
            name, mod, old_aspects, _ = old_profile
            if (normalize(resource['displayName']) == normalize(name)
                    and (resource.get('modId') or item_id.split(':', 1)[0]).casefold() == mod.casefold()):
                icon_path = resource.get('iconPath')
                matches = [entry for entry in old.get(normalize(name), []) if entry['mod'] == mod.casefold()]
                if len(matches) == 1:
                    icon = {'kind': 'atlas', 'id': matches[0]['id'], 'quality': 'exact'}
                elif icon_path and icon_path.startswith('/') and icon_path.endswith('.png'):
                    icon = {'kind': 'rendered', 'file': file_name(icon_path), 'quality': 'exact'}
                    remote_paths.add(icon_path)
                else:
                    icon = None
                items.append({'name': resource['displayName'], 'registryId': item_id,
                              'aspects': old_aspects, 'aspectVersion': version,
                              **({'icon': icon} if icon else {})})
                aspects.update(old_aspects)
                fallback_counts[version] += 1
                break
        else:
            unprofiled.append({'name': resource['displayName'], 'registryId': item_id})
    unprofiled.sort(key=lambda item: (normalize(item['name']), item['registryId']))
    items.sort(key=lambda item: (normalize(item['name']), item['registryId']))
    counts = Counter(item['icon']['quality'] if item.get('icon') else 'missing' for item in items)
    catalog = {
        'aspects': sorted(aspects),
        'items': items,
        'unprofiledItems': unprofiled,
        'aspectSource': {'version': source['gtnhVersion'], 'datasetVersionId': source['datasetVersionId'],
                         'kind': 'essentia_smelting', 'count': len(known_ids),
                         'fallbackCounts': dict(fallback_counts)},
        'iconSource': {'atlas': 'GTNH Calculator 2.7.4', 'rendered': source['gtnhVersion'], 'counts': dict(counts)},
    }
    args.catalog.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'items': len(items), 'unprofiledItems': len(unprofiled),
                      'fallbackCounts': dict(fallback_counts),
                      'aspects': len(aspects), 'renderedIcons': len(remote_paths)}, ensure_ascii=False))

    if args.download:
        output_dir = ROOT / 'public/gt-icons/rendered'
        output_dir.mkdir(parents=True, exist_ok=True)
        missing = [path for path in remote_paths if not (output_dir / file_name(path)).exists()]
        print(f'downloading {len(missing)} rendered icons')
        with ThreadPoolExecutor(max_workers=24) as pool:
            futures = [pool.submit(download_icon, path, output_dir) for path in missing]
            for future in as_completed(futures):
                future.result()
        subprocess.run([sys.executable, str(ROOT / 'scripts/build-rendered-icon-bounds.py')], check=True)


if __name__ == '__main__':
    main()

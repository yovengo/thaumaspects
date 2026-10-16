#!/usr/bin/env python3
"""Attach GTNH item sprites to the aspect catalog.

Inputs are the public GTNH 2.7.4 calculator atlas/data.bin and the GTNH
Planner 2.9 resource index. The raw binary files are kept outside this repo.
"""

import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import gzip
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
import subprocess
import unicodedata
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / 'public/item-aspects-gtnh.json'
OUTPUT_DIR = ROOT / 'public/gt-icons'
BASE_URL = 'https://gtnhplanner.com'


def normalize(name):
    name = re.sub(r'§[0-9a-fk-or]', '', name, flags=re.I)
    return unicodedata.normalize('NFKC', html.unescape(name)).casefold().strip()


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
        name = read_string(ints[pointer + 5])
        index[normalize(name)].append({
            'id': int(ints[pointer + 9]),
            'mod': read_string(ints[pointer + 6]),
            'registry': read_string(ints[pointer + 7]),
        })
    return index


def read_resource_index(path):
    data = json.load(gzip.open(path, 'rt'))
    index = defaultdict(list)
    for resource in data['resources']:
        icon_path = resource.get('iconPath', '')
        if resource.get('kind') == 'item' and icon_path.startswith('/') and icon_path.endswith('.png'):
            index[normalize(resource['displayName'])].append({
                'path': icon_path,
                'mod': resource.get('modId', ''),
            })
    return index


def unique_candidates(candidates, identity):
    return list({identity(candidate): candidate for candidate in candidates}.values())


def preferred(candidates):
    return sorted(candidates, key=lambda candidate: (
        {'minecraft': 0, 'gregtech': 1}.get(candidate.get('mod', '').casefold(), 2),
        candidate.get('mod', '').casefold(),
        str(candidate.get('id', candidate.get('path', ''))),
    ))[0]


def aliases(name):
    result = []
    result.append(re.sub(r'\s*\((?:Fireproof|Fire Resistant)\)$', '', name, flags=re.I))
    replacements = [
        (r' Planks$', ' Wood Planks'), (r' Plank$', ' Wood Planks'),
        (r' Slabs$', ' Slab'), (r' Stairs$', ''), (r' Slab$', ''),
        (r' Crop$', ''), (r' Leaves$', ' Leaf'),
        (r'^(?:Double|Triple|Quadruple|Quintuple) ', ''),
    ]
    for pattern, replacement in replacements:
        changed = re.sub(pattern, replacement, name, flags=re.I)
        if changed != name:
            result.append(changed)
    return [value for value in result if value != name]


def generic_name(name):
    text = name.casefold()
    suffixes = [
        ('arrow', 'Arrow'), ('princess', 'Queen Bee'), ('drone', 'Queen Bee'),
        ('larvae', 'Queen Bee'), ('bee', 'Queen Bee'), ('ingot', 'Iron Ingot'),
        ('dust', 'Iron Dust'), ('plate', 'Iron Plate'), ('bolt', 'Iron Bolt'),
        ('screw', 'Iron Bolt'), ('rod', 'Iron Rod'), ('wire', '1x Copper Wire'),
        ('cable', '1x Copper Cable'), ('ore', 'Iron Ore'), ('crystal', 'Nether Quartz'),
        ('gem', 'Diamond'), ('leaves', 'Oak Leaves'), ('planks', 'Oak Wood'),
        ('slab', 'Wooden Slab'), ('stairs', 'Stone'), ('gear', 'Iron Gear'),
        ('sword', 'Iron Sword'), ('book', 'Book'), ('paper', 'Paper'),
    ]
    for suffix, representative in suffixes:
        if text.endswith(suffix):
            return representative
    return 'Stone'


def file_name(url_path):
    return hashlib.sha1(url_path.encode('utf-8')).hexdigest()[:18] + '.png'


def download_icon(url_path, destination):
    if destination.exists() and destination.stat().st_size > 8:
        return
    request = Request(BASE_URL + url_path, headers={'User-Agent': 'thaumaspects-icon-import/1.0'})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=45) as response:
                data = response.read()
            if not data.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError('not a PNG')
            destination.write_bytes(data)
            return
        except Exception:
            if attempt == 2:
                raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--atlas-274', type=Path, required=True)
    parser.add_argument('--data-274', type=Path, required=True)
    parser.add_argument('--atlas-280', type=Path, required=True)
    parser.add_argument('--data-280', type=Path, required=True)
    parser.add_argument('--resource-index', type=Path, required=True)
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()

    old = read_atlas_index(args.data_274)
    newer = read_atlas_index(args.data_280)
    resources = read_resource_index(args.resource_index)
    catalog = json.loads(CATALOG_PATH.read_text())
    OUTPUT_DIR.mkdir(exist_ok=True)
    (OUTPUT_DIR / 'rendered').mkdir(exist_ok=True)
    shutil.copyfile(args.atlas_274, OUTPUT_DIR / 'atlas-2.7.4.webp')
    referenced_remote = set()
    referenced_newer = set()
    counts = Counter()

    for item in catalog['items']:
        name = item['name']
        exact_name = normalize(name)
        older = unique_candidates(old.get(exact_name, []), lambda entry: entry['id'])
        remote = unique_candidates(resources.get(exact_name, []), lambda entry: entry['path'])
        recent = unique_candidates(newer.get(exact_name, []), lambda entry: entry['id'])

        if older:
            match = preferred(older)
            icon = {'kind': 'atlas', 'id': match['id'], 'quality': 'exact' if len(older) == 1 else 'ambiguous'}
        elif remote:
            match = preferred(remote)
            icon = {'kind': 'rendered', 'file': file_name(match['path']), 'quality': 'exact' if len(remote) == 1 else 'ambiguous'}
            referenced_remote.add(match['path'])
        elif recent:
            match = preferred(recent)
            icon = {'kind': 'rendered', 'file': f"atlas-2.8-{match['id']}.png", 'quality': 'exact' if len(recent) == 1 else 'ambiguous'}
            referenced_newer.add(match['id'])
        else:
            related = next((unique_candidates(old[normalize(alias)], lambda entry: entry['id'])
                            for alias in aliases(name) if old.get(normalize(alias))), [])
            if related:
                icon = {'kind': 'atlas', 'id': preferred(related)['id'], 'quality': 'related'}
            else:
                representative = old.get(normalize(generic_name(name))) or old[normalize('Stone')]
                icon = {'kind': 'atlas', 'id': preferred(representative)['id'], 'quality': 'generic'}
        item['icon'] = icon
        counts[icon['quality']] += 1

    if args.download:
        with ThreadPoolExecutor(max_workers=12) as pool:
            futures = {pool.submit(download_icon, path, OUTPUT_DIR / 'rendered' / file_name(path)): path
                       for path in referenced_remote}
            for future in as_completed(futures):
                future.result()
        for icon_id in sorted(referenced_newer):
            target = OUTPUT_DIR / 'rendered' / f'atlas-2.8-{icon_id}.png'
            if target.exists():
                continue
            subprocess.run([
                'sips', '-s', 'format', 'png', '-c', '32', '32', '--cropOffset',
                str(icon_id // 256 * 32), str(icon_id % 256 * 32),
                str(args.atlas_280), '--out', str(target),
            ], check=True, stdout=subprocess.DEVNULL)
    else:
        print('Icon files were not downloaded; pass --download to fetch them.')

    catalog['iconSource'] = {
        'atlas': 'GTNH Calculator 2.7.4',
        'rendered': 'GTNH Planner 2.9.0-beta-2 and GTNH Calculator 2.8',
        'counts': dict(counts),
    }
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'rows': len(catalog['items']), 'quality': dict(counts),
                      'remote_files': len(referenced_remote), 'newer_sprites': len(referenced_newer)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

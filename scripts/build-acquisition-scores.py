#!/usr/bin/env python3
import argparse
from collections import defaultdict
import glob
import gzip
import html
import json
import math
from pathlib import Path
import re
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
TIERS = ['NONE', 'ULV', 'LV', 'MV', 'HV', 'EV', 'IV', 'LuV', 'ZPM', 'UV', 'UHV', 'UEV', 'UIV', 'UXV', 'OpV', 'MAX']
STAGES = ['NONE', 'LV', 'MV', 'HV', 'IV', 'UV', 'MAX']


def normalize(name):
    name = re.sub(r'§[0-9a-fk-or]', '', name, flags=re.I)
    return unicodedata.normalize('NFKC', html.unescape(name)).casefold().strip()


def resource_data(path):
    data = json.load(gzip.open(path, 'rt'))
    usage = {}
    names = defaultdict(list)
    alternatives = {}
    for row in data['resourceIndex']:
        if row['kind'] not in ('item', 'fluid'):
            continue
        item_id = row['id']
        usage[item_id] = max(0, row.get('recipeCount', 0))
        names[normalize(row['displayName'])].append(item_id)
        if row.get('alternatives'):
            alternatives[item_id] = [option['id'] for option in row['alternatives'] if option.get('id')]
    return data, usage, names, alternatives


def read_recipes(directory):
    recipes = []
    produced = set()
    world_sources = set()
    for path in sorted(glob.glob(str(directory / 'shard-*.json.gz'))):
        for row in json.load(gzip.open(path, 'rt'))['recipes']:
            if row['kind'] in ('ore_vein', 'small_ore'):
                world_sources.update(item['id'] for item in row.get('outputs', []) if item.get('kind') == 'item')
            if row['kind'] not in ('gregtech_machine', 'crop_produce') or not row.get('inputs') or not row.get('outputs'):
                continue
            tier = TIERS.index(row['minimumTier']) if row.get('minimumTier') in TIERS else len(TIERS) - 1
            inputs = []
            for ingredient in row['inputs']:
                if ingredient['kind'] not in ('item', 'fluid'):
                    inputs = []
                    break
                if ingredient['id'].startswith('oredict:craftingTool'):
                    continue
                if ingredient.get('consumed') is False and row['kind'] != 'crop_produce':
                    continue
                amount = float(ingredient.get('amount', 1)) / (1000 if ingredient['kind'] == 'fluid' else 1)
                if ingredient.get('consumed') is False:
                    amount /= 8
                inputs.append((ingredient['id'], amount))
            if not inputs:
                continue
            outputs = [(item['id'], float(item.get('amount', 1)) * float(item.get('chance', 1)))
                       for item in row['outputs'] if item['kind'] in ('item', 'fluid') and item.get('amount', 1) > 0]
            if not outputs:
                continue
            recipes.append((tier, inputs, outputs, row['kind'] == 'crop_produce'))
            produced.update(item_id for item_id, _ in outputs)
    return recipes, produced, world_sources


def estimate_scores(usage, alternatives, recipes, produced, world_sources, stage):
    max_tier = TIERS.index(stage)
    costs = {}
    for item_id, count in usage.items():
        base = 5 / math.sqrt(count + 1)
        if item_id.startswith('minecraft:'):
            costs[item_id] = base
        elif item_id in world_sources:
            costs[item_id] = base + 2
        elif item_id not in produced:
            costs[item_id] = base + 10
    depths = {item_id: 0 for item_id in costs}
    eligible = [(tier, inputs, outputs, farming) for tier, inputs, outputs, farming in recipes if tier <= max_tier]

    for _ in range(14):
        changed = False
        for tier, inputs, outputs, farming in eligible:
            total = 0.05 if farming else 0.15 * (1.6 ** tier)
            depth = 0
            for item_id, amount in inputs:
                if item_id in alternatives:
                    options = [(costs[option], depths[option]) for option in alternatives[item_id] if option in costs]
                    if not options:
                        break
                    cost, item_depth = min(options)
                elif item_id in costs:
                    cost, item_depth = costs[item_id], depths[item_id]
                else:
                    break
                total += cost * amount
                depth = max(depth, item_depth)
            else:
                for item_id, amount in outputs:
                    effective = max(0.001, amount)
                    score = total / effective + (0.1 if farming else 0.5 * (depth + 1))
                    if score + 1e-6 < costs.get(item_id, math.inf):
                        costs[item_id] = score
                        depths[item_id] = 0 if farming else depth + 1
                        changed = True
        if not changed:
            break
    return costs, depths


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--resource-index', type=Path, required=True)
    parser.add_argument('--shards-dir', type=Path, required=True)
    parser.add_argument('--catalog', type=Path, default=ROOT / 'public/item-aspects-gtnh.json')
    args = parser.parse_args()
    metadata, usage, names, alternatives = resource_data(args.resource_index)
    recipes, produced, world_sources = read_recipes(args.shards_dir)
    catalog = json.loads(args.catalog.read_text())

    scores = {}
    depths = {}
    for stage in STAGES:
        costs, steps = estimate_scores(usage, alternatives, recipes, produced, world_sources, stage)
        scores[stage] = costs
        depths[stage] = steps
        print(f'{stage}: {len(costs)} reachable resources')

    for item in catalog['items']:
        candidates = [item['registryId']] if item.get('registryId') else names.get(normalize(item['name']), [])
        item['acquisition'] = {}
        for stage in STAGES:
            matched = [(scores[stage][item_id], depths[stage][item_id]) for item_id in candidates if item_id in scores[stage]]
            if matched:
                score, depth = min(matched)
                item['acquisition'][stage] = [round(score, 4), depth]
    catalog['acquisitionSource'] = {
        'version': metadata['gtnhVersion'],
        'datasetVersionId': metadata['datasetVersionId'],
        'recipeCount': len(recipes),
        'stages': STAGES,
        'method': 'recipe-graph-relative-effort',
    }
    args.catalog.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    main()

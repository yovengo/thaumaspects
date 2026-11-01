import glob
import gzip
import json
from pathlib import Path


def load_oracle_inputs(resource_index, shards_dir, expected_version=None):
    with gzip.open(resource_index, 'rt') as source_file:
        source = json.load(source_file)

    version = source.get('gtnhVersion')
    dataset_id = source.get('datasetVersionId')
    if not version or not dataset_id:
        raise ValueError('Oracle resource index is missing source version metadata')
    if expected_version and version != expected_version:
        raise ValueError(f'Expected GTNH {expected_version}, got {version} ({dataset_id})')

    shard_paths = sorted(Path(path) for path in glob.glob(str(shards_dir / 'shard-*.json.gz')))
    if not shard_paths:
        raise ValueError(f'No Oracle recipe shards found in {shards_dir}')

    published_shards = source.get('shards')
    if published_shards is not None:
        expected_names = {Path(shard['path']).name for shard in published_shards}
        actual_names = {path.name for path in shard_paths}
        if expected_names != actual_names:
            missing = sorted(expected_names - actual_names)
            unexpected = sorted(actual_names - expected_names)
            raise ValueError(
                f'Oracle shard set does not match {dataset_id}: '
                f'{len(missing)} missing, {len(unexpected)} unexpected'
            )

    return source, shard_paths


def iter_oracle_recipes(source, shard_paths):
    published = {Path(shard['path']).name: shard for shard in source.get('shards', [])}
    count = 0
    for path in shard_paths:
        with gzip.open(path, 'rt') as shard_file:
            shard = json.load(shard_file)
        if shard.get('datasetVersionId') != source['datasetVersionId']:
            raise ValueError(f'Oracle shard belongs to another dataset: {path}')
        expected = published.get(path.name)
        if expected and (
            shard.get('start') != expected['start']
            or shard.get('end') != expected['end']
            or len(shard['recipes']) != expected['end'] - expected['start']
        ):
            raise ValueError(f'Oracle shard has an unexpected recipe range: {path}')
        count += len(shard['recipes'])
        yield from shard['recipes']

    if source.get('recipeCount') is not None and count != source['recipeCount']:
        raise ValueError(f'Expected {source["recipeCount"]} recipes, read {count}')

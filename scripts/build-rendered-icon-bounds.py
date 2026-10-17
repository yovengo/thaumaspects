#!/usr/bin/env python3
"""Measure the visible content of GTNH's transparent rendered PNG icons."""

import json
import struct
import zlib
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / 'public/gt-icons/rendered'
OUTPUT = ROOT / 'src/data/renderedIconBounds.json'
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'
VISIBLE_ALPHA = bytes(1 if value >= 16 else 0 for value in range(256))


def visible_bounds(path):
    data = path.read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError(f'Not a PNG: {path}')

    offset = len(PNG_SIGNATURE)
    compressed = bytearray()
    width = height = None
    while offset < len(data):
        length = struct.unpack_from('>I', data, offset)[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        offset += 12 + length
        if kind == b'IHDR':
            width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', payload)
            if (depth, color, compression, filtering, interlace) != (8, 6, 0, 0, 0):
                raise ValueError(f'Unsupported PNG format: {path}')
        elif kind == b'IDAT':
            compressed.extend(payload)
        elif kind == b'IEND':
            break

    pixels = zlib.decompress(compressed)
    stride = width * 4
    previous = bytearray(stride)
    left, top, right, bottom = width, height, -1, -1
    offset = 0
    for y in range(height):
        filter_type = pixels[offset]
        offset += 1
        row = bytearray(pixels[offset:offset + stride])
        offset += stride
        if filter_type == 1:
            for i in range(4, stride):
                row[i] = (row[i] + row[i - 4]) & 255
        elif filter_type == 2:
            for i in range(stride):
                row[i] = (row[i] + previous[i]) & 255
        elif filter_type == 3:
            for i in range(stride):
                row[i] = (row[i] + ((row[i - 4] if i >= 4 else 0) + previous[i]) // 2) & 255
        elif filter_type == 4:
            for i in range(stride):
                a = row[i - 4] if i >= 4 else 0
                b = previous[i]
                c = previous[i - 4] if i >= 4 else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                row[i] = (row[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        elif filter_type != 0:
            raise ValueError(f'Unsupported PNG filter {filter_type}: {path}')

        visible = row[3::4].translate(VISIBLE_ALPHA)
        first = visible.find(1)
        if first >= 0:
            left = min(left, first)
            top = min(top, y)
            right = max(right, visible.rfind(1))
            bottom = y
        previous = row

    if right < left:
        return [width, height, 0, 0, width, height]
    return [width, height, left, top, right - left + 1, bottom - top + 1]


def main():
    bounds = {path.name: visible_bounds(path) for path in sorted(ICON_DIR.glob('*.png'))}
    common = Counter(tuple(value) for value in bounds.values()).most_common(1)[0][0]
    overrides = {name: value for name, value in bounds.items() if tuple(value) != common}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({'default': common, 'overrides': overrides}, separators=(',', ':')) + '\n')
    ratios = Counter(round(max(value[4] / value[0], value[5] / value[1]), 1) for value in bounds.values())
    print(f'Measured {len(bounds)} icons; {len(overrides)} differ from the common bounds; content-size distribution: {dict(sorted(ratios.items()))}')


if __name__ == '__main__':
    main()

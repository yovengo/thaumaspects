# Thaumaspects

Thaumaspects is a modern reimagining of **Thaumcraft Research Helper**. It is based on the open-source [ythri/tcresearch](https://github.com/ythri/tcresearch/tree/gh-pages) repository: its connection-finding logic, aspect data, and artwork were brought over and adapted into a React application.

Website: [thaumaspects.vercel.app](https://thaumaspects.vercel.app/)

The helper finds aspect connections for Thaumcraft 4.x–5.x research. In addition to quick chain searching, it includes an interactive research map where you can drag aspects, place obstacles, choose start and end nodes, and automatically build a route.

> **Technical note:** the project was developed iteratively, with priority given to validating the interface and research-map mechanics. As the feature set stabilizes, the application structure will be refined and parts of the implementation modularized.

## Features

- Thaumcraft versions from 4.1 through 5.1.3.
- Forbidden Magic, Magic Bees, and GregTech add-ons.
- Chain search that accounts for unavailable aspects.
- An interactive, resizable hex map with drag-and-drop and obstacles.
- Automatic route building and visualization on the map.
- Essentia planner: enter one or more required aspects and get item quantities, totals, and alternative sets for the alchemical furnace.

## Essentia data

The planner contains **24,066 item profiles** from the `essentia_smelting` recipes in the [GTNH Planner 2.9.0-beta-2 Oracle dataset](https://github.com/Samiracle64/gtnh-factory-flow). Each row has the input registry ID and the exact aspect output declared by that furnace recipe. Names and item families are never used to invent aspects. An item that exists in the registry but has no smelting recipe in this dataset is not presented as an essentia source.

The default plan searches combinations with a bounded beam search, so different requested aspects may come from different items. A generic acquisition score is calculated from the recipe graph for the selected machine tier; it considers ingredients, crafting depth and renewable crop harvests. The planner also accounts for aspect concentration, unwanted essentia and the number of item types, keeping low-yield everyday materials ahead of concentrated artifacts in the default plan. There are no per-item bonuses, exclusions, or hand-entered aspect profiles. Players can mark stockpiled items or exclude unavailable ones. Acquisition is an estimate: the dataset does not know world rarity, the player's inventory, or all progression gates, and the bounded search does not prove a global optimum.

The catalog contains 69 aspects. Item pictures use the [GTNH Calculator 2.7.4 atlas](https://github.com/ShadowTheAge/gtnh-2.7.4) when a name and mod have a unique match, otherwise the exact rendered icon from the 2.9 resource index. A small number of items have no icon in either source and show initials instead. The picker also shows initials when an aspect icon is unavailable. Minecraft and mod textures belong to their respective creators.

To regenerate the catalog from the downloaded Oracle resource index and all recipe shards:

```bash
python3 scripts/build-oracle-catalog.py --data-274 /path/to/data.bin --resource-index /path/to/resource-index.json.gz --shards-dir /path/to/recipe-shards --download
python3 scripts/build-acquisition-scores.py --resource-index /path/to/resource-index.json.gz --shards-dir /path/to/recipe-shards
```

The generator validates unique registry IDs and derives all aspect profiles from furnace outputs. The raw Oracle shards are build inputs and are not committed. The planned infusion-recipe picker is outside the current scope.

## Getting started

```bash
pnpm install
pnpm dev
```

For a production build:

```bash
pnpm build
```

## Attribution and license

The original [ythri/tcresearch](https://github.com/ythri/tcresearch/tree/gh-pages) project is licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). This project preserves the required attribution; the transferred aspect data, artwork, and core search logic originate from that repository.

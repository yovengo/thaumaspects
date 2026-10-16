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

The planner ships with 14,338 item-aspect rows from the community [GTNH item aspect lookup](https://github.com/axcou/thaumcraft-gtnh-solver), itself generated from the [GTNH Aspects spreadsheet](https://docs.google.com/spreadsheets/d/1oaV9g5GoS_qkfZzKVrE85km2lsL8YieX_FZ9mA3bscg). Its practical-source preference comes from the [EasyPure Aspect Sources sheet](https://docs.google.com/spreadsheets/d/1Llvu91Vmn4RcCE__lKV8p_MIR9tiaV2URGbkombvlkE). The data is a scan database without a pinned GTNH release or item IDs. Some names occur with different aspect profiles; those rows are shown separately. The data does not prove that every listed item is accepted by an alchemical furnace, or that its values match a particular pack version. Check unfamiliar options in your installed pack's NEI.

The planner favors simple, familiar items by default and also shows sets using fewer items or less surplus essentia. The full 14,338-row catalog is searchable and filterable by the selected aspects; any item can be selected or added to a custom set. Results are recommendations based on the available item data, not a guaranteed global optimum. Recipe lookup is outside the current scope.

All 61 aspects have icons in the picker. Every item-aspect row also has an image: 10,914 rows match a unique item name in an icon source, 1,507 match names shared by multiple items, and 1,917 use a related or type-based game sprite. A `?` badge marks the latter two cases. Since the aspect source has names but no registry IDs, a matching name cannot guarantee the pictured variant is the exact item in every GTNH version.

The item images come from the [GTNH Calculator 2.7.4 atlas](https://github.com/ShadowTheAge/gtnh-2.7.4), [GTNH NEI 2.8 atlas](https://github.com/Milky-way-Galaxy/gtnhnei), and [GTNH Planner 2.9 resource index](https://github.com/Samiracle64/gtnh-factory-flow). The compact 2.7.4 atlas and selected rendered PNGs are stored in `public/gt-icons/`. `scripts/build-item-icons.py` recreates the item-to-image mapping from those public data files; run `python3 scripts/build-item-icons.py --help` for its input arguments. The 13 common vanilla textures in `public/item-icons/` remain as a fallback. Minecraft and mod textures belong to their respective creators.

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

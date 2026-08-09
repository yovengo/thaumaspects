# Thaumaspects

This is a vibe-coded project and a modern reimagining of **Thaumcraft Research Helper**. It is based on the open-source [ythri/tcresearch](https://github.com/ythri/tcresearch/tree/gh-pages) repository: its connection-finding logic, aspect data, and artwork were brought over and adapted into a React application.

The helper finds aspect connections for Thaumcraft 4.x–5.x research. In addition to quick chain searching, it includes an interactive research map where you can drag aspects, place obstacles, choose start and end nodes, and automatically build a route.

## Features

- Thaumcraft versions from 4.1 through 5.1.3.
- Forbidden Magic, Magic Bees, and GregTech add-ons.
- Chain search that accounts for unavailable aspects.
- An interactive, resizable hex map with drag-and-drop and obstacles.
- Automatic route building and visualization on the map.

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

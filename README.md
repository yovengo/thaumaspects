# Thaumaspects

GT New Horizons research map solver and essentia planner.

**Live:** [thaumaspects.vercel.app](https://thaumaspects.vercel.app/)

## What it does

- **Research Map:** place source aspects and obstacles on a hex board, then connect the sources automatically. Quick Search finds an aspect chain without a board.
- **Essentia Planner:** enter the required aspects and quantities; get furnace items, essentia balance, alternative mixes, and a searchable item catalog. Build a mix manually or return to the recommendation.
- **Screenshot import (beta):** recognize a GTNH research screenshot, review the detected cells, and import them into the board.
- **Preferences:** mark favorite or unavailable items. Access-code accounts optionally sync these lists between devices; anonymous preferences stay in the browser.

Routes: `/` for Research Map, `/essentia` for Essentia Planner.

## Stack

| Layer | Implementation |
| --- | --- |
| App | Next.js 16 App Router, React 19, TypeScript 6 |
| Async state and forms | TanStack Query, React Hook Form |
| Compute | Web Workers for board solving, planner search, and screenshot recognition |
| Computer vision | OpenCV.js; image processing and template matching in the browser |
| Storage | Static GTNH catalog; optional PostgreSQL on Supabase for accounts and preferences |
| Tooling | pnpm, Biome, Node test runner, Vercel Analytics |

## Data

- **Research graph:** 69 GTNH aspects, including addon aspects. Every compound connects to both recipe ingredients.
- **Furnace catalog:** 28,006 aspect profiles. 24,066 come from the [GTNH Planner 2.9.0-beta-2 Oracle export](https://github.com/Samiracle64/gtnh-factory-flow); 3,940 are [GTNH Calculator 2.8.0-v5](https://github.com/ShadowTheAge/gtnh-data/tree/2.8.0-v5) fallbacks. A fallback is used only when its registry ID, mod, and normalized name match an item in 2.9 that has no aspect profile. The 2.9 profile takes precedence. Each fallback keeps its source-version label.
- **Coverage index:** 38,097 additional registry items have no aspect profile. They are not treated as furnace sources. Aspect values are never inferred from item names or recipes.
- **Acquisition data:** the 2.9 export indexes 246,983 recipes. Stage-dependent source scores use its machine recipes and crop produce; world sources come from ore entries. Item icons come from exact rendered 2.9 assets or uniquely matched tiles in the [GTNH Calculator 2.7.4 atlas](https://github.com/ShadowTheAge/gtnh-2.7.4).

The generated catalog lives in `public/item-aspects-gtnh.json`. It is shipped with the app, not queried from Supabase.

## Research Map algorithms

1. **Aspect cost.** A primal has raw cost `1`. A compound has raw cost `1 + cost(first ingredient) + cost(second ingredient)`; costs are computed recursively and memoized. Path weight is `1 + log2(raw cost)`, so expensive compounds matter without making them prohibitively costly.
2. **Aspect chain.** The undirected aspect graph excludes disabled aspects. Layered dynamic programming stores the cheapest path to each aspect for each exact step count and caches layers per source. Repeated aspects are allowed. Quick Search checks lengths from shortest upward and chooses the cheapest chain at the first feasible length.
3. **Board route.** Breadth-first search finds the shortest available route through hex cells. Bounded depth-first search enumerates routes of an exact length, with distance pruning; occupied and blocked cells are excluded.
4. **Connection choice.** For every connected-source/remaining-target pair, the solver matches a board route to an aspect chain of the same length. It tests the minimum feasible length and up to two additional cells. Candidates are ranked by intermediate-aspect cost, then new cells, turns, and distance to remaining sources. A route that seals off an unconnected source is rejected.
5. **Whole board.** The best connection is added to the connected set and the process repeats. This is a greedy solver, not a proof of a globally optimal board. Search is capped at 12 routes and 30,000 explored states per length. Progress is streamed from a Web Worker and can be cancelled.

Implementation: [aspect costs](src/features/research-map/model/aspectCosts.ts), [aspect path finder](src/features/research-map/model/aspectGraph.ts), [board routes](src/features/research-map/board/boardRouteSearch.ts), [connection search](src/features/research-map/board/boardConnections.ts), [board solver](src/features/research-map/board/boardSolver.ts).

## Essentia Planner algorithms

The target is a vector of required aspect amounts. Each catalog item contributes its full aspect vector, so a plan can combine different items for different requirements.

- **Source effort:** derived from stage-filtered acquisition scores, recipe depth, and aspect concentration. Favorites receive a low effort score; unavailable items are excluded. Acquisition scores are built by relaxing the machine-recipe and crop graph. They do not model every ordinary crafting recipe, world rarity, or the player's inventory.
- **Practical mix:** candidate pool includes, for each requested aspect, the 40 lowest-effort and 40 best yield-adjusted sources, plus matching favorites. Three greedy aspect orders provide initial plans. A bounded beam search then explores item quantities `1`, `floor(remaining / yield)`, and `ceil(remaining / yield)`. It scores acquisition effort, unwanted essentia, and additional item types; equivalent remaining states are deduplicated and a lower bound guides the beam.
- **Alternatives:** separate construction passes produce mixes such as fewest items and less excess essentia. The catalog exposes all matching sources, including those outside the search shortlist; a manual mix can replace the recommendation.
- **Performance:** the catalog and results are cached, search runs in a Web Worker, and a favorite-only preview can be shown before the full search completes.

The beam keeps 80 states for up to four requested aspects, otherwise 32, for at most 20 expansion rounds. Recommendations are heuristic; they are not guaranteed global optima or promises that an item is obtainable at a selected tier.

Implementation: [acquisition ranking](src/features/essentia/model/itemRanking.ts), [practical search](src/features/essentia/model/practicalSearch.ts), [plan assembly](src/features/essentia/model/buildPlans.ts), [planner worker](src/features/essentia/worker/essentiaPlanner.worker.ts).

## Screenshot recognition (beta)

PNG and JPEG files up to 20 MB are decoded locally and downscaled to at most 2,400 pixels on the longest side. Recognition runs in a browser Web Worker; no screenshot is sent to an image-recognition service.

1. HSV segmentation finds the parchment. Grayscale blur, Canny edges, and polygon contours locate candidate hexagons. A more sensitive pass runs if the first pass is unreliable.
2. Hex size, spacing, center, and radius are estimated from the contours and parchment. Supported radii are 2–7.
3. Aspect icons are matched against scaled templates with OpenCV `matchTemplate` (`TM_CCOEFF_NORMED`). Foreground pixels, hex outlines, and neighboring cells help classify aspect, empty, obstacle, or uncertain cells.
4. The user can correct the radius and cell classifications before importing. Unresolved cells block import. The output matches the board input shape: `{ radius, cells: [{ row, column, type, aspect? }] }`.

This is deterministic computer vision, not a trained model. Small, blurred, cropped, or heavily altered screenshots can fail recognition and require manual correction.

Implementation: [recognition pipeline](src/features/research-map/recognition/recognizeScreenshot.ts), [preprocessing](src/features/research-map/recognition/preprocess.ts), [grid geometry](src/features/research-map/recognition/geometry.ts), [cell classification](src/features/research-map/recognition/classifyCells.ts).

## Run locally

```bash
pnpm install
pnpm dev
```

```bash
pnpm test
pnpm lint
pnpm build
```

## Optional cloud sync

Run the [SQL migrations](supabase/migrations) in order in a Supabase project. The tables are in a private schema and are accessed only through server routes. Put these server-only variables in `.env.local` and in the deployment environment:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL pooler URI with a URL-encoded password and `sslmode=verify-full` |
| `DATABASE_CA_CERT_BASE64` | Base64-encoded Supabase server root certificate |
| `AUTH_CODE_SECRET` | Stable random secret, at least 32 characters; changing it invalidates existing access codes |
| `APP_ORIGIN` | Exact public origin, for example `https://thaumaspects.vercel.app` |

Access codes are the account credential. The server stores a keyed code digest, an encrypted copy for signed-in recovery, and session-token hashes. Without a database, local item preferences still work.

## Regenerate the item catalog

```bash
python3 scripts/build-oracle-catalog.py --data-274 /path/to/2.7.4/data.bin --data-280 /path/to/2.8.0-v5/data.bin --resource-index /path/to/resource-index.json.gz --shards-dir /path/to/recipe-shards --download
python3 scripts/build-acquisition-scores.py --resource-index /path/to/resource-index.json.gz --shards-dir /path/to/recipe-shards
```

Raw Oracle shards and Calculator binaries are build inputs and are not committed.

## Attribution

Research aspect data and artwork derive from [ythri/tcresearch](https://github.com/ythri/tcresearch/tree/gh-pages) and the [jimmon89 GTNH fork](https://github.com/jimmon89/tcresearch), both under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Minecraft and mod textures belong to their respective creators.

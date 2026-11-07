# Thaumaspects

GT New Horizons research map solver and essentia planner.

**Live:** [thaumaspects.com](https://thaumaspects.com/)

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
| Storage | Cloudflare R2 item profiles and icons; optional PostgreSQL on Supabase for accounts and preferences |
| Tooling | pnpm, Biome, Node test runner, Vercel Analytics |

## Data

- **Research graph:** 69 GTNH aspects, including addon aspects. Every compound connects to both recipe ingredients.
- **GTNH 2.9.0 profiles:** 76,825 aspect-bearing item variants from an immutable R2 snapshot. This is the planner's sole item source. Each variant keeps its exact registry ID and exact rendered icon when available. The export marks furnace acceptance as unknown; the planner includes every positive-aspect profile.
- **Item types:** the same export provides item class names used in the practical-source estimate. The site ships no local item catalog or item icons. Old favorite and unavailable keys migrate to stable GTNH 2.9.0 variant keys when a matching item exists. Unmatched saved keys remain stored so they are not silently lost.

The catalog, manifest, and item types are fetched and parsed in a Web Worker. Recommendations and catalog searches run in another worker. The browser loads icons lazily from R2. In local development, a development-only route proxies the catalog files to avoid CORS configuration for `localhost`.

Set `NEXT_PUBLIC_GT_DATASET_BASE_URL` to the immutable snapshot directory URL in `.env.local` for local development and in the Vercel Production environment for deployment. The URL is not committed; it is embedded in the browser bundle at build time. The host must permit cross-origin GET requests from the deployed site. Rebuild after changing the value.

## Research Map algorithms

1. **Aspect cost.** A primal has raw cost `1`. A compound has raw cost `1 + cost(first ingredient) + cost(second ingredient)`; costs are computed recursively and memoized. Path weight is `1 + log2(raw cost)`, so expensive compounds matter without making them prohibitively costly.
2. **Aspect chain.** The undirected aspect graph excludes disabled aspects. Layered dynamic programming stores the cheapest path to each aspect for each exact step count and caches layers per source. Repeated aspects are allowed. Quick Search checks lengths from shortest upward and chooses the cheapest chain at the first feasible length.
3. **Board route.** Breadth-first search finds the shortest available route through hex cells. Bounded depth-first search enumerates routes of an exact length, with distance pruning; occupied and blocked cells are excluded.
4. **Connection choice.** For every connected-source/remaining-target pair, the solver matches a board route to an aspect chain of the same length. It tests the minimum feasible length and up to two additional cells. Candidates are ranked by intermediate-aspect cost, then new cells, turns, and distance to remaining sources. A route that seals off an unconnected source is rejected.
5. **Whole board.** The best connection is added to the connected set and the process repeats. This is a greedy solver, not a proof of a globally optimal board. Search is capped at 12 routes and 30,000 explored states per length. Progress is streamed from a Web Worker and can be cancelled.

Implementation: [aspect costs](src/features/research-map/model/aspectCosts.ts), [aspect path finder](src/features/research-map/model/aspectGraph.ts), [board routes](src/features/research-map/board/boardRouteSearch.ts), [connection search](src/features/research-map/board/boardConnections.ts), [board solver](src/features/research-map/board/boardSolver.ts).

## Essentia Planner algorithms

The target is a vector of required aspect amounts. Each catalog item contributes its full aspect vector, so a plan can combine different items for different requirements.

- **Source effort:** estimates simplicity from the exported item class and aspect concentration. Ordinary base-game items and raw material classes start cheaper than complex blocks or modded items; NBT variants, potions, and equipment receive a penalty. Favorites receive a discount and unavailable items are excluded. The current export does not contain reliable world-source or progression data, so the old tier control is hidden.
- **Practical mix:** candidate pool includes, for each requested aspect, the 40 lowest-effort and 40 best yield-adjusted sources, plus matching favorites. Three greedy aspect orders provide initial plans. A bounded beam search then explores item quantities `1`, `floor(remaining / yield)`, and `ceil(remaining / yield)`. It scores estimated source effort, unwanted essentia, and additional item types; equivalent remaining states are deduplicated and a lower bound guides the beam.
- **Alternatives:** separate construction passes produce mixes such as fewest items and less excess essentia. The catalog exposes all matching sources, including those outside the search shortlist; a manual mix can replace the recommendation.
- **Performance:** the catalog and results are cached, search runs in a Web Worker, and a favorite-only preview can be shown before the full search completes.

The beam keeps 80 states for up to four requested aspects, otherwise 32, for at most 20 expansion rounds. Recommendations are heuristic; they are not guaranteed global optima or promises that an item is obtainable at a selected tier.

Implementation: [source ranking](src/features/essentia/model/itemRanking.ts), [practical search](src/features/essentia/model/practicalSearch.ts), [plan assembly](src/features/essentia/model/buildPlans.ts), [planner worker](src/features/essentia/worker/essentiaPlanner.worker.ts).

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

The `scripts/` directory contains the previous Oracle and icon generation tools. They are not part of the active catalog loading path.

## Attribution

Research aspect data and artwork derive from [ythri/tcresearch](https://github.com/ythri/tcresearch/tree/gh-pages) and the [jimmon89 GTNH fork](https://github.com/jimmon89/tcresearch), both under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Minecraft and mod textures belong to their respective creators.

# Thaumaspects

Thaumaspects is a GTNH research and essentia companion built with Next.js. It is based on the open-source [ythri/tcresearch](https://github.com/ythri/tcresearch/tree/gh-pages) repository: its connection-finding logic, aspect data, and artwork were brought over and adapted into the site.

Website: [thaumaspects.vercel.app](https://thaumaspects.vercel.app/)

The helper finds aspect connections for GTNH research. In addition to quick chain searching, it includes an interactive research map where you can drag aspects, place obstacles, and automatically build routes.

> **Technical note:** the project was developed iteratively, with priority given to validating the interface and research-map mechanics. As the feature set stabilizes, the application structure will be refined and parts of the implementation modularized.

## Features

- GTNH-focused research map using Thaumcraft aspect relationships.
- All 69 GTNH research aspects, including Forbidden Magic, Magic Bees, GregTech, Avaritia, Thaumic Boots, and GTNH additions.
- Chain search that accounts for unavailable aspects.
- An interactive, resizable hex map with drag-and-drop and obstacles.
- Automatic route building and visualization on the map.
- Essentia planner: enter one or more required aspects and get item quantities, totals, and alternative sets for the alchemical furnace.
- Optional access-code sign-in and cloud favorites shared across devices.

## Essentia data

The planner contains **24,066 item profiles** from the `essentia_smelting` aspect entries in the [GTNH Planner 2.9.0-beta-2 Oracle dataset](https://github.com/Samiracle64/gtnh-factory-flow), plus **3,940 fallback profiles** from the [official GTNH Calculator 2.8.0-v5 data export](https://github.com/ShadowTheAge/gtnh-data/tree/2.8.0-v5). Fallback profiles are imported only when the 2.9 registry ID, mod and display name all match and the 2.9 aspect profile is absent. The 2.9 profile always takes precedence. All 28,006 profiles participate in planning; fallback entries are marked as GTNH 2.8.0 in the UI. The searchable coverage index also includes items in the 2.9 registry without an aspect profile. Names, families and crafting recipes are never used to invent aspects. Exported aspect tags do not independently verify furnace behavior in a running 2.9 client.

The default plan searches combinations with a bounded beam search, so different requested aspects may come from different items. A generic acquisition score is calculated from the available machine-recipe and crop graph for the selected tier; it considers ingredients, processing depth and renewable crop harvests. The Oracle export has no ordinary crafting recipes, so the score cannot account for a simpler crafting route. The planner also accounts for aspect concentration, unwanted essentia and the number of item types, keeping low-yield everyday materials ahead of concentrated artifacts in the default plan. There are no per-item bonuses, exclusions, or hand-entered aspect profiles. Players can mark stockpiled items or exclude unavailable ones. Acquisition is an estimate: the dataset does not know world rarity, the player's inventory, or all progression gates, and the bounded search does not prove a global optimum.

The result panel has a searchable source picker across every item containing a requested aspect. Exact item names appear first, and selecting a source immediately builds a custom furnace plan. The short list of recommended alternatives is deliberately ranked; it does not hide the remaining matching profiles from the source picker.

The catalog contains 69 aspects. Item pictures use the [GTNH Calculator 2.7.4 atlas](https://github.com/ShadowTheAge/gtnh-2.7.4) when a name and mod have a unique match, otherwise the exact rendered icon from the 2.9 resource index. Atlas tiles are served individually through `/api/atlas-icons/[id]`; aspect and item pictures use Next.js `Image` optimization. A small number of items have no icon in either source and show initials instead. The picker also shows initials when an aspect icon is unavailable. Minecraft and mod textures belong to their respective creators.

To regenerate the catalog from the downloaded Oracle resource index and recipe shards, GTNH Calculator 2.8.0-v5 binary, and GTNH Calculator 2.7.4 icon atlas index:

```bash
python3 scripts/build-oracle-catalog.py --data-274 /path/to/2.7.4/data.bin --data-280 /path/to/2.8.0-v5/data.bin --resource-index /path/to/resource-index.json.gz --shards-dir /path/to/recipe-shards --download
python3 scripts/build-acquisition-scores.py --resource-index /path/to/resource-index.json.gz --shards-dir /path/to/recipe-shards
```

The generator validates unique registry IDs and preserves the source version of every fallback profile. The raw Oracle shards and calculator binaries are build inputs and are not committed. The planned infusion-recipe picker is outside the current scope.

## Getting started

The Research Map is at `/`, and the Essentia Planner is at `/essentia`. Quick Search remains available from the Research Map.

```bash
pnpm install
pnpm dev
```

For a production build:

```bash
pnpm build
```

Code style is checked with Biome. Run `pnpm lint` to check the project or `pnpm format` to format source files and organize imports. Generated catalogs and game assets are excluded.

## Cloud favorites (Supabase)

Anonymous favorites continue to work in local storage. To enable accounts and cross-device sync:

1. Create a Supabase project and run [`supabase/migrations/001_auth_favorites.sql`](supabase/migrations/001_auth_favorites.sql) in its SQL editor. If you ran an earlier version of that migration, also run [`supabase/migrations/002_recoverable_access_codes.sql`](supabase/migrations/002_recoverable_access_codes.sql). The tables live in a private schema and are accessed only by Next.js server routes.
2. Set the server environment variables below locally in `.env.local` and in the deployment environment. Never prefix them with `NEXT_PUBLIC_`.
3. Restart the server. Click the key icon in the header, then create an access code or enter an existing one. The account menu shows the code and lets you copy it while signed in. Existing accounts created before migration must confirm their code once to enable this view; signing in with the code also does this automatically.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **Session or Transaction pooler** PostgreSQL URI with a URL-encoded password and TLS verification (`sslmode=verify-full`). The Node `pg` pool uses one connection and unnamed parameterized queries. |
| `DATABASE_CA_CERT_BASE64` | Base64-encoded contents of the **Server root certificate** downloaded from Supabase **Database Settings → SSL Configuration**. For example, `base64 -i /path/to/certificate.crt \| tr -d '\n'` on macOS. |
| `AUTH_CODE_SECRET` | Stable, private, random secret of at least 32 characters, for example the output of `openssl rand -hex 32`. Changing it makes existing access codes unusable. |
| `APP_ORIGIN` | Exact public origin, such as `https://thaumaspects.vercel.app`, with no trailing slash. Required in production for CSRF origin checks. Set to `http://localhost:3000` for local development when needed. |

The sign-in code is the only account credential. Losing it **and** all signed-in sessions permanently loses access to that account. Server rate limits cover registration and login; no Supabase Auth account or additional service is needed. Account sessions last 30 days and can be used on several devices. The API stores an HMAC code digest plus an AES-GCM encrypted copy for signed-in recovery, and stores only session token hashes. Favorites are queried by the authenticated user's ID. Keep `AUTH_CODE_SECRET` stable and private: it is required both to validate and decrypt existing codes.

The first sign-in merges anonymous local favorites with the cloud account once. Later visits use the cloud state, so an item removed on another device stays removed. Offline changes are queued locally and retried when connectivity returns. Availability exclusions and progression tier remain local settings.

TanStack Query keeps session, access code, and favorite responses in the current browser tab. The code is fetched once when restoring an account that is not already in the local recent-code list, or taken directly from a successful sign-in or registration response. The three most recently used unique access codes are stored unencrypted in this browser's `localStorage` until removed in the sign-in menu or cleared with browser data. Pending favorite edits are sent in batches; the returned list updates the cache without a follow-up GET. A visible tab refreshes remote favorites when its cached list is older than one minute.

The GTNH item catalog is also cached for 30 minutes after leaving the planner, so switching between the map and planner does not download and prepare it again.

## Attribution and license

The original [ythri/tcresearch](https://github.com/ythri/tcresearch/tree/gh-pages) project is licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). This project preserves the required attribution; the transferred aspect data, artwork, and core search logic originate from that repository. Additional GTNH aspect definitions and icons come from the [jimmon89/tcresearch GTNH fork](https://github.com/jimmon89/tcresearch), also under Creative Commons Attribution 4.0.

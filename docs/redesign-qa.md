# Redesign behavior inventory and verification

The planner's data source and recommendation algorithm were kept intact. This inventory records the actions and states present before the UI redesign and how they were checked afterward.

| Existing behavior | Verification |
| --- | --- |
| Add and remove requirement rows; search and choose aspects | Browser: mouse selection, keyboard search with ArrowDown and Enter, row add and remove |
| Edit amounts; zero and large values | Browser: zero shows the empty request state; 1,000 stays within the layout |
| Select a progression tier | Browser: LV and No machines selection |
| Show loading, load error, empty request, and no matching plan | Loading copy inspected in the component; browser: induced catalog failure, zero amounts, and Custom1 at No machines |
| Recommend a practical item mix | Browser: 16 Ignis + 16 Potentia → 8 Coal; adding 16 Terra → 8 Coal + 8 Stone; 18 Aer → 18 Sugar Canes |
| Show alternatives and allow choosing one | Browser: chose the Charcoal alternative and checked the result |
| Search sources, page through them, and open the full catalog | Browser: source search, 12 → 24 rows, no matches, catalog handoff with query and focus |
| Build a manual mix from sources or catalog, edit counts, restore recommendation | Browser: Feather 18 → 17 → restore; Coal selected from catalog → 9 → restore |
| Exclude an unavailable item and restore it | Browser: excluded Charcoal, then restored it from My sources |
| Prefer an abundant item and remove the preference | Browser: preferred Coal, reloaded, found the saved preference, and removed it |
| Show progress, shortage, excess, and byproducts | Browser: checked full coverage, Aer shortage after reducing Feather, excess and byproducts for Sugar Canes |
| Browse full dataset; search, filter, sort, and page | Browser: Coal search, Entire catalog filter, Name sort, 30 → 60 rows |
| Show duplicate variants, source version, icons, unprofiled matches, and data notes | Browser: Coal Ore variants, Steel Bolt GTNH 2.8.0 badge, rendered icons, Enderios unprofiled search, expanded data note |
| Expand aspect tags when a source has more than six aspects | Handler retained. The current dataset has no item with more than six aspects, so this control has no runtime case. |

Research Map was checked separately: aspect placement by click and drag, empty cell open ↔ blocked by mouse and Enter, drag without an accidental toggle, source selection, manual connection, auto-connect, resizing, clearing, aspect restriction controls, addon toggles, and Quick Search. The original flat-top hex geometry constants and coordinates were preserved.

Visual checks used 1440 × 900 and 390 × 844 viewports. The phone pages had no document-level horizontal overflow. The interface source and visible accessibility labels contained no Cyrillic text. `npm run build`, `npm run lint`, and `git diff --check` passed.

## Planner UX correction

The recipe input now spans the workspace, with a custom tier picker beside the aspect rows. Each removal control is 44 × 44 px, and the aspect and tier chevrons are centered SVGs. The furnace mix and essentia balance sit in separate columns on desktop and stack on phones. Alternatives initially show three mixes, with an explicit action to reveal the rest; the selected mix stays visible when the list is collapsed. The catalog's search and custom sort controls share a desktop baseline, and favorite stars occupy their own centered square buttons.

After this correction, browser checks repeated the Coal recommendation for 16 Ignis + 16 Potentia, the Coal + Stone mix after adding 16 Terra, and Sugar Canes for 18 Aer. A manual Dirt mix was incremented and restored to the automatic recommendation. The tier picker worked with mouse and keyboard; catalog sorting and favorite controls worked with mouse. A popover stacking issue found during this check was fixed. Desktop and mobile screenshots were saved, and the mobile page had no document-level horizontal overflow.

## Compact workspace and amount input

The site header and primary navigation share one row on desktop. Research Map and Essentia Planner begin near the top of the viewport; the mobile navigation uses a second compact row. The planner once again places a vertical requirement list beside the furnace output. The furnace mix appears before its essentia balance in the right column.

Amount inputs allow an empty editing state, select their value on focus, accept digits from the numeric keyboard, normalize on blur, and provide minus and plus controls. Browser checks covered clearing, direct typing, keyboard ArrowDown, the 0–1,000 limit, and manual mix quantity changes. Large requests run the unchanged recommendation function in a worker; at 1,000 the input remained responsive while calculation was pending, and a 129 Ignis request completed with a result. The 16 Ignis + 16 Potentia recommendation and manual mix restore path still worked. Desktop and 390 px mobile layouts were inspected with no document-level horizontal overflow.

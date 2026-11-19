# Strange Brigade - Ancient Weapons editor verification

Date: 2026-11-19. Source: ArtStation `4bWXz2`. Slug: `strange-brigade-ancient-weapons`. Scope: actual native DS Gallery Editor v0.11 against isolated scratch files. No repository, immutable stage, source, service, website, or deployment changes.

## Explicit result

**Passed:** actual installed DS Gallery Editor v0.11 resolved 13 Included original JPG entries and rendered every one of the 13 individually selected previews. An adjacent reorder persisted through explicit Save and Open-folder/reopen. Canonical image-only array data and exact filename case/order were restored and explicitly saved. All 13 original SHA-256 values match stage and the pre-UI baseline; all 36 stage files retain exact hashes and sizes. No embed companion existed or was generated.

**Failed:** none of the required editor acceptance checks.

**Unverified by this lane:** browser interaction, publication, deployed delivery, global capture-helper termination, and yellow-frame disappearance. The root release owner handles these gates. This delegate's CUA kernel reset passed immediately after the final required screenshot.

## Isolation and native cycle

Read the Computer Use skill, guidance, confirmation policy and API reference, the current repository `galleries/AGENTS.md`, and the established Strange Brigade editor report before controlling the editor.

Copied only staged canonical `gallery.json` into `editor-check/portfolio-media/galleries/strange-brigade-ancient-weapons/` and its 13 JPG originals into sibling `editor-check/portfolio-media-private/public/strange-brigade-ancient-weapons/`. The immutable stage was never edited. Snapshotted all stage hashes before UI work.

Launched one new installed editor instance from the returned application inventory. Selected exactly one new returned window, ID `2301318`, absent from the pre-launch inventory. Existing editor windows `198164` and `4922266` were preserved. The new editor footer visibly read `v0.11`.

Opened the scratch gallery and observed `13 entries` with the scratch private-original path automatically resolved. The selected lead `digital-shamans-crossbow-03.jpg` rendered actual image content; all 13 rows were Included.

Moved the first entry down one position and explicitly clicked Save. The title's dirty marker cleared and status read `Saved gallery.json.` The filesystem snapshot confirmed exactly the first two entries exchanged, 13 image-only entries total. Opened the same scratch folder again: the reordered first two entries persisted and the new lead `digital-shamans-melee-spear-01.jpg` rendered.

Moved that lead down one position to restore canonical order, explicitly clicked Save, and confirmed exact canonical array data/case/order on disk. Notified root immediately that the roundtrip gate passed, before completing the remaining previews.

The first two previews were confirmed during the roundtrip. Individually selected canonical row 3, then used focused grid Down navigation one row at a time through row 13. Each corresponding JPG filename and actual image content were visible without missing-image or decode placeholders. The last preview was `digital-shamans-shield-03.jpg`.

## Bounded recovery

The initial generic CUA element click reported unavailable input geometry. Recovered using the documented `@oai/sky` APIs inside the CUA session, bound to the same returned owned window, with explicit activation. A folder-dialog element coordinate exceeded parent-window bounds; the actual returned second screenshot represented the modal, so its screenshot ID and observed coordinates selected the folder successfully. No input timeout or unbounded retry occurred. All CUA calls used 15-second call deadlines. No native Chrome or user prompt was used.

## File integrity and output

`editor-check/final-check.json` records:

- 13 saved, unique, exact-case references and an image-only array.
- Exact canonical source order/case/data after the editor save.
- Matching pre-UI, scratch and stage SHA-256 values for all 13 originals.
- Exact unchanged size/hash for all 36 stage files.
- No `gallery-embeds.json` in stage or scratch; scratch public gallery contains only `gallery.json`.
- Canonical editor output retained as `editor-check/gallery-after-editor-save.json`, SHA-256 `de11d3ac98c014b002fed73a6ae09b6a601dcbbdb6b1c8ac030cca377a416680`.
- The editor changed JSON formatting while preserving canonical image data. After UI ended, canonical source bytes were restored only in scratch. Final scratch `gallery.json` is byte-identical to stage, SHA-256 `2f96b391aaf6adf82d3f1c88b114f1864f7f1f717b736d24d8712260a5e66af0`.

Other evidence: `canonical-gallery.json`, `original-hashes.json`, `stage-hashes.json`, `media-hash-check.csv`, `gallery-after-reorder.json`, `reorder-save-check.json`, and `canonical-save-check.json`, all under `editor-check/`.

## Capture finalization

Immediately after observing the final preview screenshot, submitted CUA completion summary `Verified native gallery editor roundtrip`, then called `cua_repl.js_reset`; the tool confirmed `js kernel reset`. No separate `node_repl` session was used. No further screenshot, native observation, capture initialization, or UI input occurred afterward.

Notified root that the native capture owner was done. This delegate stopped no processes. Root owns verified global helper release after all UI work. No yellow-frame disappearance claim is inferred from kernel reset or process counts.

## Individual previews

| Position | Canonical JPG | Native preview |
|---:|---|---|
| 1 | `digital-shamans-crossbow-03.jpg` | Rendered |
| 2 | `digital-shamans-melee-spear-01.jpg` | Rendered |
| 3 | `digital-shamans-melee-spear-03.jpg` | Rendered |
| 4 | `digital-shamans-long-sword-03.jpg` | Rendered |
| 5 | `digital-shamans-long-sword-04.jpg` | Rendered |
| 6 | `digital-shamans-souls-gathering-amulet-05.jpg` | Rendered |
| 7 | `digital-shamans-pirate-scimitar-02ab.jpg` | Rendered |
| 8 | `digital-shamans-stx-10.jpg` | Rendered |
| 9 | `digital-shamans-stx-14.jpg` | Rendered |
| 10 | `digital-shamans-stx-17b.jpg` | Rendered |
| 11 | `digital-shamans-shield-04-impr03.jpg` | Rendered |
| 12 | `digital-shamans-shield-02.jpg` | Rendered |
| 13 | `digital-shamans-shield-03.jpg` | Rendered |

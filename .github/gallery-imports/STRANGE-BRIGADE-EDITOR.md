# Strange Brigade - Environment Art editor verification

Date: 2026-11-19. Scope: ArtStation `Vd5Vg5`, slug `strange-brigade-environment-art`, isolated scratch only. No repository, immutable stage, service, website, caption metadata, commit, or deployment changes.

## Explicit result

**Passed:** actual installed DS Gallery Editor v0.11 resolved all 33 Included original JPG entries and rendered every one of the 33 individually selected previews. An adjacent reorder persisted through explicit Save and Open-folder/reopen. Canonical image-only array data, source filename case and order were restored and saved. All 33 original SHA-256 values match stage and the pre-UI baseline.

**Failed:** none. No native UI blocker or timeout occurred.

**Unverified by this lane:** caption/page rendering, publication, browser interaction, deployed media delivery, global capture-helper termination, and yellow-frame disappearance. The release owner handles those checks. This delegate's CUA/kernel reset passed immediately after the final required screenshot.

## Isolated inputs

The scratch public gallery folder is `editor-check/portfolio-media/galleries/strange-brigade-environment-art/`, with sibling originals at `editor-check/portfolio-media-private/public/strange-brigade-environment-art/`. Both were copied from the corresponding immutable stage inputs. The genuine empty source record at position 2 is omitted; the canonical array contains 33 actual JPG references. No embeds were expected, and no `gallery-embeds.json` existed or was generated.

Root preserves the 33 per-image source captions separately in page metadata. This editor test intentionally used the staged image-only manifest; it neither implemented nor edited captions. The post-editor array contains only the `image` property for every entry.

## Actual native cycle and previews

Read the current `galleries/AGENTS.md`, including automatic capture cleanup, before UI work. Used the established Computer Use skill and documented `@oai/sky` APIs in `cua_repl`, with 15-second calls and one input followed by fresh observation. No Chrome was used.

Launched the known v0.11 executable and selected exactly one newly returned empty editor window absent from the pre-launch inventory, preserving existing user editor windows/documents. The footer visibly read `v0.11`.

Opened the scratch gallery. The status bar showed `33 entries` and automatically resolved the scratch private-original folder. The lead `digital-shamans-1-impr-03-srgb.jpg` rendered; `digital-shamans-2-impr-03-srgb.jpg` followed in the canonical list.

Moved the lead down one position, explicitly clicked Save, and observed `Saved gallery.json.` with the dirty marker cleared. The saved filesystem snapshot confirmed exactly the first two image positions exchanged, with count 33. Used Open folder to select the same scratch gallery again: the reordered entries persisted and the new lead preview rendered.

Reversed the adjacent exchange, explicitly saved canonical order, and observed the saved status. Sent the early roundtrip gate to root immediately after this cycle. The first two previews were confirmed during the cycle; then individually selected canonical row 3 through row 33 using focused grid navigation. Every JPG displayed actual image content without a missing-file or decode placeholder. The final preview was `digital-shamans-rightwing-room-02-srgb.jpg`.

## Final file checks

`editor-check/final-check.json` records 33 saved/unique references, an image-only saved array, exact canonical source data/case/order, all exact-case references resolved, all original hashes unchanged, and stage still matching the pre-UI original baseline.

The editor preserved canonical image data but changed JSON formatting. Its canonical output is retained as `gallery-after-editor-save.json`. Restored original canonical manifest bytes into scratch after UI work ended. Final scratch `gallery.json` is byte-identical to stage, SHA-256 `f5b3f6d43333b7d034b9a64f01594d070c6a464adec2425ade7769311c8278da`. The scratch public gallery folder contains only `gallery.json`.

Supporting scratch files: `canonical-gallery.json`, `original-hashes.json`, `media-hash-check.csv`, `reorder-save-check.json`, `gallery-after-reorder.json`, `gallery-after-editor-save.json`, and `final-check.json`.

## Capture finalization and handoff

Immediately after the last preview screenshot, submitted the CUA completion summary and called `cua_repl.js_reset`; the tool confirmed `js kernel reset`. No separate `node_repl` session was used. No screenshot, native observation, capture initialization, or app input followed the reset.

Explicitly notified root that this native UI phase and reset were complete. Root records and stops exact verified helper identities after all UI. This delegate stopped no processes and makes no yellow-frame disappearance claim.

## Individual preview checklist

| Position | Canonical JPG | Native preview |
|---:|---|---|
| 1 | `digital-shamans-1-impr-03-srgb.jpg` | Rendered |
| 2 | `digital-shamans-2-impr-03-srgb.jpg` | Rendered |
| 3 | `digital-shamans-3-impr02-srgb.jpg` | Rendered |
| 4 | `digital-shamans-4-impr02-srgb.jpg` | Rendered |
| 5 | `digital-shamans-5-impr04-srgb.jpg` | Rendered |
| 6 | `digital-shamans-7-impr-srgb.jpg` | Rendered |
| 7 | `digital-shamans-12-impr-srgb-denoised.jpg` | Rendered |
| 8 | `digital-shamans-13-impr-srgb-denoised.jpg` | Rendered |
| 9 | `digital-shamans-14-impr02-srgb.jpg` | Rendered |
| 10 | `digital-shamans-15.jpg` | Rendered |
| 11 | `digital-shamans-16.jpg` | Rendered |
| 12 | `digital-shamans-17.jpg` | Rendered |
| 13 | `digital-shamans-outdoor-02-impr-denoised-srgb.jpg` | Rendered |
| 14 | `digital-shamans-checkpoint-before-passage-of-death-07-impr-denoised-srgb3.jpg` | Rendered |
| 15 | `digital-shamans-starting-corridor-05-impr02-srgb.jpg` | Rendered |
| 16 | `digital-shamans-starting-corridor-03-impr-denoised-impr-srgb.jpg` | Rendered |
| 17 | `digital-shamans-main-hall-01-impr-denoised-srgb.jpg` | Rendered |
| 18 | `digital-shamans-main-hall-03-impr-srgb.jpg` | Rendered |
| 19 | `digital-shamans-the-moon-corridor-02-srgb.jpg` | Rendered |
| 20 | `digital-shamans-entry-room-to-corridor-09m-impr-srgb.jpg` | Rendered |
| 21 | `digital-shamans-entry-room-to-corridor-08impr-denoised-srgb.jpg` | Rendered |
| 22 | `digital-shamans-the-moon-corridor-10-impr03-srgb.jpg` | Rendered |
| 23 | `digital-shamans-the-moon-corridor-12b-impr-srgb.jpg` | Rendered |
| 24 | `digital-shamans-corridor-05m-too-orangy-impr04-srgb.jpg` | Rendered |
| 25 | `digital-shamans-entry-room-to-corridor-01c-impr02-srgb.jpg` | Rendered |
| 26 | `digital-shamans-corridor-01-srgb.jpg` | Rendered |
| 27 | `digital-shamans-corridor-04b-srgb.jpg` | Rendered |
| 28 | `digital-shamans-entry-room-to-corridor-10-impr03-denoised-srgb.jpg` | Rendered |
| 29 | `digital-shamans-the-moon-corridor-04m-mirror-impr-srgb.jpg` | Rendered |
| 30 | `digital-shamans-rightwing-room-03-impr-srgb.jpg` | Rendered |
| 31 | `digital-shamans-corridor-06-mirror-impr02-srgb.jpg` | Rendered |
| 32 | `digital-shamans-circle-room-01-impr4-denoised-srgb.jpg` | Rendered |
| 33 | `digital-shamans-rightwing-room-02-srgb.jpg` | Rendered |

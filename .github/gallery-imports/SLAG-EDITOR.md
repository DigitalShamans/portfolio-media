# Slag editor verification

Client date: 2026-11-20, Europe/Bucharest. Source: ArtStation `8eAEq`. Title/slug: `Slag` / `slag`. Scope: actual installed DS Gallery Editor v0.11 against isolated scratch only. No repository, immutable stage, source, service, website, Git, or deployment changes.

## Explicit result

**Passed:** the native editor resolved 11 Included JPG originals, displayed the final Slag Sketchfab companion row, and rendered all 11 individually selected image previews. Adjacent reorder, explicit Save, actual folder reopen persistence, canonical order restoration, and explicit Save passed. Exact image-only schema/order/case and all original hashes passed. The actual 197-byte `gallery-embeds.json` remained byte-identical throughout the saves; its anchor remains after the canonical final JPG. All 33 actual stage files retain exact sizes/hashes.

**Failed:** none. No native input error, timeout, or recovery occurred.

**Unverified by this lane:** Sketchfab model playback/browser interaction, publication, deployed delivery, global capture-helper termination, and yellow-frame disappearance. Root owns these gates. This capture owner's CUA reset succeeded immediately after the final required screenshot.

## Isolated inputs

Scratch gallery: `editor-check/portfolio-media/galleries/slag/`. Sibling originals: `editor-check/portfolio-media-private/public/slag/`. Copied the staged canonical `gallery.json`, actual staged `gallery-embeds.json`, and all 11 exact original JPGs. Stage was never edited. Before UI work, recorded all stage file hashes/sizes and companion bytes/hash/anchor.

The image-only array contains 11 actual JPG references; the genuine empty second source container is separate provenance. The one companion entry is type `sketchfab`, id `364b9214850549f29d2400b733f95693`, title/caption `Slag`, anchored after `artur-perzyna-artur-perzyna-2014-compose1-denoised.jpg`.

## Actual native cycle

Read current `galleries/AGENTS.md` and applied the already-read Computer Use skill, guidance, confirmation policy, documented APIs, and established workflow. Used documented `@oai/sky` inside CUA with 15-second calls and one input followed by fresh observation. No native Chrome, user prompt, or separate node session was used.

Launched the installed application from its returned inventory, then selected exactly one new empty editor window, ID `270074`, absent from the initial inventory. Existing editor windows `7604316`, `2301318`, `198164`, and `4922266` were preserved. The footer visibly read `v0.11`. OBS and other unrelated applications were untouched.

Opened the isolated gallery through the native folder picker using its returned dialog screenshot ID. The editor automatically resolved the isolated sibling originals, showed `11 entries`, and displayed all 11 JPG rows as Included. A separate final row displayed `Slag` / `Sketchfab`. The lead `artur-perzyna-artur-perzyna-2014-compose4-abstract-denoised.jpg` rendered actual image content.

Moved the lead down one position and explicitly clicked Save. The dirty marker cleared and status read `Saved gallery.json.` File checks confirmed exactly the first two positions exchanged, 11 image-only entries total, and unchanged companion bytes. Reopened the same folder through Open folder; the reordered positions persisted and new lead `artur-perzyna-artur-perzyna-2014-compose2-blue-denoised.jpg` rendered.

Moved that lead down one position to restore canonical source order and explicitly clicked Save again. Exact canonical data/case/order and companion hash passed on disk. Sent the early roundtrip gate to root before the remaining previews.

Individually selected canonical row 3, then used focused grid Down navigation through row 11. Every corresponding filename and actual image appeared without a missing-file or decode placeholder. The final selected preview was `artur-perzyna-artur-perzyna-2014-compose1-denoised.jpg`, followed visibly in the list by the retained Sketchfab row. The model itself was not launched or exercised in this native lane.

## Integrity and retained outputs

`editor-check/final-check.json` records 11 unique exact-case references, image-only schema, canonical source order/data, all 11 unchanged original hashes, all 33 unchanged stage files, literal companion-byte equality and stable final-image anchor.

The editor changed image-manifest formatting while preserving source data. Its canonical output is retained as `editor-check/gallery-after-editor-save.json`, SHA-256 `ec354c7fe56d2a5726732e7133d3141ef1a576de4d8c8a17278bac2335381fa6`. After UI work ended, restored canonical manifest bytes only in scratch. Final scratch `gallery.json` is byte-identical to stage, SHA-256 `1d3dc1de575d92a0f6aeedf1061e41e82fd90b1609ff164861285dff2b1951d3`.

Companion preserved as-is: 197 bytes, SHA-256 `c84a23466296794973cac2f4232193f470209e2b0d30af6aa225132c3d80da80`. Direct byte comparison against the pre-UI copy, exact stage hash and byte size all passed. Its retained after-editor copy is `editor-check/gallery-embeds-after-editor.json`. No companion restoration or rewrite was needed.

Supporting evidence under `editor-check/`: `canonical-gallery.json`, `canonical-gallery-embeds.json`, `companion-before.json`, `original-hashes.json`, `stage-hashes.json`, `media-hash-check.csv`, `gallery-after-reorder.json`, `reorder-save-check.json`, `canonical-save-check.json`, and `check-final.ps1`. Scratch gallery contains exactly `gallery.json` and `gallery-embeds.json`.

## Capture finalization

Immediately after inspecting the final native screenshot, submitted CUA completion summary `Verified Slag native editor roundtrip`, then called `cua_repl.js_reset`; the tool confirmed `js kernel reset`. No separate `node_repl` session was used. No further native input, observation, screenshot, or capture initialization occurred afterward.

Notified root that the native capture owner was done. No helper or application process was stopped by this lane. Root handles exact verified Codex helpers globally after live checks, preserving unrelated recorders. Kernel reset does not establish yellow-frame disappearance; no such visual claim is made.

## Individual previews

| Position | Canonical JPG | Native preview |
|---:|---|---|
| 1 | `artur-perzyna-artur-perzyna-2014-compose4-abstract-denoised.jpg` | Rendered |
| 2 | `artur-perzyna-artur-perzyna-2014-compose2-blue-denoised.jpg` | Rendered |
| 3 | `artur-perzyna-2014-compose4-canyon.jpg` | Rendered |
| 4 | `artur-perzyna-artur-perzyna-2014-compose3-denoised.jpg` | Rendered |
| 5 | `artur-perzyna-artur-perzyna-2014-compose5-bw-new-denoised.jpg` | Rendered |
| 6 | `artur-perzyna-2014-compose6.jpg` | Rendered |
| 7 | `artur-perzyna-2014-compose7.jpg` | Rendered |
| 8 | `artur-perzyna-2014-compose10.jpg` | Rendered |
| 9 | `artur-perzyna-2014-compose9-day.jpg` | Rendered |
| 10 | `artur-perzyna-artur-perzyna-2014-compose8-night-denoised.jpg` | Rendered |
| 11 | `artur-perzyna-artur-perzyna-2014-compose1-denoised.jpg` | Rendered |

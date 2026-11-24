# Firearms verification

Scope: Firearms only. Checked 19 November 2026. Published and verified on both portfolio routes.

Studio: https://digitalshamans.co.uk/galleries/firearms/

Personal: https://digitalshamans.co.uk/artur/galleries/firearms/

Implementation `87bb41b30d636eb1ecaccd02129be927a927fb69`, PR #56. Full Pages validation, Ruby/Jekyll build and deployment completed successfully: https://github.com/DigitalShamans/portfolio-media/actions/runs/44529823521

## Bounded checkpoints and source

- Baseline `3583b8069a28d2ab3edda4f5590e02a27cf442df`, source/status checkpoint `87caa40`. Existing map/GSAP navigation changes and completed gallery reports are preserved.
- Rendered ArtStation `58QBOJ` contains 20 JPGs and a native MP4 at position 2, after the lead image. Actual source download links, stable image/video IDs, order, dimensions, byte counts, SHA-256 and Git blob hashes are archived in the private source manifest. Temporary signed iframe URLs are not committed.
- Private source checkpoint `5a01cc02634c80aa65f8c60a15f6d942b7e8a730`; private PR #4 merged as approved revision `3b580d05d7955009fb0f9f4138c1df79f486ff10`. Only the 20 JPGs are added to the originals delivery allowlist; the native MP4 is archived privately and delivered as an approved public website file.
- Images are six 2560×1366 and fourteen 1920×1080. No genuine 3840×2160 source image is verified, including files whose source variant is labelled `4k`. Original bytes are preserved without upscaling.
- Native MP4 is 2560×1440, 18.5 seconds, 27,253,962 bytes; SHA-256 `95d6742e969bd380242912f553b8cf834b5d122f25e4d82f2786be0bee80a99a`, Git blob `cc7798d6711514dac3a4a4ec8ddf08e4b79f10e1`. Exact public copy; no transcode. Container metadata was independently parsed.

## Media and original service — passed

- All 20 source JPGs decode and match exact source dimensions, approved bytes, SHA-256 and Git blobs. Twenty corresponding WebPs decode, retain exact filename case/source image order/ICC profiles and match the existing Pillow 13 EXIF-transpose/Lanczos fit-within-2560×1440/quality-92/method-6 recipe without crop/upscale. Total WebP bytes: 6,235,386. Media checkpoint `7a08fa4`.
- Existing public media service v8 source `8f51841777c92bcc2aa69cc9fdab7a5210bb0f28`, deployment `appgdep_6afeeeb85be481918250886d37504e02`, succeeded at `2026-11-19T12:42:45Z`, environment revision 13. All four earlier active revisions remain active; existing audience and protected-media code/secrets are unchanged.
- All 20 anonymous Firearms JPG GETs returned HTTP 200 `image/jpeg` and passed actual decode, dimensions, exact approved SHA-256/Git blob/byte checks (8,737,616 bytes total). Existing NFS, Aircrafts and Phantom samples passed at their retained revisions. Unknown revision, unapproved filename, case mismatch and MP4-through-JPEG-endpoint all returned 404. Windows system HTTPS trust was used without TLS bypass.
- Media-service build and all 14 existing gateway/auth/cache tests passed.

## Page integration and controlled tests — passed

- Both new routes reuse the gallery layout and image fullscreen viewer; noindex/sitemap exclusion and no new homepage/navigation entry. Existing external ArtStation cards are preserved.
- `gallery.json` remains an image-only array of 20 original JPG references. Separate companion metadata anchors the native MP4 after the lead JPG and before the second JPG. Reorder/comparison/exclusion relationships use stable filenames.
- Minimal backward-compatible video support accepts a strict local `.mp4` basename, rejecting URLs, slashes, traversal, queries, encoded and whitespace paths. Native controls, inline playback, metadata preload and existing asset-version URLs are used; no forced autoplay. Existing YouTube/Sketchfab providers and image delivery are retained.
- Twenty-one maintained embed tests and all 17 controlled delivery browser tests passed. Broader maintained tests pass 87 cases; two existing public-route cases are blocked locally by unavailable Ruby and will run in normal Pages CI. Coverage includes native video URLs/controls/responsive layout/fullscreen/failure isolation and existing JPG retry/WebP fallback, previous-image preservation, stale navigation/comparison and protected gallery behavior.
- A separate isolated-browser test loaded the actual MP4, decoded 2560×1440/18.5 seconds, advanced playback, sought to 9.25 seconds and entered/exited native fullscreen with zero page errors. Its fixture honors byte ranges; actual deployed hosting/range/playback remain a separate live check.

## Integration and actual editor — passed

- Real tracked Firearms/Phantom/Aircrafts embed validation, existing map validation and complete asset-version generation passed. The real MP4 version equals its exact Git blob `cc7798d6711514dac3a4a4ec8ddf08e4b79f10e1`; all 20 original JPG version references remain present. Missing unchanged JSON/frontmatter files in the sparse checkout were materialized from exact tracked blobs for these checks; no unrelated source content changed.
- Actual DS Gallery Editor v0.10 UI round-trip passed on an isolated source copy: 20 Included JPGs, rendered lead preview, reorder, save, reopen with persisted order, restore canonical order and save. All 21 media hashes remained unchanged. The native-video companion stayed byte-identical (SHA-256 `E40DFE783C8E8F3A60206DBFDB2951C8E173AC69682482D7E7E323EC5FC9AF44`), retaining exact filename/anchors. Editor JSON formatting changed, while canonical image data was restored. A minimized wrapper limitation was resolved through the skill's documented window activation API; no app/settings/source changes were needed.
- Current main `ece5bc6` navigation/RZ exit/map-fullscreen updates were merged and retained in checkpoint `3a73a5f`. The shared viewer include is preserved; public viewer cache key advances to v42 to avoid colliding with main's already-published v41. Only the controlled test fixture was adapted to the extracted include. Post-merge browser tests pass 17/17; targeted embeds/desktop/RZ/navigation/maps pass 71/71. No runtime rollback was needed.

## Deployed acceptance — passed

- Public delivery: 38 successful requests (36 HTTP 200, two HTTP 206). All 20 public WebPs fully decode and match exact merged bytes/SHA-256/Git blobs and source dimensions. The full MP4 response matches the exact 27,253,962 source bytes, SHA-256, Git blob and parsed 2560×1440/18.5-second metadata. Ten checked shared scripts/styles/manifests match the merged implementation.
- Video byte ranges: exact 1,024-byte responses with HTTP 206 and `Content-Range: bytes 0-1023/27253962` and `bytes 27252938-27253961/27253962`. Both range bodies match the source bytes, supporting deployed seeking/metadata reads.
- Both real aliases: HTTP 200, correct portfolio headers/title, 20 images and one native video after the lead, correct source image order, noindex, 23 per-asset versions including MP4 blob `cc7798d6711514dac3a4a4ec8ddf08e4b79f10e1`, originals revision `3b580d05…`, viewer v42, embed script v3 and embed CSS v2. Both homepages/main navigation and sitemap omit the Firearms gallery route URLs; existing external ArtStation cards are preserved. Unlisted routes remain directly and anonymously accessible; access/security settings were not changed.
- Responsive checks on both aliases: 390 CSS-pixel viewport uses the matching decoded WebP; 2800 CSS-pixel desktop uses the actual decoded approved original JPG. Lead image is genuinely 2560×1366, not upscaled 4K. Image fullscreen/dialog, counters, next/previous and return worked. Mobile native video fits its 16:9 frame with controls and playsinline, without horizontal overflow.
- Actual native Chrome studio video: rendered moving shooting frames/timer, native fullscreen at `0:05 / 0:18`, Escape return, midpoint seek to `9.106s`, native play/pause toggles.
- Actual native Chrome personal video: independently rendered moving frames/timer, native fullscreen/Escape, pause held `10.337s`, seek to `8.475s`, resume advanced to `14.583s`. Personal image fullscreen also navigated `2/20 → 3/20` and Escape returned. Tests used only a new owned Chrome window, which was closed afterward; existing user windows/tabs stayed untouched.
- Existing-gallery live smoke checks: Aircrafts retains 23 images and four correctly ordered Sketchfab iframes after its lead; Phantom retains 23 images and its original leading YouTube iframe. NFS image fullscreen decoded and navigated `1/6 → 2/6`; Egypt retains 36 image groups, with correctly decoded wireframe/checker variant switching. Full normal Pages build checks passed, resolving the earlier local Ruby environment limitation.

## Explicit test limits

- Mobile checks use responsive browser viewport emulation and maintained gesture tests; no physical touch-device or iOS/Safari run was performed.
- Native editor preview inspection covered the rendered lead and saved image list/data, not every individual preview. Independent decode/hash checks cover every image and exact video file.
- No audio-quality or frame-by-frame/full-length video review is claimed. Actual live playback, pause/resume, seeking and fullscreen were separately exercised on both routes.

Recoverable checkpoints: baseline `87caa40`, private source `5a01cc0`, approved private merge `3b580d05`, public media `7a08fa4`, page/video integration `e55a283`, editor/version checks `cf391c2`, current-main integration `3a73a5f`, post-merge regression checkpoint `901e983`, published implementation above. Completed Aircrafts and Phantom reports remain unchanged.

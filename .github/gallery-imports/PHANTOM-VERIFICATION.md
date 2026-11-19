# Phantom: Covert Ops verification

Scope: Phantom only. Checked 19 November 2026. Published and verified, with the explicit test limits below.

Studio: https://digitalshamans.co.uk/galleries/phantom-covert-ops/

Personal: https://digitalshamans.co.uk/artur/galleries/phantom-covert-ops/

Implementation `4c6bcf49ff9ff2f528e62edafa2a74a7ac0017e9`, PR #47. Pages build and deployment completed successfully: https://github.com/DigitalShamans/portfolio-media/actions/runs/44520062181

## Source and media — passed

- Rendered ArtStation `A9VRrq` matches the private source manifest exactly: YouTube `eWHDcWZnTMY` first, then 23 screenshots in exact filename order. One intervening empty ArtStation container exposes no publishable media and is retained only in acquisition evidence.
- Actual video title: **Phantom: Covert Ops | Oculus Rift Gameplay Trailer**, by Meta VR.
- Approved original revision `bcd1d7f7086e3745dcefffc49a25de804bf5fca6` contains 23 JPEGs: one 1920×1080, three 1920×905, nineteen 2560×1366. No 3840×2160 source file is verified in this set; smaller source images are preserved without upscaling.
- All 23 anonymous originals GETs passed HTTP 200, full decode, exact dimensions, source SHA-256, approved Git blob hashes and byte counts. Existing Aircrafts original passed; invalid revision and unapproved filename returned 404. HTTPS validation used Windows system trust without TLS bypass.
- Existing media service v7 source `47c824a78234983338e61f7d728ca94d69438b98`, deployment `appgdep_6afee1a1ffc0819184913c5c2447f99a`, succeeded at `2026-11-19T11:46:54Z`.
- All 23 recovered WebPs match fresh exports byte-for-byte: EXIF orientation preserved, Lanczos fit within 2560×1440, no crop/upscale, quality 92, method 6, original ICC profile. Original total 10,454,768 bytes; WebP total 6,552,638 bytes. WebP decode, filename case/count, dimensions and duplicate checks passed.

## Page integration — passed

- Both `/galleries/phantom-covert-ops/` and `/artur/galleries/phantom-covert-ops/` reuse the existing shared gallery layout and image viewer, with noindex and sitemap exclusion. No homepage/navigation listing is added.
- Image-only `gallery.json` keeps all 23 original JPG references in source order. The separate `gallery-embeds.json` anchors the one YouTube trailer before the lead JPG. Reordering follows its filename; excluding the anchor keeps a leading before-only trailer first. Existing after/before Aircrafts fallback behavior remains covered.
- Runtime change is confined to the before-only missing-anchor fallback and its script cache key. Resolution, retry/fallback, comparison and protected gallery code is unchanged. Previous revision overrides and approved originals entries are preserved.
- Twelve maintained embed tests plus eleven controlled delivery browser tests passed (23 total), including placement, exclusion/reordering, existing Aircrafts order/fallbacks, malformed or failed sidecars preserving images, JPG retry/WebP fallback, stale navigation/variant protection and previous-image retention. All 39 resolution/mobile/navigation tests also passed. `git diff --check` passed.
- Source checkpoint `03fc93c`; recovered implementation `6f2d6c2`; verified media/current-main integration checkpoint `120f0b8`. Main's completed Aircrafts report is retained.

## Actual editor UI — passed

Actual native DS Gallery Editor v0.10 round-trip **passed** on an isolated copy: 23 included JPG entries, rendered previews, first-image reorder, save/reopen with persisted order, then canonical order restored and saved. All 23 JPG references exist. The shipped companion remained byte-identical (SHA-256 `7CB12F21FBD4B6CC768E2AA8984AA74C569593A60BAA80580575BDFC5818A282`), preserving the video ID, exact title and original JPG anchor. The first two previews were inspected; all 23 individual previews were not exhaustively inspected. This is an actual UI test, separate from parser tests.

## Deployed acceptance — passed

- All 38 public verification requests returned HTTP 200. All 23 public WebPs fully decode, preserve exact source dimensions and match implementation bytes and Git blob hashes. All ten checked shared script/style/public manifest files match the deployed implementation.
- Both routes contain the correct 23-image manifest and one actual YouTube iframe before the lead image, with the exact source title and ID. Both carry `noindex`, shared embed script v2 and correct originals revision data. The HTTP-200 sitemap and both homepages/main navigation exclude the Phantom gallery route URLs; pre-existing external ArtStation cards remain. Unlisted access is direct/anonymous; security settings are unchanged.
- Both routes were tested at 390 CSS pixels with matching WebPs and at 2800 CSS pixels with the approved original JPG URL and successful actual decoding. The lead original remains 1920×1080; selecting the original does not turn a smaller source into 4K. Image fullscreen/dialog, counters, next/previous navigation and return worked.
- Native Chrome studio video verification passed actual advancing playback `0:15 → 0:31 → 0:43`, stable pause at `0:43`, resume past `1:03`, and embedded video fullscreen at `1:23` followed by Escape return. This was YouTube iframe fullscreen, not Chrome F11. Personal route loaded the exact video and started its actual intro.
- Shared-change live smoke checks passed: Aircrafts retains 23 screenshots and four ordered Sketchfab iframes after the lead image; NFS image fullscreen decode/navigation worked (`1/6 → 2/6`); Egypt retains 36 groups and its wireframe/checker variants decoded and switched correctly. Existing controlled delivery tests cover retry/fallback and stale-request behavior.

## Explicit test limits

- Personal-route video timeline advancement and its own fullscreen cycle were not separately completed: the user switched Chrome tabs after its actual intro started, so native browser input stopped. Studio playback/fullscreen passed; both routes share the same YouTube ID and embed implementation.
- Physical touch-device swipes were not directly exercised. Responsive browser sizes and maintained mobile/navigation gesture tests passed.
- Native editor verification inspected the first two image previews, all 23 included entries/references and saved data. It did not exhaustively inspect every individual editor preview. Actual media decode/hash checks cover all 23 files.

Phantom is the only import handled by this continuation. Firearms was not started. Checkpoints remain recoverable at `03fc93c`, `120f0b8`, `f42ba24`, `5bbfaaf` and the merged implementation above.

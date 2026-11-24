# Props verification

Completed 19 November 2026. One gallery release; both routes published and verified. This is the sixth converted Full Portfolio gallery.

- [Studio](https://digitalshamans.co.uk/galleries/props/)
- [Personal](https://digitalshamans.co.uk/artur/galleries/props/)
- [Editable manifest](https://digitalshamans.co.uk/galleries/props/gallery.json)
- [ArtStation source](https://www.artstation.com/artwork/ba253a)

## Source and preparation

Rendered source contains 43 containers: 42 JPGs, one empty record at position 2, no embeds. Empty record is documented and omitted. Exact image order/case, source captions and actual download links including dl=1 are preserved in source evidence. No high-resolution URL was invented.

Originals: seven at 3840×2160, ten at 2560×1440, six at 2560×1366 and nineteen at 1920×1080; 22,566,756 bytes. All 42 original hash/size/blob/decode/dimension checks pass. WebPs:17 at 2560×1440, six at 2560×1366 and 19 at 1920×1080; 15,665,332 bytes. Lanczos/q92/method6, EXIF/ICC, no crop/upscale. Every WebP matches staged bytes and decodes. gallery.json retains 42 original JPG references in source order/case; no companion is required.

Private PR6 merged at `de815cfb10a0ab016e63bb93f7cb0da658620b39`; all 42 approved blobs/sizes match that exact tree. Public checkpoints: browser guard `3a8d9f1`, media/pages `b676519`, metadata `107f7ae`. Existing approvals and delivery revisions are preserved.

## Actual native editor

DS Gallery Editor v0.11 individually rendered all 42 previews. Adjacent reorder → Save → reopen persisted; canonical order was restored and explicitly saved. All original hashes and exact-case references/order match stage. Canonical bytes were restored after the successful semantic round-trip. Isolated scratch only; no production files changed by the UI, no embeds generated, no timeout or blocker.

## Service and website

Sites v10 source `b2515911703e45c82d32113883e9c2ef4da9b723`; deployment `appgdep_6aff11b6d8908191a31ed9ec418b386b` succeeded 15:12:04Z, environment revision 15. Only Props is added under its new revision; six prior catalogs/active revisions remain. Gateway tests 14/14 and build pass.

Actual service: 42 new originals match exact bytes/SHA-256/Git blob/full JPEG decode/dimensions/orientation; three retained NFS/Aircrafts/Phantom samples pass; four unknown-revision/missing-file/wrong-case/video-endpoint probes return 404. Total 49 GETs:45 HTTP 200 +4 HTTP 404, 25.95s. Windows certificate validation and 10s request deadlines retained.

[PR70](https://github.com/DigitalShamans/portfolio-media/pull/70) merged as `82e2723b9d21f6d9c7bb01cc76c421c6ccd7a1cb`. [Pages run44552731651](https://github.com/DigitalShamans/portfolio-media/actions/runs/44552731651) validation/build/deployment succeeded 15:17:13Z. Both actual HTML routes report that exact revision.

Public delivery: 55 HTTP 200 responses cover 42 WebPs, canonical manifest, both route HTML documents, seven actual dependencies, both homes and sitemap. Exact hashes/decode/dimensions, title/h1/noindex, approved revision and 42 asset versions pass. Both routes remain absent from sitemap and homepage/main-navigation links. Existing external ArtStation cards remain. Production parser/order, version generation, embed checks and 55 maintained guard/resolution/header/prefetch/arrival tests pass. Full Ruby/Jekyll checks passed in CI. Concurrent handoff changes through d7c4604 remain preserved; this import adds no viewer behavior.

## Interactive browser

Supported in-app browser on BOTH routes at 390×844 and 2800×1500: 42 images, correct portfolio/title, no horizontal overflow, decoded mobile WebPs and original desktop JPGs. Studio 1280×900 also uses decoded WebPs. Screenshot 14 loads the actual 3840×2160 JPG wide and its 2560×1440 WebP on mobile.

Fullscreen/counters/next/previous/return pass: studio 1→2→1 mobile and 14→15→14 wide; personal 14→15→14 mobile and 42→41→42 wide. Escape and Back to gallery close the viewer. Desktop/mobile screenshots visually inspected. Temporary viewport override reset. No native Chrome use, user prompts, or physical touch/iOS/Safari testing.

## Timeout policy and measured time

In-app first; five-second observation deadline; one fresh in-app retry; two-second delivery fallback. Inputs use 5s locator limits and 15s CUA calls. HTTP fallback stays noninteractive/unverified. Guard tests 7/7 pass, including never-resolving callbacks and late-result rejection. Actual source opening exercised a 5s timeout then automatic recovery in 0.972s. A live hydration check also recovered automatically. A guard cannot cancel underlying UI input or an unresponsive external tool transport; unknown action outcomes require fresh observation.

Downloads 10.333s; preparation 9.836s. Request 14:59:56.265Z → publication 15:17:13Z. Full acceptance completed in 25.45min, 60.5% below the 64m23s Firearms baseline: the half-time target was met for this supported JPG-only run. Exact timestamps and scope are in PROPS-TIMINGS.json. This is a measured run, not a guarantee for unknown formats.

Final acceptance/STATUS/timings stay on the working branch to avoid a second website release. Working evidence retains source/download/staging facts, editor hashes, HTTP records and browser-verification.json. Prior Sniper final evidence is also carried forward.

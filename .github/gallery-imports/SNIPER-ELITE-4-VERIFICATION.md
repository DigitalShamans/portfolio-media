# Sniper Elite 4 verification

Completed 19 November 2026. One gallery release; both routes published and verified.

- [Studio](https://digitalshamans.co.uk/galleries/sniper-elite-4/)
- [Personal](https://digitalshamans.co.uk/artur/galleries/sniper-elite-4/)
- [Editable manifest](https://digitalshamans.co.uk/galleries/sniper-elite-4/gallery.json)
- [ArtStation source](https://www.artstation.com/artwork/gJYL2Z)

## Source and media

Rendered source: 26 containers containing 25 JPGs and one empty leading record, with no video/model embeds. The empty record is documented and omitted. Exact image order and download links, including `dl=1`, are preserved. Order starts with the 200 image, then the dockyard map, and ends with 202.

Originals: 24 images at 1920Ã—1200 and one dockyard overview at 3840Ã—2116; 10,793,363 bytes total. All original size/SHA-256/Git blob/format/dimension checks pass. WebPs: 24 at 1920Ã—1200 and one at 2560Ã—1411, using Lanczos/q92/method6 with EXIF/ICC handling and no crop/upscale. All 25 WebPs match staged bytes and decode. `gallery.json` retains original JPG references, exact case and source order. No companion manifest is needed.

Checkpoints: source `0778d40`, media/pages `a7d2332`, metadata `afc5513`. All 25 approved blob/size records match the exact merged originals revision `1192ad324a093102a28f4f84ea6ac5d28911c4fd`. Previous approvals and delivery revisions remain intact.

## Actual editor

DS Gallery Editor v0.11 resolved the sibling originals folder and individually rendered all 25 previews. Reorder â†’ Save â†’ reopen persisted; canonical order was restored and saved. All original hashes remain unchanged. The editor changed JSON formatting; after the semantic round-trip, canonical bytes were restored in the isolated scratch copy. Production files were not edited by the UI. The supplied v0.10 launcher forwarded to v0.11; an independent v0.10 build was not tested.

## Publication and delivery

Sites v9 source `7c35cfb21909c6d754f5f713d491f1ca36a72bc7`; deployment `appgdep_6aff022c73348191b0765147f7d78e5c` succeeded at 14:05:46Z, environment revision 14. Only this gallery enters the new revision catalog; five earlier catalogs/active revisions remain. All 14 gateway tests and the build pass.

Actual service checks: all 25 new originals and three retained NFS/Aircrafts/Phantom samples match exact bytes/hash/decode/dimensions. Four unknown-revision/missing-name/wrong-case/video-endpoint probes return 404. Totals: 28 HTTP 200 plus four HTTP 404, in 16.9s, retaining Windows certificate validation.

[PR66](https://github.com/DigitalShamans/portfolio-media/pull/66) merged as `4720791f12fface5bba6ded805936a8fc404aea1`. [Pages run44540603980](https://github.com/DigitalShamans/portfolio-media/actions/runs/44540603980) validation/build/deployment succeeded at 14:10:28Z. The later live build `1ae23ff46fd375f0ccaf27b38e38fc51a234edc3` is a verified descendant, two commits ahead, changing only homepage/header/About content. Sniper metadata/media/runtime are unchanged.

Public checks: 37 HTTP 200 responses cover all 25 WebPs, the canonical manifest, both route HTML documents, six dependencies, both homes and sitemap. Titles, headings, noindex, approved revision and all 25 asset versions pass. Both routes remain absent from sitemap and homepage/main-navigation links; existing external ArtStation cards remain. Production parser/order, asset-version generation, embed validation and 40 maintained resolution/header/prefetch tests pass. Ruby/Jekyll validation passed in Pages CI.

## Interactive browser and limits

Actual supported IAB at 390Ã—844 and 2800Ã—1500 on both routes: 25 images, correct heading/portfolio, no horizontal overflow, mobile WebPs and decoded wide-desktop originals. The wide overview loads at 3840Ã—2116; its mobile derivative at 2560Ã—1411.

Fullscreen/counters/next/previous/return pass: studio 1â†’2â†’1 mobile and2â†’3â†’2 wide; personal 1â†’2â†’1 mobile and25â†’24â†’25 wide. Escape and Back to gallery close the viewer. Default 1280 viewport restored. Finished desktop/mobile screenshots were visually inspected.

External native Chrome remains unverified: its API call stalled 1460.4716s and expired. Fresh inventory showed no additional owned Chrome window. A session reset recovered IAB, where all interactions above passed. Physical touch/iOS/Safari were not tested. This import changed no shared runtime code; unrelated exhaustive failure suites were not repeated.

## Timing and checkpoints

Downloads 4.827s; preparation 4.718s. Exact request 13:50:17.706Z â†’ Pages 14:10:28Z: 20m10.294s. Full acceptance took 51.73min, including the 24m20s native-tool stall. The half-time end-to-end target was not met; publication time is not substituted for acceptance time. Exact timestamps are in `SNIPER-ELITE-4-TIMINGS.json`.

Final evidence stays on the working branch, avoiding another documentation-only deployment. Working records retain per-file HTTP facts, editor hashes, source/staging records, publication ancestry and `browser-verification.json`. Future runs should dispatch HTTP checks immediately after Pages succeeds and use IAB first, so optional native Chrome setup cannot block independent checks.

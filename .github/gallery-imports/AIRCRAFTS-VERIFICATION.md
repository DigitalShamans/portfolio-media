# Vehicles - Aircrafts acceptance evidence

Scope: Aircrafts only. Checked 19 November 2026.

## Published references

- Studio: https://digitalshamans.co.uk/galleries/vehicles-aircrafts/
- Personal: https://digitalshamans.co.uk/artur/galleries/vehicles-aircrafts/
- Aircrafts implementation: `dd84935d45e2ee71e7ca2c4997842d86face1c4f`.
- Pages build/deploy: https://github.com/DigitalShamans/portfolio-media/actions/runs/44515049600 — completed successfully. Later map-only commits do not change Aircrafts code or media.
- Approved originals revision: `c73ad195a17c4e7f253e371450181aa3bf0a1a53`; existing media-service version 6 source `e07bfa2f98ec3f275d10d7c43bc94e4502daf879`, deployment `appgdep_6afedb642b8081918b906adb624e11da`, succeeded at `2026-11-19T11:20:17Z`.

## Passed

1. **Source/order/schema:** rendered ArtStation project `w8LJ5g` and saved source metadata agree on 23 JPGs and four Sketchfab models. Live gallery DOM has the lead image, four models in source order, then 22 images. Exact filenames/case and stable model IDs agree. The four models are Cessna 340 Landed (`5db8dc613bc2456da7a0a84d908396b0`), Cessna 340 Flying (`c80d9972936a4c8fb928099724847919`), Boeing 747-800 (`ec64a742c39b49c387e3e479cb9c3d69`) and Cessna 206 (`cf61032f294f4cfab478de38451422a3`).
2. **Real originals:** all 23 anonymous service GETs returned HTTP 200 and passed full JPEG decode, exact dimensions, byte counts and approved Git blob hash checks. Eight originals are 3840×2160, twelve are 1920×1080, three are 1920×905. Smaller originals are not upscaled or described as 4K. Invalid revision and unapproved filename return 404; an existing NFS original still passes delivery/decode/hash checks.
3. **Local WebPs:** all 23 decode, preserve exact filename stems/case and fit 2560×1440 without upscaling. The recovered checkpoint recorded byte equality with the existing Lanczos quality-92/method-6 exporter.
4. **Both real routes:** studio and personal pages render 23 images and four actual Sketchfab iframes, with correct portfolio headers, `noindex`, shared assets and the expected ordering. Every model was started and visually rendered in the in-app browser; the viewer controls are real, not thumbnail substitutes.
5. **Responsive/fullscreen images:** both routes were checked in a 390 CSS-pixel responsive browser viewport and at 2800 CSS pixels. Mobile uses the matching 2560-wide WebP; qualifying wide desktop uses the service's genuine 3840-wide lead JPG. Image overlay/fullscreen presentation, next/previous navigation, counters and return to gallery work. The in-app browser denies the browser Fullscreen API, so this confirms the dialog presentation rather than OS-level fullscreen.
6. **Actual editor UI:** installed DS Gallery Editor v0.10 opened an isolated copy, displayed all 23 images, reordered, saved and reopened it successfully. Final scratch order was restored to source order. Saved data retains all JPG references; shipped `gallery-embeds.json` remained byte-identical (SHA-256 `A643CC19111DDF2692C8619E91CED8C0EBD063820D3DB0F6349959C3AC77E284`). All four after/before anchors remain valid. This is an actual native UI check, separate from parser validation.
7. **Shipped-code regression checks:** 3 embed tests and all 11 controlled delivery browser tests passed against `dd84935` (14 total), including roughly one-second JPG retry, matching WebP fallback, stale-navigation/comparison protection, previous-image retention and protected RZ delivery. A separate mount harness passed reordering, comparison/additional-image anchors, excluded-lead fallback before the next image, both-anchors-excluded append fallback, and preservation of image entries on HTTP/JSON errors. Alternative unmerged implementation tests are not counted here.
8. **Existing-gallery smoke checks:** studio NFS fullscreen decoded, navigated and returned correctly; personal NFS still contains six images and its reveal trailer. Egypt still has 36 image groups and its fullscreen wireframe/checker variants decode and switch correctly.

## Final live checks — passed

- All 23 public WebPs returned HTTP 200, fully decoded and exactly matched the shipped Git blobs and local byte counts. All seven shared script/style/manifest responses also matched shipped blobs. Both routes returned HTTP 200 with `noindex`, the correct shared scripts and embed opt-in. All 35 public verification requests succeeded.
- Both homepages and main navigation contain no Aircrafts gallery route link; the HTTP-200 sitemap excludes both routes. The existing external ArtStation portfolio card was preserved. Unlisted routes remain directly and anonymously accessible; no authentication/security settings were changed.
- Native Chrome loaded each actual 3D model and verified orbit by horizontal canvas drag with visibly different orientation: Landed front-to-rear, Flying rear-to-nose, Boeing front-to-rear, Cessna 206 front-to-rear. Sketchfab embedded fullscreen entry and Escape exit passed on Landed, including Chrome's `sketchfab.com` fullscreen notice. This was model fullscreen, not browser F11. The in-app browser's denied Fullscreen API and fractional-iframe drag limitation were therefore checked independently in Chrome.

Physical touch-device swipes are not directly exercised; the maintained mobile/navigation tests cover gesture logic. No editor feature development or other gallery import is part of this delivery.

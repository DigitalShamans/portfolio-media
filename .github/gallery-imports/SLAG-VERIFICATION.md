# Slag verification

**Published and verified, with explicit automation limits below.** Both [studio](https://digitalshamans.co.uk/galleries/slag/) and [Artur](https://digitalshamans.co.uk/artur/galleries/slag/) routes are live. Source [ArtStation8eAEq](https://www.artstation.com/artwork/8eAEq). One gallery per release; no Full Portfolio ordinal inferred because the source was absent from current card data.

## Source, preparation and native editor

Rendered source has13 containers:11 JPGs, empty2 and one final Sketchfab model. Exact filename case/order, all11 null image captions, full multiline description and original /large/ links including dl=1 are retained. All originals and WebPs are1920x1080; no upscale or invented4K. Originals4,820,942B; WebPs3,722,944B. Full Pillow13 decode, size/SHA-256/Git blob/ICC/orientation/order/case checks passed on every image. Recipe:q92/method6/Lanczos,2560x1440 bounds without crop/upscale. Download2.977s, measurement0.279s, preparation2.128s, final local check0.847s. See SLAG-ASSETS.md.

Image-only gallery.json and separate model companion use existing shared support. Companion197B, SHA-256c84a23466296794973cac2f4232193f470209e2b0d30af6aa225132c3d80da80, typeSketchfab, ID364b9214850549f29d2400b733f95693, title/captionSlag, stable anchor after artur-perzyna-artur-perzyna-2014-compose1-denoised.jpg. No optional image-caption assets/template are emitted.

Actual DS Gallery Editor v0.11 used an owned new window and isolated sibling scratch folders.11 Included JPGs resolved; adjacent reorder/explicitSave/reopen persistence/canonical restoration and all11 individual previews passed. Sketchfab row retained after the final image, companion bytes unchanged, exact image-only schema/order/case/original hashes and33 immutable stage files passed. Editor formatting output retained and canonical bytes restored. CUA completion/reset immediately followed final native screenshot. Existing editor windows and OBS were untouched. See SLAG-EDITOR.md.

## Private and media-service release

Private source59249b2b750459715e0d98a4aeae5a40c3d498b7; [PR14](https://github.com/DigitalShamans/portfolio-media-private/pull/14) mergedddbb5d1a9b9aad396debb1c5b11f66db8b08a8a4. Every11 immutable tree blob/size and approval inventory matched;19 prior approval galleries retained. See SLAG-PRIVATE-TREE.json.

Existing public Sites projectappgprj_6afbf3a4aa2c81919821379c8fde09df was opened through the supported helper before catalog edits. The helper ran14/14 gateway tests/build, committed/pushed exact source699d42aa0c25220e5ce4538db1ef8b1c32986bc5 and packaged it. Saved v17appgprj_6afbf3a4aa2c81919821379c8fde09df~appgver_4965418ad0148191b2e1f3560b116256; deploymentappgdep_6aff755cb1008191af2991798de7f290 succeeded2026-11-19T22:17:13.687610+00:00,env22. Only MEDIA_PUBLIC_REVISIONS appended this gallery;13 old catalogs/active revisions, owner/public audience, protected access, caching and runtime remain unchanged.

All18 actual service GETs passed in8.366s with Windows TLS and10s request bounds:11 new originals plus3 retained NFS/Aircraft/Phantom samples returned200 with exact bytes/hash/blob/full decode/dimensions;4 unknown revision/missing/wrong-case/video-at-JPEG-endpoint probes returned404. Incoming website metadata was applied after this gate. See SLAG-SERVICE.md.

## Website release and actual live checks

Public source84a61b1e8d28387ad3d88376e321c4619a039974; [PR86](https://github.com/DigitalShamans/portfolio-media/pull/86) merged211bd9d8cf0494a874fbb70b951b9a8bc2d45933. [Pages44628340233](https://github.com/DigitalShamans/portfolio-media/actions/runs/44628340233) completed success22:25:50Z. Ruby is unavailable locally; actual Ruby/Jekyll, maintained public policy/navigation/resolution/embed/map/pruning/homepage validation and deploy passed in established Pages CI. Local map/embed validation and13 generated versions passed. PR-only navigation checks were path-filtered for this data-only change and are not falsely counted as a run.

All27 public GETs returned200 in5.352s:11 WebPs with exact hashes/bytes/blobs/full decode, canonical image manifest, exact companion bytes/hash/model/caption/anchor, both HTML documents with expected build revision and noindex/13versions/approved original revision, zero image-caption templates/scripts/styles,9 actual dependencies, homes/navigation and sitemap exclusions. Both pages unlisted/noindex/sitemapfalse. No existing card/redirect/nav or global delivery fallback change. See SLAG-PUBLIC.md.

Actual IAB image checks passed on both routes at390x844 and2800x1600, with an extra1280 desktop WebP check. Source order and zero image captions match. First/next images decoded at actual1920-wide dimensions from correct WebP/original sources. Full-viewport image viewer1→2→1 and Escape closure passed.

Sketchfab source preflight visibly rendered and root drag changed front to rear view; see SLAG-MODEL-PREFLIGHT.json. In published pages, model loading/Play/render and semantic canvas double-click zoom visibly passed in Artur390/mobile and studio1280/desktop. The model remained after the final image in both DOMs. Before/after screenshots show a closer view after zoom. This uses the viewer's documented zoom interaction, also demonstrated by [Sketchfab's own controls demo](https://sketchfab.com/models/128d863ab5c8467f80939cabe8b3fc34/embed).

Explicit limits: root-coordinate orbit in the mobile iframe was refused because of fractional iframe coordinates; in-page orbit is not claimed. A mobile Help locator ended at its5s deadline without an action. Sketchfab DOM includes hidden loading/heavy-device text despite actual successful rendering; visible screenshots were used to judge rendering. Four native Fullscreen API grant warnings occurred; full-viewport image overlays/navigation passed. Native fullscreen grant, physical touch/iOS/Safari untested. No Chrome/user browser/editor prompts. Read checks5s, locators5s and tool calls15s. See SLAG-BROWSER.json.

Loaded gallery and model mobile/desktop proof was saved/visually inspected in outputs. Capture-owner CUA/node sessions reset after final UI; exact original Swift48484 and one restart50608 stopped, native13368/50788 already exited, zero original survivors/errors. Warm helper25912 may restart idle; existence is not capture proof. OBS/main app/other recorders/privacy/border settings untouched. No screenshot followed cleanup; no yellow-border disappearance inferred. See SLAG-CAPTURE-CLEANUP.json.

## Completion checkpoint

Only explicit incoming gallery/metadata/report paths were staged; user header/PSB and private extra-image folders remain protected. Final evidence is pushed on codex/slag-20261120 for the next content release, avoiding a second docs-only Pages publication. Start22:07:39Z (Nov20 localBucharest); verified/capture release22:35:12.3597854Z, 1653.360s. Report preparation1774.919s, 54.05% below64m23s baseline; half-time target at preparation:True. Push/final response add overhead. See SLAG-TIMINGS.json.

# Sniper Elite 4 verification

Scope: Sniper Elite 4 only. Checked 19 November 2026. **Acceptance draft: deployment and live checks remain pending.**

Source: [Sniper Elite 4 - Environment Art](https://www.artstation.com/artwork/gJYL2Z).

Planned published routes: `/galleries/sniper-elite-4/` and `/artur/galleries/sniper-elite-4/`. Publication is not established by this draft.

## Source and media — verified

- The rendered ArtStation project contains 26 asset containers: 25 JPGs, no embeds, and one leading empty record. The empty record contains no image, video, iframe, or text and is not published. Canonical image order starts with the 200 image, followed by the dockyard map.
- Actual original dimensions are 24 images at 1920×1200 and one dockyard map at 3840×2116. Original bytes and dimensions are retained without upscaling. The map is not a 3840×2160 image.
- Staging contains the 25 originals, 25 corresponding WebP derivatives, and an image-only `gallery.json` array of 25 original JPG references in exact source filename case/order. No companion embed manifest is required.
- Approved originals revision: `1192ad324a093102a28f4f84ea6ac5d28911c4fd`. Public checkpoints: source/status `0778d40`, media `a7d2332`.
- Measured download stage: 4.827 seconds. Measured preparation stage: 4.718 seconds. These are individual stage durations, not total request-to-publication time.

## Actual native editor — passed in v0.11

- The actual DS Gallery Editor displayed 25 Included entries and automatically resolved the isolated sibling originals folder. Every one of the 25 JPGs was individually selected and visually rendered, including the final 202 image.
- Reordered the lead image down one position, clicked Save, observed the saved status, reopened the same gallery, and confirmed the changed order persisted. Restored and saved the exact canonical order.
- Post-save checks confirmed 25 unique image references, exact filename case/order, all references resolved, and all 25 original SHA-256 values unchanged. The editor changed JSON formatting; canonical original bytes were subsequently restored in the isolated test copy, with a final byte-identical manifest. No embeds were generated.
- **Version limit:** launching the supplied v0.10 executable opened a window whose returned process path and visible footer were v0.11. This verifies the actual installed v0.11 runtime; an independently running v0.10 build was not tested.

## Originals service — partially verified; live acceptance pending

- Catalog-only service source `7c35cfb21`: build passed and all 14 existing gateway tests passed.
- **Pending — deployment:** record the final deployment ID, successful status, active environment revision, and retained earlier catalog revisions.
- **Pending — live delivery:** verify all 25 anonymous original JPG responses against approved dimensions, exact bytes and hashes; check existing galleries and rejection of unknown revisions, unapproved names, and filename case mismatches.

## Pages and browser acceptance — pending

- **Pending — Pages:** record the final public implementation/PR, normal validation/build/deployment results, and final route URLs after service verification.
- **Pending — routes:** confirm both aliases return the intended gallery, exact 25-image order, approved originals revision and asset versions; verify noindex, sitemap exclusion, and the intended navigation behavior.
- **Pending — browser:** verify both studio and personal routes at responsive/mobile and desktop widths, decoded derivatives/originals, image fullscreen, counters, next/previous navigation, and Escape return. Record actual native-browser results separately from automated or emulated checks.

No deployment success, live route availability, browser interaction, or physical-device testing is claimed while these entries remain pending.

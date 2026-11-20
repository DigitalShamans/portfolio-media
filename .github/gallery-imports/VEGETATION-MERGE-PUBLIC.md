# Vegetation public delivery verification

Overall: PASS

- WebPs: 29/29 HTTP 200; full decode; exact bytes/SHA-256/Git blob/dimensions.
- Manifest: PASS canonical bytes, image-only schema, 29-image source order.
- No companion requested; source empty positions [2] omitted.
- Studio/personal HTML: 2/2 noindex, titles, viewer/gallery markers, originals revision, asset versions and lead.
- Captions: 28 exact filename/text mappings in each inert template; caption JS/CSS reachable; one source image caption remains null.
- Dependencies: 9/9 scripts/styles/mobile helper reachable.
- Homes/navigation: 2/2 exclude unlisted routes; sitemap PASS.
- 44 GETs; 8.09s; Windows TLS; Pillow 13.0.0; 10s/request.
- Actual revision: `41fd9d764958e759ea70ada0d518722e7b18d0ac`. Expected: `41fd9d764958e759ea70ada0d518722e7b18d0ac`.
- Revision: exact expected implementation checked.
- Delivery checks only; root owns UI verification.
- Evidence: public-http-results.json, public-dependency-http-results.json, public-verification.json.
- Blockers: none.

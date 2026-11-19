# Vegetation public delivery verification

Overall: PASS

- WebPs: 16/16 HTTP 200; full decode; exact bytes/SHA-256/Git blob/dimensions.
- Manifest: PASS canonical bytes, image-only schema, 16-image source order.
- No companion requested; source empty positions [2] omitted.
- Studio/personal HTML: 2/2 noindex, titles, viewer/gallery markers, originals revision, asset versions and lead.
- Captions: 16 exact filename/text mappings in each inert template; caption JS/CSS reachable.
- Dependencies: 9/9 scripts/styles/mobile helper reachable.
- Homes/navigation: 2/2 exclude unlisted routes; sitemap PASS.
- 31 GETs; 5.76s; Windows TLS; Pillow 13.0.0; 10s/request.
- Actual revision: `7dc1b7c0003fc6c2ae1406c5c85d13c31ad9bd9f`. Expected: `7dc1b7c0003fc6c2ae1406c5c85d13c31ad9bd9f`.
- Revision: exact expected implementation checked.
- Delivery checks only; root owns UI verification.
- Evidence: public-http-results.json, public-dependency-http-results.json, public-verification.json.
- Blockers: none.

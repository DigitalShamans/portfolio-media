# Strange Brigade - Environment Art public delivery verification

Overall: PASS

- WebPs: 33/33 HTTP 200; full decode; exact bytes/SHA-256/Git blob/dimensions.
- Manifest: PASS canonical bytes, image-only schema, 33-image source order.
- No companion requested; source empty positions [2] omitted.
- Studio/personal HTML: 2/2 noindex, titles, viewer/gallery markers, originals revision, asset versions and lead.
- Captions: 33 exact filename/text mappings in each inert template; caption JS/CSS reachable.
- Dependencies: 9/9 scripts/styles/mobile helper reachable.
- Homes/navigation: 2/2 exclude unlisted routes; sitemap PASS.
- 48 GETs; 9.97s; Windows TLS; Pillow 13.0.0; 10s/request.
- Actual revision: `154bcdc1cf51be2dad7bc5f52507db5351b054e8`. Expected: `154bcdc1cf51be2dad7bc5f52507db5351b054e8`.
- Revision: exact expected implementation checked.
- Delivery checks only; root owns UI verification.
- Evidence: public-http-results.json, public-dependency-http-results.json, public-verification.json.
- Blockers: none.

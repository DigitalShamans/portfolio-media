# Exterior Visualisations public delivery verification

Overall: PASS

- WebPs: 19/19 HTTP 200; full decode; exact bytes/SHA-256/Git blob/dimensions.
- Manifest: PASS canonical bytes, image-only schema, 19-image source order.
- No companion requested; source empty positions [2] omitted.
- Studio/personal HTML: 2/2 noindex, titles, viewer/gallery markers, originals revision, asset versions and lead.
- All 19 source captions remain null; no caption template, caption JS/CSS or embed JS/CSS requested.
- Dependencies: 7/7 scripts/styles/mobile helper reachable.
- Homes/navigation: 2/2 exclude unlisted routes; sitemap PASS.
- 32 GETs; 7.18s; Windows TLS; Pillow 13.0.0; 10s/request.
- Actual revision: `7a50e1004e3b57b8a8d45281dc38814b58bca6ba`. Expected: `7a50e1004e3b57b8a8d45281dc38814b58bca6ba`.
- Revision: exact expected implementation checked.
- Delivery checks only; root owns UI verification.
- Evidence: public-http-results.json, public-dependency-http-results.json, public-verification.json.
- Blockers: none.

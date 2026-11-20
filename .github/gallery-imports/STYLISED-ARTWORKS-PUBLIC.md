# Stylised Artworks public delivery verification

Overall: PASS

- WebPs: 16/16 HTTP 200; full decode; exact bytes/SHA-256/Git blob/dimensions.
- Manifest: PASS canonical bytes, image-only schema, 16-image source order.
- No companion requested; source empty positions [2] omitted.
- Studio/personal HTML: 2/2 noindex, titles, viewer/gallery markers, originals revision, asset versions and lead.
- All 16 source captions remain null; no caption template, caption JS/CSS or embed JS/CSS requested.
- Dependencies: 7/7 scripts/styles/mobile helper reachable.
- Homes/navigation: 2/2 exclude unlisted routes; sitemap PASS.
- 29 GETs; 5.62s; Windows TLS; Pillow 13.0.0; 10s/request.
- Actual revision: `3ee20281d7fae18841a22df3f483e03dba379106`. Expected: `3ee20281d7fae18841a22df3f483e03dba379106`.
- Revision: exact expected implementation checked.
- Delivery checks only; root owns UI verification.
- Evidence: public-http-results.json, public-dependency-http-results.json, public-verification.json.
- Blockers: none.

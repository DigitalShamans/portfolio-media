# Couch Heroes - Environment Art public delivery verification

Overall: PASS

- WebPs: 12/12 HTTP 200; full decode; exact bytes/SHA-256/Git blob/dimensions.
- Manifest: PASS canonical bytes, image-only schema, 12-image source order.
- No companion requested; source empty positions [] omitted.
- Studio/personal HTML: 2/2 noindex, titles, viewer/gallery markers, originals revision, asset versions and lead.
- All 12 source captions remain null; no caption template, caption JS/CSS or embed JS/CSS requested.
- Dependencies: 7/7 scripts/styles/mobile helper reachable.
- Homes/navigation: 2/2 exclude unlisted routes; sitemap PASS.
- 25 GETs; 5.33s; Windows TLS; Pillow 13.0.0; 10s/request.
- Actual revision: `291327aa0ff7b42dcab3942fc72663933f882ebd`. Expected: `291327aa0ff7b42dcab3942fc72663933f882ebd`.
- Revision: exact expected implementation checked.
- Delivery checks only; root owns UI verification.
- Evidence: public-http-results.json, public-dependency-http-results.json, public-verification.json.
- Blockers: none.

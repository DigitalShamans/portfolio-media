# Slag public delivery verification

Overall: PASS

- WebPs: 11/11 HTTP 200; full decode; exact bytes/SHA-256/Git blob/dimensions.
- Manifest: PASS canonical bytes, image-only schema, 11-image source order.
- Companion: PASS exact sketchfab ID `364b9214850549f29d2400b733f95693`, caption, after-last-image anchor; empty record omitted.
- Studio/personal HTML: 2/2 noindex, titles, viewer/gallery markers, originals revision, asset versions and lead.
- Image captions: 0 rendered records, templates/scripts/styles match source intent; 11 null captions preserved in provenance.
- Dependencies: 9/9 scripts/styles/mobile helper reachable.
- Homes/navigation: 2/2 exclude unlisted routes; sitemap PASS.
- 27 GETs; 5.35s; Windows TLS; Pillow 13.0.0; 10s/request.
- Actual revision: `211bd9d8cf0494a874fbb70b951b9a8bc2d45933`. Expected: `211bd9d8cf0494a874fbb70b951b9a8bc2d45933`.
- Revision: exact expected implementation checked.
- Delivery checks only; root owns UI verification.
- Evidence: public-http-results.json, public-dependency-http-results.json, public-verification.json.
- Blockers: none.

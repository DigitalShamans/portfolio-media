# Stylised Artworks service verification

Overall: PASS

- Originals: 16/16 HTTP 200, image/jpeg; exact bytes/SHA-256/Git blob, full decode, dimensions/orientation.
- Dimensions: 11 × 1920x1080; 2 × 3840x2160; 1 × 1696x1038; 2 × 1920x1200.
- Retained NFS/Aircraft/Phantom samples: 3/3 exact bytes/hash/decode/dimensions.
- Denials: 4/4 expected 404 (unknown revision, missing file, wrong case, video at JPEG endpoint).
- Media revision: `d389bde2044cbc19fb94d2862e981cc2a5f273a4`.
- Windows certificate trust; Pillow 13.0.0; HTTP 10.60s; 10s/request timeout.
- Facts/timings: service-http-results.json and service-verification.json.
- Blockers: none.

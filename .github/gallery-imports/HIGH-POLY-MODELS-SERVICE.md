# HIgh-Poly Models service verification

Overall: PASS

- Originals: 27/27 HTTP 200, image/jpeg; exact bytes/SHA-256/Git blob, full decode, dimensions/orientation.
- Dimensions: 2 × 1920x1080; 5 × 1600x1200; 3 × 1920x1200; 4 × 3840x2160; 10 × 2560x1440; 1 × 2509x1354; 1 × 2207x1328; 1 × 2511x1338.
- Retained NFS/Aircraft/Phantom samples: 3/3 exact bytes/hash/decode/dimensions.
- Denials: 4/4 expected 404 (unknown revision, missing file, wrong case, video at JPEG endpoint).
- Media revision: `0d8a70c4ed2f818e6ecf1c863b1e4c3477eae9f8`.
- Windows certificate trust; Pillow 13.0.0; HTTP 15.68s; 10s/request timeout.
- Facts/timings: service-http-results.json and service-verification.json.
- Blockers: none.

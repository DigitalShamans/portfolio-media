# Strange Brigade - Ancient Weapons service verification

Overall: PASS

- Originals: 13/13 HTTP 200, image/jpeg; exact bytes/SHA-256/Git blob, full decode, dimensions/orientation.
- Dimensions: 13 × 2560x1440.
- Retained NFS/Aircraft/Phantom samples: 3/3 exact bytes/hash/decode/dimensions.
- Denials: 4/4 expected 404 (unknown revision, missing file, wrong case, video at JPEG endpoint).
- Media revision: `19e539dd5bfe0f687926281a5a94b1d7fe144c75`.
- Windows certificate trust; Pillow 13.0.0; HTTP 10.91s; 10s/request timeout.
- Facts/timings: service-http-results.json and service-verification.json.
- Blockers: none.

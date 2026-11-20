# Exterior Visualisations service verification

Overall: PASS

- Originals: 19/19 HTTP 200, image/jpeg; exact bytes/SHA-256/Git blob, full decode, dimensions/orientation.
- Dimensions: 19 × 2000x1500.
- Retained NFS/Aircraft/Phantom samples: 3/3 exact bytes/hash/decode/dimensions.
- Denials: 4/4 expected 404 (unknown revision, missing file, wrong case, video at JPEG endpoint).
- Media revision: `37741ff5622207d7cb6326e3d28a33d04ec212c7`.
- Windows certificate trust; Pillow 13.0.0; HTTP 17.76s; 10s/request timeout.
- Facts/timings: service-http-results.json and service-verification.json.
- Blockers: none.

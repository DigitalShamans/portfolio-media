# Gallery publication status

Current item: publish the Aircrafts Pages routes, then verify both live routes.

- The working branch carries the Aircrafts pages, editable 23-entry JPG manifest, 23 verified WebPs, and four Sketchfab models in source order after the first image. Embeds use a separate manifest, with the next source image as a fallback anchor after an exclusion.
- Main baseline a3bc7eac includes support for saving approved image subsets. This branch incorporates that source state. No diagnostic workflow or protected gallery media is included.
- All Aircrafts originals are live at the approved revision. Media v6 deployment appgdep_6afedb642b8081918b906adb624e11da delivered 23 of 23 JPEGs, each byte-identical to the approved Git blob. Source sizes are 8 at 3840×2160, 12 at 1920×1080, and 3 at 1920×905. Existing NFS and Airplanes originals also loaded. Protected media required a session.
- Public gallery, embed and map manifests, image decoding and preview blob checks, and the local unit tests passed. Native Windows Gallery Editor UI and interactive playback remain to be checked. The app's save code retains the separate embed file.
- Next: open the Aircrafts PR, publish via the existing Pages workflow, and verify both routes. After the Aircrafts gate, acquire Phantom, then Firearms.

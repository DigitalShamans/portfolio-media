# portfolio-media

Website media and shared Digital Shamans branding and marketing assets. This repository is public, including files stored in Git LFS. Use it for material approved for public sharing.

| Folder | Contents |
| --- | --- |
| `galleries/` | Published gallery pages, `gallery.json` manifests, and web image exports |
| `projects/` | Published project media |
| `galleries_PNG/` | Original PNGs, organised by gallery folder and matching base filename |
| `branding/` | Logos, brand guidelines, and approved editable brand assets |
| `marketing/` | Approved press, campaign, and promotional materials |

GitHub Pages excludes the source PNG folders, branding and marketing folders, and Photoshop masters from the site. Put public gallery WebPs in `galleries/<gallery>/1440p/` and public cards and banners in `projects/` as regular Git files.

## Edit existing galleries in DS Gallery Editor

Pull both local checkouts in Fork, then open `portfolio-media/galleries/<gallery>/` in DS Gallery Editor v0.10 or later. The editor resolves originals in a sibling `portfolio-media-private/public/<gallery>/`; **Image folder…** remembers another location for that gallery. Save, then commit and push the website's changed `gallery.json` in Fork.

Reordering, comparison groups, and excluding or restoring already-approved images only change `gallery.json`. A gallery may use any selection of its approved originals. The approval inventory and original files stay intact when an image is excluded. Exclusion controls gallery visibility and does not revoke public approval. Every included primary and comparison still needs its committed matching WebP, and unapproved images remain blocked.

Adding new originals or replacing image bytes uses the media publication workflow below. The desktop editor does not generate WebPs or publish the image service.

## Publish gallery image updates

- Add or replace the original in the private media repository and update the approved list for new filenames or changed file contents. Keep the original's filename and the ordering of primary, comparison and additional images in the public gallery manifest.
- Export the approved public WebPs at up to 2560 × 1440 using the existing q92-m6 settings. The Pages workflow publishes these reviewed files as committed. It validates the matching WebP for every primary and comparison variant.
- Verify the delivery service at the new private media commit before updating `_data/gallery_delivery.json`. Update the public-only approved originals in `_data/public-gallery-originals.json` from the same revision. Commit both together with any changed WebPs and gallery manifests.
- Publish through the existing GitHub Pages workflow. Check public 4K on a wide desktop and 1440p on mobile in both portfolios. For rollback, revert the Pages update and retain service access to the prior media revision until the new Pages deployment is verified.

If the delivery revision is unset, 4K continues to come from the Pages checkout. When a verified immutable revision is configured, the delivery service supplies 4K and the Pages artifact excludes those originals. The RZ Start card remains a public banner. The gallery itself uses the existing password session.

## Interactive gallery maps

The user-accepted interactive map [working baseline](INTERACTIVE_MAP_BASELINE.md) records the verified commit, behaviour and regression checks.

Open `https://digitalshamans.co.uk/_tools/gallery-editor.html` in desktop Chrome or Edge, or open `_tools/gallery-editor.html` from your checkout. Choose `galleries/<gallery>` with **Open gallery folder**, then select **Interactive map**. The editor supports both original images and the repository's `1440p` WebP subfolder. Files stay on your computer.

1. Choose the overview image and give it a description.
2. Choose screenshots, click **Add screenshot**, and drag them onto the overview. Arrow keys move a selected screenshot by 1%; Shift moves it by 5%. Edit its label or remove it in the sidebar.
3. Click **Preview map** to try the same hover/tap interaction used by the published map. Return to editing to adjust positions.
4. Click **Save gallery-map.json**. In download-only mode, download that file and place it beside `gallery.json`. Image ordering and comparisons remain in their original manifest.
5. Commit and push in Fork. The build validates filenames, positions, descriptions and matching WebPs. Open `/experiments/gallery-map/?gallery=hb-atrium`, substituting your gallery folder. The personal version uses `/artur/experiments/gallery-map/?gallery=hb-atrium`.

Maps use images already included in the public gallery manifest, including its comparisons. Add any new overview image through the normal approved-image workflow first. Map configuration is public; RZ Start remains protected and is not supported by these public map pages. Maps are unlisted and excluded from the sitemap; the homepages and ordinary galleries are unchanged. The existing `/experiments/atrium-overview/` test now reads the same saved Atrium map.

The editor checks for external file changes before saving and prompts before discarding unsaved order or map edits. It reports invalid map files without replacing them; **Start a new map** only writes a replacement when you save.

## Git LFS

PSD and PSB files use Git LFS throughout the repository. In each local clone, run `git lfs install --local` before staging or pulling LFS assets. Use `git lfs ls-files` to check which files are stored in LFS. PNGs use regular Git. Add a specific LFS rule when another source format needs it.


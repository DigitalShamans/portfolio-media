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

## Publish gallery image updates

- Add or replace the original in the private media repository and update the approved list for any public gallery changes. Keep the original's filename and the ordering of primary, comparison and additional images in the public gallery manifest.
- Export the approved public WebPs at up to 2560 × 1440 using the existing q92-m6 settings. The Pages workflow publishes these reviewed files as committed. It validates the matching WebP for every primary and comparison variant.
- Verify the delivery service at the new private media commit before updating `_data/gallery_delivery.json`. Update the public-only approved originals in `_data/public-gallery-originals.json` from the same revision. Commit both together with any changed WebPs and gallery manifests.
- Publish through the existing GitHub Pages workflow. Check public 4K on a wide desktop and 1440p on mobile in both portfolios. For rollback, revert the Pages update and retain service access to the prior media revision until the new Pages deployment is verified.

If the delivery revision is unset, 4K continues to come from the Pages checkout. When a verified immutable revision is configured, the delivery service supplies 4K and the Pages artifact excludes those originals. The RZ Start card remains a public banner. The gallery itself uses the existing password session.

## Git LFS

PSD and PSB files use Git LFS throughout the repository. In each local clone, run `git lfs install --local` before staging or pulling LFS assets. Use `git lfs ls-files` to check which files are stored in LFS. PNGs use regular Git. Add a specific LFS rule when another source format needs it.

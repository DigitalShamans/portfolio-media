# portfolio-media

Website media and shared Digital Shamans branding and marketing assets. This repository is public, including files stored in Git LFS. Use it for material approved for public sharing.

| Folder | Contents |
| --- | --- |
| `galleries/` | Published gallery pages, `gallery.json` manifests, and web image exports |
| `projects/` | Published project media |
| `galleries_PNG/` | Original PNGs, organised by gallery folder and matching base filename |
| `branding/` | Logos, brand guidelines, and approved editable brand assets |
| `marketing/` | Approved press, campaign, and promotional materials |

GitHub Pages excludes the source PNG folders, branding and marketing folders, and Photoshop masters from the site. Put images used by the website in `galleries/` or `projects/` as regular Git files.

## Git LFS

PSD and PSB files use Git LFS throughout the repository. In each local clone, run `git lfs install --local` before staging or pulling LFS assets. Use `git lfs ls-files` to check which files are stored in LFS. PNGs use regular Git. Add a specific LFS rule when another source format needs it.

# Artur career timeline experiment

Unlisted test route: `/artur/experiments/career-timeline/`.

## Current layout

The broad S-curve and alternating checkpoint placement follow the user's annotated screenshot supplied on 19 November 2026. The 2012 "Back to freelance" checkpoint is removed. A new final Digital Shamans checkpoint reuses the supplied draft wording and displays "Present"; its wording and precise dates are for later refinement. There are still 12 checkpoints.

The original résumé dates and game details remain for the other entries. This experiment sets `seo_noindex: true` and `sitemap: false` and is not linked from the main navigation.

## Wider desktop composition

The paired before/after screenshots supplied later on 19 November set the desktop composition: move the complete timeline left and stretch its spline horizontally. The canvas now grows to 1800px instead of 1100px, with its left edge positioned relative to the 2000px site shell. At 3840px viewport width its left edge is 848.5px instead of 1362.5px. The site header stays in its existing position.

Large screens scale the timeline text, marker radii, stroke width, label spacing and top clearance together (1.25 at 1920px and 1.6 at 2560px). Label widths grow with the text; narrow screens retain their existing compact layout. No career wording or checkpoint positions changed in this revision.

## Curve visibility and positioning

- Curve height adapts to the viewport, reserving space for the header and introduction.
- Actual SVG arc-length samples calibrate the curve to fit at least 40% in a viewport. The implementation targets 42% as a safety margin and checks windows along the whole curve, rather than estimating from vertical height alone.
- A faint complete path keeps the upcoming shape visible; the bright stroke and travelling dot advance and reverse with scrolling.
- Normalized checkpoint positions and sides are stored in the HTML as `data-curve-at` and `data-curve-side`. Changing text does not change the intended checkpoint location.
- Text blocks are kept clear of the curve and each other, with short connectors back to their fixed markers.
- Narrow screens use a compact S-curve and checkpoint labels. Selecting a label or marker opens its complete date, role and project details in a keyboard-accessible native dialog. Compact layouts preserve readable text instead of shrinking a full desktop canvas.
- Resizing rebuilds MotionPath alignment from current geometry. Reduced motion or missing animation libraries keeps a static, readable version; without JavaScript the semantic career list remains available.

## Animation and references

One scrubbed GSAP timeline drives DrawSVG, MotionPath and desktop marker/label emphasis. Version 5 clamps its start and end to page bounds and uses a fixed pixel reveal line derived from the layout viewport (50% desktop, 65% mobile). The existing vendored GSAP, ScrollTrigger, DrawSVG and MotionPath 3.15.1 remain unchanged.

## Mobile reveal revision

The supplied mobile recording showed the current v3 page: upcoming labels began at 80% opacity, making the scroll reveal almost imperceptible. Version 4 changes the narrow-screen presentation:

- Upcoming dates and the complete route stay faintly visible, while employer labels enter from transparent with a 24px outward movement and an 8px rise.
- Each entrance runs for 0.66 seconds independently of swipe speed, rather than completing within a few pixels of scrolling. The travelling dot determines when each entrance plays or reverses.
- A thicker orange completed path, a larger glowing travelling dot with a white outline, and growing orange checkpoint markers distinguish progress from the faint upcoming route.
- The mobile scroll trigger follows the 65% viewport line with 0.35-second scrub smoothing. Scrolling back reverses the reveals; keyboard focus also reveals its checkpoint.
- The accepted desktop composition, original checkpoint positions and minimum curve visibility are retained. Static fallbacks show complete text without animation.
- Both asset URLs use `?v=4` so a normal page reload fetches this revision.

- [Supplied snorklTV tutorial](https://www.youtube.com/watch?v=ersN5fk8py0)
- [Accompanying demo](https://codepen.io/snorkltv/pen/KKmZYGy)
- [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [DrawSVG](https://gsap.com/docs/v3/Plugins/DrawSVGPlugin/)
- [MotionPath](https://gsap.com/docs/v3/Plugins/MotionPathPlugin/)

## Earlier S-curve validation

JavaScript syntax and the updated checkpoint inventory were checked. Browser QA covered 1363×936, 1100×844, 390×844 and 320×844 layouts. The minimum fitted arc fractions were 42.4%, 42.3%, 49.0% and 48.8% respectively; no checkpoint label overlaps or horizontal overflow were detected. Resizing while scrolled, complete details and dismissal, and forward/reverse scrolling were checked. All 12 checkpoints and the complete bright path were reached at the end.

## Wider-layout validation

Syntax and the 12-checkpoint inventory pass. Browser QA at 3840×2040, 1363×936, 390×844 and 320×844 found minimum fitted arc fractions of 45.0%, 46.2%, 49.0% and 48.8% respectively, with no label overlaps or horizontal overflow. Wide-layout forward/reverse scroll reached the complete path and all 12 checkpoints.

## Mobile-reveal validation

Version 4 passes JavaScript syntax and the 12-checkpoint inventory. Browser QA at 390×844 and 320×844 retains 49.0% and 48.8% minimum curve visibility, with no label overlaps or horizontal overflow. A checkpoint initially at zero copy opacity becomes fully visible after advancing the travelling dot. A fast scroll to the end reveals all 12 entries and completes the path; returning to the top hides the eight future labels again. Resizing while scrolled rebuilds the mobile/desktop presentation, and the final checkpoint still opens complete details and closes normally.

The 1363×936 desktop check retains its 46.2% minimum curve fraction, white completed path and existing label emphasis, with no overlaps or horizontal overflow. With GSAP omitted, all 12 copies remain fully visible in the static fallback. No application console errors were observed.

The existing Pages workflow performs the final repository validation and Jekyll build.

## Version 5: initial position, mobile stability and gallery previews

The second mobile recording shows that the v4 journey is already partway down the route at page load. The prior `top 65%` start was negative while the timeline was above that viewport line, so zero page scroll mapped to a later point near the 2015 checkpoints. Clamping the trigger start to zero now starts the drawn path at 2004. Browser history may still restore a genuinely scrolled position.

Mobile layout now measures `100svh` rather than the height changed by collapsible browser controls. The reveal line uses pixels calculated from that same stable height, so a subsequent ScrollTrigger refresh does not move the journey to a new viewport percentage. `ignoreMobileResize: true` suppresses the library's small vertical refreshes on touch-only devices. Width/orientation changes still rebuild the layout, and the font-ready rebuild only runs when fonts were actually loading. This removes the two resize/rebuild paths that could move the spline or reset entrances during scrolling.

Each of the ten employment descriptions now has a small 16:9 image slot beside its text. Eight use existing public gallery screenshots and link directly to the personal portfolio's corresponding gallery; image dimensions and CSS aspect ratio reserve space before loading. The images share the existing gallery assets, load lazily and require no new media files. There are unlinked placeholders for CI Games and Couch Heroes, which have no matching published galleries. Change the image `src`, `alt` and containing link `href` directly in the experiment HTML when assigning or replacing a preview.

| Checkpoint | Preview destination |
| --- | --- |
| Jujubee | `/artur/galleries/vehicles-aircrafts/` |
| Rebellion Developments | `/artur/galleries/sniper-elite-4/` |
| nDreams | `/artur/galleries/phantom-covert-ops/` |
| Chuhai Labs | `/artur/galleries/carve-snowboarding-vr-concept-art-design/` |
| Super Trumpers | `/artur/galleries/survisland-concept-art/` |
| Digital Shamans, 2021 | `/artur/galleries/carve-snowboarding-vr-concept-art-design/` |
| Realtime UK & EA | `/artur/galleries/nfs-unbound/` |
| Digital Shamans, Present | `/artur/galleries/hb-atrium/` |

Version 5 passes syntax and the 12-checkpoint inventory. Desktop Chrome browser QA used 390×844 and 320×844 frame viewports, 1363×936 desktop and 3840×2040 wide desktop. Their minimum curve fractions remain 49.0%, 48.8%, 46.2% and 45.0%; no label overlaps or horizontal overflow were found. Mobile slots measure exactly 16:9, all eight images loaded, a gallery link opened Sniper Elite 4, and the full employment-details dialog retained all role/project text. A fast scroll completes all 12 reveals, while a fresh top-of-page load starts with the 2004 label and a zero-length drawn path. The static fallback keeps every description visible. Automatic phone address-bar collapse itself is not reproduced by the desktop QA frames.

Both experiment assets now use `?v=5`.

## Version 6: slower mobile scrolling and horizontal following

On animated narrow layouts (the existing below-720px breakpoint), the timeline now takes exactly three times its former scroll distance to finish. A sticky viewport and translated canvas move the existing spline at one third of the document's scroll speed. The curve is not stretched, retaining the 40% visibility requirement. Scrolling remains native, including touch inertia: no wheel/touch interception or global scrolling change is added. After the timeline, ordinary page movement resumes. Desktop, missing-GSAP and reduced-motion layouts retain ordinary scrolling without the sticky camera.

The same camera pans horizontally so the travelling point stays at a constant left inset: 22% of viewport width, clamped to 64–96px. This is 85.8px on a 390px viewport and 70.4px at 320px. Copy widths account for the camera position, with room for previously revealed cards when the curve turns back left. Slightly smaller narrow-layout thumbnails preserve readable employment names while keeping their 16:9 proportions.

The journey still begins at 2004, reverses when scrolling back, and uses the existing timed checkpoint entrances, image links and details dialogs. The stable small viewport continues to protect against mobile toolbar height changes. The outer scroll track supplies the longer document range; only its inner canvas is translated, keeping the trigger geometry stable. Print resets the camera to a regular readable list.

Validation: syntax and checkpoint inventory pass. At 390×844, the measured scroll span is 2723.859px compared with 907.953px previously (3×). Two browser samples measured 0.333316px of canvas movement per pixel scrolled within the timeline and exactly 1px afterward. The point stayed within 0.05px of its horizontal target while scrolling in both directions. At 320×844 the point remained at 70.4px, with no card overlaps, clipped revealed cards, overflowing names or horizontal page overflow. All checkpoints complete, and a native tap opens the complete Rebellion employment dialog without moving the page. The 1363×936 desktop and static fallback use a static stage with no camera transform and multiplier 1. An independent arc-length check of the rendered 390px path over 201 camera positions found a minimum 44.3% of the whole spline visible during the animated journey.

CSS and JavaScript URLs now use `?v=6`. Runtime `data-scroll-multiplier`, `data-normal-scroll-distance`, `data-scroll-distance` and `data-camera-anchor` attributes support checking the active mode and geometry.

## Version 7: smooth desktop input and revised curve proportions

The supplied desktop recording compares stepped wheel input with continuous middle-button autoscrolling. Desktop now uses locally vendored GSAP ScrollSmoother 3.15.1 with a 0.8-second catch-up, smoothing the whole view and keeping the curve, text and marker synchronized. It uses native scrolling and is created before the timeline's ScrollTrigger. Mobile retains its native three-times-longer sticky journey. Reduced-motion and missing-library layouts remain readable without the smoother. Employment dialogs live outside the transformed wrapper; opening a dialog pauses desktop background scrolling and closing it resumes scrolling.

The preferred desktop screenshot restores the centered 1100px canvas. Desktop curve geometry keeps a fixed 1.25 height-to-width ratio instead of stretching to viewport width, fitting within the existing viewport visibility calculation. Large-screen typography scaling from the earlier wide experiment is removed so the narrower canvas retains the reference's normal text proportions. Desktop previews stay small at 100px wide.

On mobile, the curve span grows from 34% to 70% of the canvas width (roughly twice the previous horizontal sweep), capped at 300px. The fixed travelling-point column is 38% of viewport width, clamped to 96–180px, leaving enough of the wider route visible to preserve the 40% requirement. Cards stay inside the stage as the curve pans, with their connector endpoints following their actual positions. At the narrowest 320px layout, previews stack below the text to preserve readable names. The 2004 start, 16:9 images, gallery destinations and reverse reveals remain supported.

Validation: syntax and the 12-checkpoint inventory pass. After a desktop wheel step, the native scroll was already 234px while the rendered view had advanced 30.219px; it then smoothly caught up to 234px. Keyboard PageDown advanced and settled correctly. Dialog testing retained the complete Rebellion role and project text. The 1363×936, 1920×1080 and 3840×2040 desktop checks retain a 1100px canvas with no checkpoint overlaps or horizontal overflow; the revised large-screen typography has no overflowing words. Static fallback shows all descriptions with no fixed wrapper. Mobile checks at 390×844 and 320×844 found no clipped revealed cards, overlapping labels, overflowing names or horizontal page overflow, retaining multiplier 3 and subpixel horizontal tracking. Switching between mobile and desktop correctly enables and removes the smoother. Arc-length camera checks retain approximately 43.9% visibility at 390px and 44.8% at 320px.

Both experiment assets now use `?v=7`. ScrollSmoother's original license header and exact upstream bytes are retained; source: `greensock/GSAP`, tag `3.15.1`, `dist/ScrollSmoother.min.js` (blob `c61944dae681df0315b9f116bf9e7b1af4f646c7`). Reference: <https://gsap.com/docs/v3/Plugins/ScrollSmoother/>.

## Version 8: first steps, freelance and CI Games images

The 2004 First steps in CG checkpoint now displays the supplied Porsche Carrera GT / 3ds Max screenshot. The CI Games checkpoint displays the supplied Sniper Ghost Warrior 2 artwork instead of its empty slot. Both thumbnails open the original image in an accessible native image dialog, including from employment details. Close, Escape and backdrop dismissal are supported; closing an image above an employment dialog leaves that dialog open and desktop background scrolling paused. Modified clicks and missing-JavaScript links retain normal image navigation. The original JPEGs are stored unchanged under `assets/career-timeline/`.

First freelance work now links to the existing personal High-Poly Models gallery from its heading, curve marker and new thumbnail. Its preview reuses the gallery's first public WebP. Couch Heroes remains the only unassigned image slot. Existing 16:9 thumbnails, checkpoint dates, curve geometry, desktop smoothing and mobile camera behavior are retained.

Validation: JavaScript syntax and the 12-checkpoint preview build pass. Desktop browser checks confirm the 1022×734 Porsche and 960×534 Sniper originals open without leaving the timeline, Escape/Close dismiss them, nested image/details dialogs close in order, and the freelance heading opens the live High-Poly Models gallery. Responsive checks at 390×844 and 320×844 retain the 2004 start and mobile multiplier 3. The first thumbnail stays clear of its title and marker; the enlarged image fits the 320px viewport with no dialog horizontal overflow. Both uploaded files are byte-identical to the supplied originals. CSS and JavaScript URLs use `?v=8`.

## Freelance preview and gallery title correction

First Freelance Work now uses the user's supplied Unreal Engine interior screenshot (`assets/career-timeline/first-freelance-work.png`, original 2048×1087 PNG) instead of the gallery's first image. Its title and thumbnail still open `/artur/galleries/high-poly-models/`. The checkpoint capitalization is updated, and `HIgh-Poly Models` is corrected to `High-Poly Models` in both gallery routes and the personal portfolio listing. The existing gallery URL and image order are preserved; no animation code or style changes are required.

## Larger desktop thumbnails

Desktop timeline thumbnails now use 140px boxes instead of 100px, increasing their width and height by 40% while retaining 16:9 proportions. Desktop cards request an extra 40px of width; where space is limited, the thumbnail wraps below its description to keep the text readable. The rule is scoped to positioned, non-narrow timeline cards, preserving mobile thumbnails and employment-dialog image sizes. The spline geometry and gallery/image destinations are unchanged. Both CSS and JavaScript URLs use `?v=9`.

Validation: JavaScript syntax and the 12-checkpoint preview build pass. Browser measurements at 1363×936 confirm all thumbnail boxes changed from 100px to 140px. At 1363×936 and 1100×844, no overlapping cards, overflowing descriptions or horizontal page overflow were found. Narrow-layout checks at 390×844, 320×844 and 768×844 retain their previous thumbnail sizing, with no overlaps or text overflow.

## Shorter ending and slower second half

The supplied desktop screenshot shows the large empty area below View portfolio. Its cause was the outro's `50svh` minimum bottom padding (468px in the 936px browser check); that padding is now 2.5rem (40px at the normal font size).

The animated journey now blends from its existing speed to half speed around the middle of the spline. A smooth distance weighting transitions between 45% and 55% of visual progress; the latter portion uses twice the scroll distance. Desktop starts at 1px of timeline movement per scrolled pixel and finishes at 0.5px. Mobile preserves its existing one-third speed initially and finishes at one-sixth speed, retaining horizontal point tracking. Scrolling stays native, with desktop ScrollSmoother and the existing mobile scrub; no wheel or touch interception is added.

One scroll driver controls the visual timeline and a translated viewport stage. Its desktop camera reads ScrollSmoother's rendered position so cards, curve and pointer remain synchronized. The track reserves only the additional journey distance; its ending is bounded by the actual content, button and footer so the page does not acquire an empty tail or an unreachable animation endpoint on large screens. The original curve geometry, minimum visible fraction, 140px desktop thumbnails and gallery/image links are retained. Static and reduced-motion layouts keep normal document flow. CSS and JavaScript URLs now use `?v=10`.

Validation: syntax and the 12-checkpoint preview build pass. Native browser scroll samples at 1100×844 measure 1.0002px/pixel early and 0.5001px/pixel late; reversing to the same sample returns exactly the same canvas position. At 390×844, the corresponding rates are 0.33336 and 0.16668, with the point staying within 0.13px of its horizontal target. All 12 mobile descriptions reveal, and the final employment dialog retains its complete role/project text. At 320×844 and 3840×2040, the journey endpoint is reachable before the page's maximum scroll, and the final card, View portfolio and footer remain accessible. The static fallback has no stage transform and keeps all descriptions visible. No horizontal page overflow was found in these checks.

## Extended curved ending without connector lines

The latest annotated screenshot requests a longer lower bend that sweeps down and left. The final cubic now makes that broader return, and the Present checkpoint sits farther along it instead of crowding 2023. The full curve is fitted to the viewport with its original body proportions; historical checkpoint coordinates are renormalized to the longer path while retaining their order and relative placement. Present is at 95% of the full vertical extent. No career wording, images or destinations change.

The faint node-to-description connectors are removed completely: their SVG group, polyline generation, mobile updates and CSS rule are gone. The main curve, interactive checkpoint markers and travelling point remain. The final mobile card reserves enough room beside its marker as the camera follows the leftward return, keeping the Present date readable. The existing second-half slowdown, mobile tracking, larger desktop thumbnails and short footer spacing remain in place. CSS and JavaScript URLs use `?v=11`.

Validation: syntax, the 12-checkpoint preview build and normalized-position ordering pass. Browser checks at 1363×936, 1100×844, 390×844 and 320×844 find zero connector elements, no overlapping cards, no overflowing descriptions and no horizontal page overflow. Fitted curve-visibility fractions are 45.7%, 46.2%, 44.7% and 44.5%. Both phone sizes reach the final checkpoint, View portfolio and footer; the final employment dialog still shows the complete details. The static fallback keeps all descriptions visible with no connectors.

## Mockup alignment and smooth spline joins

The latest mockup reorganizes desktop cards rather than requiring a pixel copy. Left-side entries now place their thumbnail before the description, with a consistent 1rem gap and the date aligned toward the track. This keeps the SurvIsland image close to its text instead of reproducing the mockup's large gap. nDreams and the 2021 Digital Shamans entry place their year beside the heading. The 2021 card keeps its placeholder beside the heading/role and puts its two projects on one line beneath them when space permits; smaller widths wrap naturally. The compact nDreams row leaves its genre in the details dialog.

Super Trumpers now precedes Chuhai Labs at the two 2020 checkpoints. Following the mockup, the 2021 Digital Shamans entry lists MerCorp: The Retrieval and Hex Journey and uses an image slot; its Carve thumbnail/project are removed from that entry. The 2022 heading is Realtime UK, removing the crossed-out EA suffix. Present's draft projects and all other image/gallery links remain unchanged. Desktop alignment rules do not change the compact mobile card arrangement.

Spline handles now meet along the same tangent at all three cubic joins. The final return's first handle mirrors the preceding handle, removing the visible kink at the lower bend. The extended ending, native scroll behavior and second-half slowdown are retained. Both asset URLs use `?v=12`.

Validation: JavaScript syntax, the 12-checkpoint preview build and normalized order pass. A geometric check of the actual path control points measures a 0° tangent break at each join. Browser checks at 1363×936, 1100×844, 800×844, 390×844 and 320×844 find no overlapping cards, text overflow or horizontal page overflow. The SurvIsland image-to-text gap is 16px at 1363px and 1100px; the 2021 projects share one line at those widths. Phone endpoint access and the updated 2021 details dialog pass, and the static fallback keeps all 12 descriptions visible.

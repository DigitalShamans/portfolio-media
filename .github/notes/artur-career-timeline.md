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

On desktop, one scrubbed GSAP timeline drives DrawSVG, MotionPath, marker growth and label emphasis, with `start: 'top center'` and `end: 'bottom center'`. The existing vendored GSAP, ScrollTrigger, DrawSVG and MotionPath 3.15.1 remain unchanged.

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

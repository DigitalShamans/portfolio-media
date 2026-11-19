# Artur career timeline experiment

Unlisted test route: `/artur/experiments/career-timeline/`.

## Current layout

The broad S-curve and alternating checkpoint placement follow the user's annotated screenshot supplied on 19 November 2026. The 2012 "Back to freelance" checkpoint is removed. A new final Digital Shamans checkpoint reuses the supplied draft wording and displays "Present"; its wording and precise dates are for later refinement. There are still 12 checkpoints.

The original résumé dates and game details remain for the other entries. This experiment sets `seo_noindex: true` and `sitemap: false` and is not linked from the main navigation.

## Curve visibility and positioning

- Curve height adapts to the viewport, reserving space for the header and introduction.
- Actual SVG arc-length samples calibrate the curve to fit at least 40% in a viewport. The implementation targets 42% as a safety margin and checks windows along the whole curve, rather than estimating from vertical height alone.
- A faint complete path keeps the upcoming shape visible; the bright stroke and travelling dot advance and reverse with scrolling.
- Normalized checkpoint positions and sides are stored in the HTML as `data-curve-at` and `data-curve-side`. Changing text does not change the intended checkpoint location.
- Text blocks are kept clear of the curve and each other, with short connectors back to their fixed markers.
- Narrow screens use a compact S-curve and checkpoint labels. Selecting a label or marker opens its complete date, role and project details in a keyboard-accessible native dialog. Compact layouts preserve readable text instead of shrinking a full desktop canvas.
- Resizing rebuilds MotionPath alignment from current geometry. Reduced motion or missing animation libraries keeps a static, readable version; without JavaScript the semantic career list remains available.

## Animation and references

One scrubbed GSAP timeline drives DrawSVG, MotionPath, marker growth and label emphasis, with `start: 'top center'` and `end: 'bottom center'`. The existing vendored GSAP, ScrollTrigger, DrawSVG and MotionPath 3.15.1 remain unchanged.

- [Supplied snorklTV tutorial](https://www.youtube.com/watch?v=ersN5fk8py0)
- [Accompanying demo](https://codepen.io/snorkltv/pen/KKmZYGy)
- [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [DrawSVG](https://gsap.com/docs/v3/Plugins/DrawSVGPlugin/)
- [MotionPath](https://gsap.com/docs/v3/Plugins/MotionPathPlugin/)

## Validation of this revision

JavaScript syntax and the updated checkpoint inventory were checked. Browser QA covered 1363×936, 1100×844, 390×844 and 320×844 layouts. The minimum fitted arc fractions were 42.4%, 42.3%, 49.0% and 48.8% respectively; no checkpoint label overlaps or horizontal overflow were detected. Resizing while scrolled, complete details and dismissal, and forward/reverse scrolling were checked. All 12 checkpoints and the complete bright path were reached at the end.

The existing Pages workflow performs the final repository validation and Jekyll build.

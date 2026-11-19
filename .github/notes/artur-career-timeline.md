# Artur career timeline experiment

Unlisted test route: `/artur/experiments/career-timeline/`.

The 12 career entries are transcribed from the résumé timeline screenshot supplied on 19 November 2026. Keep both 2015 entries and both 2020 entries. The source ends at Couch Heroes in 2023; later career history has not been inferred. This experiment is not linked from the homepage or main navigation and sets `seo_noindex: true` and `sitemap: false`.

## Animation contract

- One vertical winding SVG path, a travelling dot and growing milestone circles. No horizontal panel navigation or snapping.
- One GSAP timeline with `scrub: true`, `start: 'top center'` and `end: 'bottom center'` drives the path drawing, dot and text reveals in both scroll directions.
- The SVG is measured from the semantic HTML rows, so wrapped text changes spacing without detaching the markers. A monotonic-Y path allows each milestone's actual path-length fraction to be found by binary search.
- ResizeObserver and viewport/font updates rebuild the MotionPath tween because its alignment is calculated at initialization. Existing scroll position supplies the rebuilt progress.
- Circle radius is animated around its fixed centre, avoiding SVG transform-origin offsets. Text remains in the accessibility tree during opacity reveals.
- Reduced-motion preference or unavailable GSAP libraries leaves the complete career readable as a static timeline. The HTML also remains readable with JavaScript disabled.
- Reuses the existing GSAP and ScrollTrigger 3.15.1. DrawSVGPlugin and MotionPathPlugin 3.15.1 are vendored from `greensock/GSAP` tag `3.15.1`, with their original license headers retained. All scripts are served from this site and only loaded by the experiment.

## References studied

- Supplied video: [snorklTV — GreenSock Scroll-Driven SVG Path Follower](https://www.youtube.com/watch?v=ersN5fk8py0), especially path/dot alignment, milestone timing and final ScrollTrigger setup.
- [Author's accompanying demo](https://codepen.io/snorkltv/pen/KKmZYGy)
- [ScrollTrigger documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [DrawSVG documentation](https://gsap.com/docs/v3/Plugins/DrawSVGPlugin/)
- [MotionPath documentation](https://gsap.com/docs/v3/Plugins/MotionPathPlugin/), including its resize/alignment caveat.

## Validation

JavaScript syntax and the 12 chronological dates were checked. Browser QA covered desktop scrolling and reverse playback, all 12 milestones at the end, 390px and 320px layouts, and resizing while scrolled. Milestone centres remained aligned with the SVG path to within one CSS pixel. The normal Pages workflow performs the final Jekyll build and repository checks when merged.

# Interactive image map working baseline

**Status:** Accepted by the user on 19 November 2026.

| Reference | Value |
| --- | --- |
| Baseline commit | [`a2b6f315f7a5a15839422b27ef84fd54edc73b2a`](https://github.com/DigitalShamans/portfolio-media/commit/a2b6f315f7a5a15839422b27ef84fd54edc73b2a) |
| Preserved branch | `baseline/interactive-map-2026-11-19` |
| Test gallery | https://digitalshamans.co.uk/experiments/atrium-overview/ |
| Latest implementation | [PR #58](https://github.com/DigitalShamans/portfolio-media/pull/58) |
| Successful deployment | [Publish portfolio run 44530749704](https://github.com/DigitalShamans/portfolio-media/actions/runs/44530749704) |

This records the accepted browser-based interactive map and its integration with the existing gallery fullscreen viewer.

## Accepted behaviour

- The overview uses the same displayed image sizing as the normal galleries. The Atrium test page includes all 32 gallery screenshots in manifest order, with comparison groups.
- Hovering continuously over a thumbnail for **400ms** enlarges it to **100% of the overview**. Leaving before the delay finishes cancels the pending enlargement.
- Every thumbnail has its own invisible keep-open rectangle, centred on its **original screen position**, rather than the enlarged image's centre. Its size is **45% of the map width by 54% of the map height**, matching the user's green annotated example. The rectangle is clipped at the map edges without shifting it inward.
- Moving outside that rectangle closes the hover preview immediately. No movement towards the enlarged image's centre is required first. Bounds follow resizing and scrolling.
- Clicking a hotspot on the page scrolls to its corresponding screenshot. Clicking that screenshot opens the existing fullscreen viewer.
- Clicking the main overview itself, or **Fullscreen overview**, opens the interactive map in that viewer. Clicking a fullscreen hotspot displays its screenshot within the viewer.
- The same hover delay, enlargement and position-based closing behaviour apply to the page and fullscreen map. Existing viewer navigation, keyboard controls, comparison switching and exit controls remain available.
- Touch uses the existing first-tap preview and second-tap navigation behaviour. Keyboard activation and focus previews remain available.

## Source references

Read these at the baseline commit when comparing or restoring map behaviour:

- `galleries/gallery-map.js`: hover timing, expansion, original thumbnail geometry and closing area.
- `galleries/gallery-map.css`: map sizing and presentation.
- `galleries/gallery-map-page.js`: screenshot targets, page scrolling and fullscreen map integration.
- `galleries/gallery-viewer.js`: shared image loading, comparisons and fullscreen controls.
- `_layouts/gallery-map.html` and `_includes/gallery-viewer.html`: map page and shared viewer markup.
- `galleries/hb-atrium/gallery-map.json` and `gallery.json`: map positions and screenshot order.
- `.github/tests/gallery-map.test.cjs`: map regression checks.

The viewer and its include are shared with ordinary galleries; compare later edits before restoring those files. Use this baseline as the regression reference for future map changes.

## Recorded validation

- All **20 map tests passed**, including all four thumbnail placements, all four closing boundaries, the Reception example, resizing, scrolling, dwell timing, click navigation and touch behaviour.
- JavaScript syntax validation passed.
- Browser checks confirmed the published test page serves `gallery-map.js?v=5`, opens the interactive overview in the existing fullscreen viewer, and displays the enlarged Reception preview.
- The deployment linked above completed successfully for the exact baseline commit.

For future map changes, run:

```sh
node --check galleries/gallery-map.js
node --test .github/tests/gallery-map.test.cjs
```

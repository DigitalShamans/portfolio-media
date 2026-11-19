# Gallery instructions

Use a plain ASCII hyphen with one space on each side between the game and gallery names in both the page title and main heading. Example: `Hard Bullet - Helipad`.

For ArtStation imports and gallery verification, use the in-app browser first.
Use `.github/scripts/gallery-browser-check.mjs` for bounded observation checks:
5 seconds per attempt, one fresh in-app tab retry, then automatic delivery-check
fallback with a 2-second deadline. Never report HTTP fallback as interactive success.
Use 5-second locator timeouts and a 15-second `cua_repl.js` call timeout. Do not
automatically launch or control native Chrome for routine gallery checks.
The JavaScript guard cannot cancel underlying UI input or an unresponsive tool
transport; never overlap another input after an unknown timed-out action. Reobserve
first. Dispatch independent HTTP checks immediately after Pages succeeds, before
optional browser work. Keep one gallery per release. Details: the import workflow.

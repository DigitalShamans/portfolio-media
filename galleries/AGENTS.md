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

Every gallery transfer must automatically release its screen-capture sessions
before the final response, including failed or interrupted transfers. Capture
owners must reset their native editor and browser automation sessions after the
last required screenshot. The release owner must then stop only the verified
Codex computer-use capture helper processes used for these checks, using current
process IDs, executable paths and parent identities. Never stop the main app,
unrelated recording/sharing apps or all Node/Chrome processes. Use the existing
authorized process-cleanup approach; do not ask the user again for routine cleanup.

Make this a finalization/finally step, and record the outcome in the gallery report.
One bounded retry is allowed for an automatically restarted helper; do not loop
until every idle helper disappears. Helper existence alone does not prove capture
is active. Do not take another desktop screenshot after cleanup, since that can
restart capture. If capture cannot be released, report the specific blocker and
do not claim the yellow frame is gone. See IMPORT-WORKFLOW.md for the procedure.

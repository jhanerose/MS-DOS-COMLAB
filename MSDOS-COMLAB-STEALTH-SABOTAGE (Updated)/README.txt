MSDOS-COMLAB: STEALTH SABOTAGE

Run: open index.html in a browser (no server or build step needed).

Structure
- index.html       menu, instructions, game layout
- css/style.css    Anchor/indigo interface styling
- js/game.js       game logic only (player, guard, sabotage, pause, leaderboard)
- assets/          every image, sprite GIF and the background music (no embedded base64)

Changes in this version
- Embedded base64 media moved out of game.js into assets/ (game.js: 827 KB -> ~20 KB).
- Fixed: guard search/caution sprites looked stretched; every state is now scaled by the guard's body so it matches the normal guard.
- Fixed: the guard walked through the computer banks; he now collides with them and path-finds around them (patrol, investigate, chase).
- Fixed: left-facing guard search/caution GIFs were mirrored twice and faced the wrong way.
- Fixed: event messages (DETECTED!, +1 point, etc.) were overwritten the same frame; they now stay ~2s.
- Fixed: typing in the name box triggered hide/pause/movement; arrow keys scrolled the page.
- Fixed: stuck keys after alt-tab; the game now auto-pauses when the tab is hidden.
- Fixed: guard investigation timer kept running during pause.
- Fixed: RESTART while paused left the game paused; a previous score could be credited to a newly typed name.
- Fixed: a blocked localStorage no longer crashes the whole game on load.

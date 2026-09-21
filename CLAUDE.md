# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no `package.json`, no bundler, no build step, no test suite, no linter. User-facing text (UI strings, README) is in Spanish.

## Running

Open `index.html` directly, or serve the directory statically (preferred):

```bash
python3 -m http.server 8000   # then http://localhost:8000
```

There are no automated tests; verify changes by playing the game in a browser.

## Architecture

Three files: `index.html` (DOM + two canvases + two overlays), `style.css` (one theme per skin), `game.js` (all logic). `game.js` is a plain classic script loaded at the end of `<body>` — it grabs DOM elements by id at top level, so element ids in `index.html` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `overlay-stats`, `theme-toggle`, `name-entry`, `player-name-input`, `save-score-btn`, `restart-btn`, `skin-select`, `highscore-list`, `best-combo`, `current-combo`, `best-lines`, `current-lines-stat`, `reset-scores-btn`, `pause-overlay`, `pause-resume-btn`, `pause-restart-btn`, `pause-controls-btn`, `pause-controls-panel`, `start-level-select`) are a contract with the script.

Key design points in `game.js`:

- **Global mutable state**: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`, `powerUpState`, `linesSincePowerUp`, `powerUpThreshold` are module-level `let`s, all (re)initialized in `init()`. The restart button just calls `init()`.
- **Piece type = color index**: `PIECES[i]` and `COLORS[i]` share indices 1–8 (index 0 is `null`). Shape matrices store the type number in filled cells, and `board` cells store that same number (0 = empty), so rendering reads the color straight from the cell value. `COLORS[9]` is the bomb power-up's color and is intentionally **not** in `PIECES`, so `randomPiece()` (which uses `PIECES.length - 1`) never produces it.
- **Collision** (`collide(shape, ox, oy)`) is the single source of truth for movement, rotation (`tryRotate` with horizontal kicks `[0,-1,1,-2,2]`), ghost projection (`ghostY`), gravity, and game-over detection in `spawn()`.
- **Lock pipeline**: `lockPiece()` → `merge()` → power-up effect if `current.powerUp` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next` to `current`, game over if it collides immediately).
- **Power-ups**: `POWER_UPS` maps an id to `{ mark, shape?, apply(piece) }`. `createPowerUpPiece(id)` builds the piece: without `shape` it's a random normal piece (merged cells keep their regular color); with `shape` it uses that fixed shape. Pieces carry `powerUp` (null or id); the special look is only drawn by `drawPiece`/`drawPowerUpMark`. `powerUpState` cycles `'none'` (clearLines accumulates `linesSincePowerUp` until a random 5–7 `powerUpThreshold`) → `'queued'` (next `spawn()` creates `next` with a uniformly random id) → `'inPlay'` (no counting, so only one at a time) → back to `'none'` via `resetPowerUpCycle()` when the piece locks.
  - `gravity` (random shape): `applyGravity` compacts each column downward.
  - `bomb` (1×1, type 9): `applyBomb` → `explodeArea(grid, cx, cy)` clears a clipped 3×3 around the cell. **Game-over rescue** in `spawn()`: if a bomb spawns colliding, the explosion is simulated on a board copy (`collide` takes an optional `grid` argument); if `next` would then fit, the copy becomes `board`, the cycle resets and `spawn()` recurses; otherwise normal `endGame()` with the board untouched.
- **Loop**: `requestAnimationFrame`-driven `loop(ts)` accumulates elapsed time and applies gravity when `dropAccum >= dropInterval`. Pause/game over work by cancelling the rAF (`animId`); resuming resets `lastTime` and calls `loop` again. Input is handled synchronously in the `keydown` listener, independent of the loop.
- **Scoring/speed**: `LINE_SCORES[cleared] * level`; soft drop +1/row, hard drop +2/row; level = `startLevel + floor(lines/10)`; `dropInterval = computeDropInterval(level) = max(100, 1000 - (level-1)*90)`.
- **Skins**: `SKINS` maps an id (`retro`, `neon`, `pastel`, `pixel`) to `{ label, colors, grid, effect }`. `applySkin(id)` swaps `activeColors`/`gridColor`, sets the `skin-<id>` class on `<body>` (each one redefines the CSS custom properties), persists to `localStorage` (`tetris-skin`) and redraws. `drawBlock` branches on `effect`: `flat`, `glow` (`shadowBlur`), `rounded` (`roundedRectPath`, also used by `drawPowerUpMark`) and `texture` (`drawPixelTexture`). `loadStoredSkin()` runs after `init()`.
- **Light/dark theme**: the `#theme-toggle` switch (next to the `TETRIS` title) is a layer *on top of* the skin. `applyTheme(isLight)` toggles `light-theme` on `<body>`; `refreshPalette()` — the single place that assigns `activeColors`/`gridColor`, called by both `applyTheme` and `applySkin` — then uses `LIGHT_COLORS`/`LIGHT_GRID_COLOR` instead of the skin's palette while the skin keeps its `effect`. The `body.light-theme` CSS block must stay **after** the `body.skin-*` blocks: same specificity, so it only wins by source order. The choice is not persisted (it resets to dark on reload), unlike the skin and the start level.
- **Pause menu**: `P`/`Escape` toggles `paused`; `openPauseMenu`/`closePauseMenu` show `#pause-overlay` (resume, restart, controls, start-level select) instead of the game-over overlay. Game input stays blocked while `paused`. `startLevel` persists in `localStorage` (`tetris-start-level`, clamped 1–9) and only takes effect on the next `init()`.
- **High scores**: top 5 `{ name, score, combo, lines }` in `localStorage` (`tetris-highscores`), read/written through `loadHighScores`/`saveHighScoresToStorage` (both fail soft). `clearLines()` returns the count so `lockPiece()` can track the `combo` streak and `maxCombo`. `endGame()` renders the table and, if `qualifiesForHighScore(score)`, shows the name field; `saveCurrentScore()` stores the entry and highlights it.

## Gotchas

- Changing `COLS`, `ROWS`, or `BLOCK` requires updating the `<canvas id="board">` `width`/`height` in `index.html` (`COLS×BLOCK` × `ROWS×BLOCK`). The next-piece preview assumes a 4×4 grid of 30px cells (120×120 canvas, hardcoded `NB = 30`).
- Adding a skin means touching both sides: an entry in `SKINS` (and a `drawBlock` branch if it needs a new `effect`), a `body.skin-<id>` block in `style.css` redefining the custom properties, and an `<option>` in `#skin-select`.

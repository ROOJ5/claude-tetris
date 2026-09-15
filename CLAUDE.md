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

Three files: `index.html` (DOM + two canvases + overlay), `style.css` (dark/retro theme), `game.js` (all logic). `game.js` is a plain classic script loaded at the end of `<body>` — it grabs DOM elements by id at top level, so element ids in `index.html` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`) are a contract with the script.

Key design points in `game.js`:

- **Global mutable state**: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`, `powerUpState`, `linesSincePowerUp`, `powerUpThreshold` are module-level `let`s, all (re)initialized in `init()`. The restart button just calls `init()`.
- **Piece type = color index**: `PIECES[i]` and `COLORS[i]` share indices 1–8 (index 0 is `null`). Shape matrices store the type number in filled cells, and `board` cells store that same number (0 = empty), so rendering reads the color straight from the cell value.
- **Collision** (`collide(shape, ox, oy)`) is the single source of truth for movement, rotation (`tryRotate` with horizontal kicks `[0,-1,1,-2,2]`), ghost projection (`ghostY`), gravity, and game-over detection in `spawn()`.
- **Lock pipeline**: `lockPiece()` → `merge()` → power-up effect if `current.powerUp` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next` to `current`, game over if it collides immediately).
- **Power-ups**: `POWER_UPS` maps an id to `{ mark, apply }`. Pieces carry `powerUp` (null or id); the shape keeps normal type numbers, so merged cells keep their regular color and the special look is only drawn by `drawPiece`/`drawPowerUpMark`. `powerUpState` cycles `'none'` (clearLines accumulates `linesSincePowerUp` until a random 5–7 `powerUpThreshold`) → `'queued'` (next `spawn()` tags the new `next`) → `'inPlay'` (no counting, so only one at a time) → back to `'none'` via `resetPowerUpCycle()` when the piece locks. Currently only `gravity` (`applyGravity`: compacts each column downward).
- **Loop**: `requestAnimationFrame`-driven `loop(ts)` accumulates elapsed time and applies gravity when `dropAccum >= dropInterval`. Pause/game over work by cancelling the rAF (`animId`); resuming resets `lastTime` and calls `loop` again. Input is handled synchronously in the `keydown` listener, independent of the loop.
- **Scoring/speed**: `LINE_SCORES[cleared] * level`; soft drop +1/row, hard drop +2/row; level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.

## Gotchas

- Changing `COLS`, `ROWS`, or `BLOCK` requires updating the `<canvas id="board">` `width`/`height` in `index.html` (`COLS×BLOCK` × `ROWS×BLOCK`). The next-piece preview assumes a 4×4 grid of 30px cells (120×120 canvas, hardcoded `NB = 30`).
- Resuming from pause (`togglePause`) does not re-add the `hidden` class to the overlay, so the "PAUSA" overlay stays visible after unpausing.

'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - blue
  '#ffb74d', // L - orange
  '#90a4ae', // N - tuerca (gris acero)
  '#ec407a', // B - bomba (power-up, no está en PIECES)
];

// Paleta Neón: colores muy saturados sobre fondo negro, con brillo (glow).
const NEON_COLORS = [
  null,
  '#00fff2', // I
  '#faff00', // O
  '#ff00f2', // T
  '#00ff66', // S
  '#ff003c', // Z
  '#2979ff', // J
  '#ff8c00', // L
  '#b0b0c8', // N
  '#ff2079', // B - bomba
];

// Paleta Pastel: colores suaves pero con suficiente saturación/oscuridad para
// mantener contraste legible contra el fondo claro del tablero (--board-bg).
const PASTEL_COLORS = [
  null,
  '#4fa3a8', // I
  '#e0a300', // O
  '#a875b0', // T
  '#5fa860', // S
  '#d3696d', // Z
  '#5f8fd0', // J
  '#d98a4a', // L
  '#8888a0', // N
  '#c25f8f', // B - bomba
];

// Paleta Pixel Art: igual que Retro, la textura de dither es lo que la distingue.
const PIXEL_COLORS = COLORS;

// Cada skin define su paleta de colores (índices 1-9, igual que COLORS/PIECES),
// el color de la cuadrícula y el efecto visual con el que `drawBlock` dibuja
// cada celda. `label` es el texto mostrado en el selector.
const SKINS = {
  retro:  { label: 'Retro',     colors: COLORS,        grid: '#22222e', effect: 'flat' },
  neon:   { label: 'Neón',      colors: NEON_COLORS,   grid: '#111318', effect: 'glow' },
  pastel: { label: 'Pastel',    colors: PASTEL_COLORS, grid: '#e6d9ea', effect: 'rounded' },
  pixel:  { label: 'Pixel Art', colors: PIXEL_COLORS,  grid: '#2a2a3a', effect: 'texture' },
};
const DEFAULT_SKIN = 'retro';
const SKIN_STORAGE_KEY = 'tetris-skin';

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (reto, hueco al centro)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Power-ups: aparecen como pieza especial tras eliminar 5–7 líneas (uno a la
// vez) y su efecto se aplica al asentarse la pieza. `shape` es opcional: sin
// ella el power-up usa una forma normal aleatoria.
const POWER_UPS = {
  gravity: { mark: 'G', apply: applyGravity },              // Gravedad: compacta los huecos
  bomb:    { mark: 'B', shape: [[9]], apply: applyBomb },   // Bomba: destruye un área 3x3
};
const POWER_UP_MIN_LINES = 5;
const POWER_UP_MAX_LINES = 7;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// powerUpState: 'none' (contando líneas) | 'queued' (sale en la próxima pieza) | 'inPlay'
let powerUpState, linesSincePowerUp, powerUpThreshold;
let currentSkin = DEFAULT_SKIN;
let activeColors = SKINS[currentSkin].colors;
let gridColor = SKINS[currentSkin].grid;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0, powerUp: null };
}

function resetPowerUpCycle() {
  powerUpState = 'none';
  linesSincePowerUp = 0;
  powerUpThreshold = POWER_UP_MIN_LINES +
    Math.floor(Math.random() * (POWER_UP_MAX_LINES - POWER_UP_MIN_LINES + 1));
}

// Cada columna "cae": los bloques se apilan en el fondo y los huecos suben.
function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c]) board[write--][c] = board[r][c];
    }
    for (; write >= 0; write--) board[write][c] = 0;
  }
}

// Vacía el área 3x3 centrada en (cx, cy), recortada a los límites del tablero.
function explodeArea(grid, cx, cy) {
  for (let r = Math.max(0, cy - 1); r <= Math.min(ROWS - 1, cy + 1); r++)
    for (let c = Math.max(0, cx - 1); c <= Math.min(COLS - 1, cx + 1); c++)
      grid[r][c] = 0;
}

// La bomba es 1x1, así que (x, y) es su propia celda.
function applyBomb(piece) {
  explodeArea(board, piece.x, piece.y);
}

function createPowerUpPiece(id) {
  const piece = randomPiece();
  const { shape } = POWER_UPS[id];
  if (shape) {
    piece.shape = shape.map(row => [...row]);
    piece.type = shape.flat().find(v => v);
    piece.x = Math.floor(COLS / 2) - Math.floor(piece.shape[0].length / 2);
  }
  piece.powerUp = id;
  return piece;
}

function randomPowerUpId() {
  const ids = Object.keys(POWER_UPS);
  return ids[Math.floor(Math.random() * ids.length)];
}

function collide(shape, ox, oy, grid = board) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && grid[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    // solo un power-up a la vez: no se cuentan líneas mientras hay uno pendiente
    if (powerUpState === 'none') {
      linesSincePowerUp += cleared;
      if (linesSincePowerUp >= powerUpThreshold) powerUpState = 'queued';
    }
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  if (current.powerUp) {
    POWER_UPS[current.powerUp].apply(current);
    resetPowerUpCycle();
  }
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (powerUpState === 'queued') {
    next = createPowerUpPiece(randomPowerUpId());
    powerUpState = 'inPlay';
  }
  if (collide(current.shape, current.x, current.y)) {
    // Bomba bloqueada al aparecer: se simula la explosión en su posición; si
    // así la siguiente pieza cabe, se aplica y la partida continúa.
    if (current.powerUp === 'bomb') {
      const trial = board.map(row => [...row]);
      explodeArea(trial, current.x, current.y);
      if (!collide(next.shape, next.x, next.y, trial)) {
        board = trial;
        resetPowerUpCycle();
        spawn();
        return;
      }
    }
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// Construye el path de un rectángulo con esquinas redondeadas (skin Pastel).
function roundedRectPath(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

// Superpone una sub-cuadrícula con celdas alternadas más oscuras para simular
// una textura "pixelada"/dither (skin Pixel Art).
function drawPixelTexture(context, px, py, size) {
  const sub = 4;
  const cell = (size - 2) / sub;
  context.fillStyle = 'rgba(0,0,0,0.16)';
  for (let sy = 0; sy < sub; sy++) {
    for (let sx = 0; sx < sub; sx++) {
      if ((sx + sy) % 2 === 0) continue;
      context.fillRect(px + 1 + sx * cell, py + 1 + sy * cell, cell, cell);
    }
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const effect = SKINS[currentSkin].effect;
  const color = activeColors[colorIndex];
  const px = x * size, py = y * size;

  context.save();
  context.globalAlpha = alpha ?? 1;

  if (effect === 'glow') {
    context.shadowColor = color;
    context.shadowBlur = size * 0.6;
  }

  context.fillStyle = color;
  if (effect === 'rounded') {
    roundedRectPath(context, px + 1, py + 1, size - 2, size - 2, size * 0.25);
    context.fill();
  } else {
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
  }

  // El resto de detalles (textura, brillo) no debe difuminarse.
  context.shadowBlur = 0;

  if (effect === 'texture') drawPixelTexture(context, px, py, size);

  // highlight
  if (effect === 'rounded') {
    context.save();
    roundedRectPath(context, px + 1, py + 1, size - 2, size - 2, size * 0.25);
    context.clip();
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(px + 1, py + 1, size - 2, 4);
    context.restore();
  } else {
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px + 1, py + 1, size - 2, 4);
  }

  context.restore();
}

// Marca de pieza especial: borde y letra con contorno oscuro (legible en ambos temas).
function drawPowerUpMark(context, x, y, size, mark, alpha) {
  const px = x * size, py = y * size;
  context.globalAlpha = alpha ?? 1;
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  if (SKINS[currentSkin].effect === 'rounded') {
    roundedRectPath(context, px + 2, py + 2, size - 4, size - 4, size * 0.25);
    context.stroke();
  } else {
    context.strokeRect(px + 2, py + 2, size - 4, size - 4);
  }
  context.font = `bold ${Math.floor(size * 0.6)}px monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 3;
  context.strokeStyle = '#000000';
  context.strokeText(mark, px + size / 2, py + size / 2 + 1);
  context.fillStyle = '#ffffff';
  context.fillText(mark, px + size / 2, py + size / 2 + 1);
  context.globalAlpha = 1;
}

function drawPiece(context, piece, offX, offY, size, alpha) {
  const mark = piece.powerUp && POWER_UPS[piece.powerUp].mark;
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      drawBlock(context, offX + c, offY + r, piece.shape[r][c], size, alpha);
      if (mark) drawPowerUpMark(context, offX + c, offY + r, size, mark, alpha);
    }
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // tras game over la pieza generada colisiona con el tablero; no dibujarla
  if (gameOver) return;

  // ghost
  drawPiece(ctx, current, current.x, ghostY(), BLOCK, 0.2);

  // current piece
  drawPiece(ctx, current, current.x, current.y, BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  drawPiece(nextCtx, next, offX, offY, NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function applySkin(skinId) {
  if (!SKINS[skinId]) skinId = DEFAULT_SKIN;
  currentSkin = skinId;
  for (const id of Object.keys(SKINS)) document.body.classList.remove(`skin-${id}`);
  document.body.classList.add(`skin-${skinId}`);
  activeColors = SKINS[skinId].colors;
  gridColor = SKINS[skinId].grid;
  if (skinSelect) skinSelect.value = skinId;
  try { localStorage.setItem(SKIN_STORAGE_KEY, skinId); } catch (e) { /* almacenamiento no disponible */ }
  draw();
  drawNext();
}

function loadStoredSkin() {
  let stored = null;
  try { stored = localStorage.getItem(SKIN_STORAGE_KEY); } catch (e) { /* almacenamiento no disponible */ }
  applySkin(stored && SKINS[stored] ? stored : DEFAULT_SKIN);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() puede ejecutarse dentro de este frame (vía lockPiece -> spawn);
  // su cancelAnimationFrame no detiene el frame actual, así que no reprogramar.
  if (gameOver || paused) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  resetPowerUpCycle();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
if (skinSelect) skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

init();
loadStoredSkin();

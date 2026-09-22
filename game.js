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

// En modo claro el amarillo y el naranja pierden contraste contra el fondo
// claro del tablero; se oscurecen para mantenerse legibles.
const LIGHT_COLORS = COLORS.map((color, i) => {
  if (i === 2) return '#f9a825'; // O - amarillo -> ámbar oscuro
  if (i === 7) return '#ef6c00'; // L - naranja -> naranja oscuro
  if (i === 8) return '#607d8b'; // N - gris acero -> gris azulado oscuro
  return color;
});

const GRID_COLOR = { dark: '#22222e', light: '#d0d0dc' };

// Colores propios de cada skin (mismos índices 1-9 que PIECES/COLORS).
const NEON_COLORS = [
  null, '#00e5ff', '#faff00', '#e000ff', '#00ff6a',
  '#ff2447', '#2979ff', '#ff9100', '#c0c0c0', '#ff2d9e',
];
const PASTEL_COLORS = [
  null, '#a8e6ff', '#fff3b0', '#d9b8f3', '#b8f2c9',
  '#ffb3ba', '#b3d1ff', '#ffd9b3', '#cfd8dc', '#ffb3d1',
];
// En claro los pasteles pierden contraste contra un fondo blanco; se oscurecen un poco.
const PASTEL_LIGHT_COLORS = PASTEL_COLORS.map(c => c);
PASTEL_LIGHT_COLORS[2] = '#f2c94c';

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

// Cada skin define su paleta (dark/light) y cómo dibujar un bloque ya resuelto
// a un color concreto (drawBlock ya se encargó de traducir colorIndex -> color).
const SKINS = {
  retro: {
    colors: COLORS,
    lightColors: LIGHT_COLORS,
    draw(context, x, y, color, size, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    colors: NEON_COLORS,
    lightColors: NEON_COLORS,
    draw(context, x, y, color, size, alpha) {
      const px = x * size + 3, py = y * size + 3, s = size - 6;
      context.save();
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.shadowBlur = size * 0.6;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      context.shadowBlur = 0;
      context.strokeStyle = 'rgba(255,255,255,0.6)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      context.restore();
    },
  },
  pastel: {
    colors: PASTEL_COLORS,
    lightColors: PASTEL_LIGHT_COLORS,
    draw(context, x, y, color, size, alpha) {
      const px = x * size + 2, py = y * size + 2, s = size - 4;
      const r = size * 0.22;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      roundRectPath(context, px, py, s, s, r);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.4)';
      roundRectPath(context, px, py, s, s * 0.35, r);
      context.fill();
      context.globalAlpha = 1;
    },
  },
  pixel: {
    colors: COLORS,
    lightColors: LIGHT_COLORS,
    draw(context, x, y, color, size, alpha) {
      const px = x * size + 1, py = y * size + 1, s = size - 2;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      const cell = Math.max(3, Math.floor(size / 6));
      context.fillStyle = 'rgba(0,0,0,0.15)';
      for (let ry = 0; ry * cell < s; ry++)
        for (let rx = 0; rx * cell < s; rx++)
          if ((rx + ry) % 2 === 0) context.fillRect(px + rx * cell, py + ry * cell, cell, cell);
      context.strokeStyle = 'rgba(255,255,255,0.25)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      context.globalAlpha = 1;
    },
  },
};
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

const HIGH_SCORES_KEY = 'tetrisRecords';
const MAX_HIGH_SCORES = 5;

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
const themeToggle = document.getElementById('theme-toggle');
const highScoresListEl = document.getElementById('high-scores-list');
const overlayScoresListEl = document.getElementById('overlay-scores-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const overlayNewScoreForm = document.getElementById('overlay-newscore-form');
const playerNameInput = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseMenuView = document.getElementById('pause-menu-view');
const pauseControlsView = document.getElementById('pause-controls-view');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level-select');
const skinSelect = document.getElementById('skin-select');

const MAX_START_LEVEL = 15;
for (let lvl = 1; lvl <= MAX_START_LEVEL; lvl++) {
  const option = document.createElement('option');
  option.value = lvl;
  option.textContent = lvl;
  startLevelSelect.appendChild(option);
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let startLevel = 1;
// powerUpState: 'none' (contando líneas) | 'queued' (sale en la próxima pieza) | 'inPlay'
let powerUpState, linesSincePowerUp, powerUpThreshold;
// combo: -1 = sin racha; sube en cada línea eliminada consecutiva entre piezas
let combo, bestComboRun;
let isLight = false;
let currentSkin = localStorage.getItem(SKIN_STORAGE_KEY) in SKINS
  ? localStorage.getItem(SKIN_STORAGE_KEY)
  : 'retro';
let gridColor = GRID_COLOR.dark;
let records = loadRecords();

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function defaultRecords() {
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIGH_SCORES_KEY));
    if (!raw || !Array.isArray(raw.scores)) return defaultRecords();
    return {
      scores: raw.scores.slice(0, MAX_HIGH_SCORES),
      bestCombo: Number(raw.bestCombo) || 0,
      maxLines: Number(raw.maxLines) || 0,
    };
  } catch {
    return defaultRecords();
  }
}

function saveRecords() {
  localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(records));
}

// Inserta la entrada, reordena por puntuación y recorta al top N.
// Devuelve el índice de la entrada insertada, o -1 si no entró al top.
function addHighScore(entry) {
  const merged = [...records.scores, entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_HIGH_SCORES);
  records.scores = merged;
  return merged.indexOf(entry);
}

function qualifiesForHighScore(candidateScore) {
  if (candidateScore <= 0) return false;
  if (records.scores.length < MAX_HIGH_SCORES) return true;
  return candidateScore > records.scores[records.scores.length - 1].score;
}

function renderHighScoreList(el, highlightIndex) {
  if (!el) return;
  el.innerHTML = '';
  if (records.scores.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin puntuaciones aún';
    el.appendChild(li);
    return;
  }
  records.scores.forEach((entry, i) => {
    const li = document.createElement('li');
    if (i === highlightIndex) li.className = 'highlight';
    const name = document.createElement('span');
    name.className = 'hs-name';
    name.textContent = `${i + 1}. ${entry.name}`;
    const scoreSpan = document.createElement('span');
    scoreSpan.textContent = entry.score.toLocaleString();
    li.appendChild(name);
    li.appendChild(scoreSpan);
    el.appendChild(li);
  });
}

function renderRecords(highlightIndex = -1) {
  renderHighScoreList(highScoresListEl, highlightIndex);
  renderHighScoreList(overlayScoresListEl, highlightIndex);
  bestComboEl.textContent = records.bestCombo;
  maxLinesEl.textContent = records.maxLines;
}

function resetRecords() {
  if (!confirm('¿Borrar todas las puntuaciones guardadas?')) return;
  records = defaultRecords();
  saveRecords();
  renderRecords();
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
    combo++;
    bestComboRun = Math.max(bestComboRun, combo);
    // solo un power-up a la vez: no se cuentan líneas mientras hay uno pendiente
    if (powerUpState === 'none') {
      linesSincePowerUp += cleared;
      if (linesSincePowerUp >= powerUpThreshold) powerUpState = 'queued';
    }
    updateHUD();
  } else {
    combo = -1;
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin];
  const palette = isLight ? skin.lightColors : skin.colors;
  skin.draw(context, x, y, palette[colorIndex], size, alpha ?? 1);
}

// Marca de pieza especial: borde y letra con contorno oscuro (legible en ambos temas).
function drawPowerUpMark(context, x, y, size, mark, alpha) {
  const px = x * size, py = y * size;
  context.globalAlpha = alpha ?? 1;
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  context.strokeRect(px + 2, py + 2, size - 4, size - 4);
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

  records.bestCombo = Math.max(records.bestCombo, bestComboRun);
  records.maxLines = Math.max(records.maxLines, lines);
  saveRecords();

  if (qualifiesForHighScore(score)) {
    overlayNewScoreForm.classList.remove('hidden');
    playerNameInput.value = localStorage.getItem('tetrisPlayerName') || '';
    renderRecords();
    setTimeout(() => playerNameInput.focus(), 0);
  } else {
    overlayNewScoreForm.classList.add('hidden');
    renderRecords();
  }

  overlay.classList.remove('hidden');
}

function saveCurrentScore() {
  const name = playerNameInput.value.trim() || 'AAA';
  localStorage.setItem('tetrisPlayerName', name);
  const index = addHighScore({ name, score, lines, combo: bestComboRun });
  saveRecords();
  overlayNewScoreForm.classList.add('hidden');
  renderRecords(index);
}

function applyTheme(light) {
  isLight = light;
  document.body.classList.toggle('light-theme', isLight);
  gridColor = isLight ? GRID_COLOR.light : GRID_COLOR.dark;
  draw();
  drawNext();
}

function applySkin(skin) {
  if (!(skin in SKINS)) return;
  currentSkin = skin;
  localStorage.setItem(SKIN_STORAGE_KEY, currentSkin);
  draw();
  drawNext();
}

function showPauseMenuView() {
  pauseControlsView.classList.add('hidden');
  pauseMenuView.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMenuView();
    pauseOverlay.classList.remove('hidden');
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
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  combo = -1;
  bestComboRun = 0;
  resetPowerUpCycle();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  overlayNewScoreForm.classList.add('hidden');
  renderRecords();
  pauseOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
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
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked));
resetScoresBtn.addEventListener('click', resetRecords);
saveScoreBtn.addEventListener('click', saveCurrentScore);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveCurrentScore();
});
skinSelect.value = currentSkin;
skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
showControlsBtn.addEventListener('click', () => {
  pauseMenuView.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
});
backBtn.addEventListener('click', showPauseMenuView);
startLevelSelect.addEventListener('change', () => {
  startLevel = Number(startLevelSelect.value);
});

startLevelSelect.value = startLevel;
init();

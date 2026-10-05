/*
  PUSH & PUZ
  Six rows on the long axis. Discs pack around a center well.
  Each side holds a hand of two. No refill until that hand is empty and the board has settled.
  Both sides fire any time a disc is in the hand. The well splits the screen: left tap fires left, right tap fires right.
  Match check waits until every fired disc has settled.
  A match is a color group of MATCH or more. Groups live on the board.
  Pop is not back yet. bigText is the award line for the player.
  An empty row takes two discs after a settle and does not match.
  A visible disc on your end slot loses. Animation is not the grid.
*/

const HAND = 2;
const BOARD_SETS = 3;
const SETTLE_MIN = 0.26;
const SETTLE_MAX = 0.9;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const APP_VERSION = ((document.getElementById("puz-version") || {}).textContent || "").trim();

const state = {
  w: 0, h: 0, viewW: 0, viewH: 0, dpr: 1, portrait: false,
  mode: "title", phase: "idle", phaseT: 0,
  rows: [], bags: [[], []], stock: [[], []], boardBag: [],
  bigText: "", bigT: 0,
  loser: -1, last: 0, flyers: [],
  colorLinks: [], colorGroups: [],
  boardLeft: 0, boardRight: 0, boardTop: 0, pitch: 0, half: 0, discR: 0, wellX: 0
};

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = list[i];
    list[i] = list[j];
    list[j] = t;
  }
  return list;
}

function colorPackOfSets(sets) {
  const pack = [];
  for (let s = 0; s < sets; s++) {
    for (let c = 0; c < COLS.length; c++) pack.push(c);
  }
  return shuffle(pack);
}

function takeBoardColor() {
  while (state.boardBag.length < COLS.length * BOARD_SETS) {
    const more = colorPackOfSets(1);
    for (let k = 0; k < more.length; k++) state.boardBag.push(more[k]);
  }
  return state.boardBag.shift();
}

function makeCell(color) {
  return { color: color, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
}

function topUp(p) {
  if (state.stock[p].length) return;
  const more = colorPackOfSets(2);
  for (let k = 0; k < more.length; k++) state.stock[p].push(more[k]);
}

function takeStock(p) {
  topUp(p);
  return state.stock[p].shift();
}

function dealHand(p) {
  while (state.bags[p].length < HAND) state.bags[p].push({ color: takeStock(p) });
}

function newGame() {
  state.rows = freshRows();
  state.stock = [colorPackOfSets(2), colorPackOfSets(2)];
  state.bags = [[], []];
  state.boardBag = [];
  dealHand(0);
  dealHand(1);
  state.phase = "idle";
  state.phaseT = 0;
  state.bigText = "";
  state.bigT = 0;
  state.loser = -1;
  state.flyers = [];
  state.colorLinks = [];
  state.colorGroups = [];
  state.mode = "play";
  for (let n = 0; n < 40; n++) {
    const dealt = [];
    for (let r = 0; r < ROWS; r++) {
      const a = takeBoardColor();
      const b = takeBoardColor();
      dealt.push(a, b);
      state.rows[r].cells = [makeCell(a), makeCell(b)];
    }
    findColorGroups();
    if (!matchedGroups().length) break;
    for (let k = dealt.length - 1; k >= 0; k--) state.boardBag.unshift(dealt[k]);
    shuffle(state.boardBag);
  }
  layoutTargets();
  snapCells();
  findColorGroups();
}

function requestPageFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
  if (!req) return;
  try {
    const p = req.call(el);
    if (p && typeof p.then === "function") p.catch(function () {});
  } catch (err) {}
}

function resize() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  canvas.style.width = viewW + "px";
  canvas.style.height = viewH + "px";
  state.viewW = viewW;
  state.viewH = viewH;
  state.dpr = dpr;
  state.portrait = viewH > viewW;
  state.w = Math.max(viewW, viewH);
  state.h = Math.min(viewW, viewH);
  const queuePad = 0.9;
  const pitchH = state.h / ROWS;
  const pitchW = state.w / (END + 0.5 + queuePad * 2);
  state.pitch = Math.min(pitchH, pitchW);
  state.half = state.pitch * 0.5;
  state.discR = state.pitch * 0.34;
  state.wellX = state.w * 0.5;
  state.boardTop = (state.h - state.pitch * ROWS) * 0.5;
  state.boardLeft = state.wellX - (END + 0.5) * state.half;
  state.boardRight = state.wellX + (END + 0.5) * state.half;
  if (state.mode !== "title") {
    layoutTargets();
    if (state.phase !== "settle") snapCells();
    for (let i = 0; i < state.flyers.length; i++) {
      const shot = state.flyers[i];
      shot.cell.y = rowY(shot.row);
      shot.cell.tx = contactX(shot.row, shot.side);
    }
  }
}

function screenToWorld(sx, sy) {
  if (!state.portrait) return { x: sx, y: sy };
  return { x: sy, y: state.h - sx };
}

function rowAt(y) {
  const r = Math.floor((y - state.boardTop) / state.pitch);
  if (r < 0 || r >= ROWS) return -1;
  return r;
}

function shoot(row, side) {
  if (state.mode !== "play") return;
  if (row < 0 || row >= ROWS) return;
  if (side !== 0 && side !== 1) return;
  if (!state.bags[side].length) return;
  if (state.phase === "idle") {
    state.bigText = "";
    state.bigT = 0;
  }
  const disc = state.bags[side].shift();
  const cell = makeCell(disc.color);
  cell.x = slotX(side === 0 ? -END - 2 : END + 2);
  cell.y = rowY(row);
  cell.tx = contactX(row, side);
  cell.ty = cell.y;
  cell.vx = side === 0 ? state.pitch * 9 : -state.pitch * 9;
  state.flyers.push({ cell: cell, row: row, side: side, t: 0 });
  if (state.phase !== "settle") {
    state.phase = "fly";
    state.phaseT = 0;
  }
}

function afterSettle() {
  snapCells();
  findColorGroups();
  const loss = edgeLoss();
  if (loss.left || loss.right) {
    state.mode = "over";
    state.phase = "idle";
    state.loser = loss.left && loss.right ? 2 : (loss.left ? 0 : 1);
    return;
  }
  let filled = false;
  for (let r = 0; r < ROWS; r++) {
    const row = state.rows[r];
    if (row.cells.length) continue;
    filled = true;
    const center = row.lw - row.rw;
    for (let n = 0; n < 2; n++) {
      const cell = makeCell(takeBoardColor());
      const slot = center + (n === 0 ? -1 : 1);
      cell.x = slotX(slot);
      cell.tx = cell.x;
      cell.y = rowY(r);
      cell.ty = cell.y;
      row.cells.push(cell);
    }
  }
  if (filled) {
    layoutTargets();
    snapCells();
    findColorGroups();
  }
  if (!state.bags[0].length) dealHand(0);
  if (!state.bags[1].length) dealHand(1);
  state.phase = "idle";
}

function update(dt) {
  if (state.mode === "title") return;
  if (state.bigT > 0) state.bigT -= dt;
  const kBal = 78;
  const dampBal = 9.5;
  for (let r = 0; r < ROWS; r++) {
    const row = state.rows[r];
    const target = row.lw - row.rw;
    row.bvx += ((target - row.bal) * kBal - row.bvx * dampBal) * dt;
    row.bal += row.bvx * dt;
    if (Math.abs(target - row.bal) < 0.02 && Math.abs(row.bvx) < 0.4) {
      row.bal = target;
      row.bvx = 0;
    }
  }
  if (state.mode === "over") return;
  state.phaseT += dt;
  let arrived = false;
  for (let i = state.flyers.length - 1; i >= 0; i--) {
    const shot = state.flyers[i];
    const c = shot.cell;
    shot.t += dt;
    c.tx = contactX(shot.row, shot.side);
    c.ty = rowY(shot.row);
    c.vx += ((c.tx - c.x) * 70 - c.vx * 8) * dt;
    c.x += c.vx * dt;
    c.y += (c.ty - c.y) * Math.min(1, dt * 14);
    const home = shot.side === 0 ? c.x >= c.tx - 1 : c.x <= c.tx + 1;
    if (!home && shot.t <= 0.7) continue;
    c.x = c.tx;
    c.vx = shot.side === 0 ? state.pitch * 4 : -state.pitch * 4;
    if (shot.side === 0) state.rows[shot.row].cells.unshift(c);
    else state.rows[shot.row].cells.push(c);
    state.flyers.splice(i, 1);
    arrived = true;
  }
  if (arrived) {
    layoutTargets();
    state.phase = "settle";
    state.phaseT = 0;
  }
  if (state.phase === "settle") {
    let calm = state.flyers.length === 0;
    const k = 78;
    const damp = 9.5;
    for (let r = 0; r < ROWS; r++) {
      const cells = state.rows[r].cells;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        c.vx += ((c.tx - c.x) * k - c.vx * damp) * dt;
        c.vy += ((c.ty - c.y) * k - c.vy * damp) * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (Math.abs(c.tx - c.x) > 1.4 || Math.abs(c.vx) > 36) calm = false;
      }
    }
    if ((calm && state.phaseT >= SETTLE_MIN) || (state.flyers.length === 0 && state.phaseT >= SETTLE_MAX)) afterSettle();
  }
}

function onPoint(x, y) {
  if (state.mode === "title") return;
  if (state.mode === "over") {
    newGame();
    return;
  }
  const row = rowAt(y);
  if (row < 0) return;
  if (x === state.wellX) return;
  shoot(row, x < state.wellX ? 0 : 1);
}

function bindInput() {
  canvas.addEventListener("click", function () {
    if (state.mode !== "title") return;
    requestPageFullscreen();
    resize();
    newGame();
  });
  canvas.addEventListener("pointerdown", function (ev) {
    const r = canvas.getBoundingClientRect();
    const p = screenToWorld(ev.clientX - r.left, ev.clientY - r.top);
    onPoint(p.x, p.y);
  }, { passive: false });
  canvas.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
  window.addEventListener("keydown", function (ev) {
    if (state.mode === "title" && (ev.code === "Space" || ev.code === "Enter")) {
      requestPageFullscreen();
      resize();
      newGame();
      return;
    }
    const n = ev.keyCode >= 49 && ev.keyCode <= 54 ? ev.keyCode - 49 : -1;
    if (n >= 0) shoot(n, 0);
  });
  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", resize);
  document.addEventListener("webkitfullscreenchange", resize);
}

function frame(now) {
  if (!state.last) state.last = now;
  let dt = (now - state.last) / 1000;
  state.last = now;
  if (dt > 0.05) dt = 0.05;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

bindInput();
resize();
requestAnimationFrame(frame);

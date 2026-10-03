/*
  PUSH & PUZ
  Seven rows on the long axis. Discs pack around a center well.
  Odd count sits on the well. Even count straddles it.
  Match-3 on a straight slot line: neighbors in a row, the same slot
  across rows, or a diagonal stepping one or two slots per row.
  Each turn deals a hand of two. The hand is the shot count. No refill
  between shots. Fire any time a disc is in the hand. Shots during a pop
  wait at the top of the chosen row and launch when that pop ends.
  Match check waits until every fired disc has settled.
  The first match of a resolve pays nothing. Each later match in that
  check, or in a settle after the first pop, is a combo and pays one disc.
  A match longer than 3 is a big and pays one disc. Awards sit on the top
  rail until the cascade finishes, then bump into the hand. Empty rows
  refill at end of turn and do not match.
  A visible disc on your end slot loses. Animation is not the grid.
*/

const ROWS = 7;
const END = 15;
const MATCH = 3;
const HAND = 2;
const BOARD_SETS = 3;
const COLS = [
  { fill: "#ff3b5c", hi: "#ffb6c6" },
  { fill: "#ff9f1a", hi: "#ffe3b8" },
  { fill: "#bb2bff", hi: "#db88ff" },
  { fill: "#2ee06a", hi: "#b5ffd1" },
  { fill: "#3aa0ff", hi: "#b8ddff" }
];
const BG = "#07080d";
const PCOL = ["#ff9f1a", "#3aa0ff"];
const SETTLE_MIN = 0.26;
const SETTLE_MAX = 0.9;
const POP_MS = 0.34;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const APP_VERSION = ((document.getElementById("puz-version") || {}).textContent || "").trim();

const state = {
  w: 0, h: 0, viewW: 0, viewH: 0, dpr: 1, portrait: false,
  mode: "title", phase: "idle", phaseT: 0, turn: 0,
  rows: [], bags: [[], []], stock: [[], []], boardBag: [],
  matchCount: 0, comboT: 0, bigText: "", bigT: 0, awards: [],
  loser: -1, last: 0, flyers: [], pending: [],
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

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return "rgb(" + r + "," + g + "," + bl + ")";
}

function makeCell(color) {
  return { color: color, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, pop: 0, popSide: -1, sc: 1 };
}

function freshRows() {
  const rows = [];
  for (let r = 0; r < ROWS; r++) rows.push({ cells: [], lw: 0, rw: 0, bal: 0, bvx: 0 });
  return rows;
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
  while (state.bags[p].length < HAND) state.bags[p].push(takeStock(p));
}

function slotsOf(row) {
  const n = row.cells.length;
  if (!n) return [];
  const s = row.lw - row.rw;
  const out = new Array(n);
  for (let k = 0; k < n; k++) out[k] = s - (n - 1) + 2 * k;
  return out;
}

function findMatches() {
  const hit = new Set();
  const cross = new Set();
  const rowLines = [];
  const groups = [];
  const slotRows = state.rows.map(slotsOf);
  function note(keys) {
    for (let n = 0; n < keys.length; n++) hit.add(keys[n]);
  }
  for (let r = 0; r < ROWS; r++) {
    const cells = state.rows[r].cells;
    const slots = slotRows[r];
    let i = 0;
    while (i < cells.length) {
      const col = cells[i].color;
      const parity = slots[i] & 1;
      let j = i + 1;
      while (j < cells.length && cells[j].color === col && (slots[j] & 1) === parity) j++;
      if (j - i >= MATCH) {
        const keys = [];
        for (let k = i; k < j; k++) keys.push(r + ":" + k);
        note(keys);
        rowLines.push({ r: r, keys: keys });
        groups.push({ len: j - i, keys: keys });
      }
      i = j;
    }
  }
  function at(r, slot, color) {
    const slots = slotRows[r];
    const cells = state.rows[r].cells;
    for (let i = 0; i < cells.length; i++) {
      if (slots[i] === slot && cells[i].color === color) return i;
    }
    return -1;
  }
  const dirs = [0, 1, -1, 2, -2];
  for (let r = 0; r < ROWS; r++) {
    const cells = state.rows[r].cells;
    const slots = slotRows[r];
    for (let i = 0; i < cells.length; i++) {
      const col = cells[i].color;
      const slot = slots[i];
      for (let d = 0; d < dirs.length; d++) {
        const dir = dirs[d];
        if (r > 0 && at(r - 1, slot - dir, col) >= 0) continue;
        const idx = [i];
        let s = 1;
        while (r + s < ROWS) {
          const k = at(r + s, slot + dir * s, col);
          if (k < 0) break;
          idx.push(k);
          s++;
        }
        if (idx.length < MATCH) continue;
        const keys = [];
        for (let n = 0; n < idx.length; n++) keys.push((r + n) + ":" + idx[n]);
        note(keys);
        for (let n = 0; n < keys.length; n++) cross.add(keys[n]);
        groups.push({ len: idx.length, keys: keys });
      }
    }
  }
  state.rowLines = rowLines;
  state.crossHits = cross;
  state.matchGroups = groups;
  return hit;
}

function edgeLoss() {
  let left = false;
  let right = false;
  for (let r = 0; r < ROWS; r++) {
    const slots = slotsOf(state.rows[r]);
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] <= -END) left = true;
      if (slots[i] >= END) right = true;
    }
  }
  return { left: left, right: right };
}

function slotX(slot) { return state.wellX + slot * state.half; }
function rowY(r) { return state.boardTop + (r + 0.5) * state.pitch; }

function queueSlot(p, i) {
  const r = state.discR;
  const n = Math.max(state.bags[p].length, i + 1);
  const gap = Math.min(state.pitch * 0.9, (state.pitch * ROWS * 0.42) / Math.max(1, n));
  const pad = state.pitch * 0.22;
  const x = p === 0 ? state.boardLeft - r - pad : state.boardRight + r + pad;
  const nextY = state.boardTop + state.pitch * ROWS * 0.5;
  return { x: x, y: nextY - i * gap };
}

function layoutAwards() {
  const n = state.awards.length;
  const small = Math.max(13, state.h * 0.04);
  const y = Math.max(state.discR, state.boardTop * 0.55);
  for (let i = 0; i < n; i++) {
    const a = state.awards[i];
    if (a.bump) continue;
    a.tx = state.wellX + (i - (n - 1) * 0.5) * state.discR * 2.15;
    a.ty = y + small * 0.95;
    if (!a.placed) {
      a.x = a.tx;
      a.y = a.ty - state.discR;
      a.placed = 1;
    }
  }
}

function layoutTargets() {
  for (let r = 0; r < ROWS; r++) {
    const row = state.rows[r];
    const slots = slotsOf(row);
    const y = rowY(r);
    for (let i = 0; i < row.cells.length; i++) {
      row.cells[i].tx = slotX(slots[i]);
      row.cells[i].ty = y;
    }
  }
}

function snapCells() {
  for (let r = 0; r < ROWS; r++) {
    const cells = state.rows[r].cells;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      c.x = c.tx;
      c.y = c.ty;
      c.vx = 0;
      c.vy = 0;
    }
  }
}

function markPops(hit) {
  for (let r = 0; r < ROWS; r++) {
    const row = state.rows[r];
    for (let i = 0; i < row.cells.length; i++) {
      if (!hit.has(r + ":" + i)) continue;
      row.cells[i].pop = 1;
    }
  }
}

function finishPops() {
  const me = state.turn;
  const cross = state.crossHits || new Set();
  const add = [];
  for (let r = 0; r < ROWS; r++) add.push(0);
  if (state.rowLines) {
    for (let n = 0; n < state.rowLines.length; n++) add[state.rowLines[n].r]++;
  }
  for (let r = 0; r < ROWS; r++) {
    const row = state.rows[r];
    const keep = [];
    for (let i = 0; i < row.cells.length; i++) {
      const c = row.cells[i];
      if (!c.pop) { keep.push(c); continue; }
      if (cross.has(r + ":" + i)) add[r]++;
    }
    row.cells = keep;
  }
  for (let r = 0; r < ROWS; r++) {
    if (!add[r]) continue;
    if (me === 0) state.rows[r].lw += add[r];
    else state.rows[r].rw += add[r];
  }
}

function newGame() {
  state.rows = freshRows();
  state.stock = [colorPackOfSets(2), colorPackOfSets(2)];
  state.bags = [[], []];
  state.boardBag = [];
  state.turn = Math.round(Math.random());
  dealHand(0);
  dealHand(1);
  state.phase = "idle";
  state.phaseT = 0;
  state.matchCount = 0;
  state.comboT = 0;
  state.bigText = "";
  state.bigT = 0;
  state.awards = [];
  state.loser = -1;
  state.flyers = [];
  state.pending = [];
  state.mode = "play";
  for (let n = 0; n < 40; n++) {
    const dealt = [];
    for (let r = 0; r < ROWS; r++) {
      const a = takeBoardColor();
      const b = takeBoardColor();
      dealt.push(a, b);
      state.rows[r].cells = [makeCell(a), makeCell(b)];
    }
    if (!findMatches().size) break;
    for (let k = dealt.length - 1; k >= 0; k--) state.boardBag.unshift(dealt[k]);
    shuffle(state.boardBag);
  }
  layoutTargets();
  snapCells();
}

function fillEmptyRows() {
  for (let r = 0; r < ROWS; r++) {
    const row = state.rows[r];
    if (row.cells.length) continue;
    const cell = makeCell(takeBoardColor());
    const slot = row.lw - row.rw;
    cell.x = slotX(slot);
    cell.tx = cell.x;
    cell.y = rowY(r);
    cell.ty = cell.y;
    row.cells.push(cell);
  }
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

function parkPending() {
  const used = [];
  for (let r = 0; r < ROWS; r++) used.push(0);
  for (let i = 0; i < state.pending.length; i++) {
    const shot = state.pending[i];
    const stack = used[shot.row];
    used[shot.row] = stack + 1;
    shot.cell.x = shot.side === 0 ? state.boardLeft - state.discR * 0.35 : state.boardRight + state.discR * 0.35;
    shot.cell.y = state.boardTop + shot.row * state.pitch - stack * state.discR * 1.65;
    shot.cell.tx = shot.cell.x;
    shot.cell.ty = shot.cell.y;
  }
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
  const availH = state.h * 0.86;
  let pitch = availH / ROWS;
  const gutter = pitch * 0.34 * 2 + pitch * 0.4;
  const maxPitch = (state.w - gutter * 2) / (END + 0.5);
  if (pitch > maxPitch) pitch = maxPitch;
  state.pitch = pitch;
  state.half = pitch * 0.5;
  state.discR = pitch * 0.34;
  state.wellX = state.w * 0.5;
  state.boardTop = (state.h - pitch * ROWS) * 0.5;
  state.boardLeft = state.wellX - (END + 0.5) * state.half;
  state.boardRight = state.wellX + (END + 0.5) * state.half;
  if (state.mode !== "title") {
    layoutTargets();
    if (state.phase !== "settle" && state.phase !== "pop" && state.phase !== "award") snapCells();
    for (let i = 0; i < state.flyers.length; i++) {
      const shot = state.flyers[i];
      shot.cell.y = rowY(shot.row);
      shot.cell.tx = contactX(shot.row, shot.side);
    }
    parkPending();
    layoutAwards();
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

function contactX(row, side) {
  const slots = slotsOf(state.rows[row]);
  if (!slots.length) return slotX(0);
  if (side === 0) return slotX(slots[0]) - state.pitch;
  return slotX(slots[slots.length - 1]) + state.pitch;
}

function shoot(row) {
  if (state.mode !== "play") return;
  if (row < 0 || row >= ROWS) return;
  const p = state.turn;
  if (!state.bags[p].length) return;
  if (state.phase === "pop") {
    const color = state.bags[p].shift();
    const cell = makeCell(color);
    state.pending.push({ cell: cell, row: row, side: p, t: 0 });
    parkPending();
    return;
  }
  if (state.phase === "idle" || state.phase === "award") {
    state.matchCount = 0;
    state.comboT = 0;
    state.bigText = "";
    state.bigT = 0;
  }
  const color = state.bags[p].shift();
  const cell = makeCell(color);
  cell.x = slotX(p === 0 ? -END - 2 : END + 2);
  cell.y = rowY(row);
  cell.tx = contactX(row, p);
  cell.ty = cell.y;
  cell.vx = p === 0 ? state.pitch * 9 : -state.pitch * 9;
  state.flyers.push({ cell: cell, row: row, side: p, t: 0 });
  if (state.phase !== "settle" && state.phase !== "award") {
    state.phase = "fly";
    state.phaseT = 0;
  }
}

function closeTurn() {
  const loss = edgeLoss();
  if (loss.left || loss.right) {
    state.mode = "over";
    state.phase = "idle";
    state.loser = loss.left && loss.right ? 2 : (loss.left ? 0 : 1);
    return;
  }
  if (!state.bags[state.turn].length) {
    fillEmptyRows();
    dealHand(state.turn);
    state.turn = 1 - state.turn;
    state.matchCount = 0;
    state.comboT = 0;
    state.bigText = "";
    state.bigT = 0;
  }
  state.phase = "idle";
}

function startAwardBump() {
  const p = state.turn;
  const base = state.bags[p].length;
  for (let i = 0; i < state.awards.length; i++) {
    const slot = queueSlot(p, base + i);
    const a = state.awards[i];
    a.tx = slot.x;
    a.ty = slot.y;
    a.bump = 1;
  }
  state.phase = "award";
  state.phaseT = 0;
}

function afterSettle() {
  snapCells();
  const hit = findMatches();
  if (hit.size) {
    markPops(hit);
    const groups = state.matchGroups || [];
    const bigs = [];
    for (let g = 0; g < groups.length; g++) {
      state.matchCount++;
      if (state.matchCount >= 2) {
        state.awards.push({ color: takeStock(state.turn), x: 0, y: 0, tx: 0, ty: 0, bump: 0, placed: 0 });
        state.comboT = 1.8;
      }
      if (groups[g].len > MATCH) {
        state.awards.push({ color: takeStock(state.turn), x: 0, y: 0, tx: 0, ty: 0, bump: 0, placed: 0 });
        bigs.push("BIG " + groups[g].len);
        state.bigT = 1.8;
      }
    }
    if (bigs.length) state.bigText = bigs.join("  ");
    layoutAwards();
    state.phase = "pop";
    state.phaseT = 0;
    return;
  }
  if (state.awards.length) {
    startAwardBump();
    return;
  }
  closeTurn();
}

function update(dt) {
  if (state.mode === "title") return;
  if (state.comboT > 0) state.comboT -= dt;
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
  if (state.awards.length) {
    for (let i = 0; i < state.awards.length; i++) {
      const a = state.awards[i];
      a.x += (a.tx - a.x) * Math.min(1, dt * 10);
      a.y += (a.ty - a.y) * Math.min(1, dt * 10);
    }
  }
  if (state.mode === "over") return;
  state.phaseT += dt;
  if (state.phase !== "pop") {
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
      if (state.phase !== "award") {
        state.phase = "settle";
        state.phaseT = 0;
      }
    }
  }
  if (state.phase === "settle") {
    let calm = state.flyers.length === 0 && state.pending.length === 0;
    const k = 78;
    const damp = 9.5;
    for (let r = 0; r < ROWS; r++) {
      const cells = state.rows[r].cells;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c.pop) continue;
        c.vx += ((c.tx - c.x) * k - c.vx * damp) * dt;
        c.vy += ((c.ty - c.y) * k - c.vy * damp) * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (Math.abs(c.tx - c.x) > 1.4 || Math.abs(c.vx) > 36) calm = false;
      }
    }
    if ((calm && state.phaseT >= SETTLE_MIN) || (state.flyers.length === 0 && state.pending.length === 0 && state.phaseT >= SETTLE_MAX)) afterSettle();
    return;
  }
  if (state.phase === "pop") {
    const t = state.phaseT / POP_MS;
    for (let r = 0; r < ROWS; r++) {
      const cells = state.rows[r].cells;
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].pop) cells[i].sc = Math.max(0, 1 - t);
      }
    }
    if (t >= 1) {
      finishPops();
      layoutTargets();
      for (let i = 0; i < state.pending.length; i++) {
        const shot = state.pending[i];
        const c = shot.cell;
        c.tx = contactX(shot.row, shot.side);
        c.ty = rowY(shot.row);
        c.vx = shot.side === 0 ? state.pitch * 9 : -state.pitch * 9;
        shot.t = 0;
        state.flyers.push(shot);
      }
      state.pending = [];
      state.phase = "settle";
      state.phaseT = 0;
    }
    return;
  }
  if (state.phase === "award") {
    let home = true;
    for (let i = 0; i < state.awards.length; i++) {
      const a = state.awards[i];
      if (Math.abs(a.tx - a.x) > 2 || Math.abs(a.ty - a.y) > 2) home = false;
    }
    if (home || state.phaseT > 0.45) {
      for (let i = 0; i < state.awards.length; i++) state.bags[state.turn].push(state.awards[i].color);
      state.awards = [];
      if (state.flyers.length) {
        state.phase = "settle";
        state.phaseT = 0;
        return;
      }
      closeTurn();
    }
  }
}

function drawDisc(x, y, r, ci, alpha, sc, shine) {
  if (sc <= 0.02 || alpha <= 0.02) return;
  const rr = r * sc;
  const c = COLS[ci];
  const edge = mixHex(c.fill, c.hi, 0.5);
  const outline = Math.max(1.6, rr * 0.11);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, rr + outline + 3, 0, Math.PI * 2);
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, rr, 0, Math.PI * 2);
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.lineWidth = outline;
  ctx.strokeStyle = edge;
  ctx.stroke();
  if (shine) {
    ctx.beginPath();
    ctx.arc(0, 0, rr * 0.72, Math.PI * 1.08, Math.PI * 1.78);
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = Math.max(1.5, rr * 0.14);
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();
}

function drawQueue(p) {
  const bag = state.bags[p];
  const mine = state.mode === "play" && state.turn === p;
  const r = state.discR;
  for (let i = 0; i < bag.length; i++) {
    const slot = queueSlot(p, i);
    const next = i === 0;
    const sc = next && mine ? 1.08 : 0.68;
    drawDisc(slot.x, slot.y, r, bag[i], 1, sc, next);
  }
}

function draw() {
  const dpr = state.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.portrait) {
    ctx.translate(state.viewW, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, state.w, state.h);
  if (state.mode === "title") {
    const font = Math.min(state.w * 0.11, state.h * 0.34);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#d7ecff";
    ctx.fillStyle = "#d7ecff";
    ctx.font = "900 " + font + "px ui-sans-serif, system-ui, sans-serif";
    ctx.globalAlpha = 0.16;
    ctx.fillText("PUSH & PUZ", state.w * 0.5, state.h * 0.46);
    ctx.globalAlpha = 1;
    ctx.strokeText("PUSH & PUZ", state.w * 0.5, state.h * 0.46);
    ctx.font = "400 " + Math.max(14, font * 0.16) + "px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("tap to start", state.w * 0.5, state.h * 0.68);
    ctx.textAlign = "right";
    ctx.font = "400 " + Math.max(11, font * 0.1) + "px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(APP_VERSION, state.w * 0.96, state.h * 0.95);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  ctx.fillRect(state.boardLeft, state.boardTop, state.boardRight - state.boardLeft, state.pitch * ROWS);
  const gridBottom = state.boardTop + state.pitch * ROWS;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(190, 206, 220, 0.28)";
  ctx.beginPath();
  for (let i = 0; i <= ROWS; i++) {
    const y = state.boardTop + i * state.pitch;
    ctx.moveTo(state.boardLeft, y);
    ctx.lineTo(state.boardRight, y);
  }
  for (let s = -END + (END % 2); s <= END; s += 2) {
    const x = state.wellX + s * state.half;
    ctx.moveTo(x, state.boardTop);
    ctx.lineTo(x, gridBottom);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(190, 206, 220, 0.28)";
  ctx.beginPath();
  for (let s = -END + ((END + 1) % 2); s <= END; s += 2) {
    const x = state.wellX + s * state.half;
    ctx.moveTo(x, state.boardTop);
    ctx.lineTo(x, gridBottom);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(190, 206, 220, 0.4)";
  ctx.beginPath();
  ctx.moveTo(state.boardLeft, state.boardTop);
  ctx.lineTo(state.boardLeft, gridBottom);
  ctx.moveTo(state.boardRight, state.boardTop);
  ctx.lineTo(state.boardRight, gridBottom);
  ctx.stroke();
  ctx.strokeStyle = "rgba(190, 206, 220, 0.28)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(state.wellX, state.boardTop);
  ctx.lineTo(state.wellX, gridBottom);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255, 226, 140, 0.9)";
  ctx.lineWidth = 3;
  ctx.lineCap = "butt";
  for (let r = 0; r < ROWS; r++) {
    const row = state.rows[r];
    let x = state.wellX + row.bal * state.half;
    if (x < state.boardLeft) x = state.boardLeft;
    if (x > state.boardRight) x = state.boardRight;
    const y0 = state.boardTop + r * state.pitch;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + state.pitch);
    ctx.stroke();
  }
  ctx.restore();

  for (let r = 0; r < ROWS; r++) {
    const row = state.rows[r];
    const y = rowY(r);
    const net = row.lw - row.rw;
    ctx.save();
    ctx.globalAlpha = 0.55;
    if (net > 0) {
      ctx.fillStyle = PCOL[0];
      ctx.fillRect(state.boardLeft, y - 2, Math.min(state.half * net, state.boardRight - state.boardLeft), 3);
    } else if (net < 0) {
      ctx.fillStyle = PCOL[1];
      const span = Math.min(state.half * -net, state.boardRight - state.boardLeft);
      ctx.fillRect(state.boardRight - span, y - 2, span, 3);
    }
    ctx.restore();
    for (let i = 0; i < row.cells.length; i++) {
      const c = row.cells[i];
      drawDisc(c.x, c.y, state.discR, c.color, 1, c.sc == null ? 1 : c.sc, true);
    }
  }
  for (let i = 0; i < state.flyers.length; i++) {
    const c = state.flyers[i].cell;
    drawDisc(c.x, c.y, state.discR, c.color, 1, 1, true);
  }
  for (let i = 0; i < state.pending.length; i++) {
    const c = state.pending[i].cell;
    drawDisc(c.x, c.y, state.discR, c.color, 1, 1, true);
  }

  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = PCOL[0];
  ctx.globalAlpha = state.turn === 0 && state.mode === "play" ? 0.95 : 0.28;
  ctx.strokeRect(state.boardLeft - 2, state.boardTop, 4, state.pitch * ROWS);
  ctx.strokeStyle = PCOL[1];
  ctx.globalAlpha = state.turn === 1 && state.mode === "play" ? 0.95 : 0.28;
  ctx.strokeRect(state.boardRight - 2, state.boardTop, 4, state.pitch * ROWS);
  ctx.restore();

  drawQueue(0);
  drawQueue(1);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#d7ecff";
  const small = Math.max(13, state.h * 0.04);
  ctx.font = "600 " + small + "px ui-sans-serif, system-ui, sans-serif";
  if (state.mode === "over") {
    const msg = state.loser === 2 ? "BOTH OUT" : (state.loser === 0 ? "LEFT OUT" : "RIGHT OUT");
    ctx.fillText(msg, state.w * 0.5, state.boardTop - small * 0.9);
    ctx.font = "400 " + (small * 0.72) + "px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("tap to restart", state.w * 0.5, state.boardTop + state.pitch * ROWS + small);
  } else {
    const showCombo = state.matchCount >= 2 && (state.comboT > 0 || state.awards.length || state.phase === "pop" || state.phase === "award");
    const showBig = state.bigText && (state.bigT > 0 || state.awards.length || state.phase === "pop" || state.phase === "award");
    const labelY = Math.max(small * 0.7, state.boardTop * 0.28);
    if (showCombo) ctx.fillText("COMBO " + state.matchCount, state.w * 0.5, labelY);
    if (showBig) ctx.fillText(state.bigText, state.w * 0.5, labelY + (showCombo ? small * 0.95 : 0));
  }
  ctx.restore();
  for (let i = 0; i < state.awards.length; i++) {
    const a = state.awards[i];
    drawDisc(a.x, a.y, state.discR, a.color, 1, a.bump ? 0.86 : 1, true);
  }
}

function onPoint(x, y) {
  if (state.mode === "title") {
    requestPageFullscreen();
    resize();
    newGame();
    return;
  }
  if (state.mode === "over") {
    newGame();
    return;
  }
  const row = rowAt(y);
  if (row < 0) return;
  if (state.turn === 0 && x >= state.wellX) return;
  if (state.turn === 1 && x <= state.wellX) return;
  shoot(row);
}

function bindInput() {
  canvas.addEventListener("pointerdown", function (ev) {
    const r = canvas.getBoundingClientRect();
    const p = screenToWorld(ev.clientX - r.left, ev.clientY - r.top);
    onPoint(p.x, p.y);
  }, { passive: false });
  canvas.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
  window.addEventListener("keydown", function (ev) {
    if (state.mode === "title" && (ev.code === "Space" || ev.code === "Enter")) {
      onPoint(state.w * 0.5, state.h * 0.5);
      return;
    }
    const n = ev.keyCode >= 49 && ev.keyCode <= 55 ? ev.keyCode - 49 : -1;
    if (n >= 0) shoot(n);
  });
  window.addEventListener("resize", resize);
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

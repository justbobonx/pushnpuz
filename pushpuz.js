/*
  PUSH & PUZ
  Six rows on the long axis. Discs pack around a center well.
  Each side shows the shot disc plus two behind it. On a shot the queue slides up.
  A new disc does not arrive with the shot. The refill timer starts at 1s, and a shot restarts it even if the last one has not paid out.
  When the timer ends, one disc fades in. If the queue is still short, the timer resets. Three dumps are 3s back to full.
  Both sides fire any time a disc is in the hand. The well splits the screen: left tap fires left, right tap fires right.
  The left seat can be a PC. It fires on its own clock and aims the held color. The bottom circle toggles that seat. Off unless tapped.
  Match check waits until every fired disc has settled.
  A match is a color group bigger than 3 that contains a disc shot this volley. Groups live on the board.
  Pop those discs after a short white hold on the match.
  They slide along their row to the scoring edge, and fade. No shadow on the fade.
  Each popped disc adds one weight on its row for each shooter in the group.
  Weight is lw or rw. The balance marker springs one slot per weight.
  bigText is the award line for the player.
  An empty row takes two discs after a settle and does not match.
  A visible disc on your end slot loses. Animation is not the grid.
*/

const HAND = 3;
const BOARD_SETS = 3;
const SETTLE_MIN = 0.26;
const SETTLE_MAX = 0.9;
const POP_TIME = 0.42;
const MARK_TIME = 0.5;
const QUEUE_SLIDE = 0.26;
const REFILL = 1;
const PC_GAP = 2.6;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const APP_VERSION = ((document.getElementById("puz-version") || {}).textContent || "").trim();

const state = {
  w: 0, h: 0, viewW: 0, viewH: 0, dpr: 1, portrait: false,
  mode: "title", phase: "idle", phaseT: 0,
  rows: [], bags: [[], []], stock: [[], []], boardBag: [],
  bigText: "", bigT: 0,
  loser: -1, last: 0, flyers: [], poppers: [],
  colorLinks: [], colorGroups: [],
  qSlide: [0, 0], refill: [0, 0],
  pcLeft: false, pcWait: PC_GAP,
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
  return { color: color, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, by: -1 };
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

function dealHand(p, fade) {
  while (state.bags[p].length < HAND) state.bags[p].push({ color: takeStock(p), born: fade ? 1 : 0 });
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
  state.poppers = [];
  state.colorLinks = [];
  state.colorGroups = [];
  state.qSlide = [0, 0];
  state.refill = [0, 0];
  state.pcWait = 1.4 + Math.random() * 0.8;
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
    if (state.phase !== "settle" && state.phase !== "pop" && state.phase !== "mark") snapCells();
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
  state.refill[side] = REFILL;
  state.qSlide[side] = 1;
  if (state.phase !== "settle" && state.phase !== "pop" && state.phase !== "mark") {
    state.phase = "fly";
    state.phaseT = 0;
  }
}

function afterSettle() {
  if (state.phase !== "pop" && state.phase !== "mark") snapCells();
  findColorGroups();
  const hit = matchedGroups();
  const doomed = [];
  let leftN = 0;
  let rightN = 0;
  for (let g = 0; g < hit.length; g++) {
    const group = hit[g];
    let left = false;
    let right = false;
    for (let d = 0; d < group.discs.length; d++) {
      const by = group.discs[d].cell.by;
      if (by === 0) left = true;
      if (by === 1) right = true;
    }
    if (!left && !right) continue;
    for (let d = 0; d < group.discs.length; d++) {
      const disc = group.discs[d];
      doomed.push({ cell: disc.cell, left: left, right: right });
      if (state.phase === "mark") {
        if (left) {
          state.rows[disc.r].lw += 1;
          leftN += 1;
        }
        if (right) {
          state.rows[disc.r].rw += 1;
          rightN += 1;
        }
      }
    }
  }
  if (doomed.length && state.phase !== "mark") {
    for (let d = 0; d < doomed.length; d++) doomed[d].cell.mark = true;
    state.phase = "mark";
    state.phaseT = 0;
    return;
  }
  if (doomed.length) {
    for (let r = 0; r < ROWS; r++) {
      const cells = state.rows[r].cells;
      const keep = [];
      for (let i = 0; i < cells.length; i++) {
        let drop = false;
        for (let d = 0; d < doomed.length; d++) {
          if (cells[i] === doomed[d].cell) { drop = true; break; }
        }
        if (!drop) keep.push(cells[i]);
      }
      state.rows[r].cells = keep;
    }
    for (let d = 0; d < doomed.length; d++) {
      const item = doomed[d];
      const cell = item.cell;
      cell.mark = false;
      const dirs = [];
      if (item.left) dirs.push(-1);
      if (item.right) dirs.push(1);
      for (let k = 0; k < dirs.length; k++) {
        const edge = dirs[k] < 0 ? state.boardLeft : state.boardRight;
        state.poppers.push({
          color: cell.color,
          x0: cell.x,
          x: cell.x,
          y: cell.y,
          edge: edge,
          t: 0,
          sc: 1,
          alpha: 1
        });
      }
    }
    layoutTargets();
    findColorGroups();
    const parts = [];
    if (leftN) parts.push("LEFT +" + leftN);
    if (rightN) parts.push("RIGHT +" + rightN);
    state.bigText = parts.join("  ");
    state.bigT = 1.8;
    state.phase = "pop";
    state.phaseT = 0;
    return;
  }
  for (let r = 0; r < ROWS; r++) {
    const cells = state.rows[r].cells;
    for (let i = 0; i < cells.length; i++) {
      cells[i].by = -1;
      cells[i].mark = false;
    }
  }
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
  state.phase = "idle";
}

function update(dt) {
  if (state.mode === "title") return;
  if (state.bigT > 0) state.bigT -= dt;
  for (let p = 0; p < 2; p++) {
    if (state.qSlide[p] > 0) state.qSlide[p] = Math.max(0, state.qSlide[p] - dt / QUEUE_SLIDE);
    if (state.mode === "play" && state.refill[p] > 0) {
      state.refill[p] -= dt;
      if (state.refill[p] <= 0) {
        if (state.bags[p].length < HAND) {
          state.bags[p].push({ color: takeStock(p), born: 1 });
          state.refill[p] = state.bags[p].length < HAND ? REFILL : 0;
        } else state.refill[p] = 0;
      }
    }
    const bag = state.bags[p];
    for (let i = 0; i < bag.length; i++) {
      if (bag[i].born > 0) bag[i].born = Math.max(0, bag[i].born - dt / QUEUE_SLIDE);
    }
  }
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
  if (state.pcLeft && state.mode === "play") {
    state.pcWait -= dt;
    if (state.pcWait <= 0) {
      if (state.bags[0].length) {
        const color = state.bags[0][0].color;
        let best = 0;
        let bestScore = -1e9;
        for (let r = 0; r < ROWS; r++) {
          const row = state.rows[r];
          const land = (row.lw - row.rw) - row.cells.length;
          const near = [];
          for (let rr = r - 1; rr <= r + 1; rr++) {
            if (rr < 0 || rr >= ROWS) continue;
            const slots = slotsOf(state.rows[rr]);
            const cells = state.rows[rr].cells;
            const dr = rr - r;
            for (let i = 0; i < cells.length; i++) {
              if (cells[i].color !== color) continue;
              const ds = slots[i] - land;
              if (2 * dr * dr + ds * ds > GROUP_REACH) continue;
              near.push({ r: rr, slot: slots[i] });
            }
          }
          let extra = 0;
          if (near.length) {
            for (let rr = 0; rr < ROWS; rr++) {
              const cells = state.rows[rr].cells;
              const slots = slotsOf(state.rows[rr]);
              for (let i = 0; i < cells.length; i++) {
                if (cells[i].color !== color) continue;
                let already = false;
                for (let k = 0; k < near.length; k++) {
                  if (near[k].r === rr && near[k].slot === slots[i]) { already = true; break; }
                }
                if (already) continue;
                for (let k = 0; k < near.length; k++) {
                  const dr = rr - near[k].r;
                  const ds = slots[i] - near[k].slot;
                  if (2 * dr * dr + ds * ds <= GROUP_REACH) { extra += 1; break; }
                }
              }
            }
          }
          const group = 1 + near.length + extra;
          let score = group * 12;
          if (group > MATCH) score += 48;
          else if (group === MATCH) score += 16;
          if (land <= -END) score -= 240;
          else if (land <= -END + 3) score -= 40;
          score += (row.rw - row.lw) * 1.6;
          for (let i = 0; i < state.flyers.length; i++) {
            if (state.flyers[i].row === r && state.flyers[i].side === 0) score -= 10;
          }
          score += (Math.random() - 0.5) * 5;
          if (score > bestScore) {
            bestScore = score;
            best = r;
          }
        }
        shoot(best, 0);
        state.pcWait = PC_GAP + Math.random() * 0.9;
      } else state.pcWait = 0.4;
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
    c.by = shot.side;
    if (shot.side === 0) state.rows[shot.row].cells.unshift(c);
    else state.rows[shot.row].cells.push(c);
    state.flyers.splice(i, 1);
    arrived = true;
  }
  if (arrived) {
    layoutTargets();
    if (state.phase !== "pop" && state.phase !== "mark") {
      state.phase = "settle";
      state.phaseT = 0;
    }
  }
  if (state.phase === "mark" && state.phaseT >= MARK_TIME) afterSettle();
  if (state.phase === "pop") {
    for (let i = state.poppers.length - 1; i >= 0; i--) {
      const pop = state.poppers[i];
      pop.t += dt;
      const u = Math.min(1, pop.t / POP_TIME);
      const e = u * u * (3 - 2 * u);
      pop.x = pop.x0 + (pop.edge - pop.x0) * e;
      pop.sc = 1;
      pop.alpha = 1 - e;
      if (pop.t >= POP_TIME) state.poppers.splice(i, 1);
    }
  }
  if (state.phase === "settle" || state.phase === "pop") {
    let calm = state.flyers.length === 0 && state.poppers.length === 0;
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
    const popped = state.phase === "pop" && state.poppers.length === 0;
    const settled = state.phase === "settle" && ((calm && state.phaseT >= SETTLE_MIN) || (state.flyers.length === 0 && state.phaseT >= SETTLE_MAX));
    if (popped && calm) afterSettle();
    else if (settled) afterSettle();
  }
}

function pcButton() {
  const r = Math.max(16, state.h * 0.035);
  return { x: r+8, y: state.h - r - 8, r: r };
}

function togglePc() {
  state.pcLeft = !state.pcLeft;
  state.pcWait = 0.6;
}

function onPoint(x, y) {
  const b = pcButton();
  const dx = x - b.x;
  const dy = y - b.y;
  if (dx * dx + dy * dy <= b.r * b.r) {
    togglePc();
    return true;
  }
  if (state.mode === "title") return false;
  if (state.mode === "over") {
    newGame();
    return false;
  }
  const row = rowAt(y);
  if (row < 0) return false;
  if (x === state.wellX) return false;
  if (x < state.wellX) {
    if (state.pcLeft) return false;
    shoot(row, 0);
    return false;
  }
  shoot(row, 1);
  return false;
}

function bindInput() {
  let swallowClick = false;
  canvas.addEventListener("click", function () {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    if (state.mode !== "title") return;
    requestPageFullscreen();
    resize();
    newGame();
  });
  canvas.addEventListener("pointerdown", function (ev) {
    const r = canvas.getBoundingClientRect();
    const p = screenToWorld(ev.clientX - r.left, ev.clientY - r.top);
    swallowClick = onPoint(p.x, p.y);
  }, { passive: false });
  canvas.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
  window.addEventListener("keydown", function (ev) {
    if (ev.code === "KeyP") {
      togglePc();
      return;
    }
    if (state.mode === "title" && (ev.code === "Space" || ev.code === "Enter")) {
      requestPageFullscreen();
      resize();
      newGame();
      return;
    }
    if (state.pcLeft) return;
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

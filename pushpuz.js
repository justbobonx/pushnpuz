/*
  PUSH & PUZ
  First cut without slots or rows. Shots are free along your end.
  Three blacks float near the bunch center, hold a soft triangle, and drift clockwise around it.
  They do not match. Colored discs do not stick to them.
  Every pair has a well: repel inside, pull outside, flat past a cutoff.
  Like colors pull harder and link. The blob is in water: strong drag,
  soft wells, so a shove becomes a drift instead of a bounce.
  A weak pull toward the bunch center keeps the cloud together. It does not pin it.
  Blacks pull that center a little harder so the triangle stays with the mob.
  A match deposits momentum at the cluster. A 4-match is one unit. Bigger matches add more. Offset from the center becomes spin. Both decay over a few seconds.
  A shot stays live for its settle window. A color link of MATCH or more lights that group and starts the fuse. The match stays with the owner disc. Links can grow it or cancel it. Another live shot that links in takes it and resets the fuse.
  Shots stay straight until they join. Launch speed covers the distance to the blob center.
  Long sides repel to infinity inside a short band. Ends stay open.
*/

const HAND = 3;
const BOARD_SETS = 3;
const SETTLE = 0.9;
const MARK_TIME = 0.8;
const QUEUE_SLIDE = 0.26;
const REFILL = 0.5;
const PC_NOMINAL_SPEED = 2.4;
const PC_FULL_PANIC_SPEED = 0.4;
const SUBSTEPS = 8;
const BURN = 0.14;
const GROW = 2;
const GROW_MIN = 0.1;
const GROW_MAX = 4;
const BOARD_NOMINAL = 32;
const DISCS_PER_W = 65;
const FLYER_PULL_STRENGTH = 300;
const SHOOT_TRIP = 2.5;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const APP_VERSION = ((document.getElementById("puz-version") || {}).textContent || "").trim();

const state = {
  w: 0, h: 0, viewW: 0, viewH: 0, dpr: 1, portrait: false,
  mode: "title",
  discs: [], blacks: [], bags: [[], []], stock: [[], []], boardBag: [],
  bigText: "", bigT: 0, matches: [],
  loser: -1, last: 0, flyers: [],
  colorLinks: [], colorGroups: [],
  qSlide: [0, 0], refill: [0, 0],
  pcLeft: false, pcWait: PC_NOMINAL_SPEED, pcPanic: 0.5,
  boardLeft: 0, boardRight: 0, wallTop: 0, wallBot: 0, wallBand: 0,
  pitch: 0, discR: 0, wellX: 0, wellY: 0, armGame: false, grow: GROW, px: 0, py: 0, ang: 0, mobI: 1, blackSpin: 0,
  pcButton: { x: 0, y: 0, r: 0 }
};


function growInterval(colors) {
  const t = colors / BOARD_NOMINAL;
  let wait = GROW * t * t;
  if (wait < GROW_MIN) wait = GROW_MIN;
  if (wait > GROW_MAX) wait = GROW_MAX;
  return wait;
}

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
  while (state.bags[p].length < HAND) state.bags[p].push({ color: takeStock(p), born: 0 });
}

function placeWell() {
  const discs = state.discs;
  if (!discs.length) return;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < discs.length; i++) {
    sx += discs[i].x;
    sy += discs[i].y;
  }
  state.wellX = sx / discs.length;
  state.wellY = sy / discs.length;
}

function clampWall(body) {
  const top = state.wallTop + state.discR * 0.35;
  if (body.y < top) {
    body.y = top;
    if (body.vy < 0) body.vy = 0;
  }
  const bot = state.wallBot - state.discR * 0.35;
  if (body.y > bot) {
    body.y = bot;
    if (body.vy > 0) body.vy = 0;
  }
}

function gameStart() {
  if (state.mode !== "title") return;
  requestPageFullscreen();
  state.armGame = true;
  resize();
  setTimeout(function () {
    if (!state.armGame) return;
    resize();
    newGame();
  }, 420);
}

function newGame() {
  const pitch = state.pitch;
  const midX = state.w * 0.5;
  const midY = state.h * 0.5;
  const outer = state.h * 0.25 - state.discR;
  const blackR = outer / 3;
  const blacks = [];
  for (let i = 0; i < 3; i++) {
    const ang = i * 2 * Math.PI / 3 - Math.PI / 2;
    const disc = makeDisc(BLACK, midX + Math.cos(ang) * blackR, midY + Math.sin(ang) * blackR);
    disc.by = -2;
    blacks.push(disc);
  }
  state.stock = [colorPackOfSets(2), colorPackOfSets(2)];
  state.bags = [[], []];
  state.boardBag = [];
  dealHand(0);
  dealHand(1);
  const colored = [];
  const shells = [outer * 2 / 3, outer];
  const step = outer / 3;
  const centerR = blackR * 0.46;
  for (let attempt = 0; attempt < 24; attempt++) {
    colored.length = 0;
    for (let i = 0; i < 3; i++) {
      const ang = i * 2 * Math.PI / 3 - Math.PI / 2 + Math.PI / 3;
      colored.push(makeDisc(takeBoardColor(), midX + Math.cos(ang) * centerR, midY + Math.sin(ang) * centerR));
    }
    for (let s = 0; s < shells.length; s++) {
      const rad = shells[s];
      const n = Math.max(6, Math.round(2 * Math.PI * rad / Math.max(step, state.discR * 2.2)));
      const spin = s * Math.PI / n;
      for (let i = 0; i < n; i++) {
        const ang = spin + i * 2 * Math.PI / n;
        colored.push(makeDisc(takeBoardColor(), midX + Math.cos(ang) * rad, midY + Math.sin(ang) * rad));
      }
    }
    state.discs = blacks.concat(colored);
    state.blacks = blacks;
    findColorGroups();
    if (!matchedGroups().length) break;
    for (let k = colored.length - 1; k >= 0; k--) state.boardBag.unshift(colored[k].color);
    shuffle(state.boardBag);
  }
  placeWell();
  state.bigText = "";
  state.bigT = 0;
  state.matches = [];
  state.loser = -1;
  state.flyers = [];
  clearPops();
  state.qSlide = [0, 0];
  state.refill = [0, 0];
  state.pcWait = PC_NOMINAL_SPEED;
  state.blackSpin = 0;
  state.mode = "play";
  state.armGame = false;
  state.grow = GROW;
  state.px = 0;
  state.py = 0;
  state.ang = 0;
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
  const oldW = state.w;
  const oldH = state.h;
  const oldPitch = state.pitch || 0;
  state.viewW = viewW;
  state.viewH = viewH;
  state.dpr = dpr;
  state.portrait = viewH > viewW;
  state.w = Math.max(viewW, viewH);
  state.h = Math.min(viewW, viewH);
  state.discR = state.w / DISCS_PER_W;
  state.pitch = state.discR / 0.34;
  state.boardLeft = state.pitch;
  state.boardRight = state.w - state.pitch;
  state.wallBand = state.pitch * 0.55;
  state.wallTop = state.pitch * 0.15;
  state.wallBot = state.h - state.pitch * 0.15;  
  const midX = state.w * 0.5;  
  if (oldPitch > 0 && state.mode !== "title" && state.discs.length && oldW > 0) {
    const s = state.pitch / oldPitch;
    const ox = oldW * 0.5;
    const oy = oldH * 0.5;
    const discs = state.discs;
    for (let i = 0; i < discs.length; i++) {
      discs[i].x = midX + (discs[i].x - ox) * s;
      discs[i].y = state.h * 0.5 + (discs[i].y - oy) * s;
    }
    for (let i = 0; i < state.flyers.length; i++) {
      const c = state.flyers[i].cell;
      c.x = midX + (c.x - ox) * s;
      c.y = state.h * 0.5 + (c.y - oy) * s;
      state.flyers[i].x0 = midX + (state.flyers[i].x0 - ox) * s;
    }
    placeWell();
  }
  
  const r = Math.max(18, state.h * 0.025);
  state.pcButton = { x: r + 8, y: state.h - r - 8, r: r };
}

function screenToWorld(sx, sy) {
  if (!state.portrait) return { x: sx, y: sy };
  return { x: sy, y: state.h - sx };
}

function shoot(y, side) {
  if (state.mode !== "play") return;
  if (side !== 0 && side !== 1) return;
  if (!state.bags[side].length) return;
  const lo = state.wallTop + state.discR;
  const hi = state.wallBot - state.discR;
  if (y < lo) y = lo;
  if (y > hi) y = hi;
  const disc = state.bags[side].shift();
  const x0 = side === 0 ? state.boardLeft - state.pitch : state.boardRight + state.pitch;
  const cell = makeDisc(disc.color, x0, y);
  const dir = side === 0 ? 1 : -1;
  const dx = state.wellX - x0;
  const dy = state.wellY - y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const drag = 2.4;
  let speed = dist * drag / (1 - Math.exp(-drag * SHOOT_TRIP));
  if (speed < state.pitch * 12) speed = state.pitch * 12;
  if (speed > state.pitch * 70) speed = state.pitch * 70;
  cell.vx = dir * speed;
  cell.vy = 0;
  const pitches = dist / state.pitch;
  state.flyers.push({ cell: cell, side: side, t: 0, x0: x0, dir: dir, burnFor: BURN * (0.8 + pitches / 18) });
  state.refill[side] = REFILL;
  state.qSlide[side] = 1;
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
  if (state.pcLeft && state.mode === "play") {
    const span = Math.max(1, state.boardRight - state.boardLeft);
    let edge = state.boardRight;
    const discs = state.discs;
    for (let i = 0; i < discs.length; i++) {
      if (discs[i].color < 0) continue;
      if (discs[i].x < edge) edge = discs[i].x;
    }
    let panic = (state.boardRight - state.wellX) / span * 0.7 + (state.boardRight - edge) / span * 0.3;
    if (panic < 0) panic = 0;
    if (panic > 1) panic = 1;
    state.pcPanic = panic;
    state.pcWait -= dt;
    if (state.pcWait <= 0) {
      if (state.bags[0].length) {
        const color = state.bags[0][0].color;
        const link = state.pitch * 1.35;
        let bestY = state.wellY;
        let bestScore = -1e9;
        const samples = 13;
        for (let s = 0; s < samples; s++) {
          const y = state.wallTop + (s + 0.5) * (state.wallBot - state.wallTop) / samples;
          let score = -Math.abs(y - state.wellY) / state.pitch * (1.2 + panic);
          for (let i = 0; i < discs.length; i++) {
            if (discs[i].color !== color) continue;
            const dy = Math.abs(discs[i].y - y);
            if (dy > state.pitch * 1.35) continue;
            const lane = 1 - dy / (state.pitch * 1.35);
            const dx = discs[i].x - state.boardLeft;
            const onHim = 1 - Math.min(1, Math.max(0, dx / span));
            const facing = discs[i].x <= state.wellX ? 1.4 : 0.7;
            score += (9 + onHim * 12 * panic) * lane * facing;
            for (let k = 0; k < discs.length; k++) {
              if (k === i || discs[k].color !== color) continue;
              const ex = discs[k].x - discs[i].x;
              const ey = discs[k].y - discs[i].y;
              if (ex * ex + ey * ey < link * link * 2.4) score += 6 * lane;
            }
          }
          if (y < state.wallTop + state.pitch || y > state.wallBot - state.pitch) score -= 18;
          score += (Math.random() - 0.5) * (1.6 - panic);
          if (score > bestScore) {
            bestScore = score;
            bestY = y;
          }
        }
        shoot(bestY, 0);
        const gap = PC_NOMINAL_SPEED + (PC_FULL_PANIC_SPEED - PC_NOMINAL_SPEED) * panic;
        state.pcWait = gap * (0.88 + Math.random() * 0.24);
      } else state.pcWait = 0.35;
    }
  }
  if (state.mode === "over") return;

  const pitch = state.pitch;
  const rest = pitch;
  const core = pitch * 0.78;
  const sub = dt / SUBSTEPS;
  let mobI = 0;
  if (state.discs.length) {
    for (let i = 0; i < state.discs.length; i++) {
      const dx = state.discs[i].x - state.wellX;
      const dy = state.discs[i].y - state.wellY;
      mobI += dx * dx + dy * dy;
    }
  }
  const floorI = pitch * pitch * 6;
  if (mobI < floorI) mobI = floorI;
  state.mobI = mobI;
  for (let step = 0; step < SUBSTEPS; step++) {
    const cx = state.wellX;
    const cy = state.wellY;
    for (let i = 0; i < state.discs.length; i++) {
      const a = state.discs[i];
      if (state.discs.length) {
        const pull = a.color < 0 ? 7.3 : 3.1;
        a.vx += (cx - a.x) * pull * sub;
        a.vy += (cy - a.y) * pull * sub;
        const spin = state.ang / pitch * (8 / (state.mobI / (pitch * pitch)));
        const gain = pitch * 1.25 * sub;
        a.vx += state.px * gain - spin * (a.y - cy) * 1.25 * sub;
        a.vy += state.py * gain + spin * (a.x - cx) * 1.25 * sub;
        if (a.color < 0) {
          const orbit = 5.6;
          a.vx += -(a.y - cy) * orbit * sub;
          a.vy += (a.x - cx) * orbit * sub;
        }
      }
      const topGap = a.y - state.wallTop;
      if (topGap < state.wallBand) {
        const dwall = Math.max(0.35, topGap);
        a.vy += (state.wallBand / (dwall * dwall)) * 70 * sub;
      }
      const botGap = state.wallBot - a.y;
      if (botGap < state.wallBand) {
        const dwall = Math.max(0.35, botGap);
        a.vy -= (state.wallBand / (dwall * dwall)) * 70 * sub;
      }
      for (let j = i + 1; j < state.discs.length; j++) {
        const b = state.discs[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.04) {
          dx = 0.2;
          dy = 0;
          d2 = 0.04;
        }
        const d = Math.sqrt(d2);
        const like = a.color >= 0 && a.color === b.color;
        const bothBlack = a.color < 0 && b.color < 0;
        const blackColor = (a.color < 0) !== (b.color < 0);
        const pairRest = bothBlack ? rest * 1.42 : rest;
        const cut = bothBlack ? rest * 2.7 : like ? rest * 2.3 : blackColor ? rest * 1.25 : rest * 1.75;
        if (d >= cut) continue;
        let f = 0;
        if (d < pairRest) {
          const stiff = bothBlack ? 140 : blackColor ? 187 : (d < core ? 307 : 147);
          f = (pairRest - d) * stiff;
        } else if (!blackColor) {
          const u = (d - pairRest) / (cut - pairRest);
          const depth = bothBlack ? 36 : like ? 58 : 10;
          f = -depth * u * (1 - u) * 4;
        }
        const nx = dx / d;
        const ny = dy / d;
        a.vx -= f * nx * sub;
        a.vy -= f * ny * sub;
        b.vx += f * nx * sub;
        b.vy += f * ny * sub;
      }
      let spd = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      const drag = 12.5 + spd * 0.03;
      a.vx *= Math.exp(-drag * sub);
      a.vy *= Math.exp(-drag * sub);
      a.x += a.vx * sub;
      a.y += a.vy * sub;
      clampWall(a);
      const cap = pitch * 14;
      spd = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      if (spd > cap) {
        a.vx = a.vx / spd * cap;
        a.vy = a.vy / spd * cap;
      }
    }
    for (let i = 0; i < state.discs.length; i++) {
      const a = state.discs[i];
      for (let j = i + 1; j < state.discs.length; j++) {
        const b = state.discs[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 >= core * core || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const push = (core - d) * 0.5 / d;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }

  for (let i = 0; i < state.flyers.length; i++) {
    const shot = state.flyers[i];
    const c = shot.cell;
    shot.t += dt;
    const burnFor = shot.burnFor || BURN;
    const burn = shot.t < burnFor ? 1 - shot.t / burnFor : 0;
    c.vx += shot.dir * pitch * 140 * burn * burn * burn * dt;
    if (state.discs.length) {
      const dx = state.wellX - c.x;
      const dy = state.wellY - c.y;
      const r2 = dx * dx + dy * dy;
      const soft = pitch * pitch;
      const pull = (pitch * pitch * pitch * FLYER_PULL_STRENGTH) / (r2 + soft);
      const r = Math.sqrt(r2);
      if (r > 0.001) {
        c.vx += pull * dx / r * dt;
        c.vy += pull * dy / r * dt;
      }
    }
    c.vx *= Math.exp(-2.4 * dt);
    c.vy *= Math.exp(-1.1 * dt);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    clampWall(c);
  }

  for (let i = state.flyers.length - 1; i >= 0; i--) {
    const shot = state.flyers[i];
    const c = shot.cell;
    let hit = false;
    for (let k = 0; k < state.discs.length; k++) {
      const dx = c.x - state.discs[k].x;
      const dy = c.y - state.discs[k].y;
      if (dx * dx + dy * dy <= rest * rest) { hit = true; break; }
    }
    if (!hit) continue;
    c.by = shot.side;
    c.live = true;
    c.settle = SETTLE;
    state.discs.push(c);
    state.flyers.splice(i, 1);
  }
  findColorGroups();
  const groups = state.colorGroups || [];
  for (let i = 0; i < state.discs.length; i++) {
    state.discs[i].gid = -1;
    state.discs[i].mark = false;
  }
  for (let g = 0; g < groups.length; g++) {
    const members = groups[g].discs;
    for (let k = 0; k < members.length; k++) members[k].gid = g;
  }
  const open = [];
  for (let h = 0; h < state.matches.length; h++) {
    const match = state.matches[h];
    const gid = match.owner.gid;
    if (gid < 0 || groups[gid].discs.length < MATCH) continue;
    let drop = false;
    for (let k = 0; k < open.length; k++) {
      if (open[k].owner.gid !== gid) continue;
      const newer = state.discs.indexOf(match.owner) > state.discs.indexOf(open[k].owner);
      const winner = newer ? match : open[k];
      winner.t = MARK_TIME;
      winner.members = [];
      open[k] = winner;
      drop = true;
      break;
    }
    if (!drop) open.push(match);
  }
  const kept = [];
  for (let h = 0; h < open.length; h++) {
    const match = open[h];
    const group = groups[match.owner.gid];
    let taker = null;
    for (let i = state.discs.length - 1; i >= 0; i--) {
      const disc = state.discs[i];
      if (disc.gid !== match.owner.gid || disc === match.owner || !disc.live) continue;
      let was = false;
      const prev = match.members || [];
      for (let m = 0; m < prev.length; m++) {
        if (prev[m] === disc) { was = true; break; }
      }
      if (was) continue;
      taker = disc;
      break;
    }
    if (taker) {
      match.owner = taker;
      match.t = MARK_TIME;
    } else match.t -= dt;
    match.members = group.discs.slice();
    if (match.t > 0) {
      kept.push(match);
      continue;
    }
    const doomed = group.discs;
    const keep = [];
    for (let i = 0; i < state.discs.length; i++) {
      let drop = false;
      for (let d = 0; d < doomed.length; d++) {
        if (state.discs[i] === doomed[d]) { drop = true; break; }
      }
      if (!drop) keep.push(state.discs[i]);
    }
    state.discs = keep;
    const exit = match.owner.by === 0 ? 1 : -1;
    let mx = 0;
    let my = 0;
    for (let d = 0; d < doomed.length; d++) {
      mx += doomed[d].x;
      my += doomed[d].y;
    }
    mx /= doomed.length;
    my /= doomed.length;
    const unit = doomed.length / 4;
    const ry = my - state.wellY;
    state.px += exit * unit;
    state.ang += exit * (-ry) * unit;
    if (state.px > 4) state.px = 4;
    if (state.px < -4) state.px = -4;
    const angCap = pitch * 4;
    if (state.ang > angCap) state.ang = angCap;
    if (state.ang < -angCap) state.ang = -angCap;
    for (let d = 0; d < doomed.length; d++) addPop(doomed[d].x, doomed[d].y, doomed[d].color);
    state.bigText = (match.owner.by === 0 ? "LEFT +" : "RIGHT +") + doomed.length;
    state.bigT = 1.8;
    placeWell();
  }
  const claimed = [];
  for (let h = 0; h < kept.length; h++) claimed.push(kept[h].owner.gid);
  for (let i = state.discs.length - 1; i >= 0; i--) {
    const disc = state.discs[i];
    if (!disc.live || disc.gid < 0) continue;
    if (groups[disc.gid].discs.length < MATCH) continue;
    let taken = false;
    for (let c = 0; c < claimed.length; c++) {
      if (claimed[c] === disc.gid) { taken = true; break; }
    }
    if (taken) continue;
    kept.push({ owner: disc, t: MARK_TIME, members: groups[disc.gid].discs.slice() });
    claimed.push(disc.gid);
  }
  for (let h = 0; h < kept.length; h++) {
    const group = groups[kept[h].owner.gid];
    if (!group) continue;
    for (let k = 0; k < group.discs.length; k++) group.discs[k].mark = true;
  }
  state.matches = kept;
  for (let i = 0; i < state.discs.length; i++) {
    const disc = state.discs[i];
    if (!disc.live) continue;
    disc.settle -= dt;
    if (disc.settle > 0) continue;
    let owns = false;
    for (let h = 0; h < state.matches.length; h++) {
      if (state.matches[h].owner === disc) { owns = true; break; }
    }
    if (!owns) disc.live = false;
  }
  if (state.mode === "play") {
    let colors = 0;
    for (let i = 0; i < state.discs.length; i++) {
      if (state.discs[i].color >= 0) colors += 1;
    }
    const want = growInterval(colors);
    if (state.grow > want) state.grow = want;
    state.grow -= dt;
    if (state.grow <= 0) {
      const born = makeDisc(takeBoardColor(), state.wellX, state.wellY);
      const reach = pitch * 1.6;
      for (let i = 0; i < state.discs.length; i++) {
        const other = state.discs[i];
        const dx = other.x - born.x;
        const dy = other.y - born.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001 || dist > reach) continue;
        const w = (reach - dist) / reach;
        const push = pitch * 3.8 * w;
        other.vx += dx / dist * push;
        other.vy += dy / dist * push;
      }
      state.discs.push(born);
      placeWell();
      state.grow = growInterval(colors + 1);
    }
  }
  const loss = edgeLoss();
  if (loss.left || loss.right) {
    state.mode = "over";
    state.loser = loss.left && loss.right ? 2 : (loss.left ? 0 : 1);
  }
  state.blackSpin += 0.45 * dt;
  const fade = Math.exp(-0.2 * dt);
  state.px *= fade;
  state.py *= fade;
  state.ang *= fade;
  placeWell();
}

function togglePc() {
  state.pcLeft = !state.pcLeft;
  state.pcWait = 0.6;
}

function onPoint(x, y) {
  const b = state.pcButton;
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
  if (x === state.w * 0.5) return false;
  if (x < state.w * 0.5) {
    if (state.pcLeft) return false;
    shoot(y, 0);
    return false;
  }
  shoot(y, 1);
  return false;
}

function bindInput() {
  let swallowClick = false;
  canvas.addEventListener("click", function () {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    gameStart();
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
      gameStart();
      return;
    }
    if (state.pcLeft) return;
    const n = ev.keyCode >= 49 && ev.keyCode <= 54 ? ev.keyCode - 49 : -1;
    if (n >= 0) {
      const y = state.wallTop + (n + 0.5) * (state.wallBot - state.wallTop) / 6;
      shoot(y, 0);
    }
  });
  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", function () {
    resize();
    if (!state.armGame) return;
    newGame();
  });
  document.addEventListener("webkitfullscreenchange", function () {
    resize();
    if (!state.armGame) return;
    newGame();
  });
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

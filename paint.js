/*
  Paint. Discs, links, hands, walls.
  Blacks are #111 with a grey edge. They are not a color.
  Long sides repel, but they are not drawn. End lines are the players.
  bigText / bigT is the player award. Nothing else owns that line.
  A live shot wears its own color glow. White is the match.
  Flow dashes ride state.px. They are paint only.
*/

const COLS = [
  { fill: "#ff3b5c", hi: "#ffb6c6", inner: "#ea294a" },
  { fill: "#ff9f1a", hi: "#ffd4b8", inner: "#fa8d00" },
  { fill: "#bb2bff", hi: "#db88ff", inner: "#9c20dd" },
  { fill: "#2ee06a", hi: "#b5ffd1", inner: "#16c14f" },
  { fill: "#3aa0ff", hi: "#b8ddff", inner: "#318ce2" }
];
const BG = "#111111";
const PCOL = ["#ff9f1a", "#3aa0ff"];
const BLACK_FILL = "#111111";
const BLACK_EDGE = "#8d939c";

const TAIL_RATE = 3;
const TAIL_DECAY = 0.07;

const POP_TIME = 0.5;
const pops = [];
let paintNow = 0;
let lastPopColor = -1;

const FLOW_N = 192;
const flowBits = [];
let flowStamp = 0;

function addPop(x, y, color) {
  lastPopColor = color;
  pops.push({ x: x, y: y, color: color, t: 0 });
}

function clearPops() {
  pops.length = 0;
}

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return "rgb(" + r + "," + g + "," + bl + ")";
}

function drawDisc(x, y, r, ci, alpha, sc, shine, ring, noShadow, spin, glow) {
  if (sc <= 0.02 || alpha <= 0.02) return;
  const rr = r * sc;
  const black = ci < 0;
  const c = black ? null : COLS[ci];
  const edge = ring || (black ? BLACK_EDGE : mixHex(c.fill, c.hi, 0.5));
  const outline = Math.max(1.6, rr * 0.11);
  ctx.save();
  ctx.translate(x, y);
  if (!noShadow) {
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, rr * 1.15, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
  }
  if (glow && c) {
    ctx.globalAlpha = alpha * 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, rr * 1.25, 0, Math.PI * 2);
    ctx.fillStyle = c.hi;
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(0, 0, rr, 0, Math.PI * 2);
  ctx.fillStyle = black ? BLACK_FILL : c.fill;
  ctx.fill();
  ctx.lineWidth = outline;
  ctx.strokeStyle = edge;
  ctx.stroke();
  if (black) {
    ctx.rotate(spin || 0);
    ctx.beginPath();
    ctx.arc(-rr * 0.2, -rr * 0.28, rr * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(196, 200, 206, 0.9)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rr * 0.28, rr * 0.32, rr * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(176, 180, 186, 0.8)";
    ctx.fill();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, rr - outline * 0.45, 0, Math.PI * 2);
    ctx.clip();
    // ctx.beginPath();
    // ctx.arc(rr * 0.1, rr * 0.1, rr * 0.6, 0, Math.PI * 2);
    // ctx.fillStyle = c.inner;
    // ctx.fill();
    ctx.restore();
    if (shine) {
      ctx.beginPath();
      ctx.arc(0, 0, rr * 0.65, Math.PI * 1.08, Math.PI * 1.78);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = Math.max(2.3, rr * 0.23);
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTrail(cell) {
  if (!cell.trail) cell.trail = [];
  for (let i = cell.trail.length - 1; i >= 0; i--) {
    cell.trail[i].life -= TAIL_DECAY;
    if (cell.trail[i].life <= 0.02) cell.trail.splice(i, 1);
  }
  cell.trailFrame = (cell.trailFrame || 0) + 1;
  if (!cell.trail.length || cell.trailFrame >= TAIL_RATE) {
    cell.trailFrame = 0;
    cell.trail.unshift({ x: cell.x, y: cell.y, life: 1 });
  }
  const col = COLS[cell.color];
  if (!col) return;
  for (let i = cell.trail.length - 1; i >= 0; i--) {
    const ghost = cell.trail[i];
    ctx.globalAlpha = 0.65 * ghost.life;
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y, state.discR * ghost.life, 0, Math.PI * 2);
    ctx.fillStyle = col.fill;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPops() {
  const step = paintNow - (drawPops.last || paintNow);
  drawPops.last = paintNow;
  const dt = step > 0.05 ? 0.05 : step;
  const edgeW = Math.max(1.6, state.discR * 0.11);
  for (let i = pops.length - 1; i >= 0; i--) {
    const pop = pops[i];
    pop.t += dt;
    const u = pop.t / POP_TIME;
    if (u >= 1) {
      pops.splice(i, 1);
      continue;
    }
    const col = COLS[pop.color];
    if (!col) continue;
    const left = Math.pow(u, 1.5);
    ctx.globalAlpha = Math.pow(1 - u, 1.5);
    ctx.beginPath();
    ctx.arc(pop.x, pop.y, state.discR * (1.1 + 4 * left), 0, Math.PI * 2);
    ctx.lineWidth = edgeW * (1 + u);
    ctx.strokeStyle = mixHex(col.fill, col.hi, 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFlow() {
  const w = state.w;
  const h = state.h;
  if (w < 2 || h < 2) return;
  if (flowBits.length !== FLOW_N) {
    flowBits.length = 0;
    for (let i = 0; i < FLOW_N; i++) {
      flowBits.push({
        x: Math.random() * w,
        y: Math.random() * h,
        ang: Math.random() * Math.PI * 2,
        spin: (Math.random() * 2 - 1) * 0.4,
        v: 2.4 + Math.random() * 2.8,
        tint: 0.82 + Math.random() * 0.18,
        size: 0.3 + Math.random() * .5
      });
    }
  }
  const step = paintNow - flowStamp;
  flowStamp = paintNow;
  const dt = step > 0 && step < 0.05 ? step : 0.016;
  const discR = state.discR;
  const flow = state.px * discR * (0.4 / 0.34);
  const alpha = 0.1 + 0.3 * Math.min(1, Math.abs(state.px) / 5);
  const shade = lastPopColor >= 0 ? COLS[lastPopColor].hi : "#999999";
  const base = ctx.getTransform();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = shade;
  for (let i = 0; i < flowBits.length; i++) {
    const bit = flowBits[i];
    bit.ang += bit.spin * dt;
    bit.x += flow * dt;
    bit.x = bit.x % w;
    if (bit.x < 0) bit.x += w;
    bit.y = bit.y % h;
    if (bit.y < 0) bit.y += h;
    const s = Math.sin(bit.ang);
    const c = Math.cos(bit.ang);
    const vx = flow - s * bit.v * bit.spin;
    const vy = c * bit.v * bit.spin;
    const spd = Math.hypot(vx, vy);
    const spd_part = Math.min(1, spd * 1.7 / discR);
    const thick = discR * bit.size * (1 - spd_part / 4);
    const dash = discR * bit.size * (1 + 3 * spd_part);
    const px = bit.x + c * bit.v;
    const py = bit.y + s * bit.v;
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    ctx.setTransform(base);
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(vy, vx));
    ctx.scale(dash / thick, 1);
    ctx.beginPath();
    ctx.arc(0, 0, thick * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();	
}

function drawColorLinks() {
  const links = state.colorLinks || [];
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2.4, state.discR * 0.34);
  for (let n = 0; n < links.length; n++) {
    const link = links[n];
    const ca = link.a;
    const cb = link.b;
    if (!ca || !cb) continue;
    const hot = ca.mark && cb.mark;
    const col = COLS[link.color];
    ctx.strokeStyle = hot ? "#ffffff" : mixHex(col.fill, col.hi, 0.5);
    ctx.beginPath();
    ctx.moveTo(ca.x, ca.y);
    ctx.lineTo(cb.x, cb.y);
    ctx.stroke();
  }
  ctx.restore();
}

function queueSlot(p, i) {
  const r = state.discR;
  const pad = state.pitch * 0.22;
  const x = p === 0 ? state.boardLeft - r - pad : state.boardRight + r + pad;
  const nextY = state.h * 0.5;
  const gap = state.pitch * 0.78;
  const split = state.pitch * 0.42;
  const y = i === 0 ? nextY : nextY - split - i * gap;
  return { x: x, y: y };
}

function drawQueue(p) {
  const bag = state.bags[p];
  const live = state.mode === "play" && bag.length;
  const r = state.discR;
  const s = state.qSlide ? state.qSlide[p] : 0;
  for (let i = 0; i < bag.length; i++) {
    const here = queueSlot(p, i);
    const was = queueSlot(p, i + 1);
    const born = bag[i].born || 0;
    const along = 1 - s;
    let x = here.x;
    let y = was.y + (here.y - was.y) * along;
    let sc = 0.68;
    let alpha = 1;
    let shine = false;
    if (born > 0.001) {
      y = here.y;
      alpha = 1 - born;
    } else if (i === 0 && live) {
      sc = 0.68 + 0.4 * along;
      shine = along > 0.55;
    }
    drawDisc(x, y, r, bag[i].color, alpha, sc, shine);
  }
}

function draw() {
  paintNow = performance.now() / 1000;
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
    drawPcButton();
    return;
  }

  drawFlow();

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#666666";
  ctx.beginPath();
  ctx.moveTo(state.w * 0.5, state.wallTop);
  ctx.lineTo(state.w * 0.5, state.wallBot);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#888844";
  ctx.globalAlpha = state.mode === "play" ? 0.95 : 0.28;
  ctx.beginPath();
  ctx.moveTo(state.boardLeft, state.wallTop);
  ctx.lineTo(state.boardLeft, state.wallBot);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(state.boardRight, state.wallTop);
  ctx.lineTo(state.boardRight, state.wallBot);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(state.wellX, state.wellY, Math.max(3, state.discR * 0.18), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawColorLinks();
  const discs = state.discs || [];
  for (let i = 0; i < discs.length; i++) {
    if (discs[i].live) drawTrail(discs[i]);
    else discs[i].trail = null;
  }
  for (let i = 0; i < state.flyers.length; i++) drawTrail(state.flyers[i].cell);
  for (let i = 0; i < discs.length; i++) {
    const c = discs[i];
    drawDisc(c.x, c.y, state.discR, c.color, 1, 1, c.color >= 0, c.mark ? "#ffffff" : "", false, c.color < 0 ? state.blackSpin : 0, c.live);
  }
  for (let i = 0; i < state.flyers.length; i++) {
    const c = state.flyers[i].cell;
    drawDisc(c.x, c.y, state.discR, c.color, 1, 1, true, "", false, 0, true);
  }
  drawPops();

  drawQueue(0);
  drawQueue(1);
  drawPcButton();
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#999966";
  const small = Math.max(20, state.h * 0.06);
  ctx.font = "600 " + small + "px ui-sans-serif, system-ui, sans-serif";
  if (state.mode === "over") {
    const msg = state.loser === 2 ? "BOTH OUT" : (state.loser === 0 ? "RIGHT WIND" : "LEFT WINS");
    ctx.fillText(msg, state.w * 0.5, Math.max(small, state.wallTop * 0.5));
    ctx.font = "400 " + (small * 0.72) + "px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("tap to restart", state.w * 0.5, state.wallBot + (state.h - state.wallBot) * 0.45);
  } else if (state.bigText && state.bigT > 0) {
    const labelY = Math.max(small * 0.7, state.wallTop * 0.45);
    ctx.fillText(state.bigText, state.w * 0.5, labelY);
  }
  ctx.restore();
}

function drawPcButton() {
  const b = state.pcButton;
  const on = state.pcLeft;
  ctx.save();
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = on ? PCOL[0] : "rgba(8, 10, 16, 0.72)";
  ctx.fill();
  ctx.lineWidth = Math.max(2, b.r * 0.08);
  ctx.strokeStyle = on ? "#ffe3b8" : "rgba(215, 236, 255, 0.45)";
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = on ? "#1a1206" : "rgba(215, 236, 255, 0.7)";
  ctx.font = "700 " + Math.max(11, b.r * 0.62) + "px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("AI", b.x, b.y + 1);
  if (on) {
    const panic = state.pcPanic || 0;
    const x = b.x + b.r + 8;
    const w = b.r * 2.6;
    const h = Math.max(4, b.r * 0.28);
    const y = b.y - h * 0.5;
    ctx.fillStyle = "rgba(215, 236, 255, 0.18)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PCOL[0];
    ctx.fillRect(x, y, w * panic, h);
  }
  ctx.restore();
}

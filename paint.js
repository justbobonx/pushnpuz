/*
  Paint. Discs, links, hands, walls.
  Blacks are #111 with a grey edge. They are not a color.
  Long sides repel, but they are not drawn. End lines are the players.
  bigText / bigT is the player award. Nothing else owns that line.
*/

const COLS = [
  { fill: "#ff3b5c", hi: "#ffb6c6" },
  { fill: "#ff9f1a", hi: "#ffe3b8" },
  { fill: "#bb2bff", hi: "#db88ff" },
  { fill: "#2ee06a", hi: "#b5ffd1" },
  { fill: "#3aa0ff", hi: "#b8ddff" }
];
const BG = "#07080d";
const PCOL = ["#ff9f1a", "#3aa0ff"];
const BLACK_FILL = "#111111";
const BLACK_EDGE = "#8d939c";

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return "rgb(" + r + "," + g + "," + bl + ")";
}

function drawDisc(x, y, r, ci, alpha, sc, shine, ring, noShadow, spin) {
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
  } else if (shine) {
    ctx.beginPath();
    ctx.arc(0, 0, rr * 0.72, Math.PI * 1.08, Math.PI * 1.78);
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = Math.max(1.5, rr * 0.14);
    ctx.lineCap = "round";
    ctx.stroke();
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

  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = PCOL[0];
  ctx.globalAlpha = state.mode === "play" ? 0.95 : 0.28;
  ctx.beginPath();
  ctx.moveTo(state.boardLeft, state.wallTop);
  ctx.lineTo(state.boardLeft, state.wallBot);
  ctx.stroke();
  ctx.strokeStyle = PCOL[1];
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
    const c = discs[i];
    drawDisc(c.x, c.y, state.discR, c.color, 1, 1, c.color >= 0, c.mark ? "#ffffff" : "", false, c.color < 0 ? state.blackSpin : 0);
  }
  for (let i = 0; i < state.flyers.length; i++) {
    const c = state.flyers[i].cell;
    drawDisc(c.x, c.y, state.discR, c.color, 1, 1, true);
  }
  const poppers = state.poppers || [];
  for (let i = 0; i < poppers.length; i++) {
    const pop = poppers[i];
    drawDisc(pop.x, pop.y, state.discR, pop.color, pop.alpha, pop.sc, false, "", true);
  }

  drawQueue(0);
  drawQueue(1);
  drawPcButton();
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#d7ecff";
  const small = Math.max(13, state.h * 0.04);
  ctx.font = "600 " + small + "px ui-sans-serif, system-ui, sans-serif";
  if (state.mode === "over") {
    const msg = state.loser === 2 ? "BOTH OUT" : (state.loser === 0 ? "LEFT OUT" : "RIGHT OUT");
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

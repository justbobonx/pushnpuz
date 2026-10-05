/*
  Paint. Discs, links, hand, and the award line.
  bigText / bigT is the player award. Nothing else owns that line.
  Poppers are discs that have left the pack and are bursting out.
  Depth is a grey fill per grid slot. The cells touching the weight target are #111111.
  Each slot outward adds #020202. The fill uses lw - rw, not the springing marker, so the pop overshoot does not walk the band.
  Grid lines stay on top of the fill. No inset.
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

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return "rgb(" + r + "," + g + "," + bl + ")";
}

function drawDisc(x, y, r, ci, alpha, sc, shine, ring, noShadow) {
  if (sc <= 0.02 || alpha <= 0.02) return;
  const rr = r * sc;
  const c = COLS[ci];
  const edge = ring || mixHex(c.fill, c.hi, 0.5);
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

function drawColorLinks() {
  const links = state.colorLinks || [];
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2.4, state.discR * 0.34);
  for (let n = 0; n < links.length; n++) {
    const link = links[n];
    const ca = link.a.cell;
    const cb = link.b.cell;
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
  const nextY = state.boardTop + state.pitch * ROWS * 0.5;
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
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(state.boardLeft, state.boardTop, state.boardRight - state.boardLeft, state.pitch * ROWS);
  ctx.clip();
  for (let r = 0; r < ROWS; r++) {
    const target = state.rows[r].lw - state.rows[r].rw;
    const y = state.boardTop + r * state.pitch;
    const leftEdge = Math.floor(target);
    const rightEdge = Math.ceil(target);
    for (let s = -END; s < END; s++) {
      let steps = 0;
      if (s + 1 <= leftEdge) steps = leftEdge - (s + 1);
      else if (s >= rightEdge) steps = s - rightEdge;
      const v = Math.min(255, 0x11 + steps * 2);
      ctx.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
      ctx.fillRect(state.wellX + s * state.half, y, state.half, state.pitch);
    }
  }
  ctx.restore();

  ctx.save();
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
  }
  drawColorLinks();
  for (let r = 0; r < ROWS; r++) {
    const row = state.rows[r];
    for (let i = 0; i < row.cells.length; i++) {
      const c = row.cells[i];
      drawDisc(c.x, c.y, state.discR, c.color, 1, 1, true, c.mark ? "#ffffff" : "");
    }
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

  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = PCOL[0];
  ctx.globalAlpha = state.mode === "play" ? 0.95 : 0.28;
  ctx.strokeRect(state.boardLeft - 2, state.boardTop, 4, state.pitch * ROWS);
  ctx.strokeStyle = PCOL[1];
  ctx.globalAlpha = state.mode === "play" ? 0.95 : 0.28;
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
  } else if (state.bigText && state.bigT > 0) {
    const labelY = Math.max(small * 0.7, state.boardTop * 0.28);
    ctx.fillText(state.bigText, state.w * 0.5, labelY);
  }
  ctx.restore();
}

/*
  Board. No slots, no rows.
  Discs sit in a pair well: rest length is the old slot spacing, one pitch.
  Blacks are a column on the center line at that spacing, enough that a shot
  cannot pass between them. They do not match.
  Like colors link inside a hysteresis band. A group bigger than MATCH that
  holds a disc from this volley is a match.
*/

const MATCH = 3;
const CONNECT = 1.35;
const BREAK = 1.85;
const BLACK = -1;

function makeDisc(color, x, y) {
  return { color: color, x: x, y: y, vx: 0, vy: 0, by: -1, mark: false, checked: false };
}

function findColorGroups() {
  const discs = state.discs;
  const pitch = state.pitch || 1;
  const connect = CONNECT * pitch;
  const brk = BREAK * pitch;
  const links = [];
  const parent = [];
  for (let n = 0; n < discs.length; n++) parent.push(n);
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  const prev = state.colorLinks || [];
  for (let a = 0; a < discs.length; a++) {
    if (discs[a].color < 0) continue;
    for (let b = a + 1; b < discs.length; b++) {
      if (discs[b].color !== discs[a].color) continue;
      const dx = discs[a].x - discs[b].x;
      const dy = discs[a].y - discs[b].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      let held = false;
      for (let k = 0; k < prev.length; k++) {
        const link = prev[k];
        if ((link.a === discs[a] && link.b === discs[b]) || (link.a === discs[b] && link.b === discs[a])) {
          held = true;
          break;
        }
      }
      const near = held ? d <= brk : d <= connect;
      if (!near) continue;
      links.push({ a: discs[a], b: discs[b], color: discs[a].color });
      const pa = find(a);
      const pb = find(b);
      if (pa !== pb) parent[pa] = pb;
    }
  }
  const groups = [];
  const at = {};
  for (let n = 0; n < discs.length; n++) {
    if (discs[n].color < 0) continue;
    const p = find(n);
    let g = at[p];
    if (!g) {
      g = { color: discs[n].color, discs: [] };
      at[p] = g;
      groups.push(g);
    }
    g.discs.push(discs[n]);
  }
  state.colorLinks = links;
  state.colorGroups = groups;
}

function matchedGroups() {
  const groups = state.colorGroups || [];
  const hit = [];
  for (let g = 0; g < groups.length; g++) {
    if (groups[g].discs.length > MATCH) hit.push(groups[g]);
  }
  return hit;
}

function edgeLoss() {
  let left = false;
  let right = false;
  const discs = state.discs;
  for (let i = 0; i < discs.length; i++) {
    if (discs[i].color < 0) continue;
    if (discs[i].x <= state.boardLeft) left = true;
    if (discs[i].x >= state.boardRight) right = true;
  }
  return { left: left, right: right };
}

/*
  Board packing and color groups.
  Odd count sits on the well. Even count straddles it.
  Same-color discs group when 2*row^2 + slot^2 <= 6.
  That caps at 1, and 1 is one row by two slots.
  A group bigger than MATCH is a match. An empty row has no discs, so it does not match.
*/

const ROWS = 6;
const END = 15;
const MATCH = 3;
const GROUP_REACH = 6;

function slotsOf(row) {
  const n = row.cells.length;
  if (!n) return [];
  const s = row.lw - row.rw;
  const out = new Array(n);
  for (let k = 0; k < n; k++) out[k] = s - (n - 1) + 2 * k;
  return out;
}

function slotX(slot) { return state.wellX + slot * state.half; }
function rowY(r) { return state.boardTop + (r + 0.5) * state.pitch; }

function contactX(row, side) {
  const slots = slotsOf(state.rows[row]);
  if (!slots.length) return slotX(0);
  if (side === 0) return slotX(slots[0]) - state.pitch;
  return slotX(slots[slots.length - 1]) + state.pitch;
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

function freshRows() {
  const rows = [];
  for (let r = 0; r < ROWS; r++) rows.push({ cells: [], lw: 0, rw: 0, bal: 0, bvx: 0 });
  return rows;
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

function findColorGroups() {
  const span = [];
  for (let r = 0; r < ROWS; r++) {
    const slots = slotsOf(state.rows[r]);
    const cells = state.rows[r].cells;
    for (let i = 0; i < cells.length; i++) {
      span.push({ r: r, i: i, cell: cells[i], slot: slots[i], color: cells[i].color });
    }
  }
  const parent = [];
  for (let n = 0; n < span.length; n++) parent.push(n);
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  const links = [];
  for (let a = 0; a < span.length; a++) {
    for (let b = a + 1; b < span.length; b++) {
      if (span[a].color !== span[b].color) continue;
      const dr = span[a].r - span[b].r;
      const ds = span[a].slot - span[b].slot;
      if (2 * dr * dr + ds * ds > GROUP_REACH) continue;
      links.push({ a: span[a], b: span[b], color: span[a].color });
      const pa = find(a);
      const pb = find(b);
      if (pa !== pb) parent[pa] = pb;
    }
  }
  const groups = [];
  const at = {};
  for (let n = 0; n < span.length; n++) {
    const p = find(n);
    let g = at[p];
    if (!g) {
      g = { color: span[n].color, discs: [] };
      at[p] = g;
      groups.push(g);
    }
    g.discs.push(span[n]);
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

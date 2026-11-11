/* =========================================================================
   Guy model — turns a doodle into a creature.
   Everything here is pure math on the stroke data (no canvas rasterizing),
   so the same doodle produces the same guy on every device.
   ========================================================================= */
const DRAW = 500;   // drawing space is DRAW x DRAW units
const INK_W = 9;    // ink line width, drawing units
const CELL = 4;     // analysis grid cell, drawing units
const INK = '#1E1B36';
const COLORS = [
  { name: 'Lemon', fill: '#FFD84A' },
  { name: 'Tangerine', fill: '#FF9A47' },
  { name: 'Bubblegum', fill: '#FF82B8' },
  { name: 'Mint', fill: '#5FDBA2' },
  { name: 'Sky', fill: '#69BCFF' },
  { name: 'Lilac', fill: '#B69CFF' },
  { name: 'Tomato', fill: '#FF6457' },
  { name: 'Moss', fill: '#A3CF56' },
  { name: 'Marshmallow', fill: '#F7F4FF' },
  { name: 'Midnight', fill: '#4E4A6E' },
];
const LEG_OPTIONS = [0, 2, 4, 6, 8];

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}

/* 3-4 chamfer distance transform; result in thirds of a cell */
function chamfer(gw, gh, src) {
  const N = gw * gh, d = new Uint16Array(N), INF = 60000;
  for (let k = 0; k < N; k++) d[k] = src[k] ? 0 : INF;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = j * gw + i; let v = d[k]; if (!v) continue;
    if (i > 0 && d[k - 1] + 3 < v) v = d[k - 1] + 3;
    if (j > 0) {
      if (d[k - gw] + 3 < v) v = d[k - gw] + 3;
      if (i > 0 && d[k - gw - 1] + 4 < v) v = d[k - gw - 1] + 4;
      if (i < gw - 1 && d[k - gw + 1] + 4 < v) v = d[k - gw + 1] + 4;
    }
    d[k] = v;
  }
  for (let j = gh - 1; j >= 0; j--) for (let i = gw - 1; i >= 0; i--) {
    const k = j * gw + i; let v = d[k]; if (!v) continue;
    if (i < gw - 1 && d[k + 1] + 3 < v) v = d[k + 1] + 3;
    if (j < gh - 1) {
      if (d[k + gw] + 3 < v) v = d[k + gw] + 3;
      if (i < gw - 1 && d[k + gw + 1] + 4 < v) v = d[k + gw + 1] + 4;
      if (i > 0 && d[k + gw - 1] + 4 < v) v = d[k + gw - 1] + 4;
    }
    d[k] = v;
  }
  return d;
}

/* marching squares on a binary mask -> closed loops (sample-index space) */
function traceLoops(mask, gw, gh) {
  const segA = [], segB = [];
  const H = (i, j) => (j * gw + i) * 2, V = (i, j) => (j * gw + i) * 2 + 1;
  const add = (a, b) => { segA.push(a); segB.push(b); };
  for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
    const tl = mask[j * gw + i], tr = mask[j * gw + i + 1], br = mask[(j + 1) * gw + i + 1], bl = mask[(j + 1) * gw + i];
    const c = tl * 8 + tr * 4 + br * 2 + bl;
    if (c === 0 || c === 15) continue;
    const top = H(i, j), bottom = H(i, j + 1), left = V(i, j), right = V(i + 1, j);
    switch (c) {
      case 1: case 14: add(left, bottom); break;
      case 2: case 13: add(bottom, right); break;
      case 3: case 12: add(left, right); break;
      case 4: case 11: add(top, right); break;
      case 5: add(left, bottom); add(top, right); break;
      case 6: case 9: add(top, bottom); break;
      case 7: case 8: add(top, left); break;
      case 10: add(top, left); add(bottom, right); break;
    }
  }
  const adj = new Map();
  const link = (key, s) => { const l = adj.get(key); if (l) l.push(s); else adj.set(key, [s]); };
  for (let s = 0; s < segA.length; s++) { link(segA[s], s); link(segB[s], s); }
  const pos = (key) => {
    const cellIdx = key >> 1, i = cellIdx % gw, j = (cellIdx - i) / gw;
    return (key & 1) ? [i, j + 0.5] : [i + 0.5, j];
  };
  const used = new Uint8Array(segA.length), loops = [];
  for (let s0 = 0; s0 < segA.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1;
    const start = segA[s0];
    let cur = segB[s0], s = s0;
    const loop = [pos(start)];
    let guard = 0;
    while (cur !== start && guard++ < 100000) {
      loop.push(pos(cur));
      const l = adj.get(cur);
      const nxt = l[0] === s ? l[1] : l[0];
      if (nxt === undefined || used[nxt]) break;
      used[nxt] = 1; s = nxt;
      cur = segA[nxt] === cur ? segB[nxt] : segA[nxt];
    }
    loops.push(loop);
  }
  return loops;
}

function chaikinClosed(pts, iters) {
  for (let it = 0; it < iters; it++) {
    const out = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
    }
    pts = out;
  }
  return pts;
}

function rdp(pts, eps) { // open polyline of [x,y]
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]], e2 = eps * eps;
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, bd = e2;
    for (let i = a + 1; i < b; i++) {
      const d = segDist2(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]);
      if (d > bd) { bd = d; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function rdpClosed(pts, eps) {
  if (pts.length < 8) return pts;
  let far = 0, fd = -1;
  for (let i = 1; i < pts.length; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const a = rdp(pts.slice(0, far + 1), eps), b = rdp(pts.slice(far).concat([pts[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

/* Simplify + quantize raw strokes so stored data == shared data (2-unit grid). */
function cleanStrokes(strokes) {
  const out = [];
  for (const s of strokes) {
    const pts = [];
    for (let i = 0; i < s.length; i += 2) pts.push([s[i], s[i + 1]]);
    const simp = pts.length > 2 ? rdp(pts, 1.1) : pts;
    const flat = [];
    let px = -1, py = -1;
    for (const p of simp) {
      const x = clamp(Math.round(p[0] / 2) * 2, 0, DRAW), y = clamp(Math.round(p[1] / 2) * 2, 0, DRAW);
      if (x === px && y === py) continue;
      flat.push(x, y); px = x; py = y;
    }
    if (flat.length) out.push(flat);
  }
  return out;
}

function analyzeDrawing(strokes) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, n = 0, inkLen = 0;
  for (const s of strokes) {
    for (let i = 0; i < s.length; i += 2) {
      const x = s[i], y = s[i + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      n++;
    }
    for (let i = 2; i < s.length; i += 2) inkLen += Math.hypot(s[i] - s[i - 2], s[i + 1] - s[i - 1]);
  }
  if (!n) return null;
  const inkR = INK_W / 2, closeR = inkR + 14;
  const pad = closeR + CELL * 3;
  const ox = minX - pad, oy = minY - pad;
  const gw = Math.ceil((maxX - minX + 2 * pad) / CELL) + 1;
  const gh = Math.ceil((maxY - minY + 2 * pad) / CELL) + 1;
  const N = gw * gh;
  const wall = new Uint8Array(N), ink = new Uint8Array(N);
  const rc2 = closeR * closeR, ri2 = (inkR + CELL * 0.5) ** 2;
  const stamp = (ax, ay, bx, by) => {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - closeR - ox) / CELL) - 1);
    const i1 = Math.min(gw - 1, Math.ceil((Math.max(ax, bx) + closeR - ox) / CELL) + 1);
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - closeR - oy) / CELL) - 1);
    const j1 = Math.min(gh - 1, Math.ceil((Math.max(ay, by) + closeR - oy) / CELL) + 1);
    for (let j = j0; j <= j1; j++) {
      const cy = oy + (j + 0.5) * CELL;
      for (let i = i0; i <= i1; i++) {
        const d2 = segDist2(ox + (i + 0.5) * CELL, cy, ax, ay, bx, by);
        if (d2 <= rc2) { const k = j * gw + i; wall[k] = 1; if (d2 <= ri2) ink[k] = 1; }
      }
    }
  };
  for (const s of strokes) {
    if (s.length === 2) stamp(s[0], s[1], s[0], s[1]);
    for (let i = 2; i < s.length; i += 2) stamp(s[i - 2], s[i - 1], s[i], s[i + 1]);
  }
  // flood the outside
  const outside = new Uint8Array(N), stack = new Int32Array(N);
  let sp = 0;
  const push = (k) => { if (!outside[k] && !wall[k]) { outside[k] = 1; stack[sp++] = k; } };
  for (let i = 0; i < gw; i++) { push(i); push((gh - 1) * gw + i); }
  for (let j = 0; j < gh; j++) { push(j * gw); push(j * gw + gw - 1); }
  while (sp) {
    const k = stack[--sp], i = k % gw;
    if (i > 0) push(k - 1);
    if (i < gw - 1) push(k + 1);
    if (k >= gw) push(k - gw);
    if (k < N - gw) push(k + gw);
  }
  // morphological close: erode the filled region back to the ink's outer edge
  const dOut = chamfer(gw, gh, outside);
  const erode = ((closeR - inkR) / CELL) * 3;
  const body = new Uint8Array(N);
  for (let k = 0; k < N; k++) body[k] = (!outside[k] && dOut[k] > erode) || ink[k] ? 1 : 0;

  // connected components (4-neighbour)
  const label = new Int32Array(N).fill(-1), comps = [];
  for (let k0 = 0; k0 < N; k0++) {
    if (!body[k0] || label[k0] >= 0) continue;
    const id = comps.length;
    let area = 0, i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1;
    sp = 0; stack[sp++] = k0; label[k0] = id;
    while (sp) {
      const k = stack[--sp], i = k % gw, j = (k - i) / gw;
      area++;
      if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
      const nb = [i > 0 ? k - 1 : -1, i < gw - 1 ? k + 1 : -1, j > 0 ? k - gw : -1, j < gh - 1 ? k + gw : -1];
      for (const q of nb) if (q >= 0 && body[q] && label[q] < 0) { label[q] = id; stack[sp++] = q; }
    }
    comps.push({ id, area, i0, i1, j0, j1 });
  }
  if (!comps.length) return null;
  comps.sort((a, b) => b.area - a.area);
  const main = comps[0];
  const kept = comps.filter((c) => c.area >= 10);

  // contours for every kept component
  const contours = [];
  let mainPerim = 0;
  for (const c of kept) {
    const m = new Uint8Array(N);
    for (let k = 0; k < N; k++) m[k] = label[k] === c.id ? 1 : 0;
    const loops = traceLoops(m, gw, gh);
    let best = loops[0] || [];
    for (const l of loops) if (l.length > best.length) best = l;
    if (best.length < 4) continue;
    let pts = best.map(([i, j]) => [ox + (i + 0.5) * CELL, oy + (j + 0.5) * CELL]);
    pts = rdpClosed(chaikinClosed(pts, 2), 0.7);
    if (c === main) for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; mainPerim += Math.hypot(q[0] - p[0], q[1] - p[1]); }
    contours.push(pts);
  }

  // distance inside the main body (for eyes) and the "solid" core (for legs/arms)
  const notMain = new Uint8Array(N);
  for (let k = 0; k < N; k++) notMain[k] = label[k] === main.id ? 0 : 1;
  const dIn = chamfer(gw, gh, notMain);
  let solid = new Uint8Array(N), solidArea = 0;
  for (let k = 0; k < N; k++) if (!notMain[k] && dIn[k] >= 6) { solid[k] = 1; solidArea++; }
  if (solidArea < main.area * 0.25) { solid = new Uint8Array(N); for (let k = 0; k < N; k++) solid[k] = notMain[k] ? 0 : 1; }

  const area = main.area * CELL * CELL;
  const bx0 = ox + main.i0 * CELL, bx1 = ox + (main.i1 + 1) * CELL;
  const by0 = oy + main.j0 * CELL, by1 = oy + (main.j1 + 1) * CELL;
  return {
    strokes, ox, oy, gw, gh, label, mainId: main.id, dIn, solid, contours,
    area, perim: Math.max(mainPerim, 1), inkLen,
    bx0, bx1, by0, by1, bodyW: bx1 - bx0, bodyH: by1 - by0,
    inkTop: minY - INK_W / 2, inkBottom: maxY + INK_W / 2, inkLeft: minX - INK_W / 2, inkRight: maxX + INK_W / 2,
  };
}

/* distance (drawing units) from point to the edge of the main body; negative = outside */
function bodyDist(A, x, y) {
  const i = Math.floor((x - A.ox) / CELL), j = Math.floor((y - A.oy) / CELL);
  if (i < 0 || j < 0 || i >= A.gw || j >= A.gh) return -99;
  const k = j * A.gw + i;
  if (A.label[k] !== A.mainId) return -1;
  return (A.dIn[k] / 3 - 0.5) * CELL;
}

const _analysisCache = new Map();
function analyzeCached(strokes) {
  const key = strokes.map((s) => s.join(',')).join('|');
  let A = _analysisCache.get(key);
  if (!A) {
    A = analyzeDrawing(strokes);
    if (_analysisCache.size > 60) _analysisCache.clear();
    _analysisCache.set(key, A);
  }
  return A;
}

function buildGuy(rec) {
  const A = analyzeCached(rec.strokes);
  if (!A) return null;
  const fr = makeRng(hashInts(rec.seed, rec.look, 11));   // body/face variant
  const pr = makeRng(hashInts(rec.seed, 77, 29));         // personality (stable across face shuffles)
  const g = { rec, A };
  const bodyW = A.bodyW, bodyH = A.bodyH;
  const minDim = Math.min(bodyW, bodyH);
  const cx = (A.bx0 + A.bx1) / 2;

  // ---- bottom profile of the solid core
  const cols = [];
  for (let i = 0; i < A.gw; i++) {
    let jb = -1;
    for (let j = A.gh - 1; j >= 0; j--) if (A.solid[j * A.gw + i]) { jb = j; break; }
    if (jb >= 0) cols.push({ x: A.ox + (i + 0.5) * CELL, y: A.oy + (jb + 1) * CELL });
  }
  const solidBottom = cols.reduce((m, c) => Math.max(m, c.y), -1e9);
  const nLegs = rec.legs | 0;
  // legs stand at the solid core; legless guys stand on whatever they were drawn with
  const baseY = nLegs > 0 ? solidBottom : Math.max(A.by1, A.inkBottom - INK_W * 0.2);
  g.originX = cx; g.originY = baseY;
  const L = (x, y) => [x - cx, y - baseY];

  // ---- legs
  g.legs = [];
  let legLen = 0;
  if (nLegs > 0) {
    const low = cols.filter((c) => c.y >= solidBottom - bodyH * 0.33);
    const xl = Math.min(...low.map((c) => c.x)), xr = Math.max(...low.map((c) => c.x));
    const span = Math.max(xr - xl, 1);
    const m = span * (nLegs === 2 ? 0.2 : 0.08);
    legLen = clamp(bodyH * fr.range(0.28, 0.5), 30, 125);
    if (fr.chance(0.08)) legLen = Math.min(legLen * 1.7, 190); // rare: absolutely huge legs
    const style = fr.chance(0.3) ? 'chunky' : 'stick';
    for (let i = 0; i < nLegs; i++) {
      const x = nLegs === 1 ? (xl + xr) / 2 : xl + m + (span - 2 * m) * (i / (nLegs - 1));
      let best = low[0];
      for (const c of low) if (Math.abs(c.x - x) < Math.abs(best.x - x)) best = c;
      const hipY = best.y - INK_W * 0.6;
      const [hx, hy] = L(best.x, hipY);
      g.legs.push({ hx, hy, len: (legLen - hy) * 1.05, group: i % 2, off: nLegs > 2 ? (i >> 1) * 0.55 : 0 });
    }
    g.legStyle = style;
  }
  g.legLen = legLen;
  g.stride = clamp(legLen * 0.8, 22, 80);
  g.footStyle = fr.pick(['shoe', 'shoe', 'round', 'toes', 'shoe']);
  g.shoe = fr.pick(['#FFFFFF', '#FF6457', INK, '#69BCFF', '#FFD84A', INK]);

  // ---- arms (at the widest point around the upper-middle)
  g.arms = [];
  if (rec.arms) {
    const targetY = A.by0 + bodyH * 0.45;
    let found = null;
    for (let dj = 0; dj < 30 && !found; dj++) {
      for (const sgn of [1, -1]) {
        const j = Math.floor((targetY - A.oy) / CELL) + dj * sgn;
        if (j < 0 || j >= A.gh) continue;
        let il = -1, ir = -1;
        for (let i = 0; i < A.gw; i++) if (A.solid[j * A.gw + i]) { if (il < 0) il = i; ir = i; }
        if (il >= 0 && ir - il >= 3) { found = { y: A.oy + (j + 0.5) * CELL, xl: A.ox + (il + 0.5) * CELL, xr: A.ox + (ir + 0.5) * CELL }; break; }
      }
    }
    if (found) {
      const armLen = clamp(bodyH * fr.range(0.26, 0.38), 26, 105);
      const inset = INK_W * 0.9;
      const [lx, ly] = L(found.xl + inset, found.y), [rx, ry] = L(found.xr - inset, found.y);
      g.arms.push({ sx: lx, sy: ly, side: -1, len: armLen }, { sx: rx, sy: ry, side: 1, len: armLen });
    }
  }

  // ---- eyes
  const eyeScale = fr.range(0.82, 1.15);
  const rMax = clamp(0.24 * minDim, 11, 60) * eyeScale;
  const rMin = Math.max(7, 0.07 * minDim);
  const yA = A.by0 + bodyH * 0.06, yB = A.by0 + bodyH * 0.62;
  let best2 = null;
  for (let y = yA; y <= yB; y += CELL) {
    const relY = (y - A.by0) / bodyH;
    for (let x = A.bx0; x <= A.bx1; x += CELL) {
      for (let s = rMin * 2.1; s <= Math.min(bodyW * 0.85, rMax * 4.4); s += CELL * 1.5) {
        const dA = bodyDist(A, x - s / 2, y), dB = bodyDist(A, x + s / 2, y);
        if (dA < 0 || dB < 0) continue;
        const r = Math.min(Math.min(dA, dB) / 0.8, s * 0.46, rMax);
        if (r < rMin) continue;
        const score = r * (1.25 - 0.55 * relY) - 0.35 * r * Math.abs(x - cx) / bodyW;
        if (!best2 || score > best2.score) best2 = { x, y, s, r, score };
      }
    }
  }
  let best1 = null;
  for (let y = yA; y <= A.by0 + bodyH * 0.7; y += CELL) {
    const relY = (y - A.by0) / bodyH;
    for (let x = A.bx0; x <= A.bx1; x += CELL) {
      const d = bodyDist(A, x, y);
      if (d <= 0) continue;
      const r = Math.min(d / 0.8, rMax * 1.35);
      const score = r * (1.2 - 0.5 * relY) - 0.3 * r * Math.abs(x - cx) / bodyW;
      if (!best1 || score > best1.score) best1 = { x, y, r, score };
    }
  }
  const eyeRoll = fr();
  g.eyes = [];
  g.stalks = [];
  if (best2 && (eyeRoll < 0.84 || !best1 || best1.r < rMin * 1.2)) {
    const e1 = L(best2.x - best2.s / 2, best2.y), e2 = L(best2.x + best2.s / 2, best2.y);
    const tilt = fr.range(-0.06, 0.06) * best2.r;
    g.eyes.push({ x: e1[0], y: e1[1] - tilt, r: best2.r }, { x: e2[0], y: e2[1] + tilt, r: best2.r * fr.range(0.9, 1.05) });
    if (eyeRoll > 0.93) {
      const top = L(best2.x, best2.y - best2.r * 1.5);
      if (bodyDist(A, best2.x, best2.y - best2.r * 1.5) > best2.r * 0.4) g.eyes.push({ x: top[0], y: top[1], r: best2.r * 0.7 });
    }
  } else if (best1 && best1.r >= rMin) {
    const e = L(best1.x, best1.y);
    g.eyes.push({ x: e[0], y: e[1], r: best1.r });
  } else {
    // too skinny for eyes: put them on stalks above the head
    const topY = A.inkTop;
    const sr = clamp(0.12 * Math.max(bodyW, 60), 8, 22);
    const sp = Math.max(sr * 2.6, bodyW * 0.3);
    for (const sx of [-sp / 2, sp / 2]) {
      const base = L(cx + sx * 0.4, topY + INK_W);
      const eye = L(cx + sx, topY - sr * 2.4);
      g.stalks.push({ bx: base[0], by: base[1], ex: eye[0], ey: eye[1] });
      g.eyes.push({ x: eye[0], y: eye[1], r: sr });
    }
  }
  g.pupil = fr.range(0.42, 0.62);
  g.sleepyLids = fr.chance(0.1);
  g.lashes = fr.chance(0.12);

  // ---- mouth + cheeks
  const eyesMain = g.eyes.slice(0, Math.min(2, g.eyes.length));
  const emx = eyesMain.reduce((s, e) => s + e.x, 0) / eyesMain.length;
  const emy = eyesMain.reduce((s, e) => s + e.y, 0) / eyesMain.length;
  const er = eyesMain[0].r;
  const spread = eyesMain.length > 1 ? Math.abs(eyesMain[1].x - eyesMain[0].x) : er * 1.6;
  let mouthW = clamp(spread * fr.range(0.45, 0.7), 12, 70);
  g.mouth = null;
  if (!g.stalks.length) {
    for (let dy = er * 1.25; dy <= er * 2.8 + 20; dy += CELL) {
      const wx = emx + cx, wy = emy + baseY + dy;
      const d = bodyDist(A, wx, wy);
      if (d > Math.max(6, mouthW * 0.28)) { g.mouth = { x: emx, y: emy + dy, w: mouthW }; break; }
    }
    if (!g.mouth) {
      mouthW *= 0.6;
      const wy = emy + baseY + er * 1.4;
      if (bodyDist(A, emx + cx, wy) > 3) g.mouth = { x: emx, y: emy + er * 1.4, w: mouthW };
    }
  } else {
    const d = bodyDist(A, cx, A.by0 + bodyH * 0.45);
    if (d > 4) g.mouth = { x: 0, y: A.by0 + bodyH * 0.45 - baseY, w: clamp(bodyW * 0.4, 8, 30) };
  }
  if (g.mouth) g.mouth.type = fr.pick(['smile', 'smile', 'grin', 'o', 'cat', 'flat', 'fang', 'tongue', 'teeth', 'smile']);
  g.cheeks = null;
  if (g.mouth && fr.chance(0.5)) {
    const cy2 = g.mouth.y - 3, dxc = g.mouth.w * 0.62 + er * 0.5;
    if (bodyDist(A, cx + g.mouth.x - dxc, cy2 + baseY) > 5 && bodyDist(A, cx + g.mouth.x + dxc, cy2 + baseY) > 5)
      g.cheeks = { y: cy2, dx: dxc, r: clamp(er * 0.42, 5, 20) };
  }

  // ---- extents (local coords, body origin at bottom centre)
  let top = A.inkTop - baseY;
  for (const e of g.eyes) top = Math.min(top, e.y - e.r - INK_W);
  g.top = top;
  g.bodyTop = A.by0 - baseY;
  g.halfW = Math.max(cx - A.inkLeft, A.inkRight - cx);
  g.bodyW = bodyW; g.bodyH = bodyH;
  g.bodyMidY = (A.by0 + A.by1) / 2 - baseY;
  g.fullH = legLen - top;

  // ---- features -> stats
  const sizeN = Math.sqrt(A.area) / 250;
  const compact = clamp((4 * Math.PI * A.area) / (A.perim * A.perim), 0.05, 1);
  const aspect = bodyH / Math.max(bodyW, 1);
  const legRatio = legLen / Math.max(bodyH, 1);
  const detail = A.inkLen / A.perim;
  const raw = {
    spd: 0.25 + (nLegs >= 6 ? 0.55 : nLegs === 4 ? 0.42 : nLegs === 2 ? 0.32 : 0.1) + (1 - remap(sizeN, 0.4, 1.3, 0, 1)) * 0.45 + compact * 0.15,
    hop: 0.25 + remap(aspect, 0.55, 1.9, 0, 0.55) + (nLegs === 0 ? 0.55 : nLegs === 2 ? 0.22 : 0.05) + remap(legRatio, 0.25, 0.8, 0, 0.35),
    hft: 0.2 + remap(sizeN, 0.35, 1.3, 0, 1.0) + (rec.arms ? 0.12 : 0),
    chs: 0.15 + remap(1 - compact, 0.25, 0.8, 0, 0.6) + remap(detail, 1.1, 4, 0, 0.5) + pr.range(0, 0.25),
  };
  const sum = raw.spd + raw.hop + raw.hft + raw.chs;
  const st = {};
  for (const k in raw) st[k] = clamp(Math.round(1 + (raw[k] / sum) * 19), 1, 10);
  g.stats = st;
  g.feat = { size: sizeN, compact, aspect, detail };

  // ---- personality
  const rr = pr();
  g.rarity = rr < 0.55 ? 'Common' : rr < 0.82 ? 'Uncommon' : rr < 0.95 ? 'Rare' : 'Legendary';
  g.species = makeSpecies(g.feat, pr);
  g.bio = makeBio(pr);
  g.voice = {
    f0: clamp(remap(sizeN, 0.4, 1.3, 440, 170) * pr.range(0.85, 1.2), 120, 600),
    wave: st.chs >= 7 ? 'square' : pr.pick(['triangle', 'triangle', 'sawtooth', 'square']),
    speed: pr.range(0.85, 1.3),
    wobble: pr.range(0, 1),
  };
  g.fill = (COLORS[rec.color] || COLORS[0]).fill;
  g.dark = rec.color === 9;
  g.paths = null;
  return g;
}

/* ---------------------------------------------------------------------
   Random doodles ("Surprise me" + the locals)
   --------------------------------------------------------------------- */
function randomDoodle(seed, forceType) {
  const r = makeRng(seed);
  const strokes = [];
  const cx = 250 + r.range(-12, 12), cy = 262 + r.range(-12, 10);
  const type = forceType || r.pick(['blob', 'bean', 'tall', 'wide', 'spiky', 'ghost', 'pear', 'tri', 'blob', 'loaf']);
  let rx = r.range(100, 150), ry = r.range(100, 145);
  if (type === 'tall') { rx = r.range(62, 92); ry = r.range(140, 180); }
  if (type === 'wide' || type === 'loaf') { rx = r.range(150, 190); ry = r.range(72, 105); }
  if (type === 'pear' || type === 'tri') { ry = r.range(120, 160); }
  const harm = [];
  const nh = type === 'spiky' ? 1 : 3;
  for (let k = 0; k < nh; k++) harm.push({ k: r.int(2, 5), a: r.range(0.02, 0.08), p: r.range(0, TAU) });
  if (type === 'spiky') harm.push({ k: r.int(7, 11), a: r.range(0.1, 0.16), p: r.range(0, TAU) });
  const steps = 96, start = r.range(0, TAU), overshoot = r.int(2, 5);
  const outline = [];
  for (let s = 0; s <= steps + overshoot; s++) {
    const t = start + (s / steps) * TAU;
    let rr = 1;
    for (const hm of harm) rr += hm.a * Math.cos(hm.k * t + hm.p);
    let x = Math.cos(t) * rx * rr, y = Math.sin(t) * ry * rr;
    if (type === 'ghost' && y > 0) y = Math.min(y, ry * 0.7) + Math.sin(x * 0.09) * 9;
    if (type === 'loaf' && y > 0) y = Math.min(y, ry * 0.55);
    if (type === 'pear') x *= 0.62 + 0.5 * ((y / ry + 1) / 2);
    if (type === 'tri') x *= 0.35 + 0.8 * ((y / ry + 1) / 2);
    if (type === 'bean') x += Math.sin(y / ry * Math.PI) * -rx * 0.18 * (y < 0 ? 1 : 0.4);
    outline.push(clamp(cx + x + r.range(-1, 1), 6, 494), clamp(cy + y + r.range(-1, 1), 6, 494));
  }
  strokes.push(outline);
  const extras = ['spots', 'stripes', 'antennae', 'tuft', 'horns', 'tail', 'belly', 'freckles', 'ears', 'none'];
  const nx = r.int(1, 3), used = new Set();
  const topY = cy - ry * 0.95;
  for (let e = 0; e < nx; e++) {
    const ex = r.pick(extras);
    if (used.has(ex)) continue;
    used.add(ex);
    if (ex === 'spots') {
      const n = r.int(2, 5);
      for (let i = 0; i < n; i++) {
        const sx = cx + r.range(-0.55, 0.55) * rx * 0.8, sy = cy + r.range(0.0, 0.6) * ry * 0.8, sr = r.range(8, 17);
        const c = [];
        for (let a = 0; a <= 14; a++) c.push(sx + Math.cos((a / 14) * TAU) * sr, sy + Math.sin((a / 14) * TAU) * sr * 0.85);
        strokes.push(c);
      }
    } else if (ex === 'stripes') {
      const n = r.int(2, 3);
      for (let i = 0; i < n; i++) {
        const yy = cy + ry * (0.15 + i * 0.22), w = rx * (0.55 - i * 0.08);
        const c = [];
        for (let a = 0; a <= 8; a++) c.push(cx - w + (a / 8) * 2 * w, yy + Math.sin(a * 1.4) * 5);
        strokes.push(c);
      }
    } else if (ex === 'antennae') {
      for (const sgn of [-1, 1]) {
        const bx = cx + sgn * rx * 0.3, by = topY + 10, len = r.range(45, 75);
        const tx = bx + sgn * r.range(10, 30), ty = by - len;
        strokes.push([bx, by, (bx + tx) / 2 + sgn * 6, (by + ty) / 2, tx, ty]);
        const c = [];
        for (let a = 0; a <= 10; a++) c.push(tx + Math.cos((a / 10) * TAU) * 8, ty - 6 + Math.sin((a / 10) * TAU) * 8);
        strokes.push(c);
      }
    } else if (ex === 'tuft') {
      const c = [], n = r.int(4, 6), w = rx * 0.35;
      for (let i = 0; i <= n; i++) c.push(cx - w + (i / n) * 2 * w, topY + 8 - (i % 2 ? r.range(22, 36) : 0));
      strokes.push(c);
    } else if (ex === 'horns') {
      for (const sgn of [-1, 1]) {
        const bx = cx + sgn * rx * 0.42, by = topY + 22;
        strokes.push([bx - 12, by, bx + sgn * 8, by - r.range(32, 48), bx + 12, by + 2]);
      }
    } else if (ex === 'tail') {
      const sgn = r.sign(), bx = cx + sgn * rx * 0.95, by = cy + ry * 0.25, c = [];
      for (let a = 0; a <= 18; a++) { const t = a / 18, rad = 34 * (1 - t * 0.6); c.push(clamp(bx + sgn * (t * 40 + Math.cos(t * 9) * rad * 0.5), 4, 496), by - Math.sin(t * 9) * rad * 0.5 - t * 20); }
      strokes.push(c);
    } else if (ex === 'belly') {
      const c = [], bw = rx * 0.45, bh = ry * 0.33, by = cy + ry * 0.38;
      for (let a = 0; a <= 18; a++) c.push(cx + Math.cos((a / 18) * TAU) * bw, by + Math.sin((a / 18) * TAU) * bh);
      strokes.push(c);
    } else if (ex === 'freckles') {
      for (let i = 0; i < 5; i++) strokes.push([cx + r.range(-0.4, 0.4) * rx, cy + r.range(-0.1, 0.25) * ry]);
    } else if (ex === 'ears') {
      for (const sgn of [-1, 1]) {
        const bx = cx + sgn * rx * 0.55, by = topY + 26;
        strokes.push([bx - sgn * 18, by + 4, bx + sgn * 6, by - r.range(34, 50), bx + sgn * 22, by + 14]);
      }
    }
  }
  return cleanStrokes(strokes.map((s) => s.map((v) => clamp(v, 2, 498))));
}

function newRecord(strokes, opts = {}) {
  const A = analyzeCached(strokes);
  const aspect = A ? A.bodyH / Math.max(A.bodyW, 1) : 1;
  const seed = opts.seed != null ? opts.seed : (Math.random() * 4294967296) >>> 0;
  const r = makeRng(seed ^ 0x5bd1e995);
  const legs = opts.legs != null ? opts.legs : aspect > 1.3 ? 2 : aspect < 0.7 ? r.pick([4, 4, 6, 2, 8]) : r.pick([2, 2, 4, 2, 6, 0]);
  return {
    id: opts.id || uid(),
    name: opts.name || suggestName(r),
    by: opts.by || '',
    color: opts.color != null ? opts.color : r.int(0, COLORS.length - 3),
    legs,
    arms: opts.arms != null ? opts.arms : r.chance(0.6) ? 1 : 0,
    look: opts.look != null ? opts.look : r.int(0, 255),
    seed,
    born: opts.born != null ? opts.born : localDayIndex(),
    strokes,
  };
}

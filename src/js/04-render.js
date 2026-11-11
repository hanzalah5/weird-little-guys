/* =========================================================================
   Guy renderer — line boil, rubber-hose limbs, googly eyes, expressions
   ========================================================================= */
const BOIL_FRAMES = 3;
const FONT = '"Shantell Sans","Comic Sans MS","Chalkboard SE","Marker Felt",system-ui,sans-serif';

function ensurePaths(g) {
  if (g.paths) return g.paths;
  const ox = g.originX, oy = g.originY, seed = g.rec.seed & 0xffff;
  const amp = reducedMotion ? 0 : 2.6;
  const fills = [], inks = [];
  for (let f = 0; f < BOIL_FRAMES; f++) {
    const fp = new Path2D();
    g.A.contours.forEach((pts, ci) => {
      for (let i = 0; i < pts.length; i++) {
        const nx = noise1(i * 0.22 + ci * 17, seed + f * 101) * amp, ny = noise1(i * 0.22 + ci * 17 + 50, seed + f * 101) * amp;
        const x = pts[i][0] - ox + nx, y = pts[i][1] - oy + ny;
        if (i) fp.lineTo(x, y); else fp.moveTo(x, y);
      }
      fp.closePath();
    });
    fills.push(fp);
    const ip = new Path2D();
    g.rec.strokes.forEach((s, si) => {
      const n = s.length / 2;
      const P = (i) => [
        s[i * 2] - ox + noise1(i * 0.3 + si * 13, seed + f * 77 + 5) * amp,
        s[i * 2 + 1] - oy + noise1(i * 0.3 + si * 13 + 40, seed + f * 77 + 5) * amp,
      ];
      const p0 = P(0);
      ip.moveTo(p0[0], p0[1]);
      if (n === 1) { ip.lineTo(p0[0] + 0.01, p0[1]); return; }
      if (n === 2) { const p1 = P(1); ip.lineTo(p1[0], p1[1]); return; }
      let prev = P(1);
      for (let i = 1; i < n - 1; i++) {
        const nxt = P(i + 1);
        ip.quadraticCurveTo(prev[0], prev[1], (prev[0] + nxt[0]) / 2, (prev[1] + nxt[1]) / 2);
        prev = nxt;
      }
      ip.lineTo(prev[0], prev[1]);
    });
    inks.push(ip);
  }
  g.paths = { fills, inks };
  return g.paths;
}

function makePose() {
  return {
    phase: Math.random() * TAU, walk: 0, face: 1,
    lookX: 0, lookY: 0, pupils: null, accX: 0, accY: 0,
    blink: 0, blinkT: rand.range(0.5, 4), blinkAnim: -1,
    squash: 0, squashV: 0, tilt: 0, spin: 0, lift: 0, airH: 0,
    air: false, flail: 0,
    expr: 'normal', exprT: 0, talkT: 0, talk: 0,
    armMode: 'rest', legGrow: 1, eyePop: 1,
  };
}

function setExpr(P, expr, secs) { P.expr = expr; P.exprT = secs || 0; }

/* generic per-frame animation: blinks, springs, pupils, mouth */
function animatePose(g, P, dt, t) {
  // blink
  P.blinkT -= dt;
  if (P.blinkAnim < 0 && P.blinkT <= 0) { P.blinkAnim = 0; P.blinkT = rand.chance(0.15) ? 0.25 : rand.range(2, 6); }
  if (P.blinkAnim >= 0) {
    P.blinkAnim += dt / 0.16;
    P.blink = P.blinkAnim < 0.5 ? P.blinkAnim * 2 : 2 - P.blinkAnim * 2;
    if (P.blinkAnim >= 1) { P.blinkAnim = -1; P.blink = 0; }
  }
  // squash spring
  const k = 170, c = 11;
  P.squashV += (-k * P.squash - c * P.squashV) * dt;
  P.squash = clamp(P.squash + P.squashV * dt, -0.45, 0.5);
  // expression timer
  if (P.exprT > 0) { P.exprT -= dt; if (P.exprT <= 0 && P.expr !== 'sleep') P.expr = 'normal'; }
  // talking mouth
  if (P.talkT > 0) { P.talkT -= dt; P.talk = Math.abs(Math.sin(t * 21)) * 0.9 + 0.1; } else P.talk = damp(P.talk, 0, 12, dt);
  // googly pupils
  if (!P.pupils || P.pupils.length !== g.eyes.length) P.pupils = g.eyes.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
  const m = 1 - g.pupil * 0.92;
  for (const p of P.pupils) {
    const tx = clamp(P.lookX, -1, 1) * m * 0.85, ty = clamp(P.lookY, -1, 1) * m * 0.85 + 0.12 * m;
    p.vx += ((tx - p.x) * 38 - p.vx * 5.5 - P.accX * 0.0035) * dt;
    p.vy += ((ty - p.y) * 38 - p.vy * 5.5 - P.accY * 0.0035 + (P.air ? 6 : 0)) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const d = Math.hypot(p.x, p.y);
    if (d > m) {
      const nx = p.x / d, ny = p.y / d;
      p.x = nx * m; p.y = ny * m;
      const vn = p.vx * nx + p.vy * ny;
      if (vn > 0) { p.vx -= 1.5 * vn * nx; p.vy -= 1.5 * vn * ny; }
    }
  }
}

function limb(ctx, hx, hy, fx, fy, L, bend) {
  let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy) || 0.001;
  if (d > L * 0.995) { const kk = (L * 0.995) / d; dx *= kk; dy *= kk; fx = hx + dx; fy = hy + dy; d = L * 0.995; }
  const a = L / 2, ht = Math.sqrt(Math.max(0, a * a - (d * d) / 4));
  const mx = (hx + fx) / 2, my = (hy + fy) / 2;
  let px = -dy / d, py = dx / d;
  if (px * bend < 0 || (Math.abs(px) < 1e-3 && py > 0)) { px = -px; py = -py; }
  const kx = mx + px * ht, ky = my + py * ht;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.quadraticCurveTo(2 * kx - mx, 2 * ky - my, fx, fy);
  return [fx, fy];
}

function strokeLimb(ctx, g, lw, chunky) {
  if (chunky) {
    ctx.strokeStyle = INK; ctx.lineWidth = lw * 2.5; ctx.stroke();
    ctx.strokeStyle = g.fill; ctx.lineWidth = lw * 1.25; ctx.stroke();
  } else {
    ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
  }
}

function drawFoot(ctx, g, fx, fy, L, face, lw) {
  const fl = clamp(L * 0.36, 11, 30), fh = fl * 0.56;
  ctx.lineWidth = lw * 0.7; ctx.strokeStyle = INK;
  if (g.footStyle === 'shoe') {
    ctx.fillStyle = g.shoe;
    ctx.beginPath(); ctx.ellipse(fx + face * fl * 0.3, fy - fh * 0.42, fl * 0.58, fh * 0.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (g.footStyle === 'round') {
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(fx + face * fl * 0.12, fy - fl * 0.2, fl * 0.28, 0, TAU); ctx.fill();
  } else if (g.footStyle === 'toes') {
    ctx.beginPath();
    for (const a of [-0.5, 0, 0.5]) { ctx.moveTo(fx, fy - 1); ctx.lineTo(fx + face * Math.cos(a) * fl * 0.6, fy - 1 + Math.sin(a) * fl * 0.25); }
    ctx.lineWidth = lw * 0.8; ctx.stroke();
  }
}

/*
 * Draw a guy standing on screen point (x, y) at scale s (px per drawing unit).
 */
function drawGuy(ctx, g, x, y, s, P, t, opts) {
  opts = opts || {};
  const paths = ensurePaths(g);
  const frame = reducedMotion ? 0 : ((((Math.floor(t * 8) + (g.rec.seed & 3)) % BOIL_FRAMES) + BOIL_FRAMES) % BOIL_FRAMES) || 0;
  const lw = Math.max(INK_W, 1.7 / s);
  ctx.save();
  ctx.translate(x, y);
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  if (opts.shadow !== false) {
    const sw = Math.max(g.bodyW * 0.48, 30) * s * clamp(1 - P.airH / 320, 0.35, 1);
    ctx.fillStyle = 'rgba(30,27,54,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 0, sw, Math.max(3, sw * 0.17), 0, 0, TAU); ctx.fill();
  }
  if (opts.selected) {
    ctx.save();
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 20;
    ctx.strokeStyle = 'rgba(30,27,54,0.65)'; ctx.lineWidth = 2.5;
    const sw = Math.max(g.bodyW * 0.62, 40) * s;
    ctx.beginPath(); ctx.ellipse(0, 0, sw, Math.max(6, sw * 0.24), 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.translate(0, -P.airH);
  ctx.scale(s, s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const legLen = g.legLen * P.legGrow;
  const bodyY = -legLen - P.lift;
  const pivotY = bodyY + g.bodyMidY;
  const rot = P.tilt + P.spin;
  const sq = P.squash + (P.extraSq || 0), sx = 1 + sq * 0.55, sy = 1 - sq;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const T = (bx, by) => {
    const px = bx * sx, py = by * sy + bodyY - pivotY;
    return [px * cr - py * sr, pivotY + px * sr + py * cr];
  };

  // ---- legs (behind the body)
  if (g.legs.length && P.legGrow > 0.02) {
    const S = g.stride;
    for (const leg of g.legs) {
      const [hx, hy] = T(leg.hx, leg.hy);
      const L = leg.len * P.legGrow;
      let fx, fy;
      if (P.air) {
        const w = Math.sin(t * 19 + leg.hx * 0.13) * L * 0.28 * P.flail;
        fx = hx + w + P.face * L * 0.08;
        fy = hy + L * 0.86;
      } else {
        const u = (((P.phase + leg.group * Math.PI + leg.off) / TAU) % 1 + 1) % 1;
        let rel, lift = 0;
        if (u < 0.5) rel = S / 2 - (u / 0.5) * S;
        else { const v = (u - 0.5) / 0.5; rel = -S / 2 + smooth(v) * S; lift = Math.sin(v * Math.PI) * S * 0.38; }
        fx = leg.hx + rel * P.walk;
        fy = -lift * P.walk;
      }
      const [ffx, ffy] = limb(ctx, hx, hy, fx, fy, L, P.face);
      strokeLimb(ctx, g, lw, g.legStyle === 'chunky');
      drawFoot(ctx, g, ffx, ffy, L, P.face, lw);
    }
  }

  // ---- arms (behind the body)
  if (g.arms.length) {
    for (const arm of g.arms) {
      const [shx, shy] = T(arm.sx, arm.sy);
      const L = arm.len * P.legGrow, sd = arm.side;
      let hx, hy;
      const mode = P.armMode;
      if (P.air || mode === 'flail') {
        hx = shx + sd * L * 0.55 + Math.sin(t * 21 + sd * 2) * L * 0.3;
        hy = shy - L * 0.45 + Math.cos(t * 17 + sd) * L * 0.3;
      } else if (mode === 'cheer') {
        hx = shx + sd * L * 0.42; hy = shy - L * 0.85 + Math.sin(t * 14 + sd) * L * 0.1;
      } else if (mode === 'wave' && sd === (P.waveSide || 1)) {
        hx = shx + sd * L * 0.45 + Math.sin(t * 13) * L * 0.28; hy = shy - L * 0.75;
      } else if (mode === 'run') {
        const sw = Math.sin(P.phase + (sd > 0 ? 0 : Math.PI));
        hx = shx + sd * L * 0.25 + sw * L * 0.45 * P.face; hy = shy + L * 0.55 - Math.abs(sw) * L * 0.2;
      } else if (mode === 'dance') {
        const sw = Math.sin(t * 9 + (sd > 0 ? 0 : Math.PI));
        hx = shx + sd * L * 0.55; hy = shy - L * 0.2 + sw * L * 0.55;
      } else {
        const sway = Math.sin(t * 2.1 + sd) * L * 0.06 + Math.sin(P.phase + (sd > 0 ? 0 : Math.PI)) * L * 0.25 * P.walk * P.face;
        hx = shx + sd * L * 0.42 + sway; hy = shy + L * 0.78;
      }
      const [ex, ey] = limb(ctx, shx, shy, hx, hy, L, sd);
      strokeLimb(ctx, g, lw * 0.9, g.legStyle === 'chunky');
      const hr = clamp(L * 0.13, 5, 12);
      ctx.fillStyle = g.fill; ctx.lineWidth = lw * 0.7; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.arc(ex, ey, hr, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }

  // ---- body
  ctx.save();
  ctx.translate(0, pivotY); ctx.rotate(rot); ctx.translate(0, bodyY - pivotY); ctx.scale(sx, sy);
  ctx.fillStyle = g.fill;
  ctx.fill(paths.fills[frame]);
  ctx.save();
  ctx.clip(paths.fills[frame]);
  ctx.fillStyle = 'rgba(30,27,54,0.12)';
  ctx.beginPath(); ctx.ellipse(g.bodyW * 0.14, 0, g.bodyW * 0.7, g.bodyH * 0.32, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.beginPath(); ctx.ellipse(-g.bodyW * 0.22, g.bodyTop + g.bodyH * 0.2, g.bodyW * 0.13, g.bodyH * 0.08, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = lw;
  ctx.stroke(paths.inks[frame]);

  // ---- face
  drawFace(ctx, g, P, t, lw);
  if (opts.crown || g.rec.crown) drawCrown(ctx, g, lw, t);
  ctx.restore();
  ctx.restore();
}

function drawFace(ctx, g, P, t, lw) {
  const expr = P.expr;
  // stalks
  for (const st of g.stalks) {
    ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.9;
    ctx.beginPath(); ctx.moveTo(st.bx, st.by);
    ctx.quadraticCurveTo(st.bx, (st.by + st.ey) / 2, st.ex, st.ey + 2); ctx.stroke();
  }
  // cheeks
  if (g.cheeks && g.mouth) {
    ctx.fillStyle = expr === 'happy' || expr === 'win' ? 'rgba(255,80,130,0.55)' : 'rgba(255,96,140,0.38)';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(g.mouth.x + sd * g.cheeks.dx, g.cheeks.y, g.cheeks.r, g.cheeks.r * 0.62, 0, 0, TAU); ctx.fill(); }
  }
  // eyes
  const pop = P.eyePop;
  for (let i = 0; i < g.eyes.length; i++) {
    const e = g.eyes[i];
    const r = e.r * (pop < 1 ? easeOutBack(clamp(pop, 0, 1)) : 1) * (expr === 'surprised' ? 1.12 : 1);
    if (r < 0.6) continue;
    ctx.lineWidth = lw * 0.75; ctx.strokeStyle = INK;
    if (expr === 'sleep') {
      ctx.beginPath(); ctx.arc(e.x, e.y - r * 0.15, r * 0.62, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
      continue;
    }
    if (expr === 'happy' || expr === 'win') {
      ctx.lineWidth = lw * 0.95;
      ctx.beginPath(); ctx.arc(e.x, e.y + r * 0.35, r * 0.62, 1.12 * Math.PI, 1.88 * Math.PI); ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill(); ctx.stroke();
    const pp = (P.pupils && P.pupils[i]) || { x: 0, y: 0 };
    const pr = r * g.pupil * (expr === 'surprised' ? 0.62 : 1);
    if (expr === 'dizzy') {
      ctx.lineWidth = lw * 0.6;
      ctx.beginPath();
      for (let a = 0; a < 14; a++) { const ang = a * 0.75 + t * 9 * (i % 2 ? -1 : 1), rad = (a / 14) * r * 0.75; const px = e.x + Math.cos(ang) * rad, py = e.y + Math.sin(ang) * rad; if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
    } else {
      const px = e.x + pp.x * r, py = e.y + pp.y * r;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(px - pr * 0.35, py - pr * 0.38, pr * 0.3, 0, TAU); ctx.fill();
    }
    // lids: blink / sleepy variants / determined
    let lid = P.blink;
    if (g.sleepyLids && expr === 'normal') lid = Math.max(lid, 0.36);
    if (expr === 'tired') lid = Math.max(lid, 0.5);
    if (lid > 0.01) {
      ctx.save();
      ctx.beginPath(); ctx.arc(e.x, e.y, r + lw * 0.2, 0, TAU); ctx.clip();
      ctx.fillStyle = g.fill;
      const ly = e.y - r + 2 * r * lid;
      ctx.fillRect(e.x - r - lw, e.y - r - lw, 2 * r + 2 * lw, ly - (e.y - r - lw));
      ctx.restore();
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.lineWidth = lw * 0.75; ctx.stroke();
      if (lid < 0.97) { ctx.beginPath(); const hw = Math.sqrt(Math.max(0, r * r - (ly - e.y) ** 2)); ctx.moveTo(e.x - hw, ly); ctx.lineTo(e.x + hw, ly); ctx.stroke(); }
    }
    if (g.lashes && lid < 0.5) {
      ctx.lineWidth = lw * 0.6;
      ctx.beginPath();
      for (const a of [-0.55, -0.25, 0.05]) { const ang = -Math.PI / 2 + a + (i % 2 ? 0.25 : -0.25); ctx.moveTo(e.x + Math.cos(ang) * r, e.y + Math.sin(ang) * r); ctx.lineTo(e.x + Math.cos(ang) * r * 1.35, e.y + Math.sin(ang) * r * 1.35); }
      ctx.stroke();
    }
    if (expr === 'determined' || expr === 'angry') {
      const sd = g.eyes.length > 1 ? (e.x < (g.eyes[0].x + g.eyes[1].x) / 2 ? -1 : 1) : 1;
      ctx.lineWidth = lw * 1.05;
      ctx.beginPath();
      ctx.moveTo(e.x - r * 0.95, e.y - r * (sd < 0 ? 1.45 : 1.08));
      ctx.lineTo(e.x + r * 0.95, e.y - r * (sd < 0 ? 1.08 : 1.45));
      ctx.stroke();
    }
    if (expr === 'sad') {
      ctx.lineWidth = lw * 0.9;
      ctx.beginPath(); ctx.moveTo(e.x - r * 0.9, e.y - r * 1.15); ctx.lineTo(e.x + r * 0.9, e.y - r * 1.4); ctx.stroke();
    }
  }
  // mouth
  const m = g.mouth;
  if (!m) return;
  const w = m.w, mx = m.x, my = m.y;
  let type = m.type;
  if (expr === 'happy' || expr === 'win') type = 'grin';
  else if (expr === 'surprised' || expr === 'held') type = 'o';
  else if (expr === 'sleep') type = 'snore';
  else if (expr === 'dizzy') type = 'wavy';
  else if (expr === 'sad') type = 'frown';
  else if (expr === 'eat') type = 'chew';
  else if (expr === 'determined') type = 'flat';
  ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.8;
  const MOUTH = '#5C1A33', TONGUE = '#FF7A9C';
  if (P.talk > 0.15 && type !== 'snore') {
    const oh = w * 0.42 * P.talk + 2;
    ctx.fillStyle = MOUTH;
    ctx.beginPath(); ctx.ellipse(mx, my + oh * 0.3, w * 0.36, oh * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    return;
  }
  ctx.beginPath();
  switch (type) {
    case 'grin': case 'teeth': {
      ctx.moveTo(mx - w / 2, my - w * 0.06);
      ctx.lineTo(mx + w / 2, my - w * 0.06);
      ctx.quadraticCurveTo(mx, my + w * 0.78, mx - w / 2, my - w * 0.06);
      ctx.fillStyle = MOUTH; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = TONGUE; ctx.beginPath(); ctx.ellipse(mx, my + w * 0.36, w * 0.24, w * 0.15, 0, 0, TAU); ctx.fill();
      if (type === 'teeth') { ctx.fillStyle = '#fff'; ctx.fillRect(mx - w * 0.3, my - w * 0.07, w * 0.6, w * 0.13); }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(mx - w / 2, my - w * 0.06); ctx.lineTo(mx + w / 2, my - w * 0.06); ctx.quadraticCurveTo(mx, my + w * 0.78, mx - w / 2, my - w * 0.06);
      ctx.stroke();
      return;
    }
    case 'o': case 'snore': {
      const k = type === 'snore' ? 0.7 + Math.sin(t * 2) * 0.25 : 1;
      ctx.ellipse(mx, my + w * 0.1, w * 0.17 * k, w * 0.22 * k, 0, 0, TAU);
      ctx.fillStyle = MOUTH; ctx.fill(); ctx.stroke();
      return;
    }
    case 'cat':
      ctx.moveTo(mx - w / 2, my); ctx.quadraticCurveTo(mx - w / 4, my + w * 0.38, mx, my);
      ctx.quadraticCurveTo(mx + w / 4, my + w * 0.38, mx + w / 2, my); ctx.stroke(); return;
    case 'flat':
      ctx.moveTo(mx - w * 0.4, my + w * 0.08); ctx.quadraticCurveTo(mx, my + w * 0.02, mx + w * 0.4, my + w * 0.1); ctx.stroke(); return;
    case 'frown':
      ctx.moveTo(mx - w * 0.4, my + w * 0.25); ctx.quadraticCurveTo(mx, my - w * 0.12, mx + w * 0.4, my + w * 0.25); ctx.stroke(); return;
    case 'wavy':
      ctx.moveTo(mx - w * 0.45, my + w * 0.1);
      for (let i = 1; i <= 6; i++) ctx.lineTo(mx - w * 0.45 + (i / 6) * w * 0.9, my + w * 0.1 + (i % 2 ? -1 : 1) * w * 0.08);
      ctx.stroke(); return;
    case 'chew': {
      const o = Math.abs(Math.sin(t * 14));
      ctx.ellipse(mx, my + w * 0.08, w * 0.3, w * 0.06 + w * 0.16 * o, 0, 0, TAU);
      ctx.fillStyle = MOUTH; ctx.fill(); ctx.stroke(); return;
    }
    default: { // smile, fang, tongue
      ctx.moveTo(mx - w / 2, my);
      ctx.quadraticCurveTo(mx, my + w * 0.5, mx + w / 2, my);
      ctx.stroke();
      if (type === 'fang') {
        ctx.fillStyle = '#fff'; ctx.beginPath();
        ctx.moveTo(mx + w * 0.12, my + w * 0.2); ctx.lineTo(mx + w * 0.26, my + w * 0.17); ctx.lineTo(mx + w * 0.2, my + w * 0.36); ctx.closePath();
        ctx.fill(); ctx.lineWidth = lw * 0.5; ctx.stroke();
      } else if (type === 'tongue') {
        ctx.fillStyle = TONGUE; ctx.beginPath();
        ctx.moveTo(mx + w * 0.02, my + w * 0.24);
        ctx.quadraticCurveTo(mx + w * 0.16, my + w * 0.6, mx + w * 0.3, my + w * 0.18);
        ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.stroke();
      }
    }
  }
}

function drawCrown(ctx, g, lw, t) {
  const w = clamp(g.bodyW * 0.36, 34, 90), hgt = w * 0.55;
  let topY = g.bodyTop - 2;
  for (const e of g.eyes) topY = Math.min(topY, e.y - e.r - 4);
  const x = 0, y = topY + hgt * 0.15;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-0.12 + Math.sin(t * 2) * 0.03);
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -hgt * 0.75); ctx.lineTo(-w / 4, -hgt * 0.35); ctx.lineTo(0, -hgt);
  ctx.lineTo(w / 4, -hgt * 0.35); ctx.lineTo(w / 2, -hgt * 0.75); ctx.lineTo(w / 2, 0); ctx.closePath();
  ctx.fillStyle = '#FFD23F'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.8; ctx.stroke();
  ctx.fillStyle = '#FF5B7F';
  ctx.beginPath(); ctx.arc(0, -hgt * 0.32, w * 0.07, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/* portrait render into a canvas (cards, pickers) */
function renderPortrait(cv, g, opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = cv.clientWidth || cv.width, H = cv.clientHeight || cv.height;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (opts.bg) {
    ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(30,27,54,0.07)'; ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 16) { ctx.beginPath(); ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 16) { ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); ctx.stroke(); }
  }
  const pad = opts.pad != null ? opts.pad : 0.1;
  const fullW = g.halfW * 2 + 40, fullH = g.fullH + 30;
  const s = Math.min((W * (1 - pad * 2)) / fullW, (H * (1 - pad * 2)) / fullH);
  const P = opts.pose || makePose();
  if (!opts.pose) { P.pupils = g.eyes.map(() => ({ x: 0.05, y: 0.08 })); P.blinkT = 99; }
  const groundY = H / 2 + (g.fullH * s) / 2 + 2;
  drawGuy(ctx, g, W / 2, Math.min(groundY, H - 4), s, P, opts.t || 0, { shadow: opts.shadow !== false, crown: opts.crown });
  return s;
}

/* ---------------------------------------------------------------------
   Speech bubbles, name tags, particles
   --------------------------------------------------------------------- */
function roundRectPath(ctx, x, y, w, h2, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h2 - r); ctx.quadraticCurveTo(x + w, y + h2, x + w - r, y + h2);
  ctx.lineTo(x + r, y + h2); ctx.quadraticCurveTo(x, y + h2, x, y + h2 - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function drawBubble(ctx, text, x, y, age, life, size = 16) {
  const appear = clamp(age / 0.18, 0, 1), vanish = clamp((life - age) / 0.25, 0, 1);
  const k = easeOutBack(appear) * vanish;
  if (k <= 0.01) return;
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  const w = tw + size * 1.2, hh = size * 1.9;
  ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(Math.sin(age * 3) * 0.03);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  roundRectPath(ctx, -w / 2, -hh - 10, w, hh, 12);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-7, -11.5); ctx.lineTo(0, 0); ctx.lineTo(7, -11.5); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(0, 0); ctx.lineTo(7, -10); ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, -hh / 2 - 9);
  ctx.restore();
}

function drawTag(ctx, text, x, y, alpha = 1, size = 13) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `800 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = INK;
  roundRectPath(ctx, x - w / 2, y - 11, w, 22, 11); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

class Particles {
  constructor() { this.list = []; }
  add(p) {
    if (this.list.length > 400) this.list.shift();
    this.list.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 1, age: 0, size: 10, rot: 0, vr: 0, drag: 0 }, p));
  }
  burst(type, x, y, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = opts.angle != null ? opts.angle + rand.range(-opts.spread, opts.spread) : rand.range(0, TAU);
      const sp = rand.range(opts.speedMin || 60, opts.speed || 220);
      this.add(Object.assign({ type, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand.range(0.5, 1.1) * (opts.life || 1),
        size: rand.range(0.7, 1.3) * (opts.size || 10), rot: rand.range(0, TAU), vr: rand.range(-8, 8),
        color: opts.colors ? rand.pick(opts.colors) : opts.color, g: opts.g != null ? opts.g : 300, drag: opts.drag || 0, text: opts.text }, opts.extra || {}));
    }
  }
  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      p.vy += p.g * dt;
      if (p.drag) { p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt); }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.floor != null && p.y > p.floor) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.7; p.vr *= 0.5; }
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }
  draw(ctx) {
    for (const p of this.list) {
      const k = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      const s = p.size;
      switch (p.type) {
        case 'heart':
          ctx.fillStyle = p.color || '#FF5B7F'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(0, s * 0.35);
          ctx.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.45, -s * 1.05, 0, -s * 0.45);
          ctx.bezierCurveTo(s * 0.45, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.35);
          ctx.fill(); ctx.stroke(); break;
        case 'star':
          ctx.fillStyle = p.color || '#FFD23F'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s; const a = (i / 10) * TAU - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          ctx.closePath(); ctx.fill(); ctx.stroke(); break;
        case 'spark':
          ctx.fillStyle = p.color || '#fff'; ctx.beginPath();
          ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s);
          ctx.fill(); break;
        case 'dust':
          ctx.globalAlpha *= 0.55; ctx.fillStyle = p.color || '#fff'; ctx.strokeStyle = 'rgba(30,27,54,0.35)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(0, 0, s * (1.4 - k * 0.6), 0, TAU); ctx.fill(); ctx.stroke(); break;
        case 'confetti':
          ctx.fillStyle = p.color || '#FF82B8'; ctx.scale(1, Math.cos(p.age * 9 + p.vr));
          ctx.fillRect(-s * 0.5, -s * 0.28, s, s * 0.56); break;
        case 'drop':
          ctx.fillStyle = p.color || '#7FC8FF'; ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, TAU); ctx.fill(); break;
        case 'text':
          ctx.rotate(-p.rot + Math.sin(p.age * 4) * 0.2);
          ctx.font = `800 ${s}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.strokeText(p.text, 0, 0);
          ctx.fillStyle = p.color || INK; ctx.fillText(p.text, 0, 0); break;
        case 'crumb':
          ctx.fillStyle = p.color || '#C98B4A'; ctx.fillRect(-s / 2, -s / 2, s, s); break;
      }
      ctx.restore();
    }
  }
}

/* =========================================================================
   Race — "Daily Dash". Deterministic 60 Hz simulation: a run is just a list
   of (press frame, hold frames), so ghosts replay exactly on any device.
   ========================================================================= */
const RACE_HZ = 60, DT = 1 / RACE_HZ;
const HURDLE = { low: 45, high: 92 };
const RIVAL_SKILL = { 'local-beans': 0.25, 'local-gloria': 0.55, 'local-steve': 0.6, 'local-wobble': 0.85 };

function genTrack(seed) {
  const r = makeRng(seed);
  const L = 6000;
  const obs = [];
  let x = 700;
  while (x < L - 450) {
    const p = r(), diff = x / L;
    if (p < 0.33) obs.push({ t: 'low', x });
    else if (p < 0.55) obs.push({ t: 'high', x });
    else if (p < 0.66) { obs.push({ t: 'low', x }); x += 175 + r.int(0, 35); obs.push({ t: 'low', x }); }
    else if (p < 0.79) obs.push({ t: 'mud', x, w: 150 + r.int(0, 30) });
    else if (p < 0.9) obs.push({ t: 'boost', x, w: 70 });
    else obs.push({ t: 'spring', x, w: 44 });
    x += Math.round(lerp(470, 310, diff)) + r.int(0, 120);
  }
  for (const o of obs) if (!o.w) o.w = 12;
  return { L, obs, seed };
}

function makeRacer(rec, idx, track, kind, extra = {}) {
  const g = buildGuy(rec);
  const st = g.stats;
  const r = {
    rec, g, idx, kind, ...extra,
    x: 0, y: 0, vx: 0, vy: 0, holdT: 0, buffer: 0, tumble: 0, boost: 0, zoom: 0,
    vmax: 300 * (0.95 + 0.01 * st.spd),
    acc: 560 * (1.06 - 0.012 * st.hft),
    jv: 640 * (0.96 + 0.008 * st.hop),
    keep: 0.32 + 0.025 * st.hft,
    chaos: st.chs,
    rng: makeRng(hashInts(track.seed, rec.seed, 7)),
    finished: false, timeMs: 0, oi: 0, log: [], hits: 0,
    down: track.obs.map(() => false), used: track.obs.map(() => false),
    inputs: [], pressAt: -1, held: false, pressed: false, ghostI: 0,
    P: makePose(), dist: 0, events: [],
  };
  r.P.face = 1; r.P.armMode = 'run'; setExpr(r.P, 'determined');
  r.P.pupils = g.eyes.map(() => ({ x: 0.3, y: 0, vx: 0, vy: 0 }));
  return r;
}

function aiInput(r, track, frame) {
  // decide presses for an upcoming obstacle once, deterministically
  if (r.plan && frame >= r.plan.at + r.plan.hold + 1) r.plan = null;
  if (!r.plan) {
    let next = null;
    for (let i = r.oi; i < track.obs.length; i++) { const o = track.obs[i]; if (o.x + o.w > r.x && o.t !== 'boost' && o.t !== 'spring') { next = o; break; } }
    if (next && !next.aiDone) next.aiDone = {};
    if (next && !next.aiDone[r.idx] && r.y <= 0) {
      const v = Math.max(r.vx, 120);
      const skill = r.skill;
      const lead = next.t === 'low' ? v * 0.22 : next.t === 'high' ? v * 0.27 : 8;
      const errF = Math.round((r.rng() * 2 - 1) * lerp(9, 1.5, skill));
      const dist = next.x - (r.x + 16);
      if (dist <= lead + errF * v * DT) {
        next.aiDone[r.idx] = true;
        const fumble = r.rng() < lerp(0.3, 0.02, skill);
        const hold = next.t === 'low' ? 0 : next.t === 'high' ? 16 : 18;
        r.plan = { at: frame, hold: fumble ? (hold ? 0 : 16) : hold };
      }
    }
  }
  if (r.plan) return { pressed: frame === r.plan.at, held: frame < r.plan.at + r.plan.hold };
  return { pressed: false, held: false };
}

function ghostInput(r, frame) {
  const ins = r.ghost.inputs;
  let pressed = false, held = false;
  while (r.ghostI < ins.length && ins[r.ghostI] < frame) r.ghostI += 2;
  if (r.ghostI < ins.length && ins[r.ghostI] === frame) pressed = true;
  for (let i = Math.max(0, r.ghostI - 6); i < Math.min(ins.length, r.ghostI + 2); i += 2) if (frame >= ins[i] && frame < ins[i] + ins[i + 1]) held = true;
  return { pressed, held };
}

function stepRacer(r, track, frame, inp) {
  if (r.finished) { r.vx = Math.max(0, r.vx - 400 * DT); r.x += r.vx * DT; if (r.y > 0 || r.vy > 0) { r.vy -= 2700 * DT; r.y = Math.max(0, r.y + r.vy * DT); } return; }
  const roll = r.rng();
  if (r.tumble > 0) r.tumble -= DT;
  if (r.boost > 0) r.boost -= DT;
  if (r.zoom > 0) r.zoom -= DT;
  else if (roll < r.chaos * 0.00028) { r.zoom = 0.9; r.events.push('zoom'); }
  let inMud = false;
  if (r.y <= 0) for (let i = r.oi; i < track.obs.length; i++) { const o = track.obs[i]; if (o.x > r.x + 20) break; if (o.t === 'mud' && r.x + 10 > o.x && r.x - 10 < o.x + o.w) inMud = true; }
  const vmax = r.vmax * (r.boost > 0 ? 1.45 : 1) * (inMud ? 0.45 : 1) * (r.tumble > 0 ? 0.35 : 1) * (r.zoom > 0 ? 1.22 : 1);
  const dv = vmax - r.vx;
  r.vx += dv > 0 ? Math.min(dv, (r.boost > 0 ? 1600 : r.acc) * DT) : Math.max(dv, -2400 * DT);
  if (inp.pressed) r.buffer = 7; else if (r.buffer > 0) r.buffer--;
  if (r.buffer > 0 && r.y <= 0 && r.vy <= 0 && r.tumble <= 0) { r.vy = r.jv; r.y = 0.01; r.holdT = 0; r.buffer = 0; r.events.push('jump'); }
  if (r.y > 0 || r.vy > 0) {
    const holding = inp.held && r.vy > 0 && r.holdT < 0.22;
    if (holding) r.holdT += DT;
    r.vy -= (holding ? 1500 : 2700) * DT;
    r.y += r.vy * DT;
    if (r.y <= 0) { r.y = 0; r.vy = 0; r.events.push('land'); }
  }
  const x0 = r.x;
  r.x += r.vx * DT;
  for (let i = r.oi; i < track.obs.length; i++) {
    const o = track.obs[i];
    if (o.x > r.x + 20) break;
    if (o.t === 'low' || o.t === 'high') {
      if (!r.down[i] && r.x + 16 > o.x && x0 - 16 < o.x + o.w && r.y < HURDLE[o.t]) {
        r.down[i] = true; r.log[i] = 'hit'; r.hits++;
        r.vx *= r.keep; r.tumble = 0.55; r.vy = Math.max(r.vy, 0); r.events.push('trip:' + i);
      }
    } else if (o.t === 'mud') {
      if (r.y <= 0 && r.x + 10 > o.x && r.x - 10 < o.x + o.w && !r.log[i]) { r.log[i] = 'hit'; r.events.push('splash:' + i); }
    } else if (o.t === 'boost') {
      if (!r.used[i] && r.y < 6 && r.x + 14 > o.x && x0 - 14 < o.x + o.w) { r.used[i] = true; r.boost = 1.1; r.log[i] = 'boost'; r.events.push('boost:' + i); }
    } else if (o.t === 'spring') {
      if (!r.used[i] && r.y < 6 && r.x + 12 > o.x && x0 - 12 < o.x + o.w && r.tumble <= 0) { r.used[i] = true; r.vy = 980; r.y = 0.01; r.holdT = 1; r.log[i] = 'spring'; r.events.push('spring:' + i); }
    }
  }
  while (r.oi < track.obs.length && track.obs[r.oi].x + track.obs[r.oi].w + 24 < r.x) {
    const i = r.oi;
    if (!r.log[i]) { const pass = track.obs[i].t === 'boost' || track.obs[i].t === 'spring' ? 'miss' : 'ok'; r.log[i] = pass; if (pass === 'ok') r.events.push('clear:' + i); }
    r.oi++;
  }
  if (r.x >= track.L) {
    const frac = (track.L - x0) / Math.max(r.x - x0, 1e-6);
    r.finished = true;
    r.timeMs = Math.round(((frame - 1 + frac) / RACE_HZ) * 1000);
    r.events.push('finish');
  }
}

const Race = (() => {
  let W = 400, H = 700, cfg = null, track = null, racers = [], frame = 0, acc = 0, t = 0;
  let phase = 'off', count = 0, endTimer = 0, onEnd = null, views = [], fx = new Particles(), shake = 0;
  let finishOrder = [];
  const keyMap = ['KeyA', 'KeyL', 'KeyV', 'ArrowUp'];
  const keyLabel = ['A', 'L', 'V', '↑'];
  const ptrPlayer = new Map();

  function start(config, done) {
    cfg = config; onEnd = done;
    track = genTrack(config.seed);
    racers = config.racers.map((c, i) => makeRacer(c.rec, i, track, c.kind, { player: c.player, skill: c.skill != null ? c.skill : 0.6, ghost: c.ghost, label: c.label }));
    frame = 0; acc = 0; t = 0; phase = 'count'; count = 3.6; endTimer = 0; finishOrder = []; fx = new Particles(); shake = 0;
    ptrPlayer.clear();
    layout();
    Sound.music('race');
  }
  function stop() { phase = 'off'; }
  function resize(w, h) { W = w; H = h; if (cfg) layout(); }
  function humans() { return racers.filter((r) => r.kind === 'human'); }
  function layout() {
    views = [];
    const hum = humans();
    const zoom = clamp(Math.min(W / 430, H / 560), 0.62, 1.6);
    if (cfg.mode === 'party' && hum.length > 1) {
      const top = 64, n = hum.length, vh = (H - top - 10) / n;
      hum.forEach((r, i) => views.push({ y0: top + i * vh, h: vh, follow: r, lanes: [r], zoom: clamp(Math.min(W / 560, vh / 230), 0.5, 1.4), player: r.player }));
    } else {
      const me = hum[0] || racers[0];
      const others = racers.filter((r) => r !== me && r.kind !== 'pb');
      views.push({ y0: 0, h: H, follow: me, lanes: others.concat([me]), zoom, player: 0, solo: true, pb: racers.filter((r) => r.kind === 'pb') });
    }
  }

  /* ---------- input ---------- */
  function press(player, down) {
    const r = humans().find((x) => x.player === player);
    if (!r) return;
    if (down) { if (!r.held) { r.pressed = true; r.held = true; } }
    else r.held = false;
  }
  function viewAt(y) { for (const v of views) if (y >= v.y0 && y < v.y0 + v.h) return v; return views[views.length - 1]; }
  function pointerDown(e) {
    if (phase === 'off') return;
    const v = cfg.mode === 'party' ? viewAt(e.y) : views[0];
    const p = v ? v.player : 0;
    ptrPlayer.set(e.pointerId, p);
    press(p, true);
  }
  function pointerUp(e) {
    const p = ptrPlayer.get(e.pointerId);
    if (p == null) return;
    ptrPlayer.delete(e.pointerId);
    let still = false;
    for (const q of ptrPlayer.values()) if (q === p) still = true;
    if (!still) press(p, false);
  }
  function key(e, down) {
    if (phase === 'off') return false;
    let p = keyMap.indexOf(e.code);
    if (cfg.mode !== 'party' && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyA')) p = 0;
    if (p < 0) return false;
    if (e.repeat) return true;
    press(p, down);
    return true;
  }

  /* ---------- simulation ---------- */
  function update(dt) {
    if (phase === 'off') return;
    t += dt;
    shake = Math.max(0, shake - dt * 3);
    if (phase === 'count') {
      const before = Math.ceil(count);
      count -= dt;
      const after = Math.ceil(count);
      if (after !== before && after >= 1 && after <= 3) Sound.sfx('count');
      for (const r of humans()) r.pressed = false;
      if (count <= 0) { phase = 'run'; Sound.sfx('go'); }
    }
    if (phase === 'run' || phase === 'end') {
      acc += Math.min(dt, 0.1);
      let steps = 0;
      while (acc >= DT && steps < 8) {
        acc -= DT; steps++; frame++;
        for (const r of racers) {
          let inp;
          if (r.kind === 'human') {
            inp = { pressed: r.pressed, held: r.held };
            if (r.pressed && !r.finished) { r.inputs.push(frame, 0); r.pressAt = frame; }
            if (r.pressAt >= 0) { if (r.held) r.inputs[r.inputs.length - 1] = Math.min(frame - r.pressAt + 1, 40); else r.pressAt = -1; }
            r.pressed = false;
          } else if (r.kind === 'ghost' || r.kind === 'pb') inp = ghostInput(r, frame);
          else inp = aiInput(r, track, frame);
          stepRacer(r, track, frame, inp);
          handleEvents(r);
        }
        if (frame > RACE_HZ * 120) for (const r of racers) if (!r.finished) { r.finished = true; r.timeMs = 120000 + r.idx; r.dnf = true; }
      }
      const hum = humans();
      if (phase === 'run' && hum.length && hum.every((r) => r.finished)) { phase = 'end'; endTimer = 0; }
      if (phase === 'end') {
        endTimer += dt;
        if (racers.every((r) => r.finished || r.kind === 'pb') && endTimer > 1.6 || endTimer > 5) finish();
      }
    }
    for (const r of racers) animateRacer(r, dt);
    fx.update(dt);
    const me = views[0] && views[0].follow;
    if (me) $('#hud-time').textContent = fmtTime(me.finished ? me.timeMs : Math.max(0, frame / RACE_HZ * 1000));
  }

  function handleEvents(r) {
    if (!r.events.length) return;
    if (r.kind === 'pb') { r.events.length = 0; return; }
    const isMe = r.kind === 'human';
    const v = views.find((vv) => vv.lanes.includes(r));
    for (const ev of r.events) {
      const [kind] = ev.split(':');
      if (kind === 'finish') {
        finishOrder.push(r);
        r.place = finishOrder.length;
        setExpr(r.P, r.place === 1 ? 'win' : 'happy', 99);
        r.P.armMode = 'cheer';
        if (isMe) { Sound.sfx(r.place === 1 ? 'win' : 'coin'); Sound.sfx('cheer'); burstAt(r, 'confetti', 40); buzz([20, 60, 20]); }
      }
      if (!v || !(isMe || cfg.mode === 'party')) continue;
      if (kind === 'jump') Sound.sfx('jump', clamp(r.g.voice.f0 / 300, 0.8, 1.4));
      else if (kind === 'trip') { Sound.sfx('trip'); shake = 0.6; setExpr(r.P, 'dizzy', 0.9); burstAt(r, 'star', 6); r.streak = 0; if (isMe) buzz(40); }
      else if (kind === 'clear') {
        r.streak = (r.streak || 0) + 1;
        const words = { 3: 'Nice!', 5: 'Great!', 7: 'Amazing!', 10: 'Unstoppable!', 14: 'LEGEND' };
        if (words[r.streak]) { burstAt(r, 'text', 1, words[r.streak]); Sound.sfx('coin'); }
      }
      else if (kind === 'splash' && r.kind === 'human') { r.streak = 0; Sound.sfx('splash'); burstAt(r, 'drop', 12); }
      else if (kind === 'splash') { Sound.sfx('splash'); burstAt(r, 'drop', 12); }
      else if (kind === 'boost') { Sound.sfx('boost'); burstAt(r, 'spark', 10); }
      else if (kind === 'spring') { Sound.sfx('spring'); }
      else if (kind === 'zoom') { burstAt(r, 'text', 1, '!!'); }
      else if (kind === 'land') r.P.squashV += 3;
    }
    r.events.length = 0;
  }
  function burstAt(r, type, n, text) {
    const v = views.find((vv) => vv.lanes.includes(r));
    if (!v) return;
    const p = racerScreen(v, r);
    if (type === 'confetti') fx.burst('confetti', p.x, p.y - 80, n, { speed: 380, g: 500, size: 10, life: 2, colors: ['#FF82B8', '#FFD84A', '#5FDBA2', '#69BCFF', '#B69CFF'], drag: 1 });
    else if (type === 'text') fx.add({ type: 'text', text, x: p.x, y: p.y - 100 * p.z, vy: -60, g: 0, life: 1.1, size: 24, color: '#FF6457' });
    else fx.burst(type, p.x, p.y - 30, n, { speed: 200, g: type === 'drop' ? 700 : 100, size: type === 'drop' ? 9 : 9, life: 0.8, color: type === 'drop' ? '#8B5E3C' : undefined });
  }

  function animateRacer(r, dt) {
    const P = r.P, g = r.g;
    const running = phase !== 'count' && (r.vx > 5);
    P.walk = damp(P.walk, running ? 1 : 0, 10, dt);
    const sNorm = 95 / g.fullH;
    if (g.legs.length) P.phase += (r.vx * dt / sNorm) / (2 * g.stride) * TAU * 0.85;
    else { r.hop = (r.hop || 0) + (r.vx * dt) / 60; P.lift = r.y <= 0 ? Math.abs(Math.sin(r.hop * Math.PI)) * g.bodyH * 0.1 : 0; }
    if (g.legs.length) P.lift = r.y <= 0 ? Math.abs(Math.sin(P.phase)) * g.legLen * 0.08 * P.walk : 0;
    P.air = r.y > 0.5; P.flail = 0.35;
    P.airH = 0;
    P.tilt = damp(P.tilt, r.finished ? 0 : r.y > 0 ? -0.1 : 0.08 * P.walk, 8, dt);
    P.spin = r.tumble > 0 ? -(1 - r.tumble / 0.55) * TAU : damp(P.spin, 0, 12, dt);
    if (!r.finished && P.expr !== 'dizzy') setExpr(P, 'determined');
    if (r.finished) P.armMode = 'cheer';
    else P.armMode = r.y > 0 ? 'flail' : 'run';
    P.lookX = 1; P.lookY = 0.1;
    P.accX = 0; P.accY = r.y > 0 ? -r.vy * 0.5 : 0;
    animatePose(g, P, dt, t);
  }

  function finish() {
    if (phase === 'done') return;
    // silently finish the stragglers with their own deterministic inputs
    let f = frame;
    const pending = () => racers.some((r) => !r.finished && (r.kind === 'ai' || r.kind === 'ghost'));
    while (pending() && f < RACE_HZ * 120) {
      f++;
      for (const r of racers) {
        if (r.finished || (r.kind !== 'ai' && r.kind !== 'ghost')) continue;
        stepRacer(r, track, f, r.kind === 'ghost' ? ghostInput(r, f) : aiInput(r, track, f));
        r.events.length = 0;
      }
    }
    for (const r of racers) if (!r.finished && r.kind !== 'pb') { r.finished = true; r.dnf = true; r.timeMs = 120000; }
    phase = 'done';
    const results = racers.filter((r) => r.kind !== 'pb').map((r) => ({ rec: r.rec, kind: r.kind, player: r.player, label: r.label, timeMs: r.timeMs, dnf: !!r.dnf, log: r.log.slice(), inputs: r.inputs.slice(), hits: r.hits }));
    results.sort((a, b) => (a.dnf - b.dnf) || a.timeMs - b.timeMs);
    results.forEach((r, i) => (r.place = i + 1));
    if (onEnd) onEnd({ mode: cfg.mode, seed: cfg.seed, day: cfg.day, track, results });
  }

  /* ---------- drawing ---------- */
  function racerScreen(v, r) {
    const li = v.lanes.indexOf(r);
    const nl = v.lanes.length;
    const depth = nl - 1 - li;
    const lk = 1 - depth * 0.07;
    const camX = v.camX || 0;
    const z = v.zoom * lk;
    const gy = laneGround(v, depth);
    return { x: (r.x - camX) * z + W * 0.26 * (1 - depth * 0.04), y: gy - r.y * z, z, gy };
  }
  function laneGround(v, depth) {
    if (!v.solo) return v.y0 + v.h * 0.78;
    const gap = clamp(H * 0.085, 44, 84);
    return v.y0 + H * 0.77 - depth * gap;
  }
  function draw(ctx) {
    if (phase === 'off') return;
    ctx.save();
    if (shake > 0 && !reducedMotion) ctx.translate(rand.range(-1, 1) * shake * 6, rand.range(-1, 1) * shake * 4);
    for (const v of views) drawView(ctx, v);
    ctx.restore();
    fx.draw(ctx);
    drawProgress(ctx);
    if (phase === 'count') {
      const n = Math.ceil(count);
      const label = n > 3 ? 'Ready?' : n >= 1 ? String(n) : 'GO!';
      const k = 1 - (count - Math.floor(count));
      bigText(ctx, label, W / 2, H * 0.36, n > 3 ? 46 : 96, easeOutBack(clamp(k * 1.6, 0, 1)));
      if (n > 3 || n === 3) {
        ctx.save(); ctx.font = `800 ${W < 500 ? 16 : 19}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = INK;
        const hint = cfg.mode === 'party' ? 'Tap your lane to jump. Hold for big hurdles.' : 'Tap to jump. Hold to jump higher.';
        ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeText(hint, W / 2, H * 0.36 + 70); ctx.fillText(hint, W / 2, H * 0.36 + 70);
        ctx.restore();
      }
    } else if (phase === 'run' && frame < 50) bigText(ctx, 'GO!', W / 2, H * 0.36, 96, 1 - frame / 50);
    if (phase === 'run' && frame >= 50 && views[0] && views[0].solo && racers.length > 1) {
      const me = views[0].follow;
      if (!me.finished) {
        const ahead = racers.filter((r) => r !== me && (r.finished || r.x > me.x)).length;
        ctx.save();
        ctx.font = `800 ${W < 500 ? 15 : 17}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = INK;
        ctx.globalAlpha = 0.8; ctx.fillText('YOUR PLACE', W / 2, 104);
        ctx.restore();
        bigText(ctx, ordinal(ahead + 1), W / 2, 140, W < 500 ? 38 : 44, 1);
      }
    }
    for (const r of humans()) if (r.finished && r.place && phase !== 'done') {
      const v = views.find((vv) => vv.follow === r);
      if (v) bigText(ctx, r.place === 1 ? '1st!!' : ordinal(r.place), W / 2, v.solo ? H * 0.34 : v.y0 + v.h * 0.4, v.solo ? 72 : 48, 1);
    }
  }
  function bigText(ctx, text, x, y, size, k) {
    if (k <= 0.02) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(-0.05);
    ctx.font = `800 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = INK; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = '#FFD84A'; ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  function drawView(ctx, v) {
    const f = v.follow;
    v.camX = damp(v.camX == null ? f.x : v.camX, f.x + 40, 8, 1 / 60);
    const z = v.zoom;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, v.y0, W, v.h); ctx.clip();
    // sky
    const sky = ctx.createLinearGradient(0, v.y0, 0, v.y0 + v.h);
    sky.addColorStop(0, '#7CCBFF'); sky.addColorStop(1, '#DDF3FF');
    ctx.fillStyle = sky; ctx.fillRect(0, v.y0, W, v.h);
    if (v.solo) {
      // sun + drifting clouds
      ctx.save();
      ctx.translate(W * 0.82, v.y0 + H * 0.2);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = '#FFD84A';
      for (let i = 0; i < 10; i++) { const a = t * 0.4 + (i / 10) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 40, Math.sin(a) * 40); ctx.lineTo(Math.cos(a) * 52, Math.sin(a) * 52); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-10, -4, 3, 0, TAU); ctx.arc(10, -4, 3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 4, 10, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      ctx.restore();
      for (let i = 0; i < 4; i++) {
        const cxp = ((i * 260 - v.camX * 0.12 * (1 + i * 0.2)) % (W + 300) + W + 300) % (W + 300) - 150;
        const cyp = v.y0 + H * (0.13 + (i % 3) * 0.07);
        ctx.lineWidth = 5; ctx.strokeStyle = INK;
        const blobs = [[-24, 0, 18], [0, -10, 24], [24, 0, 18]];
        for (const b of blobs) { ctx.beginPath(); ctx.arc(cxp + b[0], cyp + b[1], b[2], 0, TAU); ctx.stroke(); }
        ctx.fillStyle = '#fff';
        for (const b of blobs) { ctx.beginPath(); ctx.arc(cxp + b[0], cyp + b[1], b[2], 0, TAU); ctx.fill(); }
      }
    }
    const nl = v.lanes.length;
    const backGround = laneGround(v, nl - 1), frontGround = laneGround(v, 0);
    // crowd stands
    const standY = backGround - 34 * z;
    ctx.fillStyle = '#FFE9A8'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.fillRect(0, standY - 60 * z, W, 60 * z); ctx.beginPath(); ctx.moveTo(0, standY - 60 * z); ctx.lineTo(W, standY - 60 * z); ctx.stroke();
    const crowdStep = 26 * z, cam = v.camX * z * 0.9;
    for (let i = Math.floor(cam / crowdStep) - 1; i < (cam + W) / crowdStep + 1; i++) {
      const x = i * crowdStep - cam;
      const hc = hash01(i, 3, 3);
      const bob = Math.abs(Math.sin(t * (4 + hc * 3) + i)) * 6 * z * (phase === 'end' || phase === 'done' ? 2 : 1);
      const cy = standY - 22 * z - bob - (i % 2) * 14 * z;
      ctx.fillStyle = ['#FF82B8', '#FFD84A', '#5FDBA2', '#69BCFF', '#B69CFF', '#FF9A47'][Math.floor(hc * 6)];
      ctx.beginPath(); ctx.arc(x, cy, 11 * z, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x - 3.5 * z, cy - 2 * z, 1.6 * z, 0, TAU); ctx.arc(x + 3.5 * z, cy - 2 * z, 1.6 * z, 0, TAU); ctx.fill();
    }
    // track band
    ctx.fillStyle = '#E8805F';
    const tTop = backGround - 18 * z, tBot = frontGround + 26 * z;
    ctx.fillRect(0, tTop, W, tBot - tTop);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, tTop); ctx.lineTo(W, tTop); ctx.moveTo(0, tBot); ctx.lineTo(W, tBot); ctx.stroke();
    ctx.fillStyle = '#7BC95C'; ctx.fillRect(0, tBot, W, v.y0 + v.h - tBot);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    for (let d = 0; d < nl; d++) { const gy = laneGround(v, d) + 10 * z; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
    // lanes, back to front
    for (let li = 0; li < nl; li++) {
      const r = v.lanes[li], depth = nl - 1 - li;
      const lk = 1 - depth * 0.07, zz = z * lk;
      const gy = laneGround(v, depth);
      const ox = W * 0.26 * (1 - depth * 0.04);
      const X = (wx) => (wx - v.camX) * zz + ox;
      // distance markers + start/finish
      for (let m = 0; m <= track.L; m += 1000) {
        const x = X(m);
        if (x < -40 || x > W + 40) continue;
        if (m === 0 || m === track.L) {
          for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#fff' : INK; ctx.fillRect(x - 5 * zz, gy - 6 * zz + k * 4 * zz, 10 * zz, 4 * zz); }
        } else if (depth === nl - 1) {
          ctx.font = `800 ${12 * zz}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'center';
          ctx.fillText(m / 100 + 'm', x, tTop - 6);
        }
      }
      if (depth === 0 || !v.solo) drawFinishBanner(ctx, X(track.L), gy, zz);
      // obstacles
      track.obs.forEach((o, i) => {
        const x = X(o.x);
        if (x < -120 || x > W + 60) return;
        drawObstacle(ctx, o, x, gy, zz, r.down[i], r.used[i], i);
      });
      if (v.solo && r === v.follow && v.pb) for (const pb of v.pb) {
        const px = X(pb.x);
        if (px > -80 && px < W + 80) {
          drawGuy(ctx, pb.g, px, gy - pb.y * zz, (95 / pb.g.fullH) * zz, pb.P, t, { alpha: 0.32, shadow: false });
          drawTag(ctx, 'Your best', px, gy - pb.y * zz - 112 * zz - 8, 0.55, Math.max(10, 12 * zz));
        }
      }
      // racer
      const p = { x: X(r.x), y: gy - r.y * zz };
      if (r.kind === 'human' && r.y <= 0 && r.vx > 60 && phase !== 'count' && !r.finished) {
        r.dustT = (r.dustT || 0) + 1 / 60;
        if (r.dustT > 0.14) { r.dustT = 0; fx.add({ type: 'dust', x: p.x - 18 * zz, y: p.y - 4, vx: -40 - Math.random() * 30, vy: -20 - Math.random() * 20, g: 0, life: 0.45, size: 5 * zz, color: '#F7C8B4' }); }
      }
      const s = (95 / r.g.fullH) * zz;
      const ghost = r.kind === 'ghost';
      drawGuy(ctx, r.g, p.x, p.y, s, r.P, t, { alpha: ghost ? 0.55 : depth > 0 && v.solo ? 0.92 : 1, shadow: true, crown: r.rec.crown });
      if (r.boost > 0 && !r.finished) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
        for (let k = 0; k < 4; k++) { const yy = p.y - (20 + k * 18) * zz; ctx.beginPath(); ctx.moveTo(p.x - 70 * zz - k * 8, yy); ctx.lineTo(p.x - 40 * zz - k * 8, yy); ctx.stroke(); }
      }
      // name tags
      const label = r.kind === 'human' ? (cfg.mode === 'party' ? 'P' + (r.player + 1) + ' · ' + r.rec.name : 'You · ' + r.rec.name) : (r.label || r.rec.name);
      if (p.x > -40 && p.x < W + 40) drawTag(ctx, label, p.x, p.y - 112 * zz - 8, ghost ? 0.7 : 0.9, Math.max(10, 12 * zz));
      if (cfg.mode === 'party' && r.kind === 'human') {
        ctx.save(); ctx.font = `800 ${16}px ${FONT}`; ctx.fillStyle = INK; ctx.textAlign = 'left';
        ctx.fillText('P' + (r.player + 1) + '  tap here or press ' + keyLabel[r.player], 12, v.y0 + 22);
        ctx.restore();
      }
    }
    if (!v.solo) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, v.y0 + v.h); ctx.lineTo(W, v.y0 + v.h); ctx.stroke(); }
    ctx.restore();
  }
  function drawFinishBanner(ctx, x, gy, z) {
    if (x < -150 || x > W + 150) return;
    ctx.save();
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 6 * z, gy); ctx.lineTo(x - 6 * z, gy - 150 * z); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 6 * z, gy - 150 * z, 70 * z, 30 * z); ctx.strokeRect(x - 6 * z, gy - 150 * z, 70 * z, 30 * z);
    ctx.fillStyle = INK; ctx.font = `800 ${14 * z}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FINISH', x + 29 * z, gy - 134 * z);
    ctx.restore();
  }
  function drawObstacle(ctx, o, x, gy, z, down, used, i) {
    ctx.save();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.t === 'low' || o.t === 'high') {
      const hh = HURDLE[o.t] * z, w = 30 * z;
      ctx.translate(x + 6 * z, gy);
      if (down) ctx.rotate(1.25);
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -hh); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, -hh); ctx.stroke();
      ctx.fillStyle = o.t === 'high' ? '#FF6457' : '#FFFFFF';
      ctx.fillRect(-w / 2 - 4 * z, -hh - 3 * z, w + 8 * z, 10 * z); ctx.strokeRect(-w / 2 - 4 * z, -hh - 3 * z, w + 8 * z, 10 * z);
      ctx.fillStyle = o.t === 'high' ? '#FFFFFF' : '#FF6457';
      ctx.fillRect(-w * 0.1, -hh - 3 * z, w * 0.2, 10 * z);
      if (o.t === 'high' && !down) { ctx.font = `800 ${11 * z}px ${FONT}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText('HOLD', 0, -hh - 9 * z); }
    } else if (o.t === 'mud') {
      ctx.fillStyle = '#8B5E3C';
      ctx.beginPath(); ctx.ellipse(x + (o.w * z) / 2, gy + 2 * z, (o.w * z) / 2, 9 * z, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(x + (o.w * z) * 0.35, gy, 10 * z, 3 * z, 0, 0, TAU); ctx.fill();
    } else if (o.t === 'boost') {
      ctx.fillStyle = used ? '#B9F3D9' : '#5FDBA2';
      ctx.fillRect(x, gy - 4 * z, o.w * z, 8 * z); ctx.strokeRect(x, gy - 4 * z, o.w * z, 8 * z);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) { const ax = x + (12 + k * 20) * z + ((t * 60) % 20) * z * 0.3; ctx.beginPath(); ctx.moveTo(ax, gy - 3 * z); ctx.lineTo(ax + 6 * z, gy); ctx.lineTo(ax, gy + 3 * z); ctx.stroke(); }
    } else if (o.t === 'spring') {
      const sq = used ? 0.6 : 1;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 12 * z, gy - 16 * z * sq, 18 * z, 16 * z * sq); ctx.strokeRect(x + 12 * z, gy - 16 * z * sq, 18 * z, 16 * z * sq);
      ctx.fillStyle = '#FF6457';
      ctx.beginPath(); ctx.ellipse(x + 21 * z, gy - 16 * z * sq, 24 * z, 15 * z, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 12 * z, gy - 24 * z * sq, 3.5 * z, 0, TAU); ctx.arc(x + 28 * z, gy - 26 * z * sq, 4 * z, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawProgress(ctx) {
    const top = 64 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0);
    const x0 = 24, x1 = W - 34, y = cfg.mode === 'party' && humans().length > 1 ? 40 : top;
    if (cfg.mode === 'party' && humans().length > 1) return;
    ctx.save();
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#fff' : INK; ctx.fillRect(x1 + 2, y - 8 + k * 4, 6, 4); }
    const sorted = racers.slice().sort((a, b) => (a.kind === 'human') - (b.kind === 'human'));
    for (const r of sorted) {
      const px = lerp(x0, x1, clamp(r.x / track.L, 0, 1));
      if (r.kind === 'pb') { ctx.globalAlpha = 0.6; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(px, y, 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; continue; }
      const me = r.kind === 'human';
      ctx.globalAlpha = r.kind === 'ghost' ? 0.6 : 1;
      ctx.fillStyle = r.g.fill; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, y, me ? 9 : 6.5, 0, TAU); ctx.fill(); ctx.stroke();
      if (me) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px - 2.5, y - 1, 1.5, 0, TAU); ctx.arc(px + 2.5, y - 1, 1.5, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  return { start, stop, resize, update, draw, pointerDown, pointerUp, key, get active() { return phase !== 'off'; }, get phase() { return phase; }, get cfg() { return cfg; }, _sim: { genTrack, makeRacer, stepRacer, ghostInput, aiInput } };
})();

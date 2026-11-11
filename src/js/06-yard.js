/* =========================================================================
   Zoo (persistence) + Yard (the living habitat)
   ========================================================================= */
const Zoo = (() => {
  let recs = null;
  function scaleStrokes(strokes, k, dx = 0, dy = 0) {
    return cleanStrokes(strokes.map((s) => s.map((v, i) => clamp((v - 250) * k + 250 + (i % 2 ? dy : dx), 2, 498))));
  }
  function locals() {
    return [
      newRecord(randomDoodle(1234, 'loaf'), { id: 'local-steve', name: 'Big Steve', by: 'the yard', color: 7, legs: 6, arms: 1, look: 3, seed: 101, born: EPOCH_DAY }),
      newRecord(scaleStrokes(randomDoodle(2024, 'bean'), 0.62, 0, 40), { id: 'local-beans', name: 'Lil Beans', by: 'the yard', color: 2, legs: 2, arms: 1, look: 8, seed: 202, born: EPOCH_DAY }),
      newRecord(randomDoodle(777, 'tall'), { id: 'local-wobble', name: 'Professor Wobble', by: 'the yard', color: 5, legs: 2, arms: 1, look: 21, seed: 303, born: EPOCH_DAY }),
      newRecord(randomDoodle(4328, 'ghost'), { id: 'local-gloria', name: 'Gloria', by: 'the yard', color: 4, legs: 0, arms: 1, look: 5, seed: 404, born: EPOCH_DAY }),
    ].map((r) => Object.assign(r, { local: 1 }));
  }
  function sanitize(r) {
    if (!r || typeof r !== 'object' || !Array.isArray(r.strokes)) return null;
    const strokes = r.strokes.filter((s) => Array.isArray(s) && s.length >= 2 && s.length % 2 === 0 && s.every((v) => typeof v === 'number' && isFinite(v)));
    if (!strokes.length) return null;
    const out = Object.assign({}, r, {
      strokes,
      id: typeof r.id === 'string' && r.id ? r.id : uid(),
      name: typeof r.name === 'string' && r.name.trim() ? r.name.slice(0, 24) : suggestName(),
      by: typeof r.by === 'string' ? r.by.slice(0, 20) : '',
      legs: LEG_OPTIONS.includes(r.legs) ? r.legs : 2,
      arms: r.arms ? 1 : 0,
      color: Number.isInteger(r.color) ? clamp(r.color, 0, COLORS.length - 1) : 0,
      look: Number.isInteger(r.look) ? r.look & 255 : 0,
      seed: Number.isFinite(r.seed) ? r.seed >>> 0 : hashString(JSON.stringify(strokes)),
      born: Number.isFinite(r.born) ? r.born : localDayIndex(),
    });
    try { return buildGuy(out) ? out : null; } catch (e) { return null; }
  }
  function load() {
    if (recs) return recs;
    const saved = store.get('guys', null);
    recs = Array.isArray(saved) ? saved.map(sanitize).filter(Boolean) : null;
    if (!recs) { recs = locals(); save(); }
    return recs;
  }
  function save() { store.set('guys', recs); }
  return {
    list: () => load(),
    locals,
    get: (id) => load().find((r) => r.id === id),
    add(rec) { load(); const i = recs.findIndex((r) => r.id === rec.id); if (i >= 0) recs[i] = rec; else recs.push(rec); save(); },
    remove(id) { load(); recs = recs.filter((r) => r.id !== id); save(); },
    update(rec) { this.add(rec); },
    mine: () => load().filter((r) => !r.local && !r.adopted),
    count: () => load().length,
    bump(rec, key, n = 1) {
      if (!rec) return;
      rec.life = rec.life || {};
      rec.life[key] = (rec.life[key] || 0) + n;
      clearTimeout(this._t);
      this._t = setTimeout(save, 1200);
    },
  };
})();

const Yard = (() => {
  const actors = [];
  const snacks = [];
  const fx = new Particles();
  let W = 400, H = 700, worldW = 400, camX = 0, camV = 0;
  let mode = 'title';
  const lay = { hz: 300, z0: 330, z1: 450, k: 0.85 };
  const layTarget = { hz: 300, z0: 330, z1: 450, k: 0.85 };
  let selected = null, selectT = 0, tagRect = null;
  let t = 0, danceT = 0, chatClock = 4, sky = null, skyClock = 0, ambT = 4;
  const ptr = { x: -9999, y: -9999, over: false, down: false, id: null, startX: 0, startY: 0, startT: 0, moved: false, guy: null, history: [], panStart: 0, lastTap: 0 };
  const SNACKS = ['🍩', '🍪', '🍕', '🍎', '🧁', '🍌', '🥨', '🍓', '🌮', '🍦', '🧀', '🥐'];
  const hooks = { openCard: null, onPoke: null };
  let decor = [];
  const stars = Array.from({ length: 70 }, (_, i) => ({ x: hash01(i, 1, 3), y: hash01(i, 2, 3) * 0.55, r: 0.6 + hash01(i, 3, 3) * 1.4, p: hash01(i, 4, 3) * TAU }));
  const clouds = Array.from({ length: 6 }, (_, i) => ({ x: hash01(i, 5, 9) * 1600, y: 0.08 + hash01(i, 6, 9) * 0.22, s: 0.6 + hash01(i, 7, 9) * 0.7, n: 3 + (i % 3) }));
  const flies = Array.from({ length: 14 }, (_, i) => ({ x: hash01(i, 8, 1), y: hash01(i, 9, 1), p: hash01(i, 10, 1) * TAU }));

  /* ---------- sky / time of day ---------- */
  function computeSky() {
    const d = new Date();
    let hr = d.getHours() + d.getMinutes() / 60;
    if (window.__hour != null) hr = window.__hour;
    let night;
    if (hr < 5) night = 1; else if (hr < 7) night = 1 - (hr - 5) / 2; else if (hr < 18.5) night = 0; else if (hr < 20.5) night = (hr - 18.5) / 2; else night = 1;
    let dusk = 0;
    if (hr >= 17 && hr < 21) dusk = 1 - Math.abs(hr - 19) / 2;
    else if (hr >= 4.5 && hr < 8) dusk = 1 - Math.abs(hr - 6.2) / 1.8;
    return { hr, night: clamp(night, 0, 1), dusk: clamp(dusk, 0, 1) };
  }
  const isNight = () => sky && sky.night > 0.7;
  function mix(c1, c2, k) {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const r = Math.round(lerp(a >> 16, b >> 16, k)), g2 = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, k)), bl = Math.round(lerp(a & 255, b & 255, k));
    return '#' + ((1 << 24) | (r << 16) | (g2 << 8) | bl).toString(16).slice(1);
  }
  function skyColors() {
    const s = sky;
    let top = mix('#63BFFF', '#7B6FD6', s.dusk), hor = mix('#D3F1FF', '#FFB98E', s.dusk);
    top = mix(top, '#141842', s.night); hor = mix(hor, '#36397A', s.night);
    const grass = mix(mix('#8DD66B', '#9BC46A', s.dusk * 0.6), '#2D5848', s.night);
    const grass2 = mix(mix('#7BC95C', '#8AB75E', s.dusk * 0.6), '#264C3E', s.night);
    const hill1 = mix(mix('#A9E3C4', '#C8A7C8', s.dusk), '#2A3466', s.night);
    const hill2 = mix(mix('#77CC8E', '#B4A07D', s.dusk * 0.7), '#21443F', s.night);
    return { top, hor, grass, grass2, hill1, hill2 };
  }

  /* ---------- layout ---------- */
  function resize(w, h) {
    W = w; H = h;
    computeLayout(true);
  }
  function computeLayout(snap) {
    if (mode === 'title') {
      const tag = $('.tagline'), logo = $('.logo'), act = $('.title-actions');
      const topEl = tag && tag.offsetParent ? tag : logo;
      let a = H * 0.4, b = H * 0.62;
      if (topEl && act && topEl.offsetHeight) {
        a = topEl.getBoundingClientRect().bottom + 44;
        b = act.getBoundingClientRect().top - 10;
      }
      if (b - a < 70 || W > 900) { a = H * 0.62; b = H - 40; }
      Object.assign(layTarget, { hz: a - 46, z0: a, z1: Math.max(a + 30, b), k: 0.82 });
    } else if (mode === 'stage') {
      if (W > H * 1.3 && H < 560) Object.assign(layTarget, { hz: H * 0.32, z0: H * 0.52, z1: H * 0.8, k: 1 });
      else Object.assign(layTarget, { hz: H * 0.2, z0: H * 0.27, z1: H * 0.43, k: 1 });
    } else {
      const hz = H * (W < H ? 0.4 : 0.48);
      Object.assign(layTarget, { hz, z0: hz + 44, z1: H - 112, k: 1 });
    }
    if (snap) Object.assign(lay, layTarget);
    worldW = Math.max(W, Math.min(4200, 140 + actors.length * (W < 600 ? 95 : 130)));
    camX = clamp(camX, 0, worldW - W);
    buildDecor();
  }
  function setMode(m) { mode = m; computeLayout(false); }
  function buildDecor() {
    const r = makeRng(99);
    decor = [];
    const n = Math.floor(worldW / 34);
    for (let i = 0; i < n; i++) decor.push({ kind: r.pick(['tuft', 'tuft', 'tuft', 'flower', 'pebble', 'tuft', 'flower']), x: r.range(0, worldW), z: r.range(-0.05, 1.05), c: r.pick(['#FF82B8', '#FFD84A', '#FFFFFF', '#B69CFF', '#FF6457']), s: r.range(0.7, 1.2) });
  }
  const groundY = (z) => lay.z0 + z * (lay.z1 - lay.z0);
  const depthK = (z) => 0.8 + 0.32 * z;
  function guyScale(a) {
    const g = a.g;
    const base = clamp(Math.min(H * 0.15, W * 0.3, (lay.z1 - lay.z0 + 80) * 0.6), 60, 150) * lay.k;
    const disp = base * clamp(Math.pow(g.fullH / 330, 0.45), 0.72, 1.32);
    return (disp / g.fullH) * depthK(a.z);
  }

  /* ---------- actors ---------- */
  function makeActor(rec, opts = {}) {
    const g = buildGuy(rec);
    if (!g) return null;
    const a = {
      rec, g, P: makePose(),
      x: opts.x != null ? opts.x : rand.range(80, Math.max(160, worldW - 80)),
      z: opts.z != null ? opts.z : rand.range(0.1, 0.9),
      h: 0, vx: 0, vz: 0, vh: 0, spinV: 0,
      state: 'idle', timer: rand.range(0.5, 3), tx: 0, tz: 0,
      bubble: null, partner: null, snack: null, sleepy: rand.range(0, 1), awakeT: 0, hop: 0, prevVx: 0, prevVh: 0, glance: 0,
      speed: 46 + g.stats.spd * 6.5, tagT: 0,
    };
    a.P.face = rand.sign();
    return a;
  }
  function sync(list) {
    worldW = Math.max(W, Math.min(4200, 140 + list.length * (W < 600 ? 95 : 130)));
    const ids = new Set(list.map((r) => r.id));
    for (let i = actors.length - 1; i >= 0; i--) if (!ids.has(actors[i].rec.id)) actors.splice(i, 1);
    for (const rec of list) {
      const a = actors.find((x) => x.rec.id === rec.id);
      if (!a) { const na = makeActor(rec); if (na) actors.push(na); }
      else if (a.rec !== rec) { a.rec = rec; a.g = buildGuy(rec); }
    }
    computeLayout(false);
  }
  function say(a, text, opts = {}) {
    a.bubble = { text, age: 0, life: opts.life || clamp(1.2 + text.length * 0.06, 1.4, 3) };
    const onScreen = a.x - camX > -50 && a.x - camX < W + 50;
    if (onScreen && opts.voice !== false) {
      const d = Sound.speak(a.g.voice, text.replace(/[^a-z ?!]/gi, '') || 'hm', { pitch: opts.pitch || 1 });
      a.P.talkT = d;
    }
  }
  function screenPos(a) { return { x: a.x - camX, y: groundY(a.z) }; }
  function headY(a, s) { return groundY(a.z) - a.h - (a.g.legLen * a.P.legGrow + a.P.lift - a.g.top) * s; }

  /* ---------- update ---------- */
  function update(dt) {
    t += dt;
    skyClock -= dt;
    if (!sky || skyClock <= 0) { sky = computeSky(); skyClock = 20; }
    for (const k in lay) lay[k] = damp(lay[k], layTarget[k], 5, dt);
    // camera inertia
    if (!ptr.down) { camX += camV * dt; camV *= Math.exp(-4 * dt); }
    camX = clamp(camX, 0, Math.max(0, worldW - W));
    if (selected) { selectT -= dt; if (selectT <= 0 || !actors.includes(selected)) selected = null; }
    if (danceT > 0) { danceT -= dt; if (danceT <= 0) endDance(); }
    ambT -= dt;
    if (ambT <= 0) { ambT = rand.range(6, 13); if (danceT <= 0) Sound.sfx(isNight() ? 'cricket' : 'bird'); }
    // occasional chats
    chatClock -= dt;
    if (chatClock <= 0) { chatClock = rand.range(5, 11); startChat(); }
    for (const s of snacks) {
      s.age += dt;
      if (s.h > 0 || s.vh > 0) { s.vh -= 1500 * dt; s.h += s.vh * dt; if (s.h <= 0) { s.h = 0; if (s.vh < -200) { s.vh = -s.vh * 0.3; } else s.vh = 0; } }
    }
    for (let i = snacks.length - 1; i >= 0; i--) if (snacks[i].age > 40 || snacks[i].gone) snacks.splice(i, 1);
    for (const a of actors) updateActor(a, dt);
    // gentle separation
    for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
      const A = actors[i], B = actors[j];
      if (A.state === 'held' || B.state === 'held' || A.state === 'air' || B.state === 'air' || A.state === 'chat' || B.state === 'chat') continue;
      const dx = B.x - A.x, dz = B.z - A.z, minD = (A.g.bodyW * guyScale(A) + B.g.bodyW * guyScale(B)) * 0.32;
      if (Math.abs(dz) < 0.1 && Math.abs(dx) < minD) {
        const push = (minD - Math.abs(dx)) * 0.8 * dt * sign(dx || 1);
        A.x -= push; B.x += push;
      }
    }
    fx.update(dt);
  }

  function pickTarget(a) {
    a.tx = clamp(a.x + rand.range(-260, 260), 50, worldW - 50);
    a.tz = clamp(a.z + rand.range(-0.4, 0.4), 0.02, 0.98);
  }

  function moveToward(a, tx, tz, speed, dt) {
    const dx = tx - a.x, dz = (tz - a.z) * (lay.z1 - lay.z0);
    const d = Math.hypot(dx, dz);
    if (d < 6) { a.vx = damp(a.vx, 0, 10, dt); return true; }
    const sp = Math.min(speed, d * 3);
    a.vx = damp(a.vx, (dx / d) * sp, 6, dt);
    const vzpx = (dz / d) * sp;
    a.z = clamp(a.z + (vzpx / Math.max(lay.z1 - lay.z0, 1)) * dt, 0, 1);
    return false;
  }

  function updateActor(a, dt) {
    const P = a.P, g = a.g;
    const s = guyScale(a);
    a.tagT = Math.max(0, a.tagT - dt);
    if (a.bubble) { a.bubble.age += dt; if (a.bubble.age > a.bubble.life) a.bubble = null; }
    let walking = false;
    switch (a.state) {
      case 'birth': updateBirth(a, dt); break;
      case 'held': {
        const gx = ptr.x - a.grabDX + camX, gyp = ptr.y - a.grabDY;
        const nx = damp(a.x, gx, 22, dt);
        a.vx = (nx - a.x) / Math.max(dt, 1e-3);
        a.x = nx;
        const nh = Math.max(0, damp(a.h, groundY(a.z) - gyp, 22, dt));
        a.vh = (nh - a.h) / Math.max(dt, 1e-3);
        a.h = nh;
        P.tilt = damp(P.tilt, clamp(-a.vx * 0.0012, -0.7, 0.7), 8, dt);
        P.air = true; P.flail = 1; P.armMode = 'flail';
        break;
      }
      case 'air': {
        a.vh -= 2100 * dt;
        a.x += a.vx * dt; a.h += a.vh * dt;
        P.spin += a.spinV * dt;
        if ((a.bonkCD = (a.bonkCD || 0) - dt) <= 0 && Math.hypot(a.vx, a.vh) > 380) {
          const sa = guyScale(a);
          const ax = a.x, ay = groundY(a.z) - a.h - (a.g.legLen + a.g.bodyH / 2) * sa;
          const ra = Math.max(a.g.bodyW, a.g.bodyH) * sa * 0.45;
          for (const b of actors) {
            if (b === a || b.state === 'held' || b.state === 'air' || b.state === 'birth' || Math.abs(b.z - a.z) > 0.3) continue;
            const sb = guyScale(b);
            const bx = b.x, by = groundY(b.z) - b.h - (b.g.legLen + b.g.bodyH / 2) * sb;
            const rb = Math.max(b.g.bodyW, b.g.bodyH) * sb * 0.45;
            if (Math.hypot(ax - bx, ay - by) > (ra + rb) * 0.8) continue;
            if (b.partner) { b.partner.state = 'idle'; b.partner.partner = null; b.partner.timer = 1; }
            if (b.snack) b.snack = null;
            b.partner = null;
            b.state = 'air'; b.vx = a.vx * 0.55 + sign(bx - ax) * 140; b.vh = 420 + Math.abs(a.vx) * 0.15;
            b.spinV = clamp(b.vx / 140, -12, 12); b.hardLanding = true; b.bonkCD = 0.5;
            b.P.air = true; b.P.flail = 1; b.P.armMode = 'flail'; setExpr(b.P, 'surprised', 9);
            a.vx *= -0.35; a.vh = Math.max(a.vh * 0.5, 180); a.hardLanding = true; a.bonkCD = 0.5;
            const mx = (ax + bx) / 2 - camX, my = (ay + by) / 2;
            fx.burst('star', mx, my, 8, { speed: 220, g: 200, size: 9, life: 0.9 });
            fx.add({ type: 'text', text: 'BONK!', x: mx, y: my - 20, vy: -60, g: 0, life: 1, size: 28, color: '#FF5B4F' });
            Sound.sfx('thud', 1.4); Sound.sfx('squeak', 1.3);
            buzz(35);
            Zoo.bump(b.rec, 'bonked');
            break;
          }
        }
        if (a.x < 30) { a.x = 30; a.vx = Math.abs(a.vx) * 0.5; }
        if (a.x > worldW - 30) { a.x = worldW - 30; a.vx = -Math.abs(a.vx) * 0.5; }
        if (a.h <= 0) {
          const impact = -a.vh;
          a.h = 0;
          if (impact > 380) {
            a.vh = impact * 0.36; a.vx *= 0.6; a.spinV *= 0.5;
            P.squashV += 5; Sound.sfx('thud', 1.1);
            fx.burst('dust', a.x - camX, groundY(a.z), 6, { speed: 120, g: -40, size: 8, life: 0.6, color: '#fff' });
          } else {
            P.air = false; P.spin = 0; P.armMode = 'rest';
            a.vx = 0; a.vh = 0;
            P.squashV += 3.5;
            if (a.hardLanding) {
              buzz(25);
              a.state = 'dizzy'; a.timer = 2.2; setExpr(P, 'dizzy', 2.2);
              fx.burst('star', a.x - camX, headY(a, s), 5, { speed: 90, g: -20, size: 8, life: 1.2 });
              say(a, rand.pick(TXT.say.landed));
            } else { a.state = 'idle'; a.timer = rand.range(1, 2); setExpr(P, 'happy', 1); }
            a.hardLanding = false;
          }
        }
        break;
      }
      case 'dizzy':
        a.timer -= dt; P.tilt = Math.sin(t * 6) * 0.12;
        if (a.timer <= 0) { a.state = 'idle'; a.timer = 1; P.tilt = 0; }
        break;
      case 'sleep':
        P.lift = Math.sin(t * 1.6 + a.sleepy * 9) * 2;
        a.timer -= dt;
        if (rand.chance(dt * 0.7)) fx.add({ type: 'text', text: 'z', x: a.x - camX + 10, y: headY(a, s) - 4, vx: rand.range(8, 20), vy: -26, g: 0, life: 2, size: 12 + rand.range(0, 8), color: '#fff' });
        if (!isNight() && a.timer <= 0) wake(a);
        break;
      case 'eat':
        a.timer -= dt;
        if (rand.chance(dt * 8)) fx.burst('crumb', a.x - camX + P.face * 12, headY(a, s) + 30, 1, { speed: 60, g: 500, size: 4, color: '#C98B4A', extra: { floor: groundY(a.z) } });
        if (a.timer <= 0) {
          if (a.snack) a.snack.gone = true;
          a.snack = null; a.state = 'idle'; a.timer = rand.range(1.5, 3);
          setExpr(P, 'happy', 1.5);
          Zoo.bump(a.rec, 'snacks');
          fx.burst('heart', a.x - camX, headY(a, s), 3, { speed: 70, g: -60, size: 9, life: 1.2, angle: -Math.PI / 2, spread: 0.8 });
          say(a, rand.pick(TXT.say.eat));
        }
        break;
      case 'chat': {
        const b = a.partner;
        if (!b || !actors.includes(b) || b.state !== 'chat') { a.state = 'idle'; a.partner = null; break; }
        const gap = (a.g.bodyW * guyScale(a) + b.g.bodyW * guyScale(b)) * 0.42 + 22;
        const side = a.x < b.x ? -1 : 1;
        const arrived = moveToward(a, (a.x + b.x) / 2 + side * gap / 2, (a.z + b.z) / 2, a.speed, dt);
        walking = !arrived;
        P.face = a.x < b.x ? 1 : -1;
        a.timer -= dt;
        if (arrived && a.leader && a.timer <= 0) {
          a.turns--;
          const speaker = a.turns % 2 ? a : b;
          say(speaker, rand.pick(TXT.say.chat));
          a.timer = rand.range(1.3, 2);
          if (a.turns <= 0) { for (const x of [a, b]) { x.state = 'idle'; x.timer = rand.range(1, 3); x.partner = null; setExpr(x.P, 'happy', 1); } }
        }
        break;
      }
      case 'snack': {
        const sn = a.snack;
        if (!sn || sn.gone) { a.state = 'idle'; a.snack = null; break; }
        if (sn.h > 2) { P.face = sn.x > a.x ? 1 : -1; break; }
        const arrived = moveToward(a, sn.x - P.face * 14, sn.z, a.speed * 1.5, dt);
        walking = !arrived;
        if (arrived) { a.state = 'eat'; a.timer = 1.3; setExpr(P, 'eat', 1.3); Sound.sfx('munch'); }
        break;
      }
      case 'walk': {
        const arrived = moveToward(a, a.tx, a.tz, a.speed, dt);
        walking = !arrived;
        a.timer -= dt;
        if (arrived || a.timer <= 0) { a.state = 'idle'; a.timer = rand.range(1, 4); }
        break;
      }
      case 'hopup': break;
      case 'dance':
        P.lift = Math.abs(Math.sin(t * 6.1 + a.sleepy * 3)) * g.bodyH * 0.12;
        P.tilt = Math.sin(t * 3.05 + a.sleepy * 5) * 0.16;
        P.armMode = 'dance';
        if (rand.chance(dt * 0.6)) fx.add({ type: 'text', text: rand.pick(['♪', '♫']), x: a.x - camX, y: headY(a, s), vx: rand.range(-20, 20), vy: -40, g: 0, life: 1.6, size: 18, color: INK });
        break;
      default: { // idle
        a.timer -= dt;
        a.vx = damp(a.vx, 0, 8, dt);
        if (a.timer <= 0) {
          if (isNight() && a.awakeT <= 0 && rand.chance(0.55)) { a.state = 'sleep'; a.timer = rand.range(20, 60); setExpr(P, 'sleep'); P.armMode = 'rest'; break; }
          const r = rand();
          if (r < 0.62) { a.state = 'walk'; pickTarget(a); a.timer = 8; }
          else if (r < 0.75) { P.armMode = 'wave'; P.waveSide = P.face; a.timer = 1.6; say(a, rand.pick(TXT.say.greet), { life: 1.6 }); }
          else if (r < 0.85) { a.vh = 380; a.state = 'hopup'; Sound.sfx('jump', 1.2 + rand() * 0.4); }
          else a.timer = rand.range(1, 3);
        }
        if (P.armMode === 'wave' && a.timer < 0.2) P.armMode = 'rest';
      }
    }
    if (a.state === 'hopup') {
      a.vh -= 1800 * dt; a.h += a.vh * dt;
      P.air = a.h > 4; P.flail = 0.3;
      if (a.h <= 0 && a.vh < 0) { a.h = 0; a.vh = 0; P.air = false; P.squashV += 3; a.state = 'idle'; a.timer = rand.range(1, 3); }
    }
    a.awakeT -= dt;
    // walking animation
    const moving = walking && Math.abs(a.vx) + 1 > 4;
    if (moving) a.x += a.vx * dt;
    a.x = clamp(a.x, 24, worldW - 24);
    if (Math.abs(a.vx) > 3 && a.state !== 'air' && a.state !== 'held') P.face = a.vx > 0 ? 1 : -1;
    const vmag = moving ? Math.max(Math.abs(a.vx), 25) : 0;
    if (g.legs.length) {
      P.walk = damp(P.walk, moving ? 1 : 0, 8, dt);
      P.phase += ((vmag * P.face * dt) / s) / (2 * g.stride) * TAU;
      if (a.state !== 'dance' && a.state !== 'sleep') P.lift = Math.abs(Math.sin(P.phase)) * g.legLen * 0.07 * P.walk;
    } else if (a.state !== 'dance' && a.state !== 'sleep' && a.state !== 'birth') {
      // legless hopper
      if (moving) { a.hop += ((vmag * dt) / s) / Math.max(g.bodyH * 0.55, 40) * Math.PI; }
      else a.hop = damp(a.hop, Math.round(a.hop / Math.PI) * Math.PI, 10, dt);
      const hs = Math.abs(Math.sin(a.hop));
      P.lift = hs * g.bodyH * 0.16;
      P.extraSq = moving ? (hs < 0.25 ? (0.25 - hs) * 0.6 : -hs * 0.08) : 0;
    }
    if (a.state !== 'held' && a.state !== 'air' && a.state !== 'dizzy' && a.state !== 'dance') P.tilt = damp(P.tilt, moving ? P.face * 0.05 : 0, 6, dt);
    if (!moving && a.state !== 'birth' && a.state !== 'held' && a.state !== 'air' && a.state !== 'dance') P.extraSq = Math.sin(t * (a.state === 'sleep' ? 1.6 : 2.4) + a.sleepy * 7) * (a.state === 'sleep' ? 0.035 : 0.018);
    if (a.state !== 'air' && a.state !== 'held') P.spin = damp(P.spin, 0, 10, dt);
    P.airH = a.h;
    // eyes: acceleration + look target
    P.accX = (a.vx - a.prevVx) / Math.max(dt, 1e-3);
    P.accY = -(a.vh - a.prevVh) / Math.max(dt, 1e-3);
    a.prevVx = a.vx; a.prevVh = a.vh;
    let lx = null, ly = 0;
    const hx = a.x - camX, hy = headY(a, s) + 20;
    if (ptr.over && Math.hypot(ptr.x - hx, ptr.y - hy) < 320 && a.state !== 'sleep') { lx = (ptr.x - hx) / 160; ly = (ptr.y - hy) / 160; }
    else if (a.partner) { lx = sign(a.partner.x - a.x); ly = 0; }
    else if (a.snack) { lx = (a.snack.x - a.x) / 100; ly = 0.6; }
    else {
      a.glance -= dt;
      if (a.glance <= 0) { a.glance = rand.range(1.5, 4); a.gx = rand.range(-1, 1); a.gy = rand.range(-0.6, 0.6); }
      lx = moving ? P.face * 0.8 : a.gx; ly = moving ? 0.1 : a.gy;
    }
    P.lookX = damp(P.lookX, clamp(lx, -1, 1), 8, dt);
    P.lookY = damp(P.lookY, clamp(ly, -1, 1), 8, dt);
    animatePose(g, P, dt, t);
  }

  function wake(a, poked) {
    a.state = 'idle'; a.timer = rand.range(1, 2); setExpr(a.P, poked ? 'surprised' : 'normal', poked ? 0.8 : 0);
    a.awakeT = 25;
    if (poked) say(a, rand.pick(TXT.say.wake));
  }

  function startChat() {
    const idle = actors.filter((a) => a.state === 'idle' || a.state === 'walk');
    if (idle.length < 2 || danceT > 0) return;
    const a = rand.pick(idle);
    const near = idle.filter((b) => b !== a && Math.abs(b.x - a.x) < 380);
    if (!near.length) return;
    const b = rand.pick(near);
    a.state = b.state = 'chat'; a.partner = b; b.partner = a;
    a.leader = true; b.leader = false; a.turns = rand.int(3, 5); a.timer = 0.8;
  }

  /* ---------- birth sequence ---------- */
  function birth(rec, onDone) {
    const a = makeActor(rec, { x: camX + W / 2, z: 0.55 });
    if (!a) return null;
    a.state = 'birth'; a.birthT = 0; a.onDone = onDone;
    a.P.legGrow = 0; a.P.eyePop = 0; a.P.face = 1; a.P.blinkT = 99;
    actors.push(a);
    computeLayout(false);
    const landscape = W > H * 1.3 && H < 560;
    a.x = clamp(camX + (landscape ? W * 0.27 : W / 2), 60, worldW - 60);
    a.tagT = 9999;
    Sound.sfx('magic');
    const p = screenPos(a);
    fx.burst('spark', p.x, p.y - 60, 26, { speed: 300, g: 120, size: 9, life: 1, colors: ['#fff', '#FFD84A', '#FF82B8', '#69BCFF'] });
    return a;
  }
  function updateBirth(a, dt) {
    const P = a.P, bt = (a.birthT += dt);
    const s = guyScale(a), p = screenPos(a);
    P.extraSq = bt < 0.9 ? Math.sin(bt * 22) * 0.12 * (1 - bt / 0.9) : 0;
    if (bt > 0.9 && !a.b1) { a.b1 = 1; Sound.sfx('pop'); P.eyePop = 0.01; }
    if (a.b1) P.eyePop = Math.min(1, P.eyePop + dt / 0.35);
    if (bt > 1.3 && !a.b2) { a.b2 = 1; Sound.sfx('boing'); P.blinkT = 0.4; }
    if (a.b2) { a.legP = Math.min(1, (a.legP || 0) + dt / 0.5); P.legGrow = easeOutBack(a.legP); }
    if (bt > 1.9 && !a.b3) {
      a.b3 = 1; P.armMode = 'wave'; P.waveSide = 1;
      say(a, rand.pick(TXT.say.greet), { life: 2 });
      fx.burst('heart', p.x, p.y - a.g.fullH * s, 4, { speed: 90, g: -50, size: 10, angle: -Math.PI / 2, spread: 1 });
    }
    P.lookX = bt > 2.0 && bt < 3.2 ? Math.sin((bt - 2) * 4) : 0;
    if (bt > 3.2) {
      a.state = 'idle'; a.timer = 2; P.armMode = 'rest'; P.extraSq = 0; P.legGrow = 1;
      if (a.onDone) a.onDone(a);
    }
  }
  function rebuild(a, rec) {
    a.rec = rec; a.g = buildGuy(rec);
    a.P.pupils = null; a.P.squashV += 4;
    Sound.sfx('pop');
    const p = screenPos(a);
    fx.burst('spark', p.x, p.y - 50, 10, { speed: 200, g: 100, size: 7, life: 0.6, colors: ['#fff', '#FFD84A'] });
  }

  /* ---------- interactions ---------- */
  function hitTest(x, y) {
    const sorted = actors.slice().sort((a, b) => b.z - a.z);
    for (const a of sorted) {
      const s = guyScale(a), p = screenPos(a);
      const w = Math.max(a.g.halfW * s + 10, 26);
      const top = p.y - a.h - a.g.fullH * s - 10, bot = p.y - a.h + 8;
      if (x > p.x - w && x < p.x + w && y > top && y < bot) return a;
    }
    return null;
  }
  function poke(a) {
    const P = a.P;
    Sound.sfx('squeak', clamp(a.g.voice.f0 / 300, 0.7, 1.6));
    P.squashV += 6;
    Zoo.bump(a.rec, 'pokes');
    if (a.state === 'sleep') { wake(a, true); return; }
    setExpr(P, rand.chance(0.5) ? 'happy' : 'surprised', 0.9);
    const s = guyScale(a);
    fx.burst('heart', a.x - camX, headY(a, s), 2, { speed: 80, g: -60, size: 8, life: 1, angle: -Math.PI / 2, spread: 0.9 });
    if (rand.chance(0.7)) say(a, rand.pick(TXT.say.poke));
    selected = a; selectT = 6; a.tagT = 6;
    if (a.state === 'idle' || a.state === 'walk') { a.state = 'idle'; a.timer = rand.range(0.8, 2); }
    if (hooks.onPoke) hooks.onPoke(a);
  }
  function dropSnack(x, z, fromSky = true) {
    const sn = { x: clamp(x, 30, worldW - 30), z: clamp(z, 0, 1), h: fromSky ? rand.range(260, 420) : 0, vh: 0, e: rand.pick(SNACKS), age: 0, gone: false, rot: rand.range(-0.4, 0.4) };
    snacks.push(sn);
    Sound.sfx('drop');
    const cands = actors.filter((a) => !a.snack && (a.state === 'idle' || a.state === 'walk' || (a.state === 'sleep' && rand.chance(0.3))));
    cands.sort((a, b) => Math.abs(a.x - sn.x) - Math.abs(b.x - sn.x));
    const eater = cands[0];
    if (eater) {
      if (eater.state === 'sleep') wake(eater, false);
      eater.state = 'snack'; eater.snack = sn;
      if (rand.chance(0.5)) say(eater, rand.pick(['!!', 'snack!', 'mine!', 'ooh']));
    }
    return sn;
  }
  function snackShower() {
    for (let i = 0; i < 5; i++) setTimeout(() => dropSnack(camX + rand.range(40, W - 40), rand.range(0.1, 0.9)), i * 140);
  }
  function startDance(secs = 22) {
    danceT = secs;
    for (const a of actors) if (a.state !== 'held' && a.state !== 'air' && a.state !== 'birth') { if (a.state === 'sleep') wake(a); a.h = 0; a.vh = 0; a.P.air = false; a.state = 'dance'; a.partner = null; a.snack = null; setExpr(a.P, 'happy', secs); }
    Sound.music('party');
  }
  function endDance() {
    danceT = 0;
    for (const a of actors) if (a.state === 'dance') { a.state = 'idle'; a.timer = 1; a.P.armMode = 'rest'; a.P.tilt = 0; a.P.lift = 0; setExpr(a.P, 'normal'); }
    Sound.music(isNight() ? 'night' : (mode === 'title' ? 'title' : 'yard'));
  }

  function pointerDown(e) {
    if (ptr.down && e.pointerId !== ptr.id) return;
    ptr.down = true; ptr.id = e.pointerId; ptr.x = e.x; ptr.y = e.y; ptr.over = true;
    ptr.startX = e.x; ptr.startY = e.y; ptr.startT = performance.now(); ptr.moved = false; ptr.history = [[e.x, e.y, ptr.startT]];
    ptr.panStart = camX; camV = 0;
    ptr.guy = null; ptr.tag = false;
    if (tagRect && e.x > tagRect.x && e.x < tagRect.x + tagRect.w && e.y > tagRect.y && e.y < tagRect.y + tagRect.h && selected) { ptr.tag = true; return; }
    const a = hitTest(e.x, e.y);
    if (a && a.state !== 'birth') ptr.guy = a;
  }
  function pointerMove(e) {
    if (ptr.down && e.pointerId !== ptr.id) return;
    ptr.x = e.x; ptr.y = e.y; ptr.over = true;
    if (!ptr.down) return;
    const now = performance.now();
    ptr.history.push([e.x, e.y, now]);
    while (ptr.history.length > 2 && now - ptr.history[0][2] > 90) ptr.history.shift();
    if (!ptr.moved && Math.hypot(e.x - ptr.startX, e.y - ptr.startY) > 9) {
      ptr.moved = true;
      const a = ptr.guy;
      if (a && a.state !== 'birth') {
        if (a.partner) { const b = a.partner; b.state = 'idle'; b.partner = null; b.timer = 1; }
        a.partner = null;
        if (a.snack) { a.snack = null; }
        a.state = 'held';
        const p = screenPos(a);
        a.grabDX = ptr.startX - p.x; a.grabDY = ptr.startY - (p.y - a.h);
        setExpr(a.P, 'held', 999);
        Sound.sfx('whoosh');
        if (rand.chance(0.6)) say(a, rand.pick(TXT.say.held));
      }
    }
    if (ptr.moved && !ptr.guy) camX = clamp(ptr.panStart - (e.x - ptr.startX), 0, Math.max(0, worldW - W));
  }
  function pointerUp(e) {
    if (!ptr.down || e.pointerId !== ptr.id) return;
    ptr.down = false;
    const a = ptr.guy;
    const now = performance.now();
    if (ptr.tag && selected) { if (hooks.openCard) hooks.openCard(selected); return; }
    if (a && a.state === 'held') {
      const h0 = ptr.history[0], h1 = ptr.history[ptr.history.length - 1];
      const dtv = Math.max((h1[2] - h0[2]) / 1000, 0.016);
      const vx = clamp((h1[0] - h0[0]) / dtv, -1800, 1800), vy = clamp((h1[1] - h0[1]) / dtv, -1800, 1800);
      a.state = 'air'; a.vx = vx; a.vh = -vy; a.spinV = clamp(vx / 160, -14, 14);
      a.hardLanding = Math.hypot(vx, vy) > 900 || a.h > 260;
      if (Math.hypot(vx, vy) > 250 || a.h > 80) Zoo.bump(a.rec, 'thrown');
      setExpr(a.P, 'surprised', 9);
      if (Math.hypot(vx, vy) > 600) Sound.sfx('whoosh');
    } else if (a && !ptr.moved) {
      if (now - ptr.startT > 520) { if (hooks.openCard) hooks.openCard(a); }
      else poke(a);
    } else if (!ptr.moved) {
      // tap on the ground: drop a snack there
      const gy0 = lay.z0 - 30;
      if (e.y > gy0) dropSnack(e.x + camX, clamp((e.y - lay.z0) / Math.max(lay.z1 - lay.z0, 1), 0, 1));
      else dropSnack(e.x + camX, rand.range(0.2, 0.8));
    } else if (!a) {
      const h0 = ptr.history[0], h1 = ptr.history[ptr.history.length - 1];
      camV = -clamp((h1[0] - h0[0]) / Math.max((h1[2] - h0[2]) / 1000, 0.016), -2500, 2500);
    }
    ptr.guy = null;
  }
  function pointerLeave() { if (!ptr.down) { ptr.over = false; ptr.x = -9999; } }

  /* ---------- drawing ---------- */
  function drawBackground(ctx) {
    const c = skyColors();
    const hz = lay.hz;
    const grd = ctx.createLinearGradient(0, 0, 0, hz + 20);
    grd.addColorStop(0, c.top); grd.addColorStop(1, c.hor);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, hz + 40);
    // stars
    if (sky.night > 0.05) {
      ctx.fillStyle = '#FFFFFF';
      for (const s of stars) {
        ctx.globalAlpha = sky.night * (0.45 + 0.55 * Math.sin(t * 2 + s.p) ** 2);
        ctx.beginPath(); ctx.arc(s.x * W, s.y * hz, s.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // sun / moon
    const hr = sky.hr;
    const arc = (h0) => { const k = clamp((h0 - 6) / 13, 0, 1); return [W * (0.1 + 0.8 * k), hz - Math.sin(k * Math.PI) * hz * 0.62 - 10]; };
    if (hr > 5.5 && hr < 20) {
      const [sx, sy] = arc(hr);
      drawSun(ctx, sx, sy, Math.min(42, W * 0.09));
    } else {
      const hh = hr < 12 ? hr + 24 : hr;
      const k = clamp((hh - 19.5) / 11, 0, 1);
      drawMoon(ctx, W * (0.12 + 0.76 * k), hz - Math.sin(k * Math.PI) * hz * 0.55 - 10, Math.min(30, W * 0.07));
    }
    // clouds
    for (const cl of clouds) {
      const x = ((cl.x + t * 7 * cl.s - camX * 0.15) % (W + 300) + W + 300) % (W + 300) - 150;
      drawCloud(ctx, x, cl.y * hz + 20, cl.s * Math.min(1, W / 500 + 0.4), cl.n, sky.night);
    }
    // hills
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    ctx.fillStyle = c.hill1;
    ctx.beginPath(); ctx.moveTo(0, hz + 10);
    for (let x = 0; x <= W + 20; x += 20) { const wx = x + camX * 0.3; ctx.lineTo(x, hz - 34 - 26 * Math.sin(wx * 0.004 + 1.3) - 14 * Math.sin(wx * 0.013)); }
    ctx.lineTo(W, hz + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.hill2;
    ctx.beginPath(); ctx.moveTo(0, hz + 10);
    for (let x = 0; x <= W + 20; x += 18) { const wx = x + camX * 0.6; ctx.lineTo(x, hz - 8 - 18 * Math.sin(wx * 0.006 + 4) - 8 * Math.sin(wx * 0.021)); }
    ctx.lineTo(W, hz + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    // trees on the near hill
    for (let i = 0; i < 40; i++) {
      const wx = i * 260 + 90 + hash01(i, 4, 4) * 120;
      const x = wx - camX * 0.6;
      if (x < -60 || x > W + 60) continue;
      const by = hz - 8 - 18 * Math.sin(wx * 0.006 + 4) - 8 * Math.sin(wx * 0.021);
      const sz = 16 + hash01(i, 5, 4) * 12;
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, by + 4); ctx.lineTo(x, by - sz * 1.4); ctx.stroke();
      ctx.fillStyle = mix('#5FC27A', '#1F4A3C', sky.night);
      ctx.beginPath(); ctx.arc(x, by - sz * 1.6, sz, 0, TAU); ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    }
    // ground
    const gg = ctx.createLinearGradient(0, hz, 0, H);
    gg.addColorStop(0, c.grass); gg.addColorStop(1, c.grass2);
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.moveTo(0, hz + 14);
    for (let x = 0; x <= W + 20; x += 16) { const wx = x + camX; ctx.lineTo(x, hz + 10 + 3 * Math.sin(wx * 0.03)); }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    // the guy house
    drawHouse(ctx, 70 - camX, groundY(-0.05), 0.75 + 0.25 * lay.k);
    // decor
    ctx.lineWidth = 2;
    for (const d of decor) {
      const x = d.x - camX;
      if (x < -20 || x > W + 20) continue;
      const y = groundY(d.z) + 6;
      const k = depthK(d.z) * d.s;
      ctx.strokeStyle = sky.night > 0.5 ? 'rgba(20,30,40,0.6)' : 'rgba(30,27,54,0.5)';
      if (d.kind === 'tuft') {
        ctx.beginPath(); ctx.moveTo(x - 6 * k, y); ctx.lineTo(x - 3 * k, y - 9 * k); ctx.moveTo(x, y); ctx.lineTo(x, y - 12 * k); ctx.moveTo(x + 6 * k, y); ctx.lineTo(x + 3 * k, y - 9 * k); ctx.stroke();
      } else if (d.kind === 'flower') {
        ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 16 * k); ctx.stroke();
        ctx.fillStyle = mix(d.c, '#3A3F6A', sky.night * 0.6);
        for (let p = 0; p < 5; p++) { const an = (p / 5) * TAU + d.x; ctx.beginPath(); ctx.arc(x + Math.cos(an) * 4.5 * k, y - 16 * k + Math.sin(an) * 4.5 * k, 3.4 * k, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = '#FFD84A'; ctx.beginPath(); ctx.arc(x, y - 16 * k, 2.6 * k, 0, TAU); ctx.fill();
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = mix('#C9C3D9', '#4A4A6A', sky.night);
        ctx.beginPath(); ctx.ellipse(x, y - 2, 6 * k, 3.6 * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
  }
  function drawSun(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const rot = t * 0.3;
    for (let i = 0; i < 10; i++) { const a = rot + (i / 10) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); ctx.lineTo(Math.cos(a) * r * (1.55 + 0.1 * Math.sin(t * 3 + i)), Math.sin(a) * r * (1.55 + 0.1 * Math.sin(t * 3 + i))); ctx.stroke(); }
    ctx.fillStyle = sky.dusk > 0.5 ? '#FFB347' : '#FFD84A';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.12, r * 0.09, 0, TAU); ctx.arc(r * 0.32, -r * 0.12, r * 0.09, 0, TAU); ctx.fill();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, r * 0.08, r * 0.3, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,110,140,0.45)';
    ctx.beginPath(); ctx.ellipse(-r * 0.55, r * 0.18, r * 0.14, r * 0.09, 0, 0, TAU); ctx.ellipse(r * 0.55, r * 0.18, r * 0.14, r * 0.09, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawMoon(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255,240,180,0.12)'; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFF1B8'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.05, r * 0.16, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 0.32, -r * 0.05, r * 0.16, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(30,27,54,0.12)'; ctx.beginPath(); ctx.arc(r * 0.35, r * 0.45, r * 0.15, 0, TAU); ctx.arc(-r * 0.4, -r * 0.5, r * 0.1, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawCloud(ctx, x, y, s, n, night) {
    const blobs = [];
    for (let i = 0; i < n; i++) blobs.push([x + (i - (n - 1) / 2) * 26 * s, y - Math.sin((i / (n - 1 || 1)) * Math.PI) * 14 * s, (18 + (i % 2) * 8) * s]);
    ctx.lineWidth = 5; ctx.strokeStyle = INK;
    for (const b of blobs) { ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, TAU); ctx.stroke(); }
    ctx.fillStyle = mix('#FFFFFF', '#5A5F94', night);
    for (const b of blobs) { ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, TAU); ctx.fill(); }
  }
  function drawHouse(ctx, x, y, k) {
    if (x < -160 || x > W + 60) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(k, k);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.fillStyle = mix('#FFF4D6', '#5B5B7E', sky.night * 0.8);
    ctx.beginPath(); ctx.rect(-48, -78, 96, 78); ctx.fill(); ctx.stroke();
    ctx.fillStyle = mix('#FF6457', '#6E3247', sky.night * 0.7);
    ctx.beginPath(); ctx.moveTo(-60, -74); ctx.lineTo(0, -122); ctx.lineTo(60, -74); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = mix('#69BCFF', '#FFD96A', sky.night);
    ctx.beginPath(); ctx.rect(-36, -60, 26, 22); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-23, -60); ctx.lineTo(-23, -38); ctx.moveTo(-36, -49); ctx.lineTo(-10, -49); ctx.stroke();
    ctx.fillStyle = mix('#B07A4F', '#4A3A3A', sky.night * 0.6);
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(6, -46); ctx.quadraticCurveTo(21, -60, 36, -46); ctx.lineTo(36, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(30, -22, 2.4, 0, TAU); ctx.fill();
    ctx.font = `800 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = INK;
    ctx.fillText('GUYS', 0, -86);
    ctx.restore();
  }

  function draw(ctx) {
    drawBackground(ctx);
    const items = [];
    for (const sn of snacks) items.push({ z: sn.z, sn });
    for (const a of actors) items.push({ z: a.z + (a.state === 'held' ? 2 : 0), a });
    items.sort((p, q) => p.z - q.z);
    tagRect = null;
    for (const it of items) {
      if (it.sn) {
        const sn = it.sn, x = sn.x - camX, y = groundY(sn.z);
        if (x < -40 || x > W + 40) continue;
        const sz = 24 * depthK(sn.z);
        ctx.fillStyle = 'rgba(30,27,54,0.15)'; ctx.beginPath(); ctx.ellipse(x, y, sz * 0.45 * clamp(1 - sn.h / 400, 0.3, 1), sz * 0.12, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(x, y - sn.h - sz * 0.45); ctx.rotate(sn.rot + (sn.h > 0 ? t * 3 : 0));
        ctx.font = `${sz}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#7A4A1E';
        ctx.fillText(sn.e, 0, 0); ctx.restore();
        continue;
      }
      const a = it.a, s = guyScale(a), p = screenPos(a);
      if (p.x < -200 || p.x > W + 200) continue;
      drawGuy(ctx, a.g, p.x, p.y, s, a.P, t, { selected: a === selected && a.state !== 'birth' });
    }
    // night tint + fireflies
    if (sky.night > 0.05) {
      ctx.fillStyle = `rgba(16,18,58,${0.22 * sky.night})`;
      ctx.fillRect(0, 0, W, H);
      for (const f of flies) {
        const x = ((f.x * W + Math.sin(t * 0.5 + f.p) * 40) % W + W) % W, y = lay.hz + 10 + f.y * (H - lay.hz - 40) + Math.cos(t * 0.7 + f.p) * 20;
        const al = sky.night * (0.4 + 0.6 * Math.sin(t * 2.4 + f.p * 3) ** 2);
        ctx.fillStyle = `rgba(255,236,120,${al * 0.25})`; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,246,170,${al})`; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill();
      }
    }
    fx.draw(ctx);
    // bubbles + tags
    for (const a of actors) {
      const s = guyScale(a), p = screenPos(a);
      if (p.x < -100 || p.x > W + 100) continue;
      const hy = headY(a, s);
      if (a.bubble) drawBubble(ctx, a.bubble.text, p.x, hy - 6, a.bubble.age, a.bubble.life, W < 500 ? 14 : 16);
      const showTag = (a === selected && a.state !== 'birth') || a.tagT > 0;
      if (showTag && !a.bubble) {
        const label = a === selected ? a.rec.name + '  ⓘ' : a.rec.name;
        drawTag(ctx, label, p.x, hy - 16, Math.min(1, a === selected ? 1 : a.tagT), W < 500 ? 13 : 14);
        if (a === selected) {
          ctx.font = `800 ${W < 500 ? 13 : 14}px ${FONT}`;
          const w = ctx.measureText(label).width + 16;
          tagRect = { x: p.x - w / 2 - 8, y: hy - 16 - 18, w: w + 16, h: 36 };
        }
      }
    }
  }

  return {
    hooks, resize, update, draw, setMode, sync, birth, rebuild, say, dropSnack, snackShower, startDance, endDance,
    pointerDown, pointerMove, pointerUp, pointerLeave,
    get actors() { return actors; }, get mode() { return mode; }, get dancing() { return danceT > 0; },
    get isNight() { return isNight(); },
    find: (id) => actors.find((a) => a.rec.id === id),
    select(a) { selected = a; selectT = 6; },
    clearSelect() { selected = null; },
    focus(a) { camX = clamp(a.x - W / 2, 0, Math.max(0, worldW - W)); },
    arrive(rec) {
      const a = makeActor(rec, { x: camX - 40, z: rand.range(0.3, 0.7) });
      if (!a) return null;
      actors.push(a); computeLayout(false);
      a.x = camX - 30; a.state = 'walk'; a.tx = camX + W * 0.5; a.tz = a.z; a.timer = 10; a.tagT = 6;
      setTimeout(() => say(a, rand.pick(TXT.say.greet)), 1400);
      return a;
    },
    leave(a, done) {
      a.state = 'walk'; a.tx = a.x < camX + W / 2 ? -200 : worldW + 200; a.tz = a.z; a.timer = 99; a.speed *= 1.6;
      say(a, rand.pick(['bye!!', 'see ya', 'off to adventure', 'farewell', 'o7']));
      setTimeout(() => { const i = actors.indexOf(a); if (i >= 0) actors.splice(i, 1); computeLayout(false); if (done) done(); }, 2600);
    },
  };
})();

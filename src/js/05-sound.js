/* =========================================================================
   Sound — a tiny synthesizer: sfx, babbling voices, generative music.
   No audio files: every sound is built from oscillators and noise.
   ========================================================================= */
const Sound = (() => {
  let ctx = null, master, comp, musicBus, sfxBus, voiceBus, noiseBuf;
  let muted = store.get('muted', false);
  let track = null, wanted = null, pending = null, timer = null, nextT = 0, step = 0, lastVoice = 0;

  function init() {
    if (ctx) { if (ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden) ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1.0; sfxBus.connect(master);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 0.5; voiceBus.connect(master);
    try { const sb = ctx.createBufferSource(); sb.buffer = ctx.createBuffer(1, 1, 22050); sb.connect(ctx.destination); sb.start(0); } catch (e) { /* ignore */ }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend().catch(() => {});
      else { if (ctx.state !== 'closed') ctx.resume().catch(() => {}); nextT = ctx.currentTime + 0.08; }
    });
    if (pending) { const p = pending; pending = null; music(p); }
  }
  const ok = () => ctx && ctx.state === 'running' && !muted;

  function env(g, at, a, peak, d) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
  }
  function tone(o) {
    const at = o.at != null ? o.at : ctx.currentTime + (o.t || 0);
    const a = o.a || 0.005, dur = o.dur || 0.2;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, at);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, at + a + dur);
    const g = ctx.createGain();
    env(g, at, a, o.vol || 0.2, dur);
    let node = osc;
    if (o.filter) {
      const fl = ctx.createBiquadFilter();
      fl.type = o.filter.type; fl.frequency.setValueAtTime(o.filter.f, at); fl.Q.value = o.filter.q || 0.8;
      if (o.filter.f2) fl.frequency.exponentialRampToValueAtTime(o.filter.f2, at + a + dur);
      osc.connect(fl); node = fl;
    }
    node.connect(g); g.connect(o.bus || sfxBus);
    osc.start(at); osc.stop(at + a + dur + 0.05);
    return osc;
  }
  function noise(o) {
    const at = o.at != null ? o.at : ctx.currentTime + (o.t || 0);
    const a = o.a || 0.004, dur = o.dur || 0.2;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = o.type || 'bandpass'; fl.frequency.setValueAtTime(o.f || 1000, at); fl.Q.value = o.q || 1;
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, at + a + dur);
    const g = ctx.createGain(); env(g, at, a, o.vol || 0.2, dur);
    src.connect(fl); fl.connect(g); g.connect(o.bus || sfxBus);
    src.start(at, Math.random() * 0.8); src.stop(at + a + dur + 0.05);
  }

  /* ---------- instruments ---------- */
  function marimba(f, at, vol, bus) {
    const g = ctx.createGain(); env(g, at, 0.004, vol, 0.55);
    const g2 = ctx.createGain(); env(g2, at, 0.002, vol * 0.3, 0.07);
    const o1 = ctx.createOscillator(); o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.frequency.value = f * 3.94;
    o1.connect(g); o2.connect(g2); g.connect(bus); g2.connect(bus);
    o1.start(at); o2.start(at); o1.stop(at + 0.62); o2.stop(at + 0.12);
  }
  function bell(f, at, vol, bus, len = 1.3) {
    const g = ctx.createGain(); env(g, at, 0.003, vol, len);
    const g2 = ctx.createGain(); env(g2, at, 0.003, vol * 0.25, len * 0.5);
    const o1 = ctx.createOscillator(); o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.frequency.value = f * 2.76;
    o1.connect(g); o2.connect(g2); g.connect(bus); g2.connect(bus);
    o1.start(at); o2.start(at); o1.stop(at + len + 0.1); o2.stop(at + len * 0.5 + 0.1);
  }
  function whistle(f, at, len, vol, bus) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 0.985, at); o.frequency.exponentialRampToValueAtTime(f, at + 0.04);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, at); lg.gain.linearRampToValueAtTime(f * 0.012, at + Math.min(len, 0.3));
    lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.03);
    g.gain.setValueAtTime(vol, at + Math.max(0.03, len - 0.06)); g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.08);
    o.connect(g); g.connect(bus);
    o.start(at); lfo.start(at); o.stop(at + len + 0.12); lfo.stop(at + len + 0.12);
  }
  function bass(f, at, len, vol, bus) {
    tone({ type: 'triangle', f, at, a: 0.006, dur: len, vol, bus });
    tone({ type: 'sine', f: f / 2, at, a: 0.006, dur: len * 0.8, vol: vol * 0.7, bus });
  }
  function kick(at, vol, bus) { tone({ type: 'sine', f: 150, f2: 42, at, a: 0.002, dur: 0.16, vol, bus }); }
  function snare(at, vol, bus) { noise({ at, dur: 0.12, vol, f: 1900, q: 0.7, bus }); tone({ type: 'triangle', f: 210, f2: 160, at, dur: 0.07, vol: vol * 0.5, bus }); }
  function hat(at, vol, bus) { noise({ at, dur: 0.035, vol, type: 'highpass', f: 7500, q: 0.5, bus }); }
  function shaker(at, vol, bus) { noise({ at, a: 0.012, dur: 0.05, vol, type: 'highpass', f: 5500, q: 0.6, bus }); }
  function lead(f, at, len, vol, bus) {
    tone({ type: 'square', f, at, a: 0.004, dur: len, vol, bus, filter: { type: 'lowpass', f: 3200, f2: 1400 } });
  }

  /* ---------- generative tracks ---------- */
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function makeMelody(seed, prog, bars, opts) {
    const r = makeRng(seed);
    const rhythms = opts.rhythms;
    const out = [];
    let prev = opts.center;
    for (let b = 0; b < bars; b++) {
      const chord = prog[b % prog.length];
      const rh = (b % 4 === 3) ? rhythms[0] : r.pick(rhythms);
      for (const st of rh) {
        const tones = [];
        for (let o = -12; o <= 12; o += 12) for (const c of chord) tones.push(c + o + opts.center - (opts.center % 12));
        tones.sort((a, c) => Math.abs(a - prev) - Math.abs(c - prev));
        let n = tones[r.int(0, Math.min(2, tones.length - 1))];
        if (r.chance(0.18)) n += r.pick([2, -1, -2]);
        n = clamp(n, opts.center - 7, opts.center + 12);
        out.push({ bar: b, st, n });
        prev = n;
      }
    }
    return out;
  }
  // chords as semitone offsets from the key root
  const YARD_PROG = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];       // I V vi IV
  const NIGHT_PROG = [[0, 4, 7, 11], [-1, 2, 7, 11], [-3, 2, 5, 9], [-5, 2, 4, 7]];
  const RACE_PROG = [[9, 12, 16], [5, 9, 12], [0, 4, 7], [7, 11, 14]];      // vi IV I V
  const TRACKS = {
    yard: {
      bpm: 94, root: 53, // F
      init() { this.mel = makeMelody(11, YARD_PROG, 8, { center: 77, rhythms: [[0, 6, 8], [0, 4, 6, 8, 12], [0, 3, 6, 10, 12], [0, 8, 10, 12, 14], [2, 4, 8, 12]] }); },
      play(s, at, spb) {
        const bar = Math.floor(s / 16) % 8, st = s % 16, ch = YARD_PROG[bar % 4], R = this.root;
        if (st === 0) bass(midi(R - 12 + ch[0]), at, spb * 7, 0.6, musicBus);
        if (st === 8) bass(midi(R - 12 + ch[0] + 7), at, spb * 6, 0.45, musicBus);
        if (st % 4 === 2) shaker(at, 0.1, musicBus);
        if ([0, 3, 6, 10, 12].includes(st)) { const n = R + 12 + ch[[0, 1, 2, 1, 2][[0, 3, 6, 10, 12].indexOf(st)]]; marimba(midi(n), at, 0.3, musicBus); }
        for (const m of this.mel) if (m.bar === bar && m.st === st) whistle(midi(m.n), at, spb * 2.2, 0.17, musicBus);
      },
    },
    night: {
      bpm: 66, root: 53,
      play(s, at, spb) {
        const bar = Math.floor(s / 16) % 4, st = s % 16, ch = NIGHT_PROG[bar], R = this.root;
        if (st === 0) bass(midi(R - 12 + ch[0]), at, spb * 14, 0.26, musicBus);
        if (st % 2 === 0) { const idx = [0, 1, 2, 3, 2, 1, 2, 3][st / 2]; bell(midi(R + 24 + ch[idx]), at, 0.08, musicBus, 1.6); }
      },
    },
    race: {
      bpm: 148, root: 55, // G
      init() { this.mel = makeMelody(5, RACE_PROG, 8, { center: 79, rhythms: [[0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 6, 8, 10, 12], [0, 2, 4, 8, 11, 14], [0, 4, 6, 8, 12, 14]] }); },
      play(s, at, spb) {
        const bar = Math.floor(s / 16) % 8, st = s % 16, ch = RACE_PROG[bar % 4], R = this.root;
        if (st === 0 || st === 8 || (st === 10 && bar % 2)) kick(at, 0.5, musicBus);
        if (st === 4 || st === 12) snare(at, 0.22, musicBus);
        if (st % 2 === 0) hat(at, st % 4 === 2 ? 0.09 : 0.05, musicBus);
        if (st % 2 === 0) bass(midi(R - 12 + ch[0] + (st % 4 === 2 ? 12 : 0)), at, spb * 1.6, 0.26, musicBus);
        if (st % 4 === 0) marimba(midi(R + 12 + ch[(st / 4) % 3]), at, 0.07, musicBus);
        for (const m of this.mel) if (m.bar === bar && m.st === st) lead(midi(m.n), at, spb * 1.5, 0.045, musicBus);
      },
    },
    party: {
      bpm: 116, root: 50, // D
      play(s, at, spb) {
        const bar = Math.floor(s / 16) % 4, st = s % 16, ch = [[0, 3, 7], [5, 8, 12], [3, 7, 10], [-2, 2, 5]][bar], R = this.root;
        if (st % 4 === 0) kick(at, 0.55, musicBus);
        if (st === 4 || st === 12) { snare(at, 0.18, musicBus); noise({ at: at + 0.01, dur: 0.08, vol: 0.12, f: 1200, q: 1.2, bus: musicBus }); }
        if (st % 2 === 1) hat(at, 0.06, musicBus);
        if ([0, 3, 6, 8, 11, 14].includes(st)) bass(midi(R - 12 + ch[0] + (st === 6 || st === 14 ? 12 : 0)), at, spb * 1.4, 0.3, musicBus);
        if (st === 2 || st === 10) for (const c of ch) lead(midi(R + 12 + c), at, spb * 1.2, 0.022, musicBus);
      },
    },
  };
  TRACKS.title = TRACKS.yard;

  function schedule() {
    if (!ctx || !track) return;
    const tr = TRACKS[track];
    const spb = 60 / tr.bpm / 4;
    if (nextT < ctx.currentTime - 0.25) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.14) {
      if (!muted) tr.play(step, nextT, spb);
      nextT += spb; step++;
    }
  }
  function music(name) {
    if (!ctx) { pending = name; return; }
    if (wanted === name) return;
    wanted = name;
    const tr = TRACKS[name];
    if (tr && tr.init && !tr.mel) tr.init();
    const now = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(musicBus.gain.value, now);
    musicBus.gain.linearRampToValueAtTime(0.0001, now + 0.25);
    setTimeout(() => {
      track = name; step = 0;
      if (!ctx) return;
      nextT = ctx.currentTime + 0.05;
      const t2 = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(t2);
      musicBus.gain.setValueAtTime(0.0001, t2);
      musicBus.gain.linearRampToValueAtTime(name === 'night' ? 0.5 : 0.42, t2 + 0.6);
    }, name ? 260 : 0);
    if (!name) track = null;
    if (!timer) timer = setInterval(schedule, 25);
  }

  /* ---------- sound effects ---------- */
  const SFX = {
    pop: () => { tone({ f: 560, f2: 170, dur: 0.12, vol: 0.32 }); noise({ dur: 0.03, vol: 0.1, f: 3200, q: 0.7 }); },
    boing: (p = 1) => {
      const at = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(150 * p, at); o.frequency.exponentialRampToValueAtTime(430 * p, at + 0.08); o.frequency.exponentialRampToValueAtTime(300 * p, at + 0.3);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 17;
      const lg = ctx.createGain(); lg.gain.value = 45 * p; lfo.connect(lg); lg.connect(o.frequency);
      const g = ctx.createGain(); env(g, at, 0.005, 0.4, 0.32);
      o.connect(g); g.connect(sfxBus); o.start(at); lfo.start(at); o.stop(at + 0.4); lfo.stop(at + 0.4);
    },
    jump: (p = 1) => tone({ type: 'square', f: 250 * p, f2: 640 * p, dur: 0.12, vol: 0.32, filter: { type: 'lowpass', f: 2200 } }),
    squeak: (p = 1) => { tone({ f: 900 * p, f2: 1500 * p, dur: 0.08, vol: 0.28 }); tone({ f: 1500 * p, f2: 1050 * p, t: 0.08, dur: 0.07, vol: 0.2 }); },
    whoosh: () => noise({ dur: 0.32, vol: 0.4, f: 380, f2: 2600, q: 1.2, a: 0.07 }),
    thud: (p = 1) => { tone({ f: 140 * p, f2: 45, dur: 0.18, vol: 0.45 }); noise({ dur: 0.07, vol: 0.15, type: 'lowpass', f: 700 }); },
    munch: () => { for (let i = 0; i < 3; i++) noise({ t: i * 0.09, dur: 0.05, vol: 0.4, f: 1300 + i * 280, q: 2.2 }); },
    sparkle: () => [1568, 1976, 2349, 3136].forEach((f, i) => tone({ f, t: i * 0.05, dur: 0.22, vol: 0.08 })),
    magic: () => {
      [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => { tone({ type: 'triangle', f, t: i * 0.065, dur: 0.5, vol: 0.11 }); tone({ f: f * 2.004, t: i * 0.065 + 0.02, dur: 0.35, vol: 0.035 }); });
      noise({ dur: 0.9, vol: 0.05, type: 'highpass', f: 6000, a: 0.3 });
    },
    poof: () => { noise({ dur: 0.32, vol: 0.28, f: 900, f2: 200, q: 0.8 }); tone({ f: 320, f2: 90, dur: 0.25, vol: 0.22 }); },
    trip: () => { tone({ type: 'sawtooth', f: 430, f2: 120, dur: 0.34, vol: 0.1, filter: { type: 'lowpass', f: 1500 } }); SFX.thud(0.8); },
    splash: () => {
      noise({ dur: 0.35, vol: 0.45, type: 'lowpass', f: 3200, f2: 380, q: 0.5 });
      for (let i = 0; i < 4; i++) tone({ f: rand.range(900, 1600), f2: rand.range(380, 700), t: rand.range(0, 0.12), dur: 0.08, vol: 0.05 });
    },
    boost: () => { tone({ type: 'sawtooth', f: 220, f2: 900, dur: 0.28, vol: 0.2, filter: { type: 'lowpass', f: 2600 } }); tone({ type: 'square', f: 440, f2: 1760, dur: 0.22, vol: 0.04, t: 0.04, filter: { type: 'lowpass', f: 3200 } }); },
    spring: () => { SFX.boing(1.4); },
    count: () => tone({ type: 'square', f: 440, dur: 0.13, vol: 0.4, filter: { type: 'lowpass', f: 2200 } }),
    go: () => { tone({ type: 'square', f: 880, dur: 0.38, vol: 0.2, filter: { type: 'lowpass', f: 3000 } }); tone({ type: 'square', f: 1320, dur: 0.38, vol: 0.05, filter: { type: 'lowpass', f: 3000 } }); },
    cheer: () => {
      noise({ dur: 1.5, vol: 0.13, f: 1700, q: 0.6, a: 0.25 });
      for (let i = 0; i < 12; i++) tone({ type: 'triangle', f: rand.range(520, 1100), f2: rand.range(700, 1500), t: rand.range(0, 1.0), dur: 0.13, vol: 0.035 });
    },
    win: () => { const at = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => marimba(f, at + i * 0.1, 0.22, sfxBus)); marimba(1319, at + 0.45, 0.25, sfxBus); marimba(1568, at + 0.45, 0.18, sfxBus); },
    lose: () => [392, 370, 349, 311].forEach((f, i) => tone({ type: 'triangle', f, f2: f * 0.96, t: i * 0.22, dur: 0.22, vol: 0.11 })),
    click: () => tone({ f: 1100, f2: 650, dur: 0.04, vol: 0.16 }),
    tap: () => tone({ type: 'triangle', f: 640, f2: 900, dur: 0.06, vol: 0.32 }),
    snore: () => noise({ dur: 1.0, vol: 0.14, type: 'lowpass', f: 380, a: 0.45 }),
    drop: () => tone({ f: 760, f2: 300, dur: 0.14, vol: 0.22 }),
    coin: () => { tone({ type: 'square', f: 988, dur: 0.06, vol: 0.11, filter: { type: 'lowpass', f: 4000 } }); tone({ type: 'square', f: 1319, t: 0.07, dur: 0.2, vol: 0.11, filter: { type: 'lowpass', f: 4000 } }); },
    hurdle: () => { tone({ type: 'square', f: 190, f2: 90, dur: 0.11, vol: 0.12 }); noise({ dur: 0.06, vol: 0.2, f: 900 }); },
    scribble: () => noise({ dur: 0.05, vol: 0.32, f: 3800, q: 3 }),
    swish: () => noise({ dur: 0.12, vol: 0.25, f: 1800, f2: 4000, q: 1.5 }),
    bird: () => { const n = rand.int(2, 4), base = rand.range(2300, 3100); for (let i = 0; i < n; i++) tone({ f: base * rand.range(0.9, 1.1), f2: base * rand.range(1.2, 1.45), t: i * rand.range(0.09, 0.14), dur: 0.05, vol: 0.05 }); },
    cricket: () => { for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) noise({ t: k * 0.35 + i * 0.055, dur: 0.025, vol: 0.07, f: 4600, q: 9 }); },
  };
  function sfx(name, p) { if (!ok() || !SFX[name]) return; try { SFX[name](p); } catch (e) { /* audio is best-effort */ } }

  /* ---------- babble voices ---------- */
  const FORMANTS = { a: [800, 1250], e: [450, 1950], i: [320, 2450], o: [520, 900], u: [360, 760], y: [330, 2250] };
  function speak(voice, text, opts = {}) {
    if (!ok()) return 0;
    const now = ctx.currentTime;
    if (now - lastVoice < 0.06 && !opts.force) return 0;
    const letters = String(text || 'blorp').toLowerCase().replace(/[^a-z ?!]/g, '');
    const syl = [];
    let cur = '';
    for (const ch of letters) {
      if (ch === '?' || ch === '!') continue;
      cur += ch;
      if ('aeiouy'.includes(ch) || (ch === ' ' && cur.trim())) { if (cur.trim()) syl.push(cur.trim()); cur = ''; }
    }
    if (cur.trim()) syl.push(cur.trim());
    if (!syl.length) syl.push('bo');
    const sy = syl.slice(0, opts.max || 9);
    const question = /\?\s*$/.test(text);
    const base = voice.f0 * (opts.pitch || 1);
    const rate = voice.speed * (opts.rate || 1);
    const fScale = clamp(1 + (base - 220) / 900, 0.85, 1.45);
    let t = now + 0.02;
    const steps = [0, 2, 4, 5, 7, 9];
    let si = 2;
    sy.forEach((s, i) => {
      const vowel = (s.match(/[aeiouy]/) || ['a'])[0];
      const cons = s.replace(/[aeiouy ]/g, '');
      const dur = (0.07 + Math.min(cons.length, 2) * 0.014 + Math.random() * 0.03) / rate;
      si = clamp(si + rand.pick([-2, -1, 0, 1, 1, 2]), 0, steps.length - 1);
      let semi = steps[si];
      if (i === sy.length - 1) semi += question ? 5 : -2;
      const f = base * Math.pow(2, semi / 12);
      if (/[sztcfx]/.test(cons)) noise({ at: t, dur: 0.03, vol: 0.12, type: 'highpass', f: 4800, q: 0.7, bus: voiceBus });
      else if (/[kpbdgq]/.test(cons)) noise({ at: t, dur: 0.014, vol: 0.18, f: 2200, q: 1.5, bus: voiceBus });
      const o = ctx.createOscillator(); o.type = voice.wave;
      o.frequency.setValueAtTime(f * (/[mnlrw]/.test(cons) ? 0.9 : 1), t);
      o.frequency.exponentialRampToValueAtTime(f * (0.94 + Math.random() * 0.14), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.012);
      g.gain.setValueAtTime(0.32, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const [F1, F2] = FORMANTS[vowel];
      for (const [ff, q, gv] of [[F1 * fScale, 5, 1], [F2 * fScale, 7, 0.6]]) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q;
        const fg = ctx.createGain(); fg.gain.value = gv * (voice.wave === 'triangle' ? 3.2 : 2.3);
        o.connect(bp); bp.connect(fg); fg.connect(g);
      }
      const dry = ctx.createGain(); dry.gain.value = voice.wave === 'triangle' ? 0.35 : 0.12; o.connect(dry); dry.connect(g);
      g.connect(voiceBus);
      o.start(t); o.stop(t + dur + 0.03);
      t += dur * 1.04;
    });
    lastVoice = now;
    return t - now;
  }

  function setMuted(m) {
    muted = !!m;
    store.set('muted', muted);
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
    if (!muted) init();
  }
  return { init, sfx, speak, music, setMuted, isMuted: () => muted, get ready() { return !!ctx; }, _debug: { ctx: () => ctx, TRACKS, SFX, reinit: () => { ctx = null; init(); } } };
})();

/* =========================================================================
   Studio — the drawing pad
   ========================================================================= */
const Studio = (() => {
  let cv, ctx, size = 300, dpr = 1;
  let strokes = [], cur = null, curM = null, undo = [], color = 0, preview = null, mirror = false;
  let pid = null, lastSfx = 0, anim = null, onDone = null, built = false;

  function setup() {
    if (built) return;
    built = true;
    cv = $('#pad'); ctx = cv.getContext('2d');
    const sw = $('#swatches');
    COLORS.forEach((c, i) => {
      const b = h('button', { class: 'swatch', role: 'radio', 'aria-checked': i === color ? 'true' : 'false', 'aria-label': c.name, style: `background:${c.fill}` });
      b.addEventListener('click', () => { color = i; for (const x of $$('.swatch', sw)) x.setAttribute('aria-checked', x === b ? 'true' : 'false'); Sound.sfx('tap'); render(); });
      sw.append(b);
    });
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    $('#draw-undo').addEventListener('click', () => {
      if (anim) return;
      if (strokes.length) { const s = strokes.pop(); undo.push(s); if (s._pair && strokes.length) strokes.pop(); }
      else if (undo.cleared) { strokes = undo.cleared; undo.cleared = null; }
      Sound.sfx('swish'); changed();
    });
    $('#draw-clear').addEventListener('click', () => {
      if (anim || !strokes.length) return;
      undo = []; undo.cleared = strokes; strokes = []; Sound.sfx('poof'); changed();
    });
    $('#draw-surprise').addEventListener('click', surprise);
    $('#draw-mirror').addEventListener('click', () => {
      mirror = !mirror;
      $('#draw-mirror').setAttribute('aria-pressed', String(mirror));
      Sound.sfx('tap');
      if (mirror) toast('Mirror on: draw one side, get both');
      render();
    });
    $('#prompt-roll').addEventListener('click', () => { rollPrompt(); Sound.sfx('tap'); });
    $('#draw-back').addEventListener('click', () => { close(); if (onDone) onDone(null); });
    $('#draw-done').addEventListener('click', finish);
    window.addEventListener('resize', () => { if (!$('#draw').hidden) fit(); });
    document.addEventListener('keydown', (e) => {
      if ($('#draw').hidden) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('#draw-undo').click(); }
      if (e.key === 'Escape') $('#draw-back').click();
    });
  }
  function rollPrompt() {
    const cur0 = $('#prompt-text').textContent;
    let p = rand.pick(TXT.prompts);
    if (p === cur0) p = rand.pick(TXT.prompts);
    $('#prompt-text').textContent = p;
  }
  function open(cb) {
    setup();
    onDone = cb;
    strokes = []; undo = []; cur = null; preview = null;
    color = rand.int(0, 7);
    for (const [i, x] of $$('.swatch').entries()) x.setAttribute('aria-checked', i === color ? 'true' : 'false');
    rollPrompt();
    $('#draw').hidden = false;
    fit();
    changed();
  }
  function close() { $('#draw').hidden = true; cancelAnim(); }
  function fit() {
    const wrap = $('#pad-wrap');
    const avail = $('.studio-inner').clientWidth;
    const land = window.innerHeight <= 520 && window.innerWidth >= 640;
    const outer = Math.max(200, Math.floor(land ? Math.min(window.innerHeight - 96, avail * 0.55) : Math.min(avail, 560, window.innerHeight - 318)));
    wrap.style.width = outer + 'px'; wrap.style.height = outer + 'px';
    size = Math.max(100, wrap.clientWidth);
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    render();
  }
  const toDraw = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * DRAW, ((e.clientY - r.top) / r.height) * DRAW]; };
  function down(e) {
    if (anim || pid !== null) return;
    if (e.button != null && e.button > 0) return;
    if (strokes.length >= 600) { toast('That\'s a lot of lines! Try Undo or Clear.'); return; }
    Sound.init();
    pid = e.pointerId;
    try { cv.setPointerCapture(pid); } catch (err) { /* ignore */ }
    const [x, y] = toDraw(e);
    cur = [x, y];
    strokes.push(cur);
    curM = null;
    if (mirror) { curM = [DRAW - x, y]; curM._pair = true; strokes.push(curM); }
    undo = [];
    $('#pad-hint').style.opacity = 0;
    render();
  }
  function move(e) {
    if (e.pointerId !== pid || !cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const [x, y] = toDraw(ev);
      const lx = cur[cur.length - 2], ly = cur[cur.length - 1];
      if (Math.hypot(x - lx, y - ly) >= 1.6) {
        cur.push(clamp(x, 0, DRAW), clamp(y, 0, DRAW));
        if (curM) curM.push(clamp(DRAW - x, 0, DRAW), clamp(y, 0, DRAW));
      }
    }
    const now = performance.now();
    if (now - lastSfx > 90) { lastSfx = now; Sound.sfx('scribble'); }
    render();
  }
  function up(e) {
    if (e.pointerId !== pid) return;
    pid = null;
    cur = null; curM = null;
    changed();
  }
  function changed() {
    const A = strokes.length ? analyzeDrawing(strokes) : null;
    preview = A ? A.contours : null;
    let ink = 0;
    for (const s of strokes) for (let i = 2; i < s.length; i += 2) ink += Math.hypot(s[i] - s[i - 2], s[i + 1] - s[i - 1]);
    $('#draw-done').disabled = !(A && ink > 40);
    $('#pad-hint').style.opacity = strokes.length ? 0 : 1;
    render();
  }
  function render() {
    if (!ctx) return;
    const k = (size * dpr) / DRAW;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = '#E4EAFB'; ctx.lineWidth = 1;
    const step = DRAW / 16;
    ctx.beginPath();
    for (let i = 1; i < 16; i++) { const p = Math.round(i * step * k) + 0.5; ctx.moveTo(p, 0); ctx.lineTo(p, cv.height); ctx.moveTo(0, p); ctx.lineTo(cv.width, p); }
    ctx.stroke();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (mirror) {
      ctx.save(); ctx.setLineDash([10, 10]); ctx.strokeStyle = '#B69CFF'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(DRAW / 2, 0); ctx.lineTo(DRAW / 2, DRAW); ctx.stroke(); ctx.restore();
    }
    if (preview) {
      ctx.fillStyle = COLORS[color].fill;
      ctx.beginPath();
      for (const pts of preview) { pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
      ctx.fill();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = INK_W; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of strokes) {
      ctx.beginPath();
      ctx.moveTo(s[0], s[1]);
      if (s.length === 2) ctx.lineTo(s[0] + 0.01, s[1]);
      for (let i = 2; i < s.length - 2; i += 2) ctx.quadraticCurveTo(s[i], s[i + 1], (s[i] + s[i + 2]) / 2, (s[i + 1] + s[i + 3]) / 2);
      if (s.length > 2) ctx.lineTo(s[s.length - 2], s[s.length - 1]);
      ctx.stroke();
    }
  }
  function cancelAnim() { if (anim) { cancelAnimationFrame(anim.raf); anim = null; } }
  function surprise() {
    if (anim) return;
    Sound.init();
    const target = randomDoodle((Math.random() * 1e9) >>> 0);
    strokes = []; undo = [];
    $('#pad-hint').style.opacity = 0;
    const total = target.reduce((n, s) => n + s.length / 2, 0);
    const perSec = Math.max(total / 0.9, 60);
    const t0 = performance.now();
    anim = {};
    const tick = (now) => {
      const n = Math.floor(((now - t0) / 1000) * perSec);
      strokes = [];
      let left = n;
      for (const s of target) {
        if (left <= 0) break;
        const take = Math.min(s.length / 2, left);
        strokes.push(s.slice(0, take * 2));
        left -= take;
      }
      if (Math.random() < 0.3) Sound.sfx('scribble');
      render();
      if (n < total) anim.raf = requestAnimationFrame(tick);
      else { anim = null; strokes = target.map((s) => s.slice()); changed(); }
    };
    anim.raf = requestAnimationFrame(tick);
  }
  function normalizeSmall(list) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of list) for (let i = 0; i < s.length; i += 2) { x0 = Math.min(x0, s[i]); x1 = Math.max(x1, s[i]); y0 = Math.min(y0, s[i + 1]); y1 = Math.max(y1, s[i + 1]); }
    const m = Math.max(x1 - x0, y1 - y0);
    if (!(m > 0) || m >= 150) return list;
    const k = 150 / m, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const ncx = clamp(cx, 80, DRAW - 80), ncy = clamp(cy, 80, DRAW - 80);
    return list.map((s) => s.map((v, i) => (i % 2 ? ncy + (v - cy) * k : ncx + (v - cx) * k)));
  }
  function finish() {
    if (anim || !strokes.length) return;
    const cleaned = cleanStrokes(normalizeSmall(strokes));
    const A = analyzeDrawing(cleaned);
    if (!A) { toast('Draw a little more first'); return; }
    const rec = newRecord(cleaned, { color, by: store.get('by', '') });
    close();
    if (onDone) onDone(rec);
  }
  return { open, close };
})();

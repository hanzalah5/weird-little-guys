/* =========================================================================
   Main — boot, loop, input routing
   ========================================================================= */
(function main() {
  const cv = $('#world');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, last = performance.now();

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    Yard.resize(W, H);
    Race.resize(W, H);
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (Race.active && UI.screen === 'race') {
      Race.update(dt);
      Race.draw(ctx);
    } else {
      Yard.update(dt);
      Yard.draw(ctx);
    }
    requestAnimationFrame(frame);
  }

  // input routing
  const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, pointerId: e.pointerId }; };
  cv.addEventListener('pointerdown', (e) => {
    Sound.init();
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (Race.active && UI.screen === 'race') { e.preventDefault(); Race.pointerDown(pt(e)); return; }
    cv.classList.add('dragging');
    Yard.pointerDown(pt(e));
  });
  cv.addEventListener('pointermove', (e) => { if (!(Race.active && UI.screen === 'race')) Yard.pointerMove(pt(e)); });
  const up = (e) => {
    cv.classList.remove('dragging');
    if (Race.active && UI.screen === 'race') { Race.pointerUp(pt(e)); return; }
    Yard.pointerUp(pt(e));
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('lostpointercapture', up);
  cv.addEventListener('pointerleave', () => Yard.pointerLeave());
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    if (Race.active && UI.screen === 'race' && $('#modal').hidden) { if (Race.key(e, true)) e.preventDefault(); }
  });
  document.addEventListener('keyup', (e) => { if (Race.active && UI.screen === 'race') Race.key(e, false); });
  const unlock = () => { Sound.init(); };
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, unlock, { capture: true });

  // boot
  hydrateIcons();
  UI.init();
  resize();
  Yard.sync(Zoo.list());
  UI.show('title');
  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { resize(); }).catch(() => {});
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });

  // incoming invite (standalone hosting: #g=... / #r=...)
  function checkHash() {
    const hsh = location.hash;
    if (!/^#[gr]=/.test(hsh)) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    const res = Codec.parse(hsh);
    if (res) setTimeout(() => UI.receive(res), 400);
    else setTimeout(() => toast('That invite link looks broken. Ask your friend to copy it again.', 3500), 400);
  }
  checkHash();
  window.addEventListener('hashchange', checkHash);
  // paste a code anywhere outside a text field
  document.addEventListener('paste', (e) => {
    if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
    const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
    const res = Codec.parse(text);
    if (res) { e.preventDefault(); UI.receive(res); }
  });

  // optional runtime capabilities, only present when an embedding host provides them
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then((d) => { UI.caps.downloads = d; }).catch(() => {});
    window.claude.use('sample').then((s) => { UI.caps.sample = s; }).catch(() => {});
  }
  window.__wlg = { Yard, Race, Zoo, UI, Sound, Codec, buildGuy, randomDoodle, newRecord };
})();

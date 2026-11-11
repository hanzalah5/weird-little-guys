/* =========================================================================
   UI — screens, naming sheet, cards, share/adopt, race menu, results, chat
   ========================================================================= */
const UI = (() => {
  let screen = 'title';
  let naming = null, cardActor = null, cardRaf = 0, modalClose = null;
  const caps = { downloads: null, sample: null };
  const RARITY_BG = { Common: '#FFE27A', Uncommon: '#8FE6BD', Rare: '#9CCBFF', Legendary: '#FFB0D6' };
  const STAT_NAMES = [['spd', 'SPEED'], ['hop', 'HOPS'], ['hft', 'HEFT'], ['chs', 'CHAOS']];

  const dashData = () => { const d = store.get('dash', {}); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; };
  function needGuys() {
    if (Zoo.count() > 0) return false;
    toast('Your yard is empty. Draw a guy first!', 3000);
    newGuy();
    return true;
  }
  function show(name) {
    screen = name;
    if (name !== 'stage') $('#namer').hidden = true;
    $('#title').hidden = name !== 'title';
    $('#yardtop').hidden = name !== 'yard';
    $('#yardbar').hidden = name !== 'yard';
    $('#hud').hidden = name !== 'race';
    $('#yard-menu').hidden = true;
    $('#yb-more').setAttribute('aria-expanded', 'false');
    if (name !== 'yard') $('#yard-hint').hidden = true;
    if (name === 'title' || name === 'yard' || name === 'stage') Yard.setMode(name);
    if (name !== 'race') { Race.stop(); Sound.music(Yard.dancing ? 'party' : Yard.isNight ? 'night' : name === 'title' ? 'title' : 'yard'); }
    $('#yt-count').textContent = Zoo.count() === 1 ? '1 guy' : Zoo.count() + ' guys';
    if (name === 'yard' && !store.get('hinted', false)) { store.set('hinted', true); setTimeout(() => { if (screen === 'yard') hint('Tap a guy to poke it. Drag to throw. Tap the grass to drop a snack.', 7000); }, 900); }
    $('#t-daynum').textContent = '#' + dashNumber();
  }
  function soundIcons() {
    for (const id of ['#yt-sound', '#hud-sound', '#t-sound']) {
      const b = $(id);
      b.innerHTML = icon(Sound.isMuted() ? 'mute' : 'sound');
      b.setAttribute('aria-label', Sound.isMuted() ? 'Turn sound on' : 'Turn sound off');
    }
  }

  /* ---------- hints ---------- */
  function hint(text, ms = 5200) {
    const el = $('#yard-hint');
    el.textContent = text; el.hidden = false; el.style.opacity = 1;
    clearTimeout(hint._t);
    hint._t = setTimeout(() => { el.style.opacity = 0; setTimeout(() => (el.hidden = true), 400); }, ms);
  }

  /* ---------- drawing -> birth -> naming ---------- */
  function newGuy() {
    Studio.open((rec) => {
      if (!rec) return;
      show('stage');
      const a = Yard.birth(rec, () => {});
      if (!a) { show('yard'); return; }
      setTimeout(() => openNamer(a, true), 1500);
    });
  }
  function openNamer(actor, isNew) {
    naming = { actor, isNew };
    const rec = actor.rec;
    $('#nm-title').textContent = isNew ? 'It\'s alive!' : 'Tweak ' + rec.name;
    $('#nm-name').value = rec.name;
    $('#nm-by').value = rec.by || store.get('by', '');
    const legs = $('#nm-legs'); legs.innerHTML = '';
    for (const n of LEG_OPTIONS) {
      const b = h('button', { type: 'button', 'aria-pressed': rec.legs === n ? 'true' : 'false', 'aria-label': n + ' legs', text: String(n) });
      b.addEventListener('click', () => {
        rec.legs = n; Yard.rebuild(actor, rec);
        for (const x of legs.children) x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      legs.append(b);
    }
    const arms = $('#nm-arms'); arms.innerHTML = '';
    for (const [v, label] of [[0, 'None'], [1, 'Two']]) {
      const b = h('button', { type: 'button', 'aria-pressed': (rec.arms ? 1 : 0) === v ? 'true' : 'false', text: label });
      b.addEventListener('click', () => {
        rec.arms = v; Yard.rebuild(actor, rec);
        for (const x of arms.children) x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      arms.append(b);
    }
    $('#namer').hidden = false;
    $('#nm-done').textContent = isNew ? 'Welcome to the yard' : 'Save';
  }
  function setupNamer() {
    $('#nm-roll').addEventListener('click', () => { $('#nm-name').value = suggestName(); Sound.sfx('tap'); if (naming) naming.actor.rec.name = $('#nm-name').value; });
    $('#nm-name').addEventListener('input', () => { if (naming) naming.actor.rec.name = $('#nm-name').value.slice(0, 18) || '…'; });
    $('#nm-face').addEventListener('click', () => {
      if (!naming) return;
      const rec = naming.actor.rec;
      rec.look = (rec.look + 1 + rand.int(0, 200)) % 256;
      Yard.rebuild(naming.actor, rec);
    });
    $('#nm-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!naming) return;
      const { actor, isNew } = naming;
      const rec = actor.rec;
      rec.name = ($('#nm-name').value || '').trim().slice(0, 18) || suggestName();
      rec.by = ($('#nm-by').value || '').trim().slice(0, 16);
      if (rec.by) store.set('by', rec.by);
      Zoo.add(rec);
      naming = null;
      actor.tagT = 4;
      $('#namer').hidden = true;
      $('#nm-name').blur();
      show('yard');
      Yard.select(actor);
      Sound.sfx('sparkle');
      if (isNew) {
        setTimeout(() => openCard(actor, true), 450);
        const first = rec.name.split(' ').filter((w) => w.length > 2 && !TXT.titles.includes(w))[0];
        const twin = first && Yard.actors.find((b) => b !== actor && b.rec.name.toLowerCase().split(' ').includes(first.toLowerCase()));
        if (twin) setTimeout(() => Yard.say(twin, rand.pick(['hey that\'s my name', 'two of us??', 'name twins!!', 'copycat'])), 1300);
      }
    });
  }

  /* ---------- card ---------- */
  function fillCard(actor) {
    const g = actor.g, rec = actor.rec;
    $('#card-el').style.setProperty('--card-bg', RARITY_BG[g.rarity]);
    $('#cd-rarity').textContent = (rec.crown ? '👑 ' : '') + g.rarity;
    $('#cd-no').textContent = 'No. ' + String(hashString(rec.id) % 10000).padStart(4, '0');
    $('#cd-name').textContent = rec.name;
    $('#cd-species').textContent = g.species;
    const st = $('#cd-stats'); st.innerHTML = '';
    for (const [k, label] of STAT_NAMES) {
      st.append(h('span', { text: label }), h('span', { class: 'bar', role: 'img', 'aria-label': label + ' ' + g.stats[k] + ' out of 10' }, h('i', { style: `width:${g.stats[k] * 10}%` })), h('span', { class: 'num', text: String(g.stats[k]) }));
    }
    const b = g.bio, bio = $('#cd-bio'); bio.innerHTML = '';
    const lines = [['Job', b.job], ['Likes', b.likes], ['Fears', b.fears], ['Talent', b.talent], ['Says', '"' + b.catchphrase + '"']];
    for (const [k, v] of lines) bio.append(h('li', null, h('b', { text: k + ': ' }), v));
    const L = rec.life || {};
    const bits = [];
    if (L.snacks) bits.push(L.snacks + (L.snacks === 1 ? ' snack' : ' snacks'));
    if (L.thrown) bits.push('thrown ' + L.thrown + (L.thrown === 1 ? ' time' : ' times'));
    if (L.races) bits.push(L.races + (L.races === 1 ? ' race' : ' races'));
    if (L.wins) bits.push(L.wins + (L.wins === 1 ? ' win' : ' wins'));
    if (L.pokes) bits.push('poked ' + L.pokes + 'x');
    if (bits.length) bio.append(h('li', null, h('b', { text: 'Life so far: ' }), bits.join(' · ')));
    $('#cd-born').textContent = 'Born ' + fmtDate(rec.born);
    $('#cd-by').textContent = rec.by ? 'drawn by ' + rec.by : '';
  }
  function openCard(actor, fresh) {
    if (naming && naming.actor === actor) { toast('Finish naming them first'); return; }
    cardActor = actor;
    fillCard(actor);
    resetCardActions();
    $('#card').hidden = false;
    Sound.sfx(fresh ? 'sparkle' : 'swish');
    const cv = $('#cd-portrait');
    const P = makePose();
    P.blinkT = 1;
    let last = performance.now(), tt = 0;
    cancelAnimationFrame(cardRaf);
    const loop = (now) => {
      if ($('#card').hidden || cardActor !== actor) return;
      const dt = clamp((now - last) / 1000, 0, 0.05); last = now; tt += dt;
      P.lookX = Math.sin(tt * 0.7) * 0.8; P.lookY = Math.sin(tt * 0.45) * 0.3;
      P.lift = Math.sin(tt * 2.2) * 2;
      if (actor.P.talkT > 0) { P.talkT = actor.P.talkT; }
      animatePose(actor.g, P, dt, tt);
      renderPortrait(cv, actor.g, { pose: P, t: tt, bg: '#F3F6FF', pad: 0.08 });
      cardRaf = requestAnimationFrame(loop);
    };
    cardRaf = requestAnimationFrame(loop);
    setTimeout(() => $('#cd-close').focus({ preventScroll: true }), 50);
  }
  function closeCard() { $('#card').hidden = true; cancelAnimationFrame(cardRaf); cardActor = null; }
  function resetCardActions() {
    const row = $('#cd-actions .confirm-row');
    if (row) row.remove();
    $('#cd-save').hidden = false;
  }
  function setupCard() {
    $('#cd-close').addEventListener('click', closeCard);
    $('#card').addEventListener('click', (e) => { if (e.target.id === 'card') closeCard(); });
    $('#cd-share').addEventListener('click', () => { if (cardActor) shareGuy(cardActor.rec); });
    $('#cd-race').addEventListener('click', () => { if (!cardActor) return; const id = cardActor.rec.id; closeCard(); raceMenu(id); });
    $('#cd-talk').addEventListener('click', () => { if (cardActor) openChat(cardActor); });
    $('#cd-save').addEventListener('click', () => { if (cardActor) saveCard(cardActor); });
    $('#cd-release').addEventListener('click', () => {
      if (!cardActor || $('#cd-actions .confirm-row')) return;
      const a = cardActor;
      const row = h('div', { class: 'confirm-row' },
        h('span', { text: 'Release ' + a.rec.name + ' into the wild?' }),
        h('span', { class: 'row' },
          h('button', { class: 'btn small', type: 'button', text: 'Keep', onclick: () => row.remove() }),
          h('button', { class: 'btn small hot', type: 'button', text: 'Release', onclick: () => {
            closeCard();
            Zoo.remove(a.rec.id);
            Yard.leave(a, () => { $('#yt-count').textContent = Zoo.count() + ' guys'; });
            toast(a.rec.name + ' set off on an adventure');
          } })));
      $('#cd-actions').append(row);
    });
  }

  /* ---------- card image ---------- */
  function cardImage(actor) {
    const g = actor.g, rec = actor.rec;
    const Wd = 720, Hd = 1000;
    const cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd;
    const c = cv.getContext('2d');
    c.fillStyle = RARITY_BG[g.rarity]; roundRectPath(c, 6, 6, Wd - 12, Hd - 12, 40); c.fill();
    c.lineWidth = 7; c.strokeStyle = INK; c.stroke();
    c.fillStyle = '#fff'; roundRectPath(c, 34, 34, Wd - 68, Hd - 68, 26); c.fill(); c.lineWidth = 5; c.stroke();
    c.font = `800 22px ${FONT}`; c.fillStyle = INK; c.textBaseline = 'middle';
    c.fillText((rec.crown ? '👑 ' : '') + g.rarity.toUpperCase(), 64, 76);
    c.textAlign = 'right'; c.fillStyle = '#575380';
    c.fillText('No. ' + String(hashString(rec.id) % 10000).padStart(4, '0'), Wd - 64, 76);
    // portrait
    const pc = document.createElement('canvas'); pc.width = 592; pc.height = 420;
    pc.style.width = '592px'; pc.style.height = '420px';
    Object.defineProperty(pc, 'clientWidth', { value: 592 }); Object.defineProperty(pc, 'clientHeight', { value: 420 });
    const P = makePose(); P.pupils = g.eyes.map(() => ({ x: 0.15, y: 0.1 })); P.blinkT = 99; setExpr(P, 'happy');
    P.expr = 'normal';
    renderPortrait(pc, g, { pose: P, t: 0.2, bg: '#F3F6FF', pad: 0.08 });
    c.save(); roundRectPath(c, 64, 104, 592, 420, 18); c.clip(); c.drawImage(pc, 0, 0, pc.width, pc.height, 64, 104, 592, 420); c.restore();
    roundRectPath(c, 64, 104, 592, 420, 18); c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
    c.textAlign = 'left'; c.fillStyle = INK; c.font = `800 54px ${FONT}`;
    c.fillText(rec.name, 64, 572, 592);
    c.font = `italic 500 26px ${FONT}`; c.fillStyle = '#575380';
    c.fillText(g.species, 64, 614, 592);
    let y = 660;
    for (const [k, label] of STAT_NAMES) {
      c.font = `800 20px ${FONT}`; c.fillStyle = INK; c.fillText(label, 64, y);
      roundRectPath(c, 190, y - 10, 400, 20, 9); c.fillStyle = '#F3F6FF'; c.fill(); c.lineWidth = 3; c.stroke();
      roundRectPath(c, 190, y - 10, 40 * g.stats[k], 20, 9); c.fillStyle = INK; c.fill();
      c.textAlign = 'right'; c.fillText(String(g.stats[k]), 656, y); c.textAlign = 'left';
      y += 36;
    }
    y += 8;
    c.font = `500 23px ${FONT}`;
    for (const [k, v] of [['Job', g.bio.job], ['Likes', g.bio.likes], ['Fears', g.bio.fears]]) {
      c.fillStyle = INK; c.font = `800 23px ${FONT}`; c.fillText(k + ':', 64, y);
      const kw = c.measureText(k + ': ').width;
      c.font = `500 23px ${FONT}`; c.fillText(v, 64 + kw, y, 592 - kw); y += 34;
    }
    c.font = `600 19px ${FONT}`; c.fillStyle = '#575380';
    c.fillText('Born ' + fmtDate(rec.born) + (rec.by ? ' · drawn by ' + rec.by : ''), 64, Hd - 64);
    c.textAlign = 'right'; c.fillText('Weird Little Guys', Wd - 64, Hd - 64);
    return cv;
  }
  async function saveCard(actor) {
    const cv = cardImage(actor);
    const fname = (actor.rec.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'guy').toLowerCase() + '-card.png';
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    if (caps.downloads && blob) {
      try { const r = await caps.downloads.save({ filename: fname, data: blob }); if (r && r.status === 'saved') toast('Card saved'); return; } catch (e) { /* fall back to the image view */ }
    }
    if (!inArtifactViewer && blob) {
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: fname });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Card saved');
      return;
    }
    const url = cv.toDataURL('image/png');
    modal((p) => {
      p.append(h('h2', { id: 'modal-h', text: actor.rec.name + '\'s card' }), h('p', { text: 'Press and hold the card (or right-click it) to save the image, then post it anywhere.' }), h('img', { class: 'imgsave', src: url, alt: actor.rec.name + '\'s trading card' }));
    });
  }

  /* ---------- group photo ---------- */
  function groupPhoto() {
    const list = Zoo.list().map((rec) => ({ rec, g: buildGuy(rec) })).filter((x) => x.g).slice(0, 36);
    const Wd = 1080, Hd = 1350;
    const cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd;
    const c = cv.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, Hd * 0.5);
    sky.addColorStop(0, '#63BFFF'); sky.addColorStop(1, '#D3F1FF');
    c.fillStyle = sky; c.fillRect(0, 0, Wd, Hd);
    c.fillStyle = '#8DD66B'; c.fillRect(0, Hd * 0.42, Wd, Hd);
    c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(0, Hd * 0.42); c.lineTo(Wd, Hd * 0.42); c.stroke();
    // sun
    c.save(); c.translate(Wd - 150, 150);
    c.lineWidth = 6; c.lineCap = 'round';
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 80, Math.sin(a) * 80); c.lineTo(Math.cos(a) * 104, Math.sin(a) * 104); c.stroke(); }
    c.fillStyle = '#FFD84A'; c.beginPath(); c.arc(0, 0, 64, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(-20, -8, 6, 0, TAU); c.arc(20, -8, 6, 0, TAU); c.fill();
    c.beginPath(); c.arc(0, 6, 22, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    c.restore();
    // title
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = `800 78px ${FONT}`; c.lineJoin = 'round'; c.lineWidth = 14; c.strokeStyle = INK;
    c.strokeText('Weird Little Guys', 60, 150); c.fillStyle = '#FFD84A'; c.fillText('Weird Little Guys', 60, 150);
    c.font = `700 34px ${FONT}`; c.fillStyle = INK;
    c.fillText('group photo · ' + new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }), 64, 205);
    // arrange in rows, back rows smaller
    const n = list.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.15)));
    const rows = Math.ceil(n / cols);
    const top = Hd * 0.3, bottom = Hd - 70;
    const rowH = (bottom - top) / rows;
    let idx = 0;
    for (let rw = 0; rw < rows; rw++) {
      const inRow = Math.min(cols, n - idx);
      const k = 0.78 + 0.22 * (rows === 1 ? 1 : rw / (rows - 1));
      const cellW = (Wd - 80) / cols;
      const gy = top + rowH * (rw + 1) - 34;
      for (let ci = 0; ci < inRow; ci++, idx++) {
        const { rec, g } = list[idx];
        const x = 40 + cellW * (ci + 0.5) + (cols - inRow) * cellW * 0.5;
        const s = Math.min((rowH * 0.92 * k) / (g.fullH + 20), (cellW * 0.96) / (g.halfW * 2 + 30));
        const P = makePose(); P.blinkT = 99; P.pupils = g.eyes.map(() => ({ x: 0, y: 0.05 }));
        if ((hashString(rec.id) % 3) === 0) { setExpr(P, 'happy'); }
        if (g.arms.length && (hashString(rec.id) % 2)) P.armMode = 'cheer';
        drawGuy(c, g, x, gy, s, P, 0.1, { crown: rec.crown });
        drawTag(c, rec.name, x, gy + 20, 0.92, Math.max(14, Math.min(24, cellW * 0.09)));
      }
    }
    c.lineWidth = 12; c.strokeStyle = INK; c.strokeRect(6, 6, Wd - 12, Hd - 12);
    return cv;
  }
  async function showGroupPhoto() {
    const cv = groupPhoto();
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    const url = cv.toDataURL('image/png');
    modal((p) => {
      p.append(h('h2', { id: 'modal-h', text: 'Say cheese!' }), h('p', { text: caps.downloads || !inArtifactViewer ? 'Everyone in your yard, in one picture.' : 'Press and hold the photo (or right-click it) to save it.' }),
        h('img', { class: 'imgsave', src: url, alt: 'Group photo of every guy in your yard' }));
      if (blob && (caps.downloads || !inArtifactViewer)) {
        p.append(h('button', { class: 'btn primary', type: 'button', 'data-icon': 'save', text: 'Save photo', onclick: async () => {
          if (caps.downloads) { try { const r = await caps.downloads.save({ filename: 'weird-little-guys-group-photo.png', data: blob }); if (r && r.status === 'saved') toast('Photo saved'); } catch (e) { toast('Press and hold the photo to save it'); } return; }
          const u2 = URL.createObjectURL(blob); const a = h('a', { href: u2, download: 'weird-little-guys-group-photo.png' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u2), 4000); toast('Photo saved');
        } }));
      }
    });
    Sound.sfx('sparkle');
  }

  /* ---------- generic modal ---------- */
  function modal(build, opts = {}) {
    const m = $('#modal'), p = $('#modal-panel');
    p.innerHTML = '';
    p.append(h('button', { class: 'iconbtn close', type: 'button', 'aria-label': 'Close', html: icon('close'), onclick: () => closeModal() }));
    build(p);
    hydrateIcons(p);
    m.hidden = false;
    modalClose = opts.onClose || null;
    setTimeout(() => {
      let f = p.querySelector('[data-autofocus]');
      if (!f) { f = p.querySelector('#modal-h'); if (f) f.setAttribute('tabindex', '-1'); }
      if (f) f.focus({ preventScroll: true });
    }, 60);
  }
  function closeModal() {
    if ($('#modal').hidden) return;
    $('#modal').hidden = true;
    const cb = modalClose; modalClose = null;
    if (cb) cb();
  }

  /* ---------- share / adopt ---------- */
  function shareGuy(rec) {
    const code = Codec.guyCode(rec);
    const link = Codec.shareLink(code);
    const msg = link
      ? `Meet ${rec.name}, my weird little guy. Adopt them into your yard: ${link}`
      : `Meet ${rec.name}, my weird little guy! Open Weird Little Guys, tap "Got a code from a friend?" and paste this:\n${code}`;
    modal((p) => {
      p.append(
        h('h2', { id: 'modal-h', text: 'Send ' + rec.name + ' to a friend' }),
        h('p', { text: link ? 'Anyone who opens the link gets ' + rec.name + ' in their yard, wobbles and all.' : 'Your friend pastes this code into "Got a code from a friend?" and ' + rec.name + ' walks into their yard.' }),
      );
      const box = h('textarea', { class: 'codebox', readonly: true, 'aria-label': 'Invite message', rows: 4 });
      box.value = msg;
      p.append(box);
      const row = h('div', { class: 'row' });
      row.append(h('button', { class: 'btn primary', type: 'button', 'data-icon': 'copy', 'data-autofocus': true, text: 'Copy invite', onclick: async () => { if (await copyText(msg, box)) toast('Copied. Paste it in your group chat'); else toast('Select the text and copy it'); } }));
      row.append(h('button', { class: 'btn', type: 'button', text: 'Copy code only', onclick: async () => { if (await copyText(code, box)) toast('Code copied'); } }));
      p.append(row);
    });
  }
  function adopt(prefill) {
    modal((p) => {
      p.append(h('h2', { id: 'modal-h', text: 'Adopt a friend\'s guy' }), h('p', { text: 'Paste the invite your friend sent you. Codes start with WLG.' }));
      const box = h('textarea', { class: 'codebox', 'aria-label': 'Invite code', placeholder: 'WLGg.…', rows: 4, 'data-autofocus': true });
      box.style.userSelect = 'text';
      if (prefill) box.value = prefill;
      const err = h('p', { class: 'small-print', role: 'alert' });
      p.append(box, err, h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', text: 'Adopt', onclick: () => {
        const res = Codec.parse(box.value);
        if (!res) { err.textContent = 'That code didn\'t work. Copy the whole message, including the part that starts with WLG.'; return; }
        closeModal();
        receive(res);
      } })));
    });
  }
  function receive(res) {
    const rec = res.rec;
    const exists = Zoo.get(rec.id);
    if (!exists) {
      rec.adopted = 1;
      Zoo.add(rec);
    }
    show('yard');
    let a = Yard.find(rec.id);
    if (!a) a = Yard.arrive(rec);
    if (a) Yard.focus(a);
    if (res.kind === 'race') {
      const g = res.ghost;
      modal((p) => {
        p.append(
          h('h2', { id: 'modal-h', text: rec.name + ' challenges you!' }),
          h('p', { text: `${rec.by ? rec.by + '\'s guy ' : ''}${rec.name} ran Daily Dash #${Math.max(1, g.day - EPOCH_DAY + 1)} in ${fmtTime(g.ms)}s. Race their ghost on the same track.` }),
          h('div', { class: 'row' }, h('button', { class: 'btn go big', type: 'button', 'data-icon': 'flag', text: 'Race the ghost', onclick: () => { closeModal(); raceMenu(null, { ghost: { rec, ...g } }); } })),
        );
      });
    } else {
      toast(exists ? rec.name + ' already lives here' : rec.name + ' moved into your yard!');
    }
  }

  /* ---------- about ---------- */
  function about() {
    modal((p) => {
      p.append(
        h('h2', { id: 'modal-h', text: 'How it works' }),
        h('p', { html: '<b>Draw anything.</b> The game traces your outline, fills it, finds room for eyes and a mouth, and grows legs and arms that walk with real foot-planting. The same drawing always becomes the same guy, with the same stats and personality.' }),
        h('p', { html: '<b>The yard</b> follows your clock: guys nap at night, chat, chase snacks and get dizzy when thrown. Tap the ground to drop a snack. Drag a guy to fling them.' }),
        h('p', { html: '<b>Daily Dash</b> is a new 60 m track every day, the same for everyone. Tap to jump, hold to clear red hurdles. Your run is saved as a tiny ghost you can send to friends.' }),
        h('p', { class: 'small-print', html: 'No images, no audio files, no libraries: every guy, sound and song is generated in your browser. Your yard is saved on this device.' }),
      );
    });
  }

  /* ---------- talk ---------- */
  function openChat(actor) {
    const g = actor.g, rec = actor.rec;
    const history = [];
    modal((p) => {
      p.append(h('h2', { id: 'modal-h', text: 'Talk to ' + rec.name }));
      const log = h('div', { class: 'chatlog', 'aria-live': 'polite' });
      const add = (who, text) => {
        const m = h('div', { class: 'msg ' + (who === 'me' ? 'me' : 'them') }, who === 'me' ? null : h('b', { text: rec.name }), h('span', { text }));
        log.append(m); log.scrollTop = log.scrollHeight;
        return m.lastChild;
      };
      add('them', rand.pick(['hi!! ' + g.bio.catchphrase, 'oh hello. it is me, ' + rec.name, 'you can ask me anything. i might know.', 'hello human. what\'s up']));
      const input = h('input', { class: 'text-in', id: 'chat-in', maxlength: 160, placeholder: 'Ask ' + rec.name.split(' ')[0] + ' anything', 'data-autofocus': true, autocomplete: 'off' });
      input.style.userSelect = 'text';
      const form = h('form', { class: 'inline' }, input, h('button', { class: 'btn primary small', type: 'submit', 'aria-label': 'Send', html: icon('send') }));
      const note = h('p', { class: 'small-print', text: caps.sample ? rec.name + ' answers with a little help from AI.' : '' });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        add('me', text);
        history.push({ role: 'user', content: text });
        const span = add('them', '…');
        let reply = null;
        if (caps.sample) {
          try {
            const sys = `You are ${rec.name}, a weird little hand-drawn creature (species: ${g.species}) living in a doodle yard in a game called Weird Little Guys. ` +
              `Your job: ${g.bio.job}. You like ${g.bio.likes}. You fear ${g.bio.fears}. Secret talent: ${g.bio.talent}. Catchphrase: "${g.bio.catchphrase}". Favorite snack: ${g.bio.snack}. Alignment: ${g.bio.alignment}. ` +
              `Stats out of 10: speed ${g.stats.spd}, hops ${g.stats.hop}, heft ${g.stats.hft}, chaos ${g.stats.chs}. You have ${rec.legs} legs${rec.arms ? ' and two noodle arms' : ' and no arms'}. ` +
              `Reply in character: one or two short sentences, all lowercase, funny, sweet and a little absurd, under 35 words. At most one emoji. Keep it wholesome. Never mention being an AI.`;
            const msgs = [{ role: 'user', content: sys + '\n\nThe human says: ' + history[0].content }];
            for (let i = 1; i < history.length; i++) msgs.push({ role: history[i].role, content: history[i].content });
            const res = await caps.sample(msgs, { modelTier: 'quick', cache: false, onText: ({ text: tx }) => { span.textContent = tx; } });
            reply = (res && res.text || '').trim();
          } catch (err) {
            if (err && err.code === 'not_granted') { caps.sample = null; note.textContent = ''; }
            reply = null;
          }
        }
        if (!reply) { await new Promise((r) => setTimeout(r, 500 + Math.random() * 500)); reply = localReply(g, text); }
        span.textContent = reply;
        history.push({ role: 'assistant', content: reply });
        const d = Sound.speak(g.voice, reply, { max: 8, force: true });
        actor.P.talkT = d;
        Yard.say(actor, reply.length > 26 ? reply.slice(0, 24) + '…' : reply, { voice: false });
      });
      p.append(log, form, note);
    });
  }

  /* ---------- race menu ---------- */
  function guyPicker(selectedId, onPick, opts = {}) {
    const wrap = h('div', { class: 'picker', role: 'group', 'aria-label': 'Choose a racer' });
    const list = Zoo.list();
    for (const rec of list) {
      const g = buildGuy(rec);
      if (!g) continue;
      const cv = h('canvas', { width: 80, height: 70, 'aria-hidden': 'true' });
      const b = h('button', { class: 'pick', type: 'button', 'aria-pressed': rec.id === selectedId ? 'true' : 'false', 'data-id': rec.id }, cv, h('span', { text: rec.name }));
      if (opts.badge) { const tg = opts.badge(rec.id); if (tg) b.append(h('span', { class: 'tag', text: tg })); }
      b.addEventListener('click', () => { Sound.sfx('tap'); onPick(rec.id, b); });
      wrap.append(b);
      requestAnimationFrame(() => renderPortrait(cv, g, { pad: 0.06, shadow: false }));
    }
    return wrap;
  }
  function raceMenu(preselect, opts = {}) {
    if (needGuys()) return;
    let racerId = preselect || store.get('racer', null);
    if (!Zoo.get(racerId)) racerId = (Zoo.mine()[0] || Zoo.list()[0] || {}).id;
    const today = localDayIndex();
    const dn = dashNumber();
    const best = (dashData()[today] || null);
    modal((p) => {
      if (opts.ghost) {
        const gh = opts.ghost;
        p.append(h('h2', { id: 'modal-h', text: 'Race ' + gh.rec.name + '\'s ghost' }), h('p', { text: 'Pick your racer. Same track, same rivals; their run replays exactly.' }));
      } else {
        p.append(h('h2', { id: 'modal-h', text: 'Race!' }), h('p', { text: 'Tap to jump. Hold to jump higher over red hurdles. Mud slows you, green arrows boost you.' }));
      }
      p.append(h('b', { text: 'Your racer', style: 'font-size:.9rem' }));
      const picker = guyPicker(racerId, (id, btn) => { racerId = id; for (const x of picker.children) x.setAttribute('aria-pressed', x === btn ? 'true' : 'false'); });
      p.append(picker);
      const go = (mode) => { store.set('racer', racerId); closeModal(); startRace(mode, racerId, opts); };
      if (opts.ghost) {
        p.append(h('button', { class: 'btn go big', type: 'button', 'data-icon': 'flag', text: 'Start', onclick: () => go('daily') }));
        return;
      }
      const modes = h('div', { class: 'modes' });
      modes.append(
        h('button', { class: 'mode daily', type: 'button', onclick: () => go('daily') }, h('span', { class: 'ico', html: icon('flag') }), h('b', { text: 'Daily Dash #' + dn }), h('span', { text: best ? 'Your best today: ' + fmtTime(best.ms) + 's. Same track for everyone.' : 'Today\'s track is the same for everyone. Beat your friends.' })),
        h('button', { class: 'mode', type: 'button', onclick: () => go('quick') }, h('span', { class: 'ico', html: icon('dice') }), h('b', { text: 'Quick race' }), h('span', { text: 'A random track against guys from your yard.' })),
        h('button', { class: 'mode party', type: 'button', onclick: () => { closeModal(); partyMenu(); } }, h('span', { class: 'ico', html: icon('party') }), h('b', { text: 'Party race' }), h('span', { text: '2 to 4 players on one screen. Everyone taps their own lane.' })),
      );
      p.append(modes);
    });
  }
  function partyMenu() {
    if (needGuys()) return;
    let n = 2;
    const picks = [];
    const list = Zoo.list();
    for (let i = 0; i < 4; i++) picks.push((list[i % list.length] || {}).id);
    let slot = 0;
    modal((p) => {
      p.append(h('h2', { id: 'modal-h', text: 'Party race' }), h('p', { text: 'Pass the phone around, or crowd one laptop. Each player picks a guy, then taps their own lane to jump.' }));
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Number of players' });
      const players = h('div', { class: 'players' });
      let picker;
      const renderPlayers = () => {
        players.innerHTML = '';
        for (let i = 0; i < n; i++) {
          const rec = Zoo.get(picks[i]);
          const b = h('button', { class: 'btn small' + (i === slot ? ' primary' : ''), type: 'button', text: 'P' + (i + 1) + ': ' + (rec ? rec.name : '—') + (i === slot ? '  (picking)' : ''), onclick: () => { slot = i; renderPlayers(); syncPicker(); } });
          players.append(b);
        }
      };
      const syncPicker = () => { for (const x of picker.children) x.setAttribute('aria-pressed', x.dataset.id === picks[slot] ? 'true' : 'false'); };
      for (const k of [2, 3, 4]) {
        const b = h('button', { type: 'button', 'aria-pressed': k === n ? 'true' : 'false', text: k + ' players' });
        b.addEventListener('click', () => { n = k; slot = Math.min(slot, n - 1); for (const x of seg.children) x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); renderPlayers(); });
        seg.append(b);
      }
      picker = guyPicker(picks[0], (id) => { picks[slot] = id; slot = (slot + 1) % n; renderPlayers(); syncPicker(); });
      renderPlayers();
      p.append(seg, players, picker, h('p', { class: 'small-print', text: 'Keyboard: P1 = A, P2 = L, P3 = V, P4 = ↑' }),
        h('button', { class: 'btn go big', type: 'button', 'data-icon': 'flag', text: 'Start the party', onclick: () => { closeModal(); startRace('party', null, { picks: picks.slice(0, n) }); } }));
    });
  }

  function startRace(mode, racerId, opts = {}) {
    if (needGuys()) return;
    if (Yard.dancing) Yard.endDance();
    const me = Zoo.get(racerId) || Zoo.list()[0];
    let day = localDayIndex(), seed;
    const racers = [];
    if (mode === 'party') {
      seed = (Math.random() * 1e9) >>> 0;
      opts.picks.forEach((id, i) => racers.push({ rec: Zoo.get(id) || me, kind: 'human', player: i }));
    } else {
      if (mode === 'daily') {
        if (opts.ghost) day = opts.ghost.day;
        seed = hashInts(day, 777, 1);
        const order = ['local-beans', 'local-gloria', 'local-wobble', 'local-steve'];
        let rivals = order.map((id) => Zoo.locals().find((r) => r.id === id)).filter((r) => r && r.id !== me.id).slice(0, 3);
        rivals.sort((a, b) => (RIVAL_SKILL[a.id] || 0) - (RIVAL_SKILL[b.id] || 0));
        if (opts.ghost) rivals.shift();
        for (const r of rivals) racers.push({ rec: r, kind: 'ai', skill: RIVAL_SKILL[r.id] || 0.6 });
        if (opts.ghost) racers.push({ rec: opts.ghost.rec, kind: 'ghost', ghost: opts.ghost, label: 'Ghost · ' + opts.ghost.rec.name });
        const pb = dashData()[day];
        const pbRec = pb && pb.inputs && pb.inputs.length ? Zoo.get(pb.id) : null;
        if (pbRec) racers.push({ rec: pbRec, kind: 'pb', ghost: { inputs: pb.inputs } });
      } else {
        seed = (Math.random() * 1e9) >>> 0;
        const pool = Zoo.list().filter((r) => r.id !== me.id);
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        for (const r of pool.slice(0, 3)) racers.push({ rec: r, kind: 'ai', skill: rand.range(0.35, 0.8) });
      }
      racers.push({ rec: me, kind: 'human', player: 0 });
    }
    show('race');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    Race.start({ mode, seed, day, racers }, (res) => setTimeout(() => results(res, opts), 300));
  }

  function results(res, opts) {
    const mode = res.mode;
    const humansR = res.results.filter((r) => r.kind === 'human');
    const me = humansR[0];
    let pb = false, crown = false;
    for (const hr of humansR) { const zr = Zoo.get(hr.rec.id); Zoo.bump(zr, 'races'); if (hr.place === 1) Zoo.bump(zr, 'wins'); }
    if (mode === 'daily' && me && !me.dnf) {
      const all = dashData();
      const prev = all[res.day];
      if (!prev || me.timeMs < prev.ms) { all[res.day] = { ms: me.timeMs, inputs: me.inputs, id: me.rec.id, place: me.place }; store.set('dash', all); pb = !!prev; }
      if (me.place === 1 && !me.rec.crown) {
        const rec = Zoo.get(me.rec.id);
        if (rec) { rec.crown = 1; Zoo.update(rec); crown = true; Yard.sync(Zoo.list()); }
      }
    }
    const emoji = (log) => res.track.obs.map((o, i) => {
      const v = log[i];
      if (o.t === 'boost') return v === 'boost' ? '⚡' : '';
      if (o.t === 'spring') return v === 'spring' ? '🍄' : '';
      return v === 'hit' ? '🟥' : '🟩';
    }).join('');
    const medal = (pl) => (pl === 1 ? '🥇' : pl === 2 ? '🥈' : pl === 3 ? '🥉' : '🏃');
    modal((p) => {
      if (mode === 'party') {
        const win = humansR[0];
        p.append(h('h2', { id: 'modal-h', text: 'P' + (win.player + 1) + ' wins!' }), h('p', { text: win.rec.name + ' crossed first in ' + fmtTime(win.timeMs) + 's.' }));
      } else {
        p.append(h('h2', { id: 'modal-h', text: me.place === 1 ? 'You won!' : ordinal(me.place) + ' place' }));
        const tl = h('div', { class: 'big-time', text: fmtTime(me.timeMs) + 's' });
        if (pb) tl.append(h('span', { class: 'pb', text: 'new best' }));
        p.append(tl);
        if (crown) p.append(h('p', { text: '👑 ' + me.rec.name + ' earned a crown. It shows up in the yard.' }));
      }
      const list = h('div', { role: 'list' });
      for (const r of res.results) {
        const who = r.kind === 'human' ? (mode === 'party' ? 'P' + (r.player + 1) + ' · ' + r.rec.name : r.rec.name + ' (you)') : (r.label || r.rec.name);
        list.append(h('div', { class: 'podium-line' + (r === me && mode !== 'party' ? ' me' : ''), role: 'listitem' }, h('span', { class: 'place', text: medal(r.place) }), h('span', { text: who }), h('span', { class: 't', text: r.dnf ? 'DNF' : fmtTime(r.timeMs) + 's' })));
      }
      p.append(list);
      let shareText = '';
      if (mode === 'daily' && me) {
        const dn = Math.max(1, res.day - EPOCH_DAY + 1);
        shareText = `Weird Little Guys · Daily Dash #${dn}\n${medal(me.place)} ${me.rec.name} — ${fmtTime(me.timeMs)}s\n${emoji(me.log)}`;
        const link = !inArtifactViewer && location.protocol !== 'file:' ? location.href.split('#')[0] : '';
        if (link) shareText += '\n' + link;
        p.append(h('pre', { class: 'result-share', text: shareText }));
      }
      const row = h('div', { class: 'row' });
      if (shareText) row.append(h('button', { class: 'btn primary', type: 'button', 'data-icon': 'copy', text: 'Copy result', onclick: async () => { if (await copyText(shareText, p.querySelector('.result-share'))) toast('Copied. Brag responsibly'); else toast('Select the result text and copy it'); } }));
      if (mode === 'daily' && me && !me.dnf) row.append(h('button', { class: 'btn blue', type: 'button', 'data-icon': 'mail', text: 'Challenge a friend', onclick: () => challenge(me, res.day) }));
      p.append(row);
      p.append(h('div', { class: 'row' },
        h('button', { class: 'btn go', type: 'button', 'data-icon': 'flag', text: 'Race again', onclick: () => { closeModal(); if (mode === 'party') startRace('party', null, opts); else startRace(mode, me.rec.id, opts); } }),
        h('button', { class: 'btn', type: 'button', 'data-icon': 'house', text: 'Yard', onclick: () => { closeModal(); show('yard'); } })));
    }, { onClose: () => { if (screen === 'race' && !Race.active) show('yard'); else if (screen === 'race' && Race.phase === 'done') show('yard'); } });
  }
  function challenge(me, day) {
    const code = Codec.raceCode(me.rec, { day, ms: me.timeMs, inputs: me.inputs });
    const link = Codec.shareLink(code);
    const msg = link
      ? `I ran Daily Dash #${Math.max(1, day - EPOCH_DAY + 1)} in ${fmtTime(me.timeMs)}s with ${me.rec.name}. Race my ghost: ${link}`
      : `I ran Daily Dash #${Math.max(1, day - EPOCH_DAY + 1)} in ${fmtTime(me.timeMs)}s with ${me.rec.name}. Open Weird Little Guys, tap "Got a code from a friend?" and paste this to race my ghost:\n${code}`;
    modal((p) => {
      p.append(h('h2', { id: 'modal-h', text: 'Challenge a friend' }), h('p', { text: 'Your friend races your exact run as a ghost, on the same track. ' + me.rec.name + ' moves into their yard too.' }));
      const box = h('textarea', { class: 'codebox', readonly: true, rows: 4, 'aria-label': 'Challenge message' });
      box.value = msg;
      p.append(box, h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', 'data-icon': 'copy', 'data-autofocus': true, text: 'Copy challenge', onclick: async () => { if (await copyText(msg, box)) toast('Copied. Now send it'); } })));
    }, { onClose: () => show('yard') });
  }

  /* ---------- wiring ---------- */
  function init() {
    setupNamer();
    setupCard();
    $('#t-draw').addEventListener('click', newGuy);
    $('#t-yard').addEventListener('click', () => show('yard'));
    $('#t-dash').addEventListener('click', () => { show('yard'); raceMenu(); });
    $('#t-party').addEventListener('click', () => { show('yard'); partyMenu(); });
    $('#t-adopt').addEventListener('click', () => adopt());
    $('#t-about').addEventListener('click', about);
    $('#yt-home').addEventListener('click', () => show('title'));
    $('#yb-draw').addEventListener('click', newGuy);
    $('#yb-snack').addEventListener('click', () => { Yard.snackShower(); hint('Tip: tap anywhere on the grass to drop a snack right there.', 3500); });
    $('#yb-race').addEventListener('click', () => raceMenu());
    const menu = $('#yard-menu');
    $('#yb-more').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; $('#yb-more').setAttribute('aria-expanded', String(!menu.hidden)); });
    document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target.closest('#yb-more') == null) { menu.hidden = true; $('#yb-more').setAttribute('aria-expanded', 'false'); } });
    const mi = (id, fn) => $(id).addEventListener('click', () => { menu.hidden = true; $('#yb-more').setAttribute('aria-expanded', 'false'); fn(); });
    mi('#ym-adopt', () => adopt());
    mi('#ym-party', partyMenu);
    mi('#ym-photo', showGroupPhoto);
    mi('#ym-dance', () => { if (Yard.dancing) Yard.endDance(); else { Yard.startDance(); toast('Dance party!'); } });
    mi('#ym-about', about);
    mi('#ym-home', () => show('title'));
    for (const id of ['#yt-sound', '#hud-sound', '#t-sound']) $(id).addEventListener('click', () => { Sound.setMuted(!Sound.isMuted()); soundIcons(); if (!Sound.isMuted()) Sound.music(screen === 'race' ? 'race' : Yard.isNight ? 'night' : 'yard'); });
    $('#hud-back').addEventListener('click', () => { Race.stop(); show('yard'); });
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#modal').hidden) closeModal();
      else if (!$('#card').hidden) closeCard();
    });
    soundIcons();
    Yard.hooks.openCard = (a) => openCard(a);
  }
  return { init, show, receive, adopt, openCard, caps, get screen() { return screen; }, raceMenu, hint };
})();

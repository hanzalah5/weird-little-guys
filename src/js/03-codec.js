/* =========================================================================
   Codec — guys and race ghosts packed into short copy-pasteable codes.
   Format: "WLG" + kind + "." + base64(bytes)  (kind: g = guy, r = race ghost)
   ========================================================================= */
const Codec = (() => {
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const enc = new TextEncoder(), dec = new TextDecoder();

  class W {
    constructor() { this.b = []; }
    u8(v) { this.b.push(v & 255); }
    vu(v) { v = Math.max(0, Math.floor(v)); while (v >= 128) { this.b.push((v & 127) | 128); v = Math.floor(v / 128); } this.b.push(v); }
    vs(v) { this.vu(v < 0 ? -2 * v - 1 : 2 * v); }
    u32(v) { this.u8(v); this.u8(v >>> 8); this.u8(v >>> 16); this.u8(v >>> 24); }
    str(s) { const x = enc.encode(s || '').slice(0, 60); this.vu(x.length); for (const c of x) this.b.push(c); }
    bytes() { return new Uint8Array(this.b); }
  }
  class R {
    constructor(b) { this.b = b; this.p = 0; }
    u8() { if (this.p >= this.b.length) throw new Error('eof'); return this.b[this.p++]; }
    vu() { let v = 0, m = 1, c; do { c = this.u8(); v += (c & 127) * m; m *= 128; } while (c & 128 && m < 2 ** 49); return v; }
    vs() { const v = this.vu(); return v & 1 ? -(v + 1) / 2 : v / 2; }
    u32() { return (this.u8() | (this.u8() << 8) | (this.u8() << 16) | (this.u8() << 24)) >>> 0; }
    str() { const n = this.vu(); if (n > 200) throw new Error('bad str'); const s = this.b.slice(this.p, this.p + n); this.p += n; return dec.decode(s); }
  }

  function writeGuy(w, rec) {
    w.u8(1); // version
    w.u8(((LEG_OPTIONS.indexOf(rec.legs) & 7) << 5) | ((rec.arms ? 1 : 0) << 4) | (rec.color & 15));
    w.u8(rec.look);
    w.u32(rec.seed);
    w.vu(rec.born);
    w.str(rec.name);
    w.str(rec.by);
    w.vu(rec.strokes.length);
    for (const s of rec.strokes) {
      const n = s.length / 2;
      w.vu(n);
      let px = 0, py = 0;
      for (let i = 0; i < s.length; i += 2) {
        const qx = Math.round(s[i] / 2), qy = Math.round(s[i + 1] / 2);
        if (i === 0) { w.vu(qx); w.vu(qy); } else { w.vs(qx - px); w.vs(qy - py); }
        px = qx; py = qy;
      }
    }
  }
  function readGuy(r) {
    const ver = r.u8();
    if (ver !== 1) throw new Error('version');
    const f = r.u8();
    const rec = { legs: LEG_OPTIONS[(f >> 5) & 7] ?? 2, arms: (f >> 4) & 1, color: clamp(f & 15, 0, COLORS.length - 1) };
    rec.look = r.u8();
    rec.seed = r.u32();
    rec.born = r.vu();
    rec.name = r.str().slice(0, 24) || 'Guy';
    rec.by = r.str().slice(0, 20);
    const ns = r.vu();
    if (ns > 2000) throw new Error('too many strokes');
    rec.strokes = [];
    for (let k = 0; k < ns; k++) {
      const n = r.vu();
      if (n > 5000) throw new Error('too many points');
      const s = [];
      let x = 0, y = 0;
      for (let i = 0; i < n; i++) {
        if (i === 0) { x = r.vu(); y = r.vu(); } else { x += r.vs(); y += r.vs(); }
        s.push(clamp(x * 2, 0, DRAW), clamp(y * 2, 0, DRAW));
      }
      rec.strokes.push(s);
    }
    rec.id = 'g' + (hashString(rec.strokes.map((s) => s.join(',')).join('|') + rec.seed).toString(36));
    return rec;
  }

  function b64(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
      const n = (a << 16) | ((b || 0) << 8) | (c || 0);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '');
    }
    return out;
  }
  function unb64(str) {
    const clean = str.replace(/[^A-Za-z0-9+/]/g, '');
    const out = [];
    for (let i = 0; i < clean.length; i += 4) {
      const v = [0, 1, 2, 3].map((k) => (i + k < clean.length ? B64.indexOf(clean[i + k]) : -1));
      const n = (v[0] << 18) | (v[1] << 12) | ((v[2] < 0 ? 0 : v[2]) << 6) | (v[3] < 0 ? 0 : v[3]);
      out.push((n >> 16) & 255);
      if (v[2] >= 0) out.push((n >> 8) & 255);
      if (v[3] >= 0) out.push(n & 255);
    }
    return new Uint8Array(out);
  }

  function guyCode(rec) { const w = new W(); writeGuy(w, rec); return 'WLGg.' + b64(w.bytes()); }
  function raceCode(rec, ghost) {
    const w = new W();
    writeGuy(w, rec);
    w.vu(ghost.day); w.vu(ghost.ms); w.vu(ghost.inputs.length / 2);
    let prev = 0;
    for (let i = 0; i < ghost.inputs.length; i += 2) { w.vu(ghost.inputs[i] - prev); w.vu(ghost.inputs[i + 1]); prev = ghost.inputs[i]; }
    return 'WLGr.' + b64(w.bytes());
  }
  /* accepts a bare code, a link with #g=/#r=, or text that contains a code */
  function parse(text) {
    if (!text) return null;
    const t = String(text).replace(/\s+/g, '');
    try {
      let m = t.match(/WLG([gr])\.([A-Za-z0-9+/]+)/);
      if (!m) { const h = t.match(/#([gr])=([A-Za-z0-9+/%]+)/); if (h) m = [0, h[1], decodeURIComponent(h[2])]; }
      if (!m) return null;
      const r = new R(unb64(m[2]));
      const rec = readGuy(r);
      if (!rec.strokes.length || !buildGuy(rec)) return null;
      if (m[1] === 'g') return { kind: 'guy', rec };
      const day = r.vu(), ms = r.vu(), n = r.vu();
      if (n > 3000) return null;
      const inputs = [];
      let prev = 0;
      for (let i = 0; i < n; i++) { const f = prev + r.vu(); inputs.push(f, r.vu()); prev = f; }
      return { kind: 'race', rec, ghost: { day, ms, inputs } };
    } catch (e) { return null; }
  }
  function shareLink(code) {
    if (inArtifactViewer || location.protocol === 'file:') return null;
    const kind = code[3], body = code.slice(5);
    return location.href.split('#')[0] + '#' + kind + '=' + body;
  }
  return { guyCode, raceCode, parse, shareLink };
})();

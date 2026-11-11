'use strict';
/* =========================================================================
   Weird Little Guys — utilities
   ========================================================================= */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));
const remap = (v, a, b, c, d) => lerp(c, d, clamp(invLerp(a, b, v), 0, 1));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutElastic = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1);
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const sign = (v) => (v < 0 ? -1 : 1);

/* ---------- deterministic randomness ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const next = mulberry32(seed);
  const r = () => next();
  r.range = (a, b) => a + (b - a) * next();
  r.int = (a, b) => a + Math.floor(next() * (b - a + 1));
  r.pick = (arr) => arr[Math.floor(next() * arr.length)];
  r.chance = (p) => next() < p;
  r.sign = () => (next() < 0.5 ? -1 : 1);
  return r;
}
const rand = makeRng((Math.random() * 4294967296) >>> 0); // non-deterministic helpers for visuals

function hashString(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}
function hashInts(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
const hash01 = (a, b, c) => hashInts(a, b, c) / 4294967296;
function noise1(x, seed) {
  const i = Math.floor(x), f = x - i;
  return lerp(hash01(i, seed, 7), hash01(i + 1, seed, 7), smooth(f)) * 2 - 1;
}

/* ---------- DOM helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return e;
}

const uid = () => {
  const a = new Uint32Array(2);
  (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(a) : (a[0] = Math.random() * 4e9, a[1] = Math.random() * 4e9);
  return (a[0].toString(36) + a[1].toString(36)).slice(0, 10);
};

/* ---------- dates ---------- */
const EPOCH_DAY = Date.UTC(2026, 10, 11) / 86400000; // Daily Dash #1 = 2026-11-11
function localDayIndex(d = new Date()) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
function dashNumber(d = new Date()) { return Math.max(1, localDayIndex(d) - EPOCH_DAY + 1); }
function dayKey(dayIdx) { const d = new Date(dayIdx * 86400000); return d.toISOString().slice(0, 10); }
function fmtDate(dayIdx) {
  const d = new Date(dayIdx * 86400000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
const fmtTime = (ms) => (ms / 1000).toFixed(2);
const ordinal = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

/* ---------- storage (never trusted to exist) ---------- */
const store = {
  get(key, def) {
    try { const v = localStorage.getItem('wlg.' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('wlg.' + key, JSON.stringify(val)); return true; } catch (e) { return false; }
  },
};

const reducedMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const inArtifactViewer = (() => { try { return window.parent !== window && !!window.claude; } catch (e) { return true; } })();

function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* not supported */ } }

function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

async function copyText(text, fallbackEl) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* fall through to the legacy path */ }
  let ok = false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;-webkit-user-select:text;user-select:text';
  document.body.append(ta);
  try { ta.focus({ preventScroll: true }); ta.select(); ta.setSelectionRange(0, text.length); ok = !!(document.execCommand && document.execCommand('copy')); } catch (e) { ok = false; }
  ta.remove();
  if (!ok && fallbackEl) { try { fallbackEl.focus(); fallbackEl.select && fallbackEl.select(); fallbackEl.setSelectionRange && fallbackEl.setSelectionRange(0, fallbackEl.value.length); } catch (e) { /* ignore */ } }
  return ok;
}

/* ---------- icons (hand-drawn style strokes) ---------- */
const ICONS = {
  pencil: '<path d="M4 20l1.2-4.6L16.5 4.1a2 2 0 0 1 2.9 0l.6.6a2 2 0 0 1 0 2.9L8.6 18.9z"/><path d="M14.5 6.2l3.3 3.3"/><path d="M4 20l4.4-1.1"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4.5c3-1.6 5.4 1.4 8.2 0s4.3-.6 5.8.3v8.6c-1.5-.9-3-1.7-5.8-.3s-5.2-1.6-8.2 0"/><path d="M9 4.6v8.6M13.2 4.4v8.6" opacity=".45"/>',
  party: '<path d="M4 20l4.5-12 7.5 7.5z"/><path d="M14 3.5c.2 1.6-.5 2.6-2 3"/><path d="M19.5 9c-1.5-.3-2.6.2-3.3 1.5"/><path d="M17 4.5l.01 0M20 6.5l.01 0M15.5 7.5l.01 0" stroke-width="3"/>',
  house: '<path d="M3.5 11.2L12 4l8.5 7.2"/><path d="M5.8 9.5V20h12.4V9.5"/><path d="M10 20v-5.2h4V20"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9c1.3 1.6 1.3 4.4 0 6"/><path d="M18.2 6.5c2.6 3 2.6 8 0 11"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  close: '<path d="M6 6.3l11.6 11.4M17.8 6.1L6.2 17.8"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4" transform="rotate(-6 12 12)"/><path d="M9 9l.01 0M15 15l.01 0M15 9l.01 0M9 15l.01 0M12 12l.01 0" stroke-width="3"/>',
  undo: '<path d="M9 14L4.5 9.5 9 5"/><path d="M5 9.5h9a5.5 5.5 0 0 1 0 11h-3"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10.5 11v5.5M13.5 11v5.5"/>',
  spark: '<path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z"/><path d="M19 16.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z"/>',
  donut: '<ellipse cx="12" cy="12.5" rx="8.5" ry="7.5"/><ellipse cx="12" cy="12" rx="2.6" ry="2"/><path d="M6 10.5c1-.4 1.6.6 2.6.1M15.5 8.5c.8.5 1.6 0 2.2.6M9.5 16.5c.9-.4 1.6.4 2.4 0M15 15.5l1.5.8" />',
  menu: '<path d="M5 7.2h14M5 12.2h14M5 17.2h14"/>',
  mail: '<rect x="3.5" y="6" width="17" height="12.5" rx="2"/><path d="M4 7l8 6.2L20 7"/>',
  note: '<path d="M9 18.5V6.5l10-2.2v12"/><ellipse cx="6.8" cy="18.6" rx="2.6" ry="2.1"/><ellipse cx="16.8" cy="16.4" rx="2.6" ry="2.1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.6l.01 0" stroke-width="3"/>',
  chat: '<path d="M4.5 6.5c0-1.4 1.1-2.5 2.5-2.5h10c1.4 0 2.5 1.1 2.5 2.5v7c0 1.4-1.1 2.5-2.5 2.5H11l-4.5 4v-4h0c-1.1 0-2-.9-2-2z"/><path d="M8.5 10l.01 0M12 10l.01 0M15.5 10l.01 0" stroke-width="2.8"/>',
  save: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 16.5v3h15v-3"/>',
  door: '<path d="M6 20V4.5h9.5V20"/><path d="M3.5 20h17"/><path d="M12.5 12.2l.01 0" stroke-width="3"/>',
  check: '<path d="M4.5 12.5l5 5L19.5 6.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 5.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9.5A1.5 1.5 0 0 0 5 16h.5"/>',
  play: '<path d="M7 4.8v14.4L19 12z"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7.3l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7-.3l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  send: '<path d="M4 12L20 4.5 15 20l-3.2-6.5z"/><path d="M11.8 13.5L20 4.5"/>',
  mirror: '<path d="M12 3v18" stroke-dasharray="2.2 2.6"/><path d="M9 7.5C6 8 4 10 4 12.5S6 17 9 16.5z"/><path d="M15 7.5c3 .5 5 2.5 5 5s-2 4.5-5 4z"/>',
  camera: '<path d="M4 8.5c0-1.1.9-2 2-2h2l1.5-2h5l1.5 2h2c1.1 0 2 .9 2 2V18c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2z"/><circle cx="12" cy="13" r="3.6"/>',
};
function icon(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}
function hydrateIcons(root = document) {
  for (const e of $$('[data-icon]', root)) {
    if (e.dataset.iconDone) continue;
    e.dataset.iconDone = '1';
    e.insertAdjacentHTML('afterbegin', icon(e.dataset.icon));
  }
}

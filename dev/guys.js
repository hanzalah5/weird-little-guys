// Visual harness: grid of random guys + edge cases + codec round trip
document.getElementById('title').hidden = true;
const cv = document.getElementById('world');
const dpr = 1;
cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
const ctx = cv.getContext('2d');
ctx.fillStyle = '#EAF6FF'; ctx.fillRect(0, 0, cv.width, cv.height);
const cases = [];
const legsCycle = [2, 4, 0, 6, 2, 8, 4, 2, 0, 2, 6, 4];
for (let i = 0; i < 12; i++) {
  const strokes = randomDoodle(1000 + i * 7919);
  cases.push(newRecord(strokes, { seed: 4242 + i, legs: legsCycle[i], arms: i % 3 ? 1 : 0, color: i % 10, look: i * 17 }));
}
// stick figure
cases.push(newRecord(cleanStrokes([[250,100,250,300],[250,180,190,240],[250,180,310,240],[250,300,200,400],[250,300,300,400],[220,60,250,40,280,60,290,90,270,120,250,125,230,120,212,95,220,60]]), { seed: 9, legs: 2, arms: 1, color: 4 }));
// open squiggle (no closed shape)
cases.push(newRecord(cleanStrokes([[100,300,150,250,200,300,250,250,300,300,350,250,400,300]]), { seed: 10, legs: 4, arms: 0, color: 2 }));
// tiny dot-ish drawing
cases.push(newRecord(cleanStrokes([[240,240,260,240,265,255,255,268,240,265,236,250,240,240]]), { seed: 11, legs: 2, arms: 1, color: 1 }));
// huge drawing
cases.push(newRecord(randomDoodle(77, 'wide').map(s => s.map(v => clamp((v - 250) * 1.5 + 250, 0, 500))), { seed: 12, legs: 6, arms: 1, color: 7 }));
const cols = 4, cw = innerWidth / cols, ch = innerHeight / Math.ceil(cases.length / cols);
const report = [];
cases.forEach((rec, i) => {
  // codec round trip
  const code = Codec.guyCode(rec);
  const back = Codec.parse(code);
  const ok = back && JSON.stringify(back.rec.strokes) === JSON.stringify(rec.strokes) && back.rec.legs === rec.legs && back.rec.seed === rec.seed;
  const t0 = performance.now();
  const g = buildGuy(rec);
  const ms = performance.now() - t0;
  const P = makePose();
  P.walk = i % 2 ? 1 : 0; P.phase = i; P.blinkT = 99;
  P.pupils = g.eyes.map(() => ({ x: 0.1, y: 0.1, vx: 0, vy: 0 }));
  if (i === 5) P.expr = 'happy';
  if (i === 6) P.expr = 'determined';
  if (i === 7) { P.air = true; P.flail = 1; P.airH = 20; }
  if (i === 8) P.expr = 'sleep';
  if (i === 9) P.talk = 0.8;
  if (i === 10) P.armMode = 'cheer';
  const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * ch + ch - 18;
  const s = Math.min((ch - 40) / g.fullH, (cw - 20) / (g.halfW * 2 + 30));
  drawGuy(ctx, g, x, y, s, P, 0.3, {});
  ctx.fillStyle = '#000'; ctx.font = '11px sans-serif';
  ctx.fillText(`${rec.name} L${rec.legs} ${g.stats.spd}/${g.stats.hop}/${g.stats.hft}/${g.stats.chs} ${ms.toFixed(0)}ms ${ok ? 'codec✓' : 'CODEC✗'} ${code.length}ch`, x - cw / 2 + 6, y - ch + 30);
  report.push({ name: rec.name, eyes: g.eyes.length, mouth: g.mouth && g.mouth.type, stalks: g.stalks.length, species: g.species, ms: +ms.toFixed(1), ok, codeLen: code.length });
});
window.__report = report;

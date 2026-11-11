document.getElementById('title').hidden = true;
const cv = document.getElementById('world');
cv.width = innerWidth; cv.height = innerHeight;
const ctx = cv.getContext('2d');
ctx.fillStyle = '#EAF6FF'; ctx.fillRect(0, 0, cv.width, cv.height);
const L = Zoo.locals();
const cols = 2, cw = innerWidth / cols, ch = innerHeight / 2;
const rep = [];
L.forEach((rec, i) => {
  const g = buildGuy(rec);
  const P = makePose(); P.blinkT = 99; P.pupils = g.eyes.map(() => ({ x: 0.1, y: 0.1, vx: 0, vy: 0 }));
  const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * ch + ch - 30;
  const s = Math.min((ch - 70) / g.fullH, (cw - 40) / (g.halfW * 2 + 30));
  drawGuy(ctx, g, x, y, s, P, 0.3, {});
  ctx.fillStyle = '#000'; ctx.font = '16px sans-serif';
  ctx.fillText(`${rec.name} — ${g.species} — ${g.rarity} ${JSON.stringify(g.stats)} mouth:${g.mouth && g.mouth.type}`, x - cw / 2 + 10, y - ch + 50);
  rep.push(rec.name);
});
window.__report = rep;

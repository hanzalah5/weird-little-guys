document.getElementById('title').hidden = true;
const cv = document.getElementById('world');
cv.width = innerWidth; cv.height = innerHeight;
const ctx = cv.getContext('2d');
ctx.fillStyle = '#EAF6FF'; ctx.fillRect(0, 0, cv.width, cv.height);
const seeds = [4322, 4323, 4324, 4325, 4326, 4327, 4328, 4329, 4330, 4331, 4332, 4333];
const cols = 4, cw = innerWidth / cols, ch = innerHeight / 3;
seeds.forEach((sd, i) => {
  const rec = newRecord(randomDoodle(sd, 'ghost'), { name: 'Gloria', color: 4, legs: 0, arms: 1, look: 5, seed: 404 });
  const g = buildGuy(rec);
  const P = makePose(); P.blinkT = 99; P.pupils = g.eyes.map(() => ({ x: 0.1, y: 0.1, vx: 0, vy: 0 }));
  const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * ch + ch - 14;
  const s = Math.min((ch - 40) / g.fullH, (cw - 20) / (g.halfW * 2 + 30));
  drawGuy(ctx, g, x, y, s, P, 0.3, {});
  ctx.fillStyle = '#000'; ctx.font = '14px sans-serif'; ctx.fillText(String(sd), x - cw / 2 + 8, y - ch + 30);
});
window.__report = 'ok';

import { startApp, openPage } from './lib/browser.mjs';
const app = await startApp();
const logs = [];
const { browser, page } = await openPage({ url: app.url, width: 800, height: 450, quality: 'medium', logs });
await page.waitForFunction(() => window.__game && window.__game.frames > 2, null, { timeout: 300000 });
const info = await page.evaluate(() => {
  const g = window.__game;
  let m = null;
  g.truck.group.traverse((o) => { if (o.isMesh && o.name === 'windshield') m = o; });
  if (!m) return { found: false };
  m.geometry.computeBoundingBox();
  const bb = m.geometry.boundingBox;
  const wp = new (m.position.constructor)(); m.getWorldPosition(wp);
  return { found: true, visible: m.visible, opacity: m.material.opacity, transparent: m.material.transparent,
    side: m.material.side, depthWrite: m.material.depthWrite,
    bb: [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].map((v) => +v.toFixed(2)),
    world: [wp.x, wp.y, wp.z].map((v) => +v.toFixed(2)), renderOrder: m.renderOrder };
});
console.log(JSON.stringify(info));
await browser.close(); await app.close();

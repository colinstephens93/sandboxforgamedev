// Full-game screenshots of the AI Live rig (cart, laptop, cable, charger) and of the UI panels over the 3D view.
// node scripts/uishots.mjs [rig|panels|all] [quality] [W] [H]
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';
import { runScript } from './lib/uiScript.mjs';
const [what = 'rig', quality = 'low', W = '1280', H = '720'] = process.argv.slice(2);
const app = await startApp(5302);
const logs = [];
const { browser, page } = await openPage({ url: app.url, width: +W, height: +H, quality, logs });
await page.waitForFunction(() => window.__game && window.__game.frames > 2, null, { timeout: 240000 });
fs.mkdirSync('.dev/ui', { recursive: true });
const ev = (fn, arg) => page.evaluate(fn, arg);

// the integrator adds the rig to the equipment; here we add it by hand
await ev(async () => {
  const g = window.__game; const rig = await import('/src/shop/ailiveRig.js'); const labels = await import('/src/data/labels/index.js');
  Object.assign(labels.LABELS, rig.AILIVE_LABELS);
  const r = rig.buildAILiveRig({ quality: g.R.q, shop: g.shop, game: g });
  g.scene.add(r.group); g.hooks.push((dt) => r.update(dt)); g.interactor.roots.push(r.group); g.colliders.push(...r.colliders);
  window.__rig = r; g.mode = 'fixed'; g.introT = 999;
});
const look = async (name, cam, tgt, fov = 55) => {
  await ev(([c, t, f]) => { const g = window.__game; g.mode = 'fixed'; g.cam(c, t, f); g.advance(0.1); }, [cam, tgt, fov]);
  await page.waitForTimeout(900);
  const data = await ev(() => window.__game.shot());
  fs.writeFileSync(`.dev/ui/${name}.png`, Buffer.from(data.split(',')[1], 'base64')); console.log('saved', name);
};
const adv = (s) => ev((s) => window.__game.advance(s), s);

if (what === 'rig' || what === 'all') {
  await look('rig-1-cart-idle', [-5.1, 1.55, 0.4], [-3.6, 0.9, 1.0], 45);
  await look('rig-2-cart-wide', [-6.2, 1.9, -0.8], [-2.8, 0.7, 0.6], 55);
  await ev(() => { const g = window.__game; g.ai.plug(true); g.ai.setCharger(true); g.ign.setKey(2, { coolantF: 70, range: 'P' }); }); await adv(3);
  await look('rig-3-plugged-wide', [-5.2, 2.2, 3.2], [-1.6, 0.7, 0.2], 55);
  await look('rig-4-port-close', [-1.9, 1.15, 1.0], [-0.55, 0.75, 0.35], 50);
  await ev(() => { const g = window.__game; g.ai.read({ keyPos: 2, engineRunning: false }); }); await adv(14);
  await ev(() => { const g = window.__game; g.ai.saveBackup({ keyPos: 2, engineRunning: false }); }); await adv(7);
  await ev(() => { const g = window.__game; g.ai.select('street'); g.ai.write({ keyPos: 2, engineRunning: false }, 'street'); }); await adv(24);
  await look('rig-5-screen-writing', [-4.55, 1.2, 1.0], [-3.7, 1.02, 1.0], 40);
  await look('rig-6-charger', [-1.6, 1.5, -3.3], [-1.3, 1.0, -1.1], 50);
  await look('rig-7-charger-engine-bay', [-2.6, 1.9, -2.4], [-0.4, 1.0, -1.0], 55);
  await adv(40);
  await ev(() => { const g = window.__game; g.ai.plug(false); g.ai.setCharger(false); }); await adv(1);
  await look('rig-8-unplugged', [-5.1, 1.55, 0.4], [-3.6, 0.9, 1.0], 45);
  await look('rig-9-charger-off', [-1.6, 1.5, -3.3], [-1.3, 1.0, -1.1], 50);
}
if (what === 'interact' || what === 'all') {
  // the real use path: stand at the cart, aim at the laptop, press E
  await ev(() => { const g = window.__game; g.mode = 'walk'; g.player.setPose(-4.7, 1.0, -Math.PI / 2, -0.62); }); await page.waitForTimeout(4000);
  console.log('dbg', await ev(() => { const g = window.__game; const h = g.interactor.hit; return JSON.stringify({ mode: g.mode, cam: g.camera.position.toArray(), hit: h ? [h.object.name, h.distance, h.object.parent && h.object.parent.name] : null }); }));
  console.log('target', await ev(() => { const t = window.__game.interactor.target; return t ? `${t.label} / ${t.interactable ? t.interactable.userData.interact.prompt : 'none'}` : 'none'; }));
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
  console.log('panel open after E', await ev(() => window.__game.panelsReg.ailive.isOpen));
  await ev(() => window.__game.closePanels());
}
if (what === 'panels' || what === 'all') {
  await ev(() => { const g = window.__game; g.mode = 'fixed'; g.cam([-3, 1.7, -8], [0, 1.1, -1], 60); });
  await runScript(page, { dir: `.dev/ui/app${W}` });
}
console.log(logs.length ? 'LOGS:\n' + logs.join('\n').slice(0, 3000) : 'no console errors');
await browser.close(); await app.close();

import { startApp, openPage } from './lib/browser.mjs';
const app = await startApp();
const logs = [];
const { browser, page } = await openPage({ url: app.url, width: 1280, height: 720, quality: 'low', logs });
await page.waitForFunction(() => window.__game && window.__game.frames > 2, null, { timeout: 300000 });
const info = await page.evaluate(() => {
  const gl = window.__game.R.renderer.getContext();
  const d = gl.getExtension('WEBGL_debug_renderer_info');
  return { renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a', vendor: d ? gl.getParameter(d.UNMASKED_VENDOR_WEBGL) : 'n/a', pixelRatio: window.__game.R.renderer.getPixelRatio(), size: [gl.drawingBufferWidth, gl.drawingBufferHeight], quality: window.__game.R.qualityName };
});
console.log(JSON.stringify(info));
await browser.close(); await app.close();

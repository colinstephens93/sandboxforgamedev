// Bench page (index.html): the truck alone with the engine, dyno and AI Live. See src/bench/bench.js.
import { Bench } from './bench.js';

const $ = (id) => document.getElementById(id);
const bench = new Bench($('view'), (f, m) => { $('loadbar').style.width = `${Math.round(f * 100)}%`; $('loadmsg').textContent = m; });
if (import.meta.env?.DEV || new URLSearchParams(window.location.search).has('debug')) window.__bench = bench;
bench.init().then(() => {
  $('loading').style.opacity = '0'; setTimeout(() => $('loading').remove(), 600);
  bench.ui.say('Use the Engine button to turn it on or off; adjust the throttle with the slider. T: dyno, L: AI Live, M: shop menu, F1: help.', 9);
}).catch((e) => { console.error(e); $('loadmsg').textContent = 'Error: ' + e.message; });

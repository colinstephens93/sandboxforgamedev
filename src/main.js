import { Game } from './game/game.js';

const canvas = document.getElementById('view');
const loadbar = document.getElementById('loadbar');
const loadmsg = document.getElementById('loadmsg');
const progress = (f, m) => { loadbar.style.width = `${Math.round(f * 100)}%`; loadmsg.textContent = m; };

const game = new Game(canvas, progress);
window.__game = game;
game.init().catch((e) => { console.error(e); loadmsg.textContent = 'Error: ' + e.message; });

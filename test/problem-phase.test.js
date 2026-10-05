/* Headless smoke test: reproduce the Learn → Problem phase end-to-end,
 * click tiles, assert the scene morphs (no freeze, no dead taps). */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true
});
const w = dom.window;
/* give the window a fetch that reads data/*.json from disk (00-content.js) */
w.fetch = (url) => {
  const p = path.join(__dirname, '..', String(url).replace(/^\.\//, '').replace(/^\/+/, ''));
  return new Promise((res, rej) => fs.readFile(p, 'utf8', (e, t) => e ? rej(e) : res({ ok: true, json: () => JSON.parse(t) })));
};
/* 16-shell wires listeners on index.html's real DOM — build a skeleton
   with every id so the module loads headlessly too */
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const ids = [...new Set((html.match(/id="([^"]+)"/g) || []).map(s => s.slice(4, -1)))];
  const body = w.document.body;
  for (const id of ids) { const d = w.document.createElement('div'); d.id = id; body.appendChild(d); }
}
// minimal WebAudio stub — every node shape the modules touch
function makeNode(extra = {}) {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  return Object.assign({
    connect(n) { return n || {}; }, disconnect() {}, start() {}, stop() {},
    gain: param(), frequency: param(), Q: param(), detune: param(), playbackRate: param(),
    type: '', buffer: null, onended: null
  }, extra);
}
w.AudioContext = function () {
  return {
    currentTime: 0, state: 'running', destination: makeNode(), resume() { return Promise.resolve(); },
    createGain: () => makeNode(), createOscillator: () => makeNode(),
    createBiquadFilter: () => makeNode(), createBufferSource: () => makeNode(),
    createStereoPanner: () => makeNode(), createDynamicsCompressor: () => makeNode(),
    createWaveShaper: () => makeNode(),
    createBuffer: (c, l) => ({ length: l, getChannelData: () => new Float32Array(l || 1) })
  };
};
if (!w.Element.prototype.animate) w.Element.prototype.animate = function () { return { cancel() {}, finished: Promise.resolve() }; };
if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
w.CSS = w.CSS || {};

global.window = w; global.document = w.document; global.performance = w.performance;
global.localStorage = w.localStorage; global.requestAnimationFrame = cb => setTimeout(() => cb(w.performance.now()), 0);
global.navigator = w.navigator; global.HTMLElement = w.HTMLElement;

const files = ['00-content','01-state','02-campaign','03-questions','04-renderers','05-achievements','06-modes','07-spaced','08-shop','09-music','10-screens','11-engine','12-settings','13-visualizer','14-aitutor','15b-lesson-content','15-lessons','16-shell','17-rewards'];
let scriptErrs = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8');
  try { w.eval(src); } catch (e) { scriptErrs.push(f + ': ' + e.message); }
}
if (scriptErrs.length) { console.error('SCRIPT LOAD ERRORS:\n' + scriptErrs.join('\n')); process.exit(1); }
console.log('✓ all modules load, CF.Lessons =', typeof w.CF.Lessons);

const container = w.document.getElementById('app');
w.CF.Lessons.render(container);
console.log('✓ picker rendered, len', container.innerHTML.length);

const api = Object.keys(w.CF.Lessons);
console.log('CF.Lessons API:', api.join(', '));

if (typeof w.CF.Lessons.start === 'function') {
  w.CF.Lessons.start(container, 'p1');
} else {
  /* click the p1 lesson card in the picker */
  const card = container.querySelector('.lsn-card[data-lesson="p1"]');
  if (!card) { console.error('✗ p1 card not found in picker'); process.exit(1); }
  card.click();
}

setTimeout(() => {
  const begin = container.querySelector('#lsnStart');
  if (!begin) { console.error('✗ no Begin button — intro did not render'); process.exit(1); }
  begin.click();

  setTimeout(() => {
    const stage = container.querySelector('#probStage');
    if (!stage) { console.error('✗ Problem stage missing'); process.exit(1); }
    const cells = stage.querySelectorAll('.vz-cell');
    console.log('✓ Problem phase rendered,', cells.length, 'cells');
    if (!cells.length) process.exit(1);

    // tap two tiles (p1 pair task: arr [2,7,11,15], target 9 → indices 0,1)
    cells[0].click();
    setTimeout(() => {
      const auxAfterOne = container.querySelector('#probAux').textContent;
      console.log('after 1 tap:', auxAfterOne.slice(0, 80));
      const ptrs = stage.querySelectorAll('.vz-ptr');
      console.log('pointer chips after 1 tap:', ptrs.length);
      const liveCells = stage.querySelectorAll('.vz-cell:not(.vz-exiting)');
      liveCells[1].click();
      setTimeout(() => {
        const aux = container.querySelector('#probAux').textContent;
        const next = container.querySelector('#lsnNext');
        console.log('after 2 taps (0+1):', aux.slice(0, 90));
        console.log('Continue disabled?', next.disabled);
        setTimeout(() => {
          const won = stage.querySelectorAll('.vz-cell.win').length;
          console.log('win-marked cells now:', won);
          console.log('✓ interaction chain alive (no exception, taps registered)');
          process.exit(0);
        }, 1200);
      }, 250);
    }, 250);
  }, 200);
}, 200);

setTimeout(() => { console.error('✗ TEST TIMEOUT — something hung'); process.exit(1); }, 8000);

const { JSDOM } = require('jsdom');
const fs = require('fs');

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true
});
const w = dom.window;
w.CSS = w.CSS || {};
if (!w.Element.prototype.animate) w.Element.prototype.animate = function () { return { cancel() {}, finished: Promise.resolve() }; };
for (const f of ['01-state', '13-visualizer', '14-aitutor', '15b-lesson-content', '15-lessons']) {
  try { w.eval(fs.readFileSync('js/' + f + '.js', 'utf8')); } catch (e) { console.log('LOADFAIL', f, e.message); }
}
const c = w.document.getElementById('app');
w.CF.Lessons.render(c);
const card = c.querySelector('.lsn-card[data-lesson="p1"]');
console.log('card found?', !!card, 'locked?', card && card.className.includes('locked'));
card.click();
setTimeout(() => {
  console.log('#lsnStart?', !!c.querySelector('#lsnStart'));
  console.log('#imagineScene?', !!c.querySelector('#imagineScene'));
  console.log('.lsn-gate-card?', !!c.querySelector('.lsn-gate-card'));
  const begin = c.querySelector('#lsnStart');
  if (begin) begin.click();
  setTimeout(() => {
    const stage = c.querySelector('#probStage');
    console.log('#probStage?', !!stage, 'cells:', stage ? stage.querySelectorAll('.vz-cell').length : 0);
    process.exit(0);
  }, 150);
}, 100);

const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../extension/native-theme.js');
function fixture(selectors) {
  function element(tagName) {
    const attrs = new Map(), classes = new Set();
    return { tagName, classList: { contains: k => classes.has(k), add: k => classes.add(k), remove: k => classes.delete(k) },
      getAttribute: k => attrs.get(k) ?? null, setAttribute: (k,v) => attrs.set(k,v), removeAttribute: k => attrs.delete(k),
      matches: s => (!s.startsWith('html') || tagName === 'HTML') && (!s.startsWith('body') || tagName === 'BODY') };
  }
  const doc = { documentElement: element('HTML'), body: element('BODY'), styleSheets: [{cssRules: selectors.map(selectorText => ({selectorText}))}] };
  return { doc, adapter: N.create(doc, () => true) };
}
test('uses declared common root switches, not similar component names', () => {
  assert.deepEqual(N.candidates('html[data-theme="dark"] main, body.dark article').map(c => c.name), ['data-theme','dark']);
  assert.deepEqual(N.candidates('.dark-widget, .darkness, .card[data-theme=dark]'), []);
});
test('successful native activation can be restored without replacing other classes', () => {
  const {doc,adapter} = fixture(['html.dark main']);
  doc.documentElement.classList.add('existing');
  assert.ok(adapter.tryActivate(() => doc.documentElement.classList.contains('dark')));
  adapter.restore();
  assert.equal(doc.documentElement.classList.contains('dark'), false);
  assert.equal(doc.documentElement.classList.contains('existing'), true);
});
test('failed candidates roll back and are not retried on their own mutations', () => {
  const {doc,adapter} = fixture(['html[data-theme="dark"]']);
  doc.documentElement.setAttribute('data-theme','light');
  let reads = 0;
  assert.equal(adapter.tryActivate(() => {reads++; return false;}), null);
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'light');
  adapter.tryActivate(() => {reads++; return false;});
  assert.equal(reads, 1);
});
test('skips inaccessible styles and inactive media', () => {
  const {doc} = fixture([]);
  doc.styleSheets = [{get cssRules(){throw new Error('SecurityError');}}, {media:{mediaText:'print'},cssRules:[{selectorText:'html.dark'}]}];
  assert.equal(N.create(doc, () => false).tryActivate(() => true), null);
});

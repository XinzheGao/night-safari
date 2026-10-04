const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/colors.js');
test('reads legacy and modern rgba syntax with transparency', () => {
  assert.deepEqual(C.parse('rgba(255, 255, 255, 0.5)'), [255,255,255,.5]);
  assert.deepEqual(C.parse('rgb(0 0 0 / 50%)'), [0,0,0,.5]);
  assert.equal(C.parse('color(display-p3 1 0 0)'), null);
});
test('palette main and muted text meet 4.5:1 on intended backgrounds', () => {
  for (const fg of [C.palette.text, C.palette.muted, C.palette.link])
    for (const bg of [C.palette.canvas, C.palette.panel, C.palette.raised])
      assert.ok(C.contrast(C.parse(fg), C.parse(bg)) >= 4.5, `${fg} / ${bg}`);
});
test('transparent light panels are evaluated on their actual backdrop', () => {
  const background = C.composite([255,255,255,.75], C.parse(C.palette.canvas));
  assert.ok(C.luminance(background) > .4);
});
test('dark semantic text retains red and green distinctions', () => {
  assert.equal(C.foreground([180,20,20,1]), C.palette.red);
  assert.equal(C.foreground([20,100,40,1]), C.palette.green);
  assert.equal(C.foreground([0,0,0,1]), C.palette.text);
});
test('neutral linked titles and white media labels are not forced blue', () => {
  assert.equal(C.foreground([24, 25, 28, 1], true), C.palette.text);
  assert.equal(C.foreground([120, 120, 120, 1], true), C.palette.muted);
  assert.equal(C.foreground([255, 255, 255, 1], true), null);
  assert.equal(C.foreground([0, 100, 200, 1], true), C.palette.link);
});

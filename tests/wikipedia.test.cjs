const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../extension/content.js'),'utf8');
const adapter = source.slice(source.indexOf('  const darkPreference'), source.indexOf('  function setState'));
function setup(host='zh.wikipedia.org', choice='auto', dark=true, works=true) {
  const classes = new Set(['skin-theme-clientpref-day']);
  const root = {classList:{contains:n=>classes.has(n), add:n=>classes.add(n), remove:n=>classes.delete(n)}};
  const preference = {matches:dark};
  const context={host,mode:()=>choice,root,matchMedia:()=>preference,nativeDark:()=>works,location:{pathname:'/'},document:{scripts:[{src:'/laputa-home/assets/index.js'}]}};
  vm.createContext(context);vm.runInContext(adapter+';globalThis.activate=activateSiteTheme;globalThis.restore=restoreSiteTheme;',context);
  return {context,classes,preference};
}
test('Wikipedia native styles are reversible without persisting preferences',()=>{
  const f=setup();assert.equal(f.context.activate(),true);assert.equal(f.classes.has('skin-theme-clientpref-day'),false);
  assert.equal(f.context.activate(),false);f.context.restore();assert.equal(f.classes.has('skin-theme-clientpref-day'),true);assert.equal(f.classes.has('skin-theme-clientpref-night'),false);
});
test('adapters honor browser preference, explicit modes and hostname boundaries',()=>{
  for(const choice of ['off','native','force']) assert.equal(setup('zh.wikipedia.org',choice).context.activate(),false);
  assert.equal(setup('zh.wikipedia.org','auto',false).context.activate(),false);
  assert.equal(setup('wikipedia.org.example.com').context.activate(),false);
});
test('failed render verification restores the original classes',()=>{
  const f=setup('zh.wikipedia.org','auto',true,false);assert.equal(f.context.activate(),false);assert.deepEqual([...f.classes],['skin-theme-clientpref-day']);
});
test('preserves existing and subsequently selected website themes',()=>{
  const f=setup();f.classes.delete('skin-theme-clientpref-day');f.classes.add('skin-theme-clientpref-night');f.context.activate();f.context.restore();assert.equal(f.classes.has('skin-theme-clientpref-night'),true);
  const g=setup();g.context.activate();g.classes.delete('skin-theme-clientpref-night');g.classes.add('skin-theme-clientpref-os');g.context.restore();assert.deepEqual([...g.classes],['skin-theme-clientpref-os']);
});
test('Bilibili homepage uses a temporary native class and restores it',()=>{
  const f=setup('www.bilibili.com');assert.equal(f.context.activate(),true);assert.equal(f.classes.has('bili_dark'),true);f.context.restore();assert.equal(f.classes.has('bili_dark'),false);
});

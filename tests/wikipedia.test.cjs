const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../extension/content.js'),'utf8');
// Run the adapter extracted from the shipped content script against a native handler.
const adapter = source.slice(source.indexOf('  let wikipediaAttempts'), source.indexOf('  // Verified against Bilibili'));
function setup(host, choice='auto', ready=true) {
  const classes = new Set(['skin-theme-clientpref-day']);
  let changes=0;
  const input={type:'radio',disabled:false,checked:false,dispatchEvent(){changes++;if(ready){classes.delete('skin-theme-clientpref-day');classes.add('skin-theme-clientpref-night');}}};
  const context={host, mode:()=>choice, root:{classList:{contains:c=>classes.has(c)}},document:{getElementById:()=>input},Event:class{}};
  vm.createContext(context);vm.runInContext(adapter+';globalThis.activate=activateWikipediaTheme;',context);
  return {context,input,classes,get changes(){return changes;}};
}
test('Wikipedia uses its native change handler and is idempotent',()=>{
  const f=setup('zh.wikipedia.org'); assert.equal(f.context.activate(),true);assert.equal(f.classes.has('skin-theme-clientpref-day'),false);
  f.context.activate();assert.equal(f.changes,1);
});
test('Wikipedia honors modes and restricts the hostname',()=>{
  for(const choice of ['off','native','force']){const f=setup('zh.wikipedia.org',choice);assert.equal(f.context.activate(),false);assert.equal(f.changes,0);}
  const f=setup('wikipedia.org.example.com');assert.equal(f.context.activate(),false);assert.equal(f.changes,0);
});
test('unready native handler restores checkbox and limits retries',()=>{
  const f=setup('en.wikipedia.org','auto',false);for(let i=0;i<5;i++)assert.equal(f.context.activate(),false);
  assert.equal(f.input.checked,false);assert.equal(f.changes,3);
});

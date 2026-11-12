import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../js/jungsi-consulting.js', import.meta.url), 'utf8');
function setup(hash='#consulting') {
  const events=[], handlers={}, panels={}, tabs=[0,1].map(i=>({setAttribute(){},getAttribute(){return i?'consultingPanel':'calculator';},addEventListener(n,f){this[n]=f;},focus(){}}));
  let tick;
  const doc={visibilityState:'visible',querySelectorAll:()=>tabs,addEventListener:(n,f)=>handlers[n]=f,getElementById:id=> panels[id] ||= {contains:target=>target===panels.consulting,hidden:false}};
  const location={hash}; const history={replaceState(a,b,h){location.hash=h;}};
  const window={SCTrack:{event:(...x)=>events.push(x)},setInterval:f=>(tick=f,1),clearInterval(){tick=()=>{};},addEventListener(){}};
  vm.runInNewContext(source,{window,document:doc,location,history,CONFIG:{api:{consultingPublic:'mock'}},fetch:async()=>({ok:false,json:async()=>null})});
  return {events,handlers,tabs,doc,tick:()=>tick(),location};
}
test('direct entry and tab changes stay distinct from pageviews',()=>{
 const s=setup(); assert.equal(s.events[0][0],'consulting_view'); s.tabs[1].click(); assert.equal(s.events.length,1);s.tabs[0].click();assert.equal(s.events[1][0],'calculator_view');assert.equal(s.location.hash,'#calculator');s.tabs[1].click();assert.equal(s.events[2][0],'consulting_view');assert.ok(s.events.every(e=>e[0]!=='page_view'));
});
test('engagement counts visible consulting time once',()=>{
 const s=setup();s.doc.visibilityState='hidden';for(let i=0;i<60;i++)s.tick();assert.equal(s.events.length,1);s.doc.visibilityState='visible';for(let i=0;i<30;i++)s.tick();assert.equal(s.events[1][0],'consulting_engaged');for(let i=0;i<30;i++)s.tick();assert.equal(s.events.length,2);
});
test('disabled application does not emit; open form is click only',()=>{
 const s=setup();const link={id:'consultingApply',href:'https://docs.google.com/forms/d/example',getAttribute:n=>n==='aria-disabled'?'true':null};const event={target:{closest:()=>link}};
 s.handlers.click(event);assert.equal(s.events.length,1);link.getAttribute=()=>null;s.handlers.click(event);assert.equal(s.events[1][0],'consulting_apply_click');assert.ok(!s.events.some(e=>/purchase|lead|sign_up/.test(e[0])));
});

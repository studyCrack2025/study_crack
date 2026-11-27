import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../js/jungsi-consulting.js', import.meta.url), 'utf8');
function setup(hash='#consulting', order=['calculator','consultingPanel']) {
  const events=[], handlers={}, listeners={}, panels={}, tabs=order.map(panel=>({setAttribute(){},getAttribute(){return panel;},addEventListener(n,f){this[n]=f;},focus(){}}));
  let tick;
  const element = id => {
    if (panels[id]) return panels[id];
    const attributes = new Map();
    return panels[id] = {
      id, hidden: false, dataset: {}, firstChild: { textContent: '' },
      contains: target => target === panels[id] || id === 'consultingPanel' && target === panels.consulting,
      getAttribute: name => name === 'href' ? panels[id].href ?? null : attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, String(value)),
      removeAttribute: name => attributes.delete(name),
      addEventListener() {},
      querySelector: selector => element(id + selector)
    };
  };
  const doc={visibilityState:'visible',querySelectorAll:()=>tabs,addEventListener:(n,f)=>{(listeners[n] ||= []).push(f);handlers[n]=event=>listeners[n].forEach(listener=>listener(event));},getElementById:element};
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
test('consulting-first navigation preserves calculator anchors and event identity',()=>{
 const s=setup('#calculator',['consultingPanel','calculator']);
 assert.equal(s.events[0][0],'calculator_view');
 assert.equal(s.doc.getElementById('calculator').hidden,false);
 assert.equal(s.doc.getElementById('consultingPanel').hidden,true);
 s.tabs[0].click();
 assert.equal(s.location.hash,'#consulting');
 assert.equal(s.events[1][0],'consulting_view');
 s.tabs[0].keydown({key:'ArrowRight',preventDefault(){}});
 assert.equal(s.location.hash,'#calculator');
 assert.equal(s.events[2][0],'calculator_view');
 assert.ok(s.events.every(e=>e[0]!=='page_view'));
});
test('disabled application does not emit; open form is click only',()=>{
 const s = setup(), link = s.doc.getElementById('consultingApply');
 const event = { target: { closest: () => link } };
 assert.equal(link.href, '#application');
 assert.equal(link.dataset.jungsiProduct, 'consulting');
 link.setAttribute('aria-disabled', 'true');
 s.handlers.click(event);
 assert.equal(s.events.length, 1);
 link.removeAttribute('aria-disabled');
 s.handlers.click(event);
 assert.equal(s.events[1][0], 'consulting_apply_click');
 delete link.dataset.jungsiProduct;
 link.href = '/2027-jungsi-consulting/home';
 s.handlers.click(event);
 assert.equal(s.events.length, 2);
 assert.ok(!s.events.some(e => /purchase|lead|sign_up/.test(e[0])));
});

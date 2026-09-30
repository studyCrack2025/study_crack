const fs=require('node:fs'); const vm=require('node:vm'); const assert=require('node:assert/strict');
const code=fs.readFileSync(require('path').join(__dirname,'../../js/measurement-v2.js'),'utf8');
function create(storage=new Map(),url='https://studycrack.co.kr/?utm_source=naver&utm_medium=blog&utm_campaign=fall') {
 const w={dataLayer:[],location:{href:url},document:{referrer:'',title:'StudyCrack',addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},navigator:{},addEventListener(){},setTimeout(){}};
 vm.runInNewContext(code,{window:w,URL,URLSearchParams,Number});return {w,m:w.SCMeasurementV2,storage};
}
(async()=>{
 let passed=[]; let x=create();
 assert.throws(()=>x.m.event('login'));passed.push('No events before session resolution');
 assert.throws(()=>x.m.ready('email@example.com'));assert.throws(()=>x.m.ready('undefined'));passed.push('Reject email and placeholder user IDs');
 x.m.ready('opaque-user-123');x.m.ready('opaque-user-123');x.m.pageView();assert.equal(x.w.dataLayer.filter(e=>e.sc.event_name==='page_view').length,1);passed.push('One initial pageview per document');
 x.m.setIdentity(null);assert.equal(x.w.dataLayer.at(-1).sc.user_id,null);x.m.setIdentity('opaque-user-123');assert.equal(x.w.dataLayer.at(-1).sc.user_id,'opaque-user-123');passed.push('Logout null and stable login identity');
 x.w.location.href='https://studycrack.co.kr/analysis';x.m.pageView();x.w.location.href='https://studycrack.co.kr/';x.m.pageView();assert.equal(x.w.dataLayer.filter(e=>e.sc.event_name==='page_view').length,3);passed.push('Distinct navigation and back navigation pageviews');
 const order={status:'paid',transaction_id:'ORDER_test_1',value:25000,currency:'KRW',plan_type:'basic'};
 await assert.rejects(()=>x.m.purchase({...order,status:'pending'}));await assert.rejects(()=>x.m.purchase({...order,transaction_id:''}));await assert.rejects(()=>x.m.purchase({...order,value:'25000'}));passed.push('Reject unconfirmed purchase and invalid order data');
 assert.equal(await x.m.purchase(order),true);assert.equal(await x.m.purchase(order),false);let y=create(x.storage);y.m.ready('opaque-user-123');assert.equal(await y.m.purchase(order),false);passed.push('Duplicate order suppressed across a new document');
 x.m.event('analysis_view');assert.equal(x.w.dataLayer.at(-1).sc.ecommerce,null);assert.equal(x.w.dataLayer.at(-1).sc.purchase_verified,false);passed.push('Clear ecommerce state after purchase');
 let z=create(x.storage,'https://studycrack.co.kr/?utm_source=google');z.m.ready(null);assert.equal(z.w.dataLayer.at(-1).sc.sc_first_source,'naver');assert.equal(z.w.dataLayer.at(-1).sc.sc_first_medium,'blog');passed.push('Atomic first-touch snapshot retained');
 assert.throws(()=>x.m.event('Payment'));passed.push('Only canonical event names accepted');
 const result={scope:'Local adapter logic only; NOT GTM Preview, network receipt, GA4 DebugView or end-to-end verification',passed};
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1});

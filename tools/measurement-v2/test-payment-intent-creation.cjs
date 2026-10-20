const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../../js/payment.js','utf8');
const code=source.slice(source.indexOf('function createPaymentIdempotencyKey()'));
const id='PI_'+'a'.repeat(32);
const valid={paymentIntentId:id,orderId:id,purchaseKind:'subscription',tier:'BASIC',status:'intent_created',amount:25000,productName:'BASIC',expiresAt:new Date(Date.now()+600000).toISOString()};
function setup(overrides={},failFirst=false){
 const requests=[],saved=[],events=[],alerts=[];const button={};
 const ctx={paymentIntentPending:false,paymentIntentRetry:null,selectedTier:'basic',TEST_PAY_MODE:'0',userPhoneMissing:false,
  document:{getElementById:key=>({name:{value:'Private name'},phone:{value:'01012345678'},email:{value:'private@example.invalid'},submitBtn:button})[key]},
  formatPhoneNumber:value=>value,CONFIG:{api:{payment:'/payment'}},window:{crypto:{randomUUID:()=> 'test-key'},location:{},SCTrack:{event:(...args)=>events.push(args)}},
  apiFetch:async(_url,options)=>{requests.push(JSON.parse(options.body));if(failFirst&&requests.length===1)throw Error('retry');return{json:async()=>({success:true,data:{...valid,...overrides}})};},
  localStorage:{setItem:(_key,value)=>saved.push(JSON.parse(value))},alert:value=>alerts.push(value),allowPaymentNavigationOnce(){},_applyTierMessage(){},_applyPhoneRequiredMessage(){}};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,requests,saved,events,alerts};
}
(async()=>{
 let t=setup();await t.ctx.processPayment();await t.ctx.processPayment();assert.equal(t.requests.length,1);assert.equal(t.requests[0].type,'create_payment_intent');assert(!Object.hasOwn(t.requests[0].data,'amount'));assert.equal(t.saved[0].paymentIntentId,id);assert.equal(t.saved[0].orderId,id);assert.equal(t.ctx.window.location.href,'/checkout');assert.equal(t.events[0][0],'begin_checkout');assert.equal(t.events[0][1].ecommerce.value,25000);assert(!JSON.stringify(t.events).includes('Private'));assert(!JSON.stringify(t.events).includes('private@'));
 for(const bad of [{paymentIntentId:'ORDER_legacy'},{orderId:'wrong'},{tier:'PRO'},{status:'paid'},{status:'expired'},{purchaseKind:'consulting'},{amount:0},{expiresAt:'2020-01-01'}]){t=setup(bad);await t.ctx.processPayment();assert.equal(t.saved.length,0,JSON.stringify(bad));assert.equal(t.events.length,0);assert.equal(t.ctx.paymentIntentPending,false);}
 t=setup({},true);await t.ctx.processPayment();await t.ctx.processPayment();assert.equal(t.requests[0].data.idempotencyKey,t.requests[1].data.idempotencyKey);assert.equal(t.saved.length,1);assert.equal(t.events.length,1);
 t=setup({tier:'TEST',amount:100});t.ctx.selectedTier='test';await t.ctx.processPayment();assert.equal(t.saved.length,1);assert.equal(t.events.length,0);
 console.log(JSON.stringify({scope:'Mocked order preparation; no real order or charge created',passed:['One server-issued intent before checkout','Checkout measurement uses only server amount and plan, never contact data','Malformed, mismatched, settled or expired intent blocks navigation and measurement','Uncertain preparation retry keeps idempotency key','Test payments excluded from production checkout measurement']}));
})().catch(error=>{console.error(error);process.exitCode=1;});

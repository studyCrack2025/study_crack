const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const base=__dirname, id='PI_'+ 'a'.repeat(32), passed=[];
const core=fs.readFileSync(path.join(base,'../../js/measurement-v2.js'),'utf8');
const controller=fs.readFileSync(path.join(base,'../../js/payment-success-v2.js'),'utf8');
async function run({query='?paymentIntentId='+id,payment={},authenticated=true,networkError=false,store=new Map(),success=true}={}){
  const events={},elements={},calls=[];
  const w={document:{title:'결제 확인',referrer:'',addEventListener:(k,f)=>(events[k]??=[]).push(f),getElementById:k=>elements[k]??={textContent:'',style:{}}},
    location:{href:'https://studycrack.co.kr/success'+query,pathname:'/success'},history:{replaceState(){}},
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
    CONFIG:{api:{payment:'https://example.invalid/payment'}},addEventListener(){},setTimeout(){},navigator:{},dataLayer:[]};
  const context={window:w,URL,URLSearchParams};vm.createContext(context);vm.runInContext(core,context);
  w.resolveUserIdentity=async()=>{if(authenticated)w.SCTrack.identify('test-internal-id');return authenticated;};
  w.apiFetch=async(url,options)=>{calls.push(JSON.parse(options.body));if(networkError)throw Error('network');return {ok:true,json:async()=>({success,data:{paymentIntentId:id,purchaseKind:'subscription',tier:'PRO',status:'paid',amount:149000,fulfillmentStatus:'fulfilled',...payment}})};};
  vm.runInContext(controller,context);for(const callback of events.DOMContentLoaded)await callback();
  return {purchases:w.dataLayer.filter(x=>x.event==='sc_verified_purchase'),elements,calls,store,dataLayer:w.dataLayer};
}
(async()=>{
  let x=await run({query:'?tier=pro&status=paid&amount=149000&orderId=FAKE'});assert.equal(x.calls.length,0);assert.equal(x.purchases.length,0);passed.push('Success URL parameters alone do not query or emit purchase');
  x=await run({query:'?status=promo&source=kcc01&orderId=FAKE&paymentIntentId='+id});assert.equal(x.calls.length,0);assert.equal(x.purchases.length,0);assert.equal(x.elements.successTitle.textContent,'종료된 프로모션입니다');passed.push('Retired promotion cannot look up or count a payment even with a valid-looking ID');
  x=await run();assert.equal(x.purchases.length,1);assert.equal(x.purchases[0].sc.ecommerce.value,149000);assert.equal(x.purchases[0].sc.ecommerce.transaction_id,id);assert.equal(x.purchases[0].sc.user_id,'test-internal-id');passed.push('Authenticated server paid response supplies ID, amount, plan and identity');
  const shared=x.store; for(let i=0;i<3;i++){x=await run({store:shared});assert.equal(x.purchases.length,0);}passed.push('Three reloads do not repeat the same transaction');
  for(const status of ['vbank_ready','intent_created','failed','expired','cancelled']){x=await run({payment:{status}});assert.equal(x.purchases.length,0);}passed.push('Unpaid, bank-issued, failed, expired and cancelled orders do not emit purchase');
  for(const payment of [{paymentIntentId:'PI_'+'b'.repeat(32)},{amount:'149000'},{amount:-1},{tier:'TEST'},{purchaseKind:'consulting'}]){x=await run({payment});assert.equal(x.purchases.length,0);}passed.push('Mismatched orders, invalid amount and unsupported products are rejected');
  x=await run({authenticated:false});assert.equal(x.calls.length,0);assert.equal(x.purchases.length,0);assert(x.elements.actionBtn.href.includes('/login?returnUrl='));passed.push('Unresolved session asks for login and preserves order return route');
  x=await run({networkError:true});assert.equal(x.purchases.length,0);assert(x.elements.successTitle.textContent.includes('확인하지 못'));passed.push('API failure shows unconfirmed state');
  x=await run({success:false});assert.equal(x.purchases.length,0);passed.push('Unsuccessful API envelope cannot create purchase');
  x=await run({payment:{status:'vbank_ready',vbank:{accountNo:'ACCOUNT-PRIVATE',holder:'PRIVATE-HOLDER'}}});assert(!JSON.stringify(x.dataLayer).includes('PRIVATE'));passed.push('Bank display details never enter analytics');
  const result={scope:'Mocked authoritative API responses; no real charge or GA4 delivery asserted',passed};console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1});

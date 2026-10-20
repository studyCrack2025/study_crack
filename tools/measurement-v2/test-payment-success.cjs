const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const base=__dirname, id='PI_'+ 'a'.repeat(32), passed=[];
const core=fs.readFileSync(path.join(base,'../../js/measurement-v2.js'),'utf8');
const controller=fs.readFileSync(path.join(base,'../../js/payment-status.js'),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function run({query='?paymentIntentId='+id,payment={},authenticated=true,networkError=false,store=new Map(),success=true,identityGate=null}={}){
  store.set('userId','test-internal-id');
  const events={},elements={},calls=[],listeners={};
  const location={href:'https://studycrack.co.kr/success'+query,pathname:'/success',search:query};
  const w={document:{title:'결제 확인',referrer:'',addEventListener:(k,f)=>(events[k]??=[]).push(f),getElementById:k=>elements[k]??={textContent:'',style:{},setAttribute(){},removeAttribute(){},addEventListener:(event,fn)=>{listeners[k+':'+event]=fn;}}},
    location,history:{replaceState(){}},
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
    CONFIG:{api:{payment:'https://example.invalid/payment'}},addEventListener:(k,f)=>(events[k]??=[]).push(f),setTimeout(){},navigator:{},dataLayer:[]};
  w.resolveMeasurementIdentity=async()=>{if(identityGate)await identityGate;return authenticated?'test-internal-id':null;};
  w.apiFetch=async(url,options)=>{calls.push(JSON.parse(options.body));if(networkError)throw Object.assign(Error('network'),{status:401});return {ok:true,json:async()=>({success,data:{paymentIntentId:id,purchaseKind:'subscription',tier:'PRO',status:'paid',amount:149000,fulfillmentStatus:'fulfilled',...payment}})};};
  const context={window:w,document:w.document,localStorage:w.localStorage,location,history:w.history,CONFIG:w.CONFIG,apiFetch:w.apiFetch,resolveMeasurementIdentity:w.resolveMeasurementIdentity,URL,URLSearchParams,AbortController,setTimeout,clearTimeout};
  vm.createContext(context);vm.runInContext(core,context);vm.runInContext(controller,context);
  for(const callback of events.DOMContentLoaded)callback();
  await flush();
  return {purchases:()=>w.dataLayer.filter(x=>x.event==='sc_verified_purchase'),elements,calls,store,dataLayer:w.dataLayer,events,listeners,w};
}
(async()=>{
  let x=await run({query:'?tier=pro&status=paid&amount=149000&orderId=FAKE'});assert.equal(x.calls.length,0);assert.equal(x.purchases().length,0);passed.push('Success URL parameters alone do not query or emit purchase');
  x=await run({query:'?status=promo&source=kcc01&orderId=FAKE&paymentIntentId='+id});assert.equal(x.calls.length,0);assert.equal(x.purchases().length,0);assert.equal(x.elements.successTitle.textContent,'종료된 프로모션입니다');passed.push('Retired promotion cannot look up or count a payment even with a valid-looking ID');
  x=await run();assert.equal(x.purchases().length,1);assert.equal(x.purchases()[0].sc.ecommerce.value,149000);assert.equal(x.purchases()[0].sc.ecommerce.transaction_id,id);assert.equal(x.purchases()[0].sc.user_id,'test-internal-id');passed.push('Authenticated server paid response supplies ID, amount, plan and identity');
  const shared=x.store;for(let i=0;i<3;i++){x=await run({store:shared});assert.equal(x.purchases().length,0);}passed.push('Three reloads do not repeat the same transaction');
  for(const status of ['vbank_ready','intent_created','failed','expired','cancelled']){x=await run({payment:{status}});assert.equal(x.purchases().length,0);}passed.push('Unpaid, bank-issued, failed, expired and cancelled orders do not emit purchase');
  for(const payment of [{paymentIntentId:'PI_'+'b'.repeat(32)},{amount:'149000'},{amount:-1},{amount:0},{tier:'TEST'},{purchaseKind:'consulting'}]){x=await run({payment});assert.equal(x.purchases().length,0);}passed.push('Mismatched orders, invalid amount and unsupported products are rejected');
  x=await run({authenticated:false});assert.equal(x.purchases().length,0);passed.push('Unresolved analytics identity cannot emit purchase');
  x=await run({networkError:true});assert.equal(x.purchases().length,0);assert(x.elements.successTitle.textContent.includes('로그인 후'));assert.equal(x.elements.actionBtn.href,'/login');assert.equal(x.elements.actionBtn.target,'_blank');passed.push('Expired API session preserves manual recovery in a new tab');
  x=await run({success:false});assert.equal(x.purchases().length,0);passed.push('Unsuccessful API envelope cannot create purchase');
  x=await run({payment:{status:'vbank_ready',vbank:{bankName:'PRIVATE-BANK',accountNo:'ACCOUNT-PRIVATE',holder:'PRIVATE-HOLDER',expireDate:'2026-12-31'}}});assert(!JSON.stringify(x.dataLayer).includes('PRIVATE'));assert.equal(x.elements.vbankAccount.textContent,'ACCOUNT-PRIVATE');passed.push('Bank display details never enter analytics');
  x=await run({payment:{fulfillmentStatus:'processing'}});assert.equal(x.purchases().length,1);assert.equal(x.elements.successTitle.textContent,'결제 완료 · 이용권 반영 대기');passed.push('Server-paid but pending entitlement is measured once without claiming entitlement success');
  let release;const gate=new Promise(resolve=>{release=resolve;});x=await run({identityGate:gate});x.store.set('userId','other');for(const callback of x.events.storage)callback({key:'userId'});release();await flush();assert.equal(x.purchases().length,0);assert.equal(x.elements.successTitle.textContent,'결제 상태를 다시 확인해주세요');passed.push('Account switch during identity resolution suppresses stale purchase and status');
  console.log(JSON.stringify({scope:'Mocked authoritative API responses; no real charge or GA4 delivery asserted',passed}));
})().catch(e=>{console.error(e);process.exitCode=1});

const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../../js/checkout.js','utf8');
new vm.Script(source);
const fn=source.slice(source.indexOf('let isPaymentInProgress = false;'));
const valid={paymentIntentId:'PI_'+'a'.repeat(32),orderId:'PI_'+'a'.repeat(32),purchaseKind:'subscription',tier:'BASIC',status:'intent_created',amount:25000,expiresAt:new Date(Date.now()+600000).toISOString()};
function setup(overrides={},agree=true){
 const requests=[],gateway=[],saved=[],alerts=[];let envelope={success:true,data:{...valid,...overrides}};
 const button={disabled:false,style:{}};
 const context={checkoutData:{userId:'test-user',tier:'basic',orderId:'ORDER_1790740000000_abcd',amount:25000,productName:'BASIC',name:'Test',email:'test@example.invalid',phone:'01000000000'},document:{getElementById:id=>id==='agreeTerms'?{checked:agree}:button,querySelector:()=>({value:'card'})},window:{location:{}},CONFIG:{api:{payment:'https://api.example.invalid/payment',payment_return:'https://api.example.invalid/return',payment_notify:'https://api.example.invalid/notify'},nicepay:{clientId:'test-public-id'}},apiFetch:async(url,options)=>{requests.push(JSON.parse(options.body));return{json:async()=>envelope}},AUTHNICE:{requestPay:payload=>gateway.push(payload)},localStorage:{setItem:(k,v)=>saved.push([k,v])},alert:message=>alerts.push(message),allowCheckoutNavigationOnce(){},console:{error(){}},Date,Number};
 vm.createContext(context);vm.runInContext(fn,context);return {context,requests,gateway,saved,alerts,button};
}
(async()=>{
 let t=setup();await t.context.submitCheckout();assert.equal(t.gateway.length,1);assert.equal(t.gateway[0].orderId,valid.orderId);assert.equal(t.gateway[0].amount,25000);assert.deepEqual(JSON.parse(t.gateway[0].mallReserved),{paymentIntentId:valid.paymentIntentId});assert.equal(t.requests[0].data.idempotencyKey,'ORDER_1790740000000_abcd');assert(!('amount' in t.requests[0].data));
 await t.context.submitCheckout();assert.equal(t.gateway.length,1);
 for(const overrides of [{amount:26000},{tier:'PRO'},{status:'paid'},{status:'vbank_ready'},{paymentIntentId:'FAKE'},{orderId:'WRONG'},{expiresAt:'2020-01-01'}]){t=setup(overrides);await t.context.submitCheckout();assert.equal(t.gateway.length,0,JSON.stringify(overrides));assert.equal(t.button.disabled,false);}
 t=setup({},false);await t.context.submitCheckout();assert.equal(t.requests.length,0);
 t=setup();await t.context.submitCheckout();t.gateway[0].fnError({errorMsg:'test cancel'});await t.context.submitCheckout();assert.equal(t.requests[0].data.idempotencyKey,t.requests[1].data.idempotencyKey);
 const result={scope:'Mocked payment server and NicePay SDK only; no real order or charge created',passed:['Server ID and amount passed to SDK; only intent ID in callback metadata','Repeated submit guarded','Price/plan/order/state/expiry mismatches block SDK','No agreement means no request','SDK retry reuses idempotency key']};
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1});

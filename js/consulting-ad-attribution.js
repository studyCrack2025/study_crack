(function(root){
 'use strict';
 const pending=new Map(),products=['consulting','calculator'],sources=['naver','google','meta','facebook','instagram'];
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_.-]{1,120}$/.test(v)?v:null;
 const touchKey=product=>'sc_site_touch_v2:'+product,tokenKey=product=>'sc_site_attribution_v2:'+product;
 let capturedSearch=null;
 function captureTouch(){
  const page=new URL(root.location.href),q=page.searchParams;
  if(page.search===capturedSearch)return;
  capturedSearch=page.search;
  const explicitProduct=q.get('utm_product');
  const landing=products.includes(explicitProduct) ? explicitProduct : page.hash==='#calculator' ? 'calculator' : 'consulting';
  if(sources.includes(q.get('utm_source')))try{root.sessionStorage.setItem(touchKey(landing),JSON.stringify({at:Date.now(),input:{source:q.get('utm_source'),campaignId:id(q.get('utm_id')||q.get('utm_campaign')),creativeId:id(q.get('utm_content'))}}));}catch{}
 }
 captureTouch();
 function inputFor(product){
  let input={source:'unknown',campaignId:null,creativeId:null};
  try{const t=JSON.parse(root.sessionStorage.getItem(touchKey(product)));if(t&&Number.isSafeInteger(t.at)&&t.at<=Date.now()&&Date.now()-t.at<7*86400000&&sources.includes(t.input?.source))input={source:t.input.source,campaignId:id(t.input.campaignId),creativeId:id(t.input.creativeId)};}catch{}
  return {...input,productType:product};
 }
 async function getToken(product='consulting'){
  if(!products.includes(product)||!root.CONFIG?.api?.consultingPublic)return null;
  captureTouch();
  const input=inputFor(product),signature=JSON.stringify(input);let saved;
  try{saved=JSON.parse(root.sessionStorage.getItem(tokenKey(product)));}catch{}
  if(saved?.signature===signature&&typeof saved.token==='string'&&saved.token.length>0&&saved.token.length<=1600&&Date.parse(saved.expiresAt)>Date.now())return saved.token;
  if(pending.get(product)?.signature===signature)return pending.get(product).promise;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
  const promise=(async()=>{
   try{
    const r=await fetch(root.CONFIG.api.consultingPublic,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'create_consulting_ad_attribution',data:input}),signal:controller.signal});
    const b=await r.json(),d=b.data;
    if(!r.ok||b.success!==true||typeof d?.token!=='string'||!d.token.length||d.token.length>1600||!(Date.parse(d.expiresAt)>Date.now())||d.productType&&d.productType!==product||product==='calculator'&&d.productType!=='calculator')return null;
    try{root.sessionStorage.setItem(tokenKey(product),JSON.stringify({...d,signature}));}catch{}
    return d.token;
   }catch{return null;}finally{clearTimeout(timer);if(pending.get(product)?.signature===signature)pending.delete(product);}
  })();
  pending.set(product,{signature,promise});return promise;
 }
 async function decorate(href,entry){
  let url;try{url=new URL(href);}catch{return href;}
  if(url.origin!=='https://docs.google.com'||!url.pathname.startsWith('/forms/')||!/^entry\.\d+$/.test(entry)||url.searchParams.has(entry))return href;
  const token=await getToken('consulting');if(token)url.searchParams.set(entry,token);return url.href;
 }
 root.SCConsultingAttribution=Object.freeze({decorate,getToken});
})(window);

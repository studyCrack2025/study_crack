/* Optional consulting attribution; no cookies or contact data. */
(function(root){
 'use strict';
 const KEY='sc_consulting_attribution_v1', pending=new Map();
 async function getToken(){
  const q=new URL(root.location.href).searchParams;
  let input={source:q.get('utm_source')||'unknown',campaignId:q.get('utm_id')||q.get('utm_campaign')||null,creativeId:q.get('utm_content')||null};
  if(input.source==='unknown')try{const touch=JSON.parse(root.sessionStorage.getItem('sc_consulting_touch_v1'));if(touch&&Date.now()-touch.at>=0&&Date.now()-touch.at<7*86400000)input=touch.input;}catch{}
  const signature=JSON.stringify(input);let saved;
  try{saved=JSON.parse(root.sessionStorage.getItem(KEY));}catch{}
  if(saved&&Date.parse(saved.expiresAt)>Date.now()&&saved.signature===signature&&typeof saved.token==='string')return saved.token;
  if(pending.has(signature))return pending.get(signature);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
  const task=(async()=>{
   try{
    const r=await fetch(root.CONFIG.api.consultingPublic,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'create_consulting_ad_attribution',data:input}),signal:controller.signal});
    const b=await r.json();if(!r.ok||b.success!==true||typeof b.data?.token!=='string'||b.data.token.length>1600||!(Date.parse(b.data.expiresAt)>Date.now()))return null;
    try{root.sessionStorage.setItem(KEY,JSON.stringify({...b.data,signature}));}catch{}
    return b.data.token;
   }catch{return null;}finally{clearTimeout(timer);pending.delete(signature);}
  })();pending.set(signature,task);return task;
 }
 async function decorate(href,entry){
  try{
   const url=new URL(href);if(url.origin!=='https://docs.google.com'||!url.pathname.startsWith('/forms/')||!/^entry\.\d+$/.test(entry))return href;
   const token=await getToken();if(token)url.searchParams.set(entry,token);return url.href;
  }catch{return href;}
 }
 root.SCConsultingAttribution=Object.freeze({decorate,getToken});
})(window);

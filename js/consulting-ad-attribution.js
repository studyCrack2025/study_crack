/* Load after CONFIG and before jungsi-consulting.js. No cookies or contact data. */
(function(root){
 'use strict';
 const KEY='sc_consulting_attribution_v1';let pending;
 async function decorate(href,entry){
  const url=new URL(href);if(url.origin!=='https://docs.google.com'||!url.pathname.startsWith('/forms/')||!/^entry\.\d+$/.test(entry))return href;
  const q=new URL(root.location.href).searchParams;
  let input={source:q.get('utm_source')||'unknown',campaignId:q.get('utm_id')||q.get('utm_campaign')||null,creativeId:q.get('utm_content')||null};
  if(input.source==='unknown')try{const touch=JSON.parse(root.sessionStorage.getItem('sc_consulting_touch_v1'));if(touch&&Date.now()-touch.at<7*86400000)input=touch.input;}catch{}
  const signature=JSON.stringify(input);let saved;
  try{saved=JSON.parse(root.sessionStorage.getItem(KEY));}catch{}
  if(saved&&Date.parse(saved.expiresAt)>Date.now()&&(saved.signature===signature||input.source==='unknown')){url.searchParams.set(entry,saved.token);return url.href;}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
  try{
   if(!pending)pending=fetch(root.CONFIG.api.consultingPublic,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'create_consulting_ad_attribution',data:input}),signal:controller.signal}).then(async r=>{const b=await r.json();if(!r.ok||b.success!==true||typeof b.data?.token!=='string')throw new Error('Attribution unavailable');return b.data;}).finally(()=>pending=null);
   const data=await pending;
   try{root.sessionStorage.setItem(KEY,JSON.stringify({...data,signature}));}catch{}
   url.searchParams.set(entry,data.token);return url.href;
  }catch{return href;}finally{clearTimeout(timer);}
 }
 root.SCConsultingAttribution=Object.freeze({decorate});
})(window);

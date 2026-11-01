import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import vm from 'node:vm';
const read = name => readFile(new URL('../../'+name,import.meta.url),'utf8');
const pages=['index','service','analysis','payment','qna','jungsi-score-guide','jungsi-admission-prediction-guide','jungsi-percentile-guide'];
test('every indexed page shares a published asset and guide structured data describes visible content',async()=>{
 const policy=JSON.parse(await read('tools/public-site-files.json'));
 for(const name of pages){
  const html=await read(name+'.html');
  const match=html.match(/property="og:image" content="https:\/\/studycrack.co.kr\/([^\"]+)"/);
  assert.ok(match,name+' share image');assert.ok(policy.files.includes(match[1]));
  assert.ok((await stat(new URL('../../'+match[1],import.meta.url))).size<300000);
  const data=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  if(name.startsWith('jungsi-')){
   const article=data.find(x=>x['@type']==='Article');assert.ok(article);assert.ok(html.includes(article.headline));
   assert.ok(html.includes(article.datePublished.slice(0,10)));assert.ok(html.includes(article.dateModified.slice(0,10)));
   assert.equal(article.author.name,'스터디크랙');assert.ok(data.some(x=>x['@type']==='BreadcrumbList'));
  }
 }
});
test('edge candidate canonicalizes known pages once and preserves raw encoded duplicate query values',async()=>{
 const context=vm.createContext({});vm.runInContext(await read('tools/seo-edge/viewer-request.js'),context);
 const request=(uri,host='studycrack.co.kr',method='GET')=>({uri,method,headers:{host:{value:host}},querystring:{utm_source:{value:'a%20b'},tag:{multiValue:[{value:'x'},{value:'y%2Fz'}]}}});
 for(const uri of ['/service/','/service.html','/service.html/']){
  const result=context.handler({request:request(uri)});assert.equal(result.statusCode,301);
  assert.equal(result.headers.location.value,'https://studycrack.co.kr/service?utm_source=a%20b&tag=x&tag=y%2Fz');
 }
 for(const req of [request('/service'),request('/unknown/'),request('/assets/x.png'),request('/service/','studycrack.co.kr','POST'),request('/service/','dev.studycrack.co.kr')])assert.equal(context.handler({request:req}),req);
 assert.equal(context.handler({request:request('/index.html','www.studycrack.co.kr')}).headers.location.value,'https://studycrack.co.kr/?utm_source=a%20b&tag=x&tag=y%2Fz');
});
test('SVG masks have numeric view boxes and preserve all five pages without third-party icon stylesheets',async()=>{
 const css=await read('css/icons-subset.css');let count=0;
 for(const match of css.matchAll(/base64,([A-Za-z0-9+/=]+)/g)){
  const svg=Buffer.from(match[1],'base64').toString();assert.match(svg,/viewBox="\d+ \d+ \d+ \d+"/);assert.match(svg,/<path d="[^\"]+"/);count++;
 }
 assert.ok(count>20);
 for(const page of pages.slice(0,5)){
  const html=await read(page+'.html');assert.doesNotMatch(html,/cdnjs.cloudflare.com\/ajax\/libs\/font-awesome/);
  for(const icon of html.matchAll(/class="[^\"]*\bfa-([a-z][a-z-]+)[^\"]*"/g)){
   if(['solid','regular','brands'].includes(icon[1]))continue;
   assert.ok(css.includes('.fa-'+icon[1]),'missing icon '+icon[1]+' on '+page);
  }
 }
});

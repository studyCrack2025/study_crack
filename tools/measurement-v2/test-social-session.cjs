const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'../../js/social-callback.js'),'utf8');
const start=code.indexOf('    async function finishSocialLogin('),end=code.indexOf('    window.closePendingSocialSignupTermsModal',start);
assert(start>=0&&end>start);
async function run(result,status=200) {
 const store=new Map(),session=new Map(),events=[],errors=[];
 const ctx={IS_LOCAL:true,USER_API_URL:'https://example.invalid/user',statusMsg:{},startedFromMobile:false,localStorage:{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)||null},sessionStorage:{setItem:(k,v)=>session.set(k,v)},setAccessToken:v=>session.set('accessToken',v),setIdToken(){},getSharedBearerToken:()=>session.get('accessToken'),clearClientSession:()=>{store.clear();session.clear()},registerRefreshCookie:async()=>{},fetch:async()=>({ok:status===200,status,json:async()=>({})}),getSafeSocialReturnUrl:()=>'',clearSocialReturnState(){},showError:s=>errors.push(s),window:{location:{href:''},SCTrack:{identify(){},event:e=>events.push(e)}}};
 vm.createContext(ctx);vm.runInContext(code.slice(start,end),ctx);await ctx.finishSocialLogin(result);return {ctx,events,errors};
}
(async()=>{
 let r=await run({userId:'local-user',isNewUser:false});assert.equal(r.ctx.window.location.href,'');assert(r.errors[0].includes('로컬'));assert.equal(r.events.length,0);
 r=await run({userId:'local-user',accessToken:'mock-token',isNewUser:false},403);assert.equal(r.ctx.window.location.href,'');assert(r.errors[0].includes('403'));assert.equal(r.events.length,0);
 r=await run({userId:'local-user',accessToken:'mock-token',isNewUser:false});assert.equal(r.ctx.window.location.href,'/');assert.deepEqual(r.events,['login']);
 const out={scope:'Mocked social callback logic, not real server authentication',passed:['Missing local tokens stops success redirect','Profile HTTP 403 stops success redirect and login event','Validated profile permits login event and redirect']};
 console.log(JSON.stringify(out));
})().catch(e=>{console.error(e);process.exitCode=1});

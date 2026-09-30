const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/../../js/shared/api.js','utf8');
const helper=src.slice(src.indexOf('async function resolveMeasurementIdentity()'));
const passed=[];
async function run({status=200,profile={role:'student',userId:'verified'},id='verified',tokenId='verified',refresh=false,secondStatus=200,switched=false}={}){
 let calls=0;const context={localStorage:{getItem:()=>switched&&calls?'other':id},CONFIG:{api:{user:'https://test.invalid/user'}},getSharedBearerToken:()=> 'token',getSharedPayloadFromToken:()=>({sub:tokenId}),tryRefreshToken:async()=>refresh,fetch:async()=>{const s=calls++?secondStatus:status;return {ok:s===200,status:s,json:async()=>profile}}};
 vm.createContext(context);vm.runInContext(helper,context);return {id:await context.resolveMeasurementIdentity(),calls};
}
(async()=>{
 assert.equal((await run()).id,'verified');passed.push('Profile-authorized identity persists without auth.js');
 assert.equal((await run({status:403})).id,null);passed.push('Denied session cannot identify analytics');
 const refreshed=await run({status:401,refresh:true});assert.equal(refreshed.id,'verified');assert.equal(refreshed.calls,2);passed.push('One refresh and profile retry allowed');
 assert.equal((await run({profile:{role:'student',userId:'other'}})).id,null);assert.equal((await run({switched:true})).id,null);passed.push('Mismatched or changed account cannot leak cached identity');
 assert.equal((await run({profile:{success:false}})).id,null);passed.push('False success body rejected');
 const result={passed,scope:'Mocked identity verification; separate browser receipt required'};console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1});

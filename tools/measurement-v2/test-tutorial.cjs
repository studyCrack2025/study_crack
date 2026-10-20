const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/../../js/tutorial.js','utf8');
function setup(result){
 const events=[], handlers={}, redirects=[],storage=new Map();
 const context={document:{addEventListener:(name,fn)=>handlers[name]=fn}, window:{SCTrack:{once:(key,name)=>{if(!events.includes(name))events.push(name)},event:name=>events.push(name)},location:{search:'',replace:url=>redirects.push(url)}},localStorage:{getItem:key=>key==='userId'?'test':storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},URLSearchParams,CONFIG:{api:{user:'test'}},apiFetch:async()=>({ok:true,json:async()=>({tutorialRewardClaimed:true})}),console};
 vm.createContext(context);vm.runInContext(code,context);context.apiCall=async()=>result;
 return {context,events,handlers,redirects,storage};
}
(async()=>{
 let test=setup({success:true});await test.handlers.DOMContentLoaded();assert.deepEqual(test.events,[]);assert.deepEqual(test.redirects,['/']);
 test=setup({success:false,error:'save failed'});await assert.rejects(test.context._completeTutorial('/basic-preview'));assert.deepEqual(test.events,[]);assert(!test.storage.has('tutorial_completed'));
 test=setup({success:true});await test.context._completeTutorial('/basic-preview');assert.deepEqual(test.events,['tutorial_complete']);assert.equal(test.context.window.location.href,'/basic-preview');
 test=setup({success:true});vm.runInContext("mbtiDimSelections=['C','S','D','R']; simulateMbtiAnalysis=()=>{};",test.context);test.context.confirmMBTIDims();await Promise.resolve();await Promise.resolve();assert.deepEqual(test.events,['learning_profile_complete']);
 test=setup({success:false});vm.runInContext("mbtiDimSelections=['C','S','D','R']; simulateMbtiAnalysis=()=>{};",test.context);test.context.confirmMBTIDims();await Promise.resolve();await Promise.resolve();assert.deepEqual(test.events,[]);
 const result={passed:['Returning completed user does not emit completion','Failed completion emits nothing and preserves incomplete state','Successful completion emits before redirect','Direct profile selection emits only after successful save','Failed profile save emits no completion'],scope:'Mocked application execution; live tutorial completion not performed'};
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1});

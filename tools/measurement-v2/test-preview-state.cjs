const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
function bridge(file){let calls=[];let s={window:{SCTrack:{once:(...x)=>calls.push(x),event:(...x)=>calls.push(x)}}};vm.createContext(s);let txt=fs.readFileSync(file,'utf8');vm.runInContext(txt.slice(0,txt.indexOf('function setBasicPreviewStatus')),s);return {s,calls};}
let n=bridge(path.join(__dirname,'../../js/basic-preview.js'));
vm.runInContext("trackBasicPreview('basic_preview_start',{preview_state:'loading'});trackBasicPreview('basic_preview_state',{preview_state:'needs_scores'});trackBasicPreview('basic_preview_state',{preview_state:'sensitive arbitrary string'});trackBasicPreview('basic_preview_ready');",n.s);
assert.equal(n.calls[0][1],'basic_preview_start');assert.equal(n.calls[1][0],'basic_preview_state');assert.equal(n.calls[1][1].preview_state,'needs_scores');assert.equal(n.calls[2][1].preview_state,'analysis_failed');assert.equal(n.calls[3][1],'analysis_view');

console.log('Preview state bridge tests passed (no network)');

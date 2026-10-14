import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('comparison guide has usable analysis and official reference destinations',()=>{
 const html=readFileSync(new URL('../../service.html',import.meta.url),'utf8');
 const section=html.match(/<section class="section score-comparison-guide"[\s\S]*?<\/section>/)?.[0];
 assert.ok(section);
 assert.match(section,/href="\/survey"/);
 assert.match(section,/href="https:\/\/www\.adiga\.kr\/man\/inf\/mainView\.do\?menuId=PCMANINF1000"/);
 for(const [,id] of section.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${id}"`),'internal link target must exist');
 assert.match(section,/합격을 보장하지 않습니다/);
});

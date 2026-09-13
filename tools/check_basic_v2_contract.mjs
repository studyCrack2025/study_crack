import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = new URL('../', import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8');
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

const [home, homeScript, tutorial, tutorialScript, analysisScript, preview, previewScript] = await Promise.all([
  read('index.html'),
  read('js/script.js'),
  read('tutorial.html'),
  read('js/tutorial.js'),
  read('js/analysis.js'),
  read('basic-preview.html'),
  read('js/basic-preview.js')
]);

const publicBasicV2Sources = [home, homeScript, tutorial, tutorialScript, preview, previewScript].join('\n');
assert.match(home, /나에게 가장 가치 있는 다음 1점/, 'the landing must include the Basic v2 eyebrow');
assert.match(home, /합격에 유리하고,/, 'the landing must include the first line of the Basic v2 hero title');
assert.match(home, /내가 올리기 쉬운 과목부터\./, 'the landing must include the second line of the Basic v2 hero title');
assert.match(home, /내 성적으로 다음 1점 확인하기/, 'the landing must include the Basic v2 primary CTA');
assert.match(homeScript, /basic_landing_cta_click/, 'the landing must track the approved Basic v2 CTA event');
assert.doesNotMatch(publicBasicV2Sources, /StudyCrack\s*X\s*KCC|\/promotion\/kcc01/, 'Basic v2 screens must not restore the KCC promotion');
assert.doesNotMatch(publicBasicV2Sources, /최대\s*18개/, 'Basic v2 screens must not claim an unconfirmed 18-target limit');

assert.equal(occurrences(preview, '/css/basic-preview.css'), 1, 'the preview stylesheet must load exactly once');
assert.equal(occurrences(preview, '/js/basic-preview.js'), 1, 'the preview script must load exactly once');
assert.match(preview, /name="robots" content="noindex,nofollow"/, 'the personalized preview must remain noindex');
assert.match(preview, /href="\/payment\?plan=basic"/, 'the Basic unlock CTA must open the Basic checkout');
assert.match(previewScript, /type: 'get_basic_preview'/, 'the preview must request only the dedicated server contract');

assert.match(tutorialScript, /complete_tutorial_preview/, 'the tutorial must complete through the preview flow');
assert.doesNotMatch(tutorialScript, /grant_tutorial_trial/, 'the Basic v2 tutorial must not issue an automatic Trial');
assert.match(analysisScript, /complete_tutorial_preview/, 'the legacy tutorial completion path must use the preview flow');
assert.doesNotMatch(analysisScript, /grant_tutorial_trial/, 'the legacy frontend path must not issue an automatic Trial');
assert.match(tutorial, /onclick="showBasicPreview\(\)"/, 'the tutorial result CTA must open the personalized preview');

console.log('Basic v2 frontend contracts passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/config.js', import.meta.url), 'utf8');

function configFor(hostname, override = '') {
  const window = { location: { hostname }, STUDYCRACK_API_BASE_URL: override };
  vm.runInNewContext(source, { window });
  return window.CONFIG;
}

assert.match(configFor('localhost').api.user, /execute-api\.ap-northeast-2\.amazonaws\.com\/local\/api\/user$/);
assert.equal(configFor('dev.studycrack.co.kr').api.user, 'https://api.dev.studycrack.co.kr/api/user');
assert.equal(configFor('studycrack.co.kr').api.user, 'https://api.studycrack.co.kr/api/user');
assert.equal(configFor('localhost', 'http://127.0.0.1:4567').api.user, 'http://127.0.0.1:4567/api/user');
assert.equal(configFor('dev.studycrack.co.kr').api.consulting, 'https://api.dev.studycrack.co.kr/api/consulting');
assert.equal(configFor('studycrack.co.kr').api.consultingPublic, 'https://api.studycrack.co.kr/api/consulting-public');

console.log('config-routing contracts passed');

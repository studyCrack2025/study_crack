import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../../js/checkout.js', import.meta.url), 'utf8');
const notice = vm.runInNewContext(source.slice(0, source.indexOf('function initCheckoutExitGuard')) + '\ncheckoutProductNotice');

test('purchase disclosure distinguishes one-off analysis and diagnosis from four-week plans', () => {
  const basic = notice('basic');
  assert.match(basic.notice, /BASIC/); assert.doesNotMatch(basic.notice + basic.agreement, /4주/);
  const starter = notice('starter');
  assert.match(starter.notice, /STARTER 1주 플래너 진단/); assert.doesNotMatch(starter.agreement, /4주/);
  for (const tier of ['standard', 'pro']) {
    assert.match(notice(tier).notice, /4주/);
    assert.match(notice(tier).agreement, /4주/);
  }
  assert.equal(notice('unknown').notice, '');
});

test('reserved four-week notice uses a validated Korean date without changing the billed amount', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  assert.match(notice('pro', '2026-10-01T15:00:00Z', now).notice, /2026년 10월 2일/);
  assert.doesNotMatch(notice('basic', '2026-10-01', now).notice, /부터 이용/);
  assert.doesNotMatch(notice('pro', 'invalid', now).notice, /Invalid|부터 이용/);
  assert.doesNotMatch(notice('pro', '2026-09-01', now).notice, /부터 이용/);
  assert.match(source, /agreementText.textContent = productNotice.agreement/);
  assert.match(source, /noticeBox.textContent = productNotice.notice/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PLAN_META } from '../../studycrack-mobile-app/src/constants/plans.js';

test('web and mobile product summaries describe analysis without promising AI generation or admission', async () => {
  const [payment, checkout, service, support] = await Promise.all([
    'payment.html', 'js/checkout.js', 'service.html',
    'studycrack-mobile-app/src/screens/mypage/MyPageSecondaryScreens.jsx'
  ].map(file => readFile(new URL(`../../${file}`, import.meta.url), 'utf8')));
  assert.ok(payment.includes(PLAN_META.Basic.desc));
  assert.ok(checkout.includes(PLAN_META.Basic.desc));
  assert.ok(payment.includes(PLAN_META.Pro.desc));
  assert.ok(service.includes(PLAN_META.Pro.desc));
  for (const text of [PLAN_META.Basic.desc, PLAN_META.Pro.desc, payment, checkout, service]) {
    assert.doesNotMatch(text, /AI 기반 합격 예측 분석|합격 보장형 프리미엄 전략 관리/);
  }
  assert.ok(PLAN_META.Pro.features.includes('조건부 환급 혜택 제공'));
  assert.ok(support.includes('분석 결과는 참고 자료이며 합격을 보장하지 않습니다.'));
  assert.equal(PLAN_META.Standard.payPrice, '49,000원 / 4주');
  assert.equal(PLAN_META.Pro.payPrice, '149,000원 / 4주');
});

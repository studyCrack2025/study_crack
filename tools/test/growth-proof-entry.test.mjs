import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const home = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../css/style.css', import.meta.url), 'utf8');

test('기존 기본 버튼을 유지하고 개인화 결과 확인 조건을 안내한다', () => {
  assert.ok(home.includes('<a class="hero-cta basic-preview-entry" data-entry="hero" href="/basic-preview">내 성적으로 다음 1점 확인하기</a>'));
  assert.ok(home.includes('<p class="hero-note">로그인·성적 입력 후 개인화 결과를 확인할 수 있어요.<br> 전체 분석은 필요할 때 선택하세요.</p>'));
});

test('로그인 없이 기존 실제 화면으로 이동하는 접근 가능한 링크를 제공한다', () => {
  assert.ok(home.includes('<a class="hero-example-link" href="#analysis-example">가입 전 실제 분석 화면 보기 ↓</a>'));
  assert.ok(home.includes('<section id="analysis-example" class="section-bg dark-feature landing-proof scroll-reveal" aria-labelledby="analysisExampleTitle" tabindex="-1">'));
  assert.ok(home.includes('<h2 id="analysisExampleTitle">'));
  assert.ok(home.includes('실제 화면 발췌 · 화면마다 입력 사례가 다릅니다.'));
  assert.match(css, /\.hero-example-link:focus-visible/);
  assert.match(css, /#analysis-example\s*\{[^}]*scroll-margin-top:/);
});

test('히어로 부제는 승인된 두 문장을 표시한다', () => {
  assert.match(home, /<p class="hero-subtitle">내 성적에서 목표 대학까지,<br> 먼저 올릴 과목과 점수를 확인하세요\.<\/p>/);
});

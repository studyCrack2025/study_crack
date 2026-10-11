import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');

const one = (pattern, source, message) => {
  const matches = [...source.matchAll(pattern)];
  assert.equal(matches.length, 1, message);
  return matches[0][1];
};

test('Q&A has a clear indexable page identity and self-canonical', async () => {
  const html = await read('qna.html');
  const head = one(/<head\b[^>]*>([\s\S]*?)<\/head>/gi, html, 'Q&A must have one head');
  assert.match(head, /<title>스터디크랙 FAQ \| 분석·서비스 이용 안내<\/title>/);
  assert.match(head, /href="\/css\/qna\.css\?v=20261011a"/);
  assert.match(head, /<meta name="description" content="[^\"]*목표 대학[^\"]*과목별 목표 점수[^\"]*"/);
  assert.match(head, /<link rel="canonical" href="https:\/\/studycrack\.co\.kr\/qna"\s*\/>/);
  assert.doesNotMatch(head, /noindex/i, 'public Q&A must not be marked noindex');
  assert.equal([...html.matchAll(/<h1\b/gi)].length, 1, 'Q&A must have exactly one H1');
  assert.match(html, /<h1[^>]*>스터디크랙 자주 묻는 질문<\/h1>/);
});

test('Q&A answers avoid unsupported accuracy promises and stale plan limits', async () => {
  const html = await read('qna.html');
  assert.match(html, /합격을 보장하지 않습니다/);
  assert.match(html, /대학별 모집요강/);
  assert.doesNotMatch(html, /최근 3개년|높은 정확도를 제공합니다|합격할 수밖에/);
  assert.doesNotMatch(html, /6개 대학 세트|총 5번까지만|무제한으로 수정|Standard 이상을 추천/);
  assert.match(html, /href="\/payment"[^>]*>현재 플랜 안내 확인<\/a>/);
});

test('service page leads with confirmed analysis capabilities and official admissions reference', async () => {
  const html = await read('service.html');
  const head = one(/<head\b[^>]*>([\s\S]*?)<\/head>/gi, html, 'Service must have one head');
  assert.match(head, /<meta name="description" content="[^\"]*대학별 환산 점수[^\"]*과목별 목표 점수[^\"]*"/);
  assert.match(html, /<h1[^>]*>내 성적으로 목표 대학과 과목별 목표 점수를 살펴보세요<\/h1>/);
  assert.match(html, /대학별 환산 점수/);
  assert.match(html, /과목별 목표 점수/);
  assert.match(html, /합격을 보장하지 않습니다/);
  assert.ok(html.includes('href="https://www.adiga.kr/man/inf/mainView.do?menuId=PCMANINF1000"'));
  assert.ok(html.includes('대입정보포털 어디가에서 대학별 모집요강 확인'));
  assert.doesNotMatch(html, /SKY 멘토가 당신 전용 공부 전략을|합격할 수밖에 없게 만듭니다|예측 모델로 정밀하게 조정|CMDF 분석형 전략가|논리적인 계획에 특화된 학생 유형/);
  assert.match(html, /과목별 성적 분석 예시/);
  assert.match(html, /href="\/survey"[^>]*>내 성적 기준으로 분석 시작하기/);
});

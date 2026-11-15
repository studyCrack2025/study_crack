import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('analysis metadata matches the existing score-comparison capability and avoids an admission guarantee', async () => {
  const html = await readFile(new URL('../../analysis.html', import.meta.url), 'utf8');
  const headMatches = [...html.matchAll(/<head\b[^>]*>([\s\S]*?)<\/head>/gi)];
  assert.equal(headMatches.length, 1, 'analysis page must have one head');
  const head = headMatches[0][1];
  assert.match(head, /<title>수능 점수로 정시 대학별 합격 가능성 비교 \| 스터디크랙<\/title>/);
  assert.match(head, /<meta name="description" content="[^\"]*정시 합격 예측[^\"]*환산 점수[^\"]*참고 자료이며 합격을 보장하지 않습니다/);
  assert.match(head, /<meta property="og:title" content="수능 점수로 정시 대학별 합격 가능성 비교 \| 스터디크랙"\s*\/>/);
  assert.match(head, /<meta property="og:description" content="[^\"]*환산 점수[^\"]*합격을 보장하지 않습니다/);
  assert.match(head, /<link rel="canonical" href="https:\/\/studycrack\.co\.kr\/analysis"\s*\/>/);
  assert.doesNotMatch(head, /noindex/i, 'existing indexability must be preserved');
  assert.match(html, /<h1 class="sr-only">나만의 입시 솔루션 - 점수 분석 및 합격 시뮬레이션<\/h1>/);
  assert.match(html, /합격 가능성 위치/);
  assert.match(html, /분석 결과는 참고 자료|합격을 보장하지 않습니다/);
});
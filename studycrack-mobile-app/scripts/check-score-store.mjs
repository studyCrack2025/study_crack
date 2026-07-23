import assert from 'node:assert/strict';
import {
  buildScoreSignature,
  buildUniversityCard,
  normalizeServerResults
} from '../src/runtime/score-store.js';

const scoresA = { math: { elective: 28, common: 44 }, kor: { elective: 31, common: 42 } };
const scoresAReordered = { kor: { common: 42, elective: 31 }, math: { common: 44, elective: 28 } };
const scoresB = { ...scoresAReordered, math: { common: 45, elective: 28 } };
const signatureA = buildScoreSignature('mar', ['고려대학교 경영학과', '연세대학교 경영학과'], scoresA);

assert.equal(
  signatureA,
  buildScoreSignature('mar', ['연세대학교 경영학과', '고려대학교 경영학과'], scoresAReordered),
  '대학 순서와 객체 key 순서는 같은 요청으로 정규화해야 합니다.'
);
assert.notEqual(
  signatureA,
  buildScoreSignature('mar', ['연세대학교 경영학과', '고려대학교 경영학과'], scoresB),
  '원점수가 바뀌면 요청 시그니처가 달라야 합니다.'
);

const normalized = normalizeServerResults([
  {
    univ: '연세대학교',
    major: '경영학과',
    converted_score: 0,
    score_available: true,
    is_eligible: true,
    status: '고위험 (F)'
  },
  {
    univ: '고려대학교',
    major: '경영학과',
    converted_score: 0,
    score_available: false,
    score_unavailable_reason: '합격컷 데이터 없음',
    is_eligible: true,
    status: '분석 불가'
  }
], [], signatureA);

assert.equal(normalized['연세대학교경영학과'].score, 0, '계산된 0점은 유효한 점수여야 합니다.');
assert.equal(normalized['연세대학교경영학과'].available, true);
assert.equal(normalized['연세대학교경영학과'].sourceSignature, signatureA);
assert.equal(normalized['고려대학교경영학과'].score, null, '계산 불가 0점은 점수로 저장하면 안 됩니다.');
assert.equal(normalized['고려대학교경영학과'].available, false);
assert.equal(
  buildUniversityCard('고려대학교 경영학과', { mar: normalized }, 'mar', 'ready').scoreStatus,
  'empty',
  '계산 불가 엔트리는 확정 점수로 렌더링하면 안 됩니다.'
);

const legacy = normalizeServerResults([
  { univ: '성균관대학교', major: '경제학과', converted_score: 72, is_eligible: true, status: '소신 (D)' },
  { univ: '한양대학교', major: '경제학과', converted_score: 0, is_eligible: false, status: '지원 불가' }
]);
assert.equal(legacy['성균관대학교경제학과'].available, true, '구버전 정상 응답은 배포 전에도 호환해야 합니다.');
assert.equal(legacy['한양대학교경제학과'].available, false, '구버전 지원 불가 0점은 확정하면 안 됩니다.');

console.log('score-store contracts passed');

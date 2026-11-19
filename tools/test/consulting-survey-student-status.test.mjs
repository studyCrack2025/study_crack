import test from 'node:test';
import assert from 'node:assert/strict';
import { clientSurveyError, createEmptySurvey, isSchoolFieldInapplicable, normalizeSurveyDraft, surveySaveSnapshot } from '../../studycrack-mobile-app/src/features/consulting-v2/survey-model.js';
import { supplementFieldChanged } from '../../studycrack-mobile-app/src/features/consulting-v2/survey-supplement-model.js';

test('검정고시는 졸업연도 없이 저장하며 합격연도를 졸업연도에서 추정하지 않는다', () => {
  const draft = createEmptySurvey();
  Object.assign(draft.studentStatus, { applicantType: 'qualification_exam', graduationYear: null, residenceRegion: '서울' });
  assert.notEqual(clientSurveyError(draft, [])?.section, 'studentStatus');
  assert.equal(Object.hasOwn(surveySaveSnapshot(draft).studentStatus, 'qualificationExamYear'), false);
  const prior = normalizeSurveyDraft({ studentStatus: { applicantType: 'qualification_exam', graduationYear: 2024, schoolName: '이전 학교' } });
  assert.equal(prior.studentStatus.qualificationExamYear, undefined);
  assert.equal(prior.studentStatus.graduationYear, 2024);
  assert.equal(prior.studentStatus.schoolName, '이전 학교');
  prior.studentStatus.qualificationExamYear = 2015;
  assert.equal(surveySaveSnapshot(prior).studentStatus.qualificationExamYear, 2015);
  assert.equal(normalizeSurveyDraft(surveySaveSnapshot(prior)).studentStatus.qualificationExamYear, 2015);
});

test('지원자 유형별 필수 연도와 합격연도 범위를 검사하고 공란을 가짜 수정으로 세지 않는다', () => {
  const snapshot = createEmptySurvey();
  Object.assign(snapshot.studentStatus, { applicantType: 'qualification_exam', graduationYear: null, residenceRegion: '서울' });
  for (const year of [0, 2027, 2026.5, '2026']) {
    snapshot.studentStatus.qualificationExamYear = year;
    assert.equal(clientSurveyError(snapshot, [])?.section, 'studentStatus');
  }
  snapshot.studentStatus.qualificationExamYear = null;
  assert.notEqual(clientSurveyError(snapshot, [])?.section, 'studentStatus');
  assert.equal(supplementFieldChanged('studentStatus.qualificationExamYear', {}, snapshot, [], []), false);
  for (const applicantType of ['graduate', 'high_school_senior']) {
    snapshot.studentStatus.applicantType = applicantType;
    assert.equal(clientSurveyError(snapshot, [])?.section, 'studentStatus');
  }
  snapshot.studentStatus.applicantType = 'qualification_exam';
  assert.equal(isSchoolFieldInapplicable(snapshot, 'studentStatus.graduationYear'), true);
  assert.equal(isSchoolFieldInapplicable(snapshot, 'studentStatus.qualificationExamYear'), false);
  assert.equal(isSchoolFieldInapplicable(snapshot, 'studentStatus.residenceRegion'), false);
});

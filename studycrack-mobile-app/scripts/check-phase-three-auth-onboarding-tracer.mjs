import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [authSource, introSource, surveySource, ob3Source, resultSource, screenContext, resources, profileHandlers] = await Promise.all([
  readFile(new URL('../src/screens/auth/AuthScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/onboarding/IntroScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/onboarding/SurveyScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/onboarding/Ob3Screen.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/screens/onboarding/ResultScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/screen-context.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/analysis/use-university-resources.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/handlers/profile-handlers.js', import.meta.url), 'utf8')
]);

assert.match(authSource, /AuthFindIdScreen\(ctx\)/);
assert.match(authSource, /AuthFindPwScreen\(ctx\)/);
assert.match(authSource, /data-find-email-name/);
assert.match(authSource, /data-reset-email/);
assert.doesNotMatch(authSource, /로그인 화면의 이메일 찾기 창/);
assert.doesNotMatch(authSource, /로그인 화면의 비밀번호 찾기 창/);

assert.doesNotMatch(introSource, />128<|환산점수 \+18점/);
assert.match(introSource, /대학별 반영 방식/);
assert.match(surveySource, /data-action="saveQualInfo"/);
assert.match(surveySource, /data-action="saveScoreEdit"/);
assert.match(surveySource, /disabled=\{scoreSubjectSaving\}/);
assert.match(surveySource, /data-field="v2e-korean-common"/);
assert.match(profileHandlers, /ctx\.screen === 'ob1'/);
assert.match(profileHandlers, /ctx\.screen === 'ob2'/);

assert.doesNotMatch(ob3Source, /질문 4개/);
assert.match(ob3Source, /36문항/);

for (const mockText of [
  '연세대학교 경영학과',
  '고려대학교 경영학과',
  '성균관대학교 글로벌경영학과',
  '국민대 경영학부',
  '숭실대 경제학과',
  '세종대 미디어커뮤니케이션학과',
  '평균 3개월',
  '환산 +18.0점',
  '환산 +6.8점',
  '환산 +3.0점'
]) assert.doesNotMatch(resultSource, new RegExp(mockText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.match(resultSource, /analysisRecommended/);
assert.match(resultSource, /analysisMajorOptions/);
assert.match(resultSource, /analysisScoreView/);
assert.match(resultSource, /analysisSimulationTargets/);
assert.match(resultSource, /analysisApiStatus/);
assert.match(screenContext, /universityRecommendationStatus/);
assert.match(screenContext, /analysisSimulationTargets/);
assert.match(resources, /\['addUniversity', 'ob4'\]\.includes\(screen\)/);

console.log('phase 3 auth/onboarding tracer contract ok');

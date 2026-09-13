import assert from 'node:assert/strict';
import './check-score-card-gesture.mjs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { buildAnalysisSnapshot } from '../src/screens/analysis/snapshot.js';
import { buildScoreSignature } from '../src/features/analysis/score-store.js';

const vite = await createServer({ appType: 'custom', logLevel: 'silent', root: fileURLToPath(new URL('..', import.meta.url)), server: { middlewareMode: true, hmr: false } });
try {
  const { ScoreJourneyCard } = await vite.ssrLoadModule('/src/screens/onboarding/ScoreJourneyCard.jsx');
  const state = {
    userLoadStatus: 'ready', user: { currentSubscription: { tier: 'standard', status: 'active' }, quantitative: {
      mar: { kor: { raw: 0 }, math: { raw: 80 }, eng: { raw: 90, grd: 1 }, inq1: { raw: 49, name: '물리학I' }, inq2: { raw: 50, name: '생명과학I' } }
    } }, scoreExamKey: 'mar', targetMajor: '대학 A', analysisTargetList: ['대학 A'],
    analysisCalculationRequested: true, analysisApiStatus: 'ready', analysisResultExamMode: 'mar',
    analysisResults: [{ univ: '대학', major: 'A', converted_score: 0, score_available: true }]
  };
  state.analysisResultSignature = buildScoreSignature('mar', state.analysisTargetList, state.user.quantitative.mar);
  const render = patch => renderToStaticMarkup(createElement(ScoreJourneyCard, {
    canUseReverseProjection: true, analysisPresentation: buildAnalysisSnapshot(state),
    // Legacy estimates must never authorize a target or replace a confirmed zero.
    analysisSelected: { score: 70 }, analysisTargetScore: 250, analysisSimRows: [{ subject: '탐구1', gainNum: 1 }],
    scores: { korean: 80, math: 80, english: 90, inquiry1: 49, inquiry2: 50 }, ...patch
  }));
  let html = render();
  assert.match(html, /<span>환산 점수<\/span><b>0점<\/b>/);
  assert.match(html, /<span>국어<\/span><b>0점<\/b>/);
  assert.match(html, /<span>영어<\/span><b>1등급<\/b>/);
  assert.match(html, /목표 성적 미확인/);
  assert.doesNotMatch(html, />250점<|>70점<|>100점<|2등급|유지/);
  assert.match(html, /data-target="analysis"/);
  for (const patch of [{ analysisApiStatus: 'loading' }, { analysisApiStatus: 'error' }, { analysisResultSignature: 'old' }, { scoreExamKey: 'jun' }, { targetMajor: '대학 B', analysisTargetList: ['대학 B'] }, { userLoadStatus: 'loading' }]) {
    html = render({ analysisPresentation: buildAnalysisSnapshot({ ...state, ...patch }) });
    assert.doesNotMatch(html, /<span>환산 점수<\/span><b>0점/);
    assert.match(html, /미확인/);
  }
  for (const score of [null, undefined, '', NaN]) {
    html = render({ analysisPresentation: { ready: true, score, currentScores: [] } });
    assert.doesNotMatch(html, /<span>환산 점수<\/span><b>0점/);
  }
  html = render({ analysisPresentation: { ready: true, score: 12.5, currentScores: [['탐구1', 51, '점'], ['영어', 10, '등급'], ['국어', -1, '점']] } });
  assert.doesNotMatch(html, />51점<|>10등급<|>-1점</);
  assert.match(html, /12.5점/);
  assert.match(render({ canUseReverseProjection: false }), /Standard 이상/);
  console.log('Score journey contracts passed: scoped current values, zero, grade, bounds, stale/unknown target and analysis recovery.');
} finally { await vite.close(); }

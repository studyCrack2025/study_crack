// 환산점수 서브시스템의 단일 출처(재설계). 홈/분석이 공유하던 computeHomeTargets·라이브/mock 폴백·
// 3중 타겟 리스트를 대체한다. 화면은 오직 이 모듈이 만든 카드/엔트리만 읽는다(서버 converted_score 전용).
//
// 데이터 모델
//   scoreCache: { [examKey]: { [univKey]: { score, status, color, sim } } }
//   - univKey = 공백 제거 대학+학과명. 서버 응답의 univ/major를 정규화해 저장한다.
//   - 시험 전환은 examKey만 바뀔 뿐 캐시를 지우지 않는다 → 재진입 시 0 깜빡임 없이 즉시 표시.

import { scoreExamTypeToKey } from './persistence.js';

export function univKey(name) {
  return String(name || '').replace(/\s+/g, '');
}

export function examKeyOf(state = {}) {
  return state.scoreExamKey || scoreExamTypeToKey(state.scoreExamType) || 'active';
}

// (examKey, 정렬된 타겟 리스트) → fetch 시그니처. 동일 시그니처면 재요청하지 않는다.
export function buildScoreSignature(examKey, targetUniversities = []) {
  return `${examKey}::${(targetUniversities || []).map(univKey).filter(Boolean).join('|')}`;
}

// 캐시에서 한 대학의 엔트리를 찾는다. 정확 일치 → 부분 포함(백엔드 학과명 정규화 차이 흡수).
export function selectScoreEntry(scoreCache = {}, examKey = '', name = '') {
  const cache = scoreCache && scoreCache[examKey];
  if (!cache) return null;
  const key = univKey(name);
  if (!key) return null;
  if (cache[key]) return cache[key];
  for (const cachedKey of Object.keys(cache)) {
    if (cachedKey && (cachedKey.includes(key) || key.includes(cachedKey))) return cache[cachedKey];
  }
  return null;
}

// 한 대학의 표시용 카드 객체. 점수 출처는 캐시(서버) 뿐. 없으면 로딩(pending)/빈값(empty)으로 표기.
export function buildUniversityCard(name, scoreCache = {}, examKey = '', fetchStatus = 'idle') {
  const entry = selectScoreEntry(scoreCache, examKey, name);
  const numeric = entry ? Number(entry.score) : NaN;
  const hasScore = Number.isFinite(numeric);
  const pending = !hasScore && (fetchStatus === 'loading' || fetchStatus === 'idle');
  const score = hasScore ? Math.round(numeric) : 0;
  const cut = 100;
  const gap = score - cut;
  return {
    major: name,
    score,
    cut,
    scoreStatus: hasScore ? 'confirmed' : pending ? 'pending' : 'empty',
    scoreUpdating: hasScore && fetchStatus === 'loading',
    gap: gap > 0 ? `+${gap}` : String(gap),
    rank: (entry && entry.status) || (score >= 150 ? '안정' : score >= 100 ? '합격권' : '도전'),
    color: (entry && entry.color) || ''
  };
}

// 타겟 리스트(고정 순서) → 카드 배열. targetMajor 같은 선택 상태로 재정렬하지 않는다.
export function buildUniversityCards(targetUniversities = [], scoreCache = {}, examKey = '', fetchStatus = 'idle') {
  return (targetUniversities || [])
    .filter(Boolean)
    .map((name) => buildUniversityCard(name, scoreCache, examKey, fetchStatus));
}

// 서버 분석 응답(analysisResults) + 시뮬레이션을 캐시 머지용 맵으로 정규화한다.
export function normalizeServerResults(analysisResults = [], simulationResults = []) {
  const simByKey = {};
  for (const sim of simulationResults || []) {
    if (!sim || !sim.univ) continue;
    simByKey[univKey(`${sim.univ}${sim.major || ''}`)] = sim;
  }
  const merged = {};
  for (const item of analysisResults || []) {
    if (!item || !item.univ) continue;
    const score = Number(item.converted_score);
    if (!Number.isFinite(score)) continue;
    const key = univKey(`${item.univ}${item.major || ''}`);
    merged[key] = {
      score: Math.round(score),
      status: item.status || '',
      color: item.color || '',
      sim: simByKey[key] || null
    };
  }
  return merged;
}

// 기존 캐시에 한 시험의 결과를 머지한 새 scoreCache 반환(불변 업데이트).
export function mergeScoreCache(scoreCache = {}, examKey = '', mergedEntries = {}) {
  return {
    ...scoreCache,
    [examKey]: { ...(scoreCache[examKey] || {}), ...mergedEntries }
  };
}

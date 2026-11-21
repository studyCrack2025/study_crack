import { calculatorComparisonScores } from './calculator-execution.js';
import { CALCULATOR_RISK_BANDS } from './calculator-indicators.js';
import { CALCULATOR_GROUPS, validRepresentatives } from './calculator-plan-model.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const format = value => value.toLocaleString('ko-KR', { maximumFractionDigits: 6 });
const bandLabel = band => CALCULATOR_RISK_BANDS.find(([key]) => key === band)?.[1] || '판단 대기';
const range = (value, bounds) => bounds && bounds.low !== bounds.high ? `${format(bounds.low)}~${format(bounds.high)}` : format(value);

function summarizeScores(scores, compared) {
  const items = [['kor', '국어'], ['math', '수학'], ['inq1', '탐구 1'], ['inq2', '탐구 2']].map(([key, label]) => {
    const row = scores.exam[key], metrics = compared.basis === 'official' ? compared.exam[key] : null;
    return { label, subject: row.opt || row.name, value: scores.basis === 'raw' ? `원점수 ${row.raw}` : `표준점수 ${row.std}`,
      detail: metrics ? `${scores.basis === 'raw' ? '예상 ' : ''}표점 ${metrics.std} · 백분위 ${metrics.pct} · ${metrics.grd}등급` : '예상 성적 계산 대기' };
  });
  return { basis: scores.basis === 'raw' ? '2027학년도 수능 가채점 기준 · 표준점수·백분위·등급은 추정치입니다.' : '2027학년도 성적표 기준', items,
    grades: `영어 ${scores.exam.eng.grd}등급 · 한국사 ${scores.exam.hist.grd}등급${scores.exam.foreign ? ` · ${scores.exam.foreign.name} ${scores.exam.foreign.grd}등급` : ''}` };
}

function referenceDisplay(reference, includeScore, includeIndex) {
  if (!reference) return null;
  const labels = { current_two_references: '현행식 기준 참고 비교', prior_data_two_estimates: '기존자료 기준 참고 비교', historical70_only: '70% 참고선 단독', academic_score_without_cut: '수능 점수만 계산', held: '비교 보류', explicitly_excluded: '자료 대기' };
  const year = reference.referenceYear ? `${reference.referenceYear}학년도` : '기존자료 · 연도 미확인';
  const lines = [];
  if (includeScore && finite(reference.convertedScore)) lines.push({ label: '참고 자료의 환산점수', value: `${format(reference.convertedScore)}점` });
  if (finite(reference.passReference)) lines.push({ label: `${year} 합격권 추정선`, value: `${range(reference.passReference, reference.referenceBounds?.pass)}점` });
  if (finite(reference.registered70Reference)) lines.push({ label: `${year} 70% 참고선`, value: `${range(reference.registered70Reference, reference.referenceBounds?.registered70)}점` });
  if (includeIndex && finite(reference.referenceIndex)) lines.push({ label: '별도 자료 기준 참고 지수', value: `${reference.referenceIndex} / 100` });
  if (reference.indexRange && reference.indexRange.low !== reference.indexRange.high) lines.push({ label: '참고 지수의 가정 범위', value: `${format(reference.indexRange.low)}~${format(reference.indexRange.high)}` });
  const note = reference.status === 'prior_data_two_estimates' ? '기존 산식·변환표·추정 기준선의 비교입니다. 생성연도와 현행 전형의 동일성은 확인되지 않았습니다.'
    : reference.status === 'current_two_references' ? `${year} 입결 참고입니다. 기준선과 지수의 범위는 계산 가정에 따른 범위입니다.`
      : reference.status === 'historical70_only' ? `${year} 70% 참고선만 있어 합격권 추정선과 지수는 제공하지 않습니다.`
        : reference.status === 'academic_score_without_cut' ? '비교 기준선이 없어 지원 단계를 판단하지 않습니다.' : '현재 입력의 산식·지원 조건·비교 자료를 확인해야 합니다.';
  return { label: labels[reference.status] || '비교 자료 확인 필요', lines, note };
}

function representativeCard(group, label, target, result) {
  if (!target) return { group, label, status: 'empty', identity: null, score: null, indicator: null, reference: null, notes: ['이 군의 대표 지원안을 선택하지 않았습니다.'] };
  const formal = result.status === 'available' && finite(result.convertedScore), reference = result.referenceComparison;
  const hasReference = finite(reference?.convertedScore), publishedIndex = formal && result.possibility?.status === 'available';
  const band = publishedIndex ? result.possibility.riskBand : reference?.riskBand ?? null;
  const points = publishedIndex ? result.possibility.index.points : reference?.referenceIndex ?? null;
  const score = formal ? { label: result.scoreScope === 'csat_component' ? '내 수능 반영점수' : '내 환산점수', value: `${format(result.convertedScore)}점`,
    maximum: finite(result.maximumScore) ? `기준 만점 ${format(result.maximumScore)}점 · 가산점에 따라 초과할 수 있습니다.` : '별도 기준 만점이 없는 점수입니다.' }
    : hasReference ? { label: '참고 환산점수', value: `${format(reference.convertedScore)}점`, maximum: '아래 참고 자료의 산식과 기준으로 계산한 점수입니다.' } : null;
  const notes = [];
  if (result.reasonCodes?.includes('UNIT_SELECTION_CHANGED')) notes.push('모집단위 자료가 바뀌었습니다. 지원 조합에서 후보를 다시 선택해주세요.');
  else if (result.status === 'ineligible') notes.push('현재 응시 과목이나 지원 조건을 확인해야 합니다.');
  else if (!score) notes.push('계산에 필요한 자료를 확인 중입니다. 지원 단계는 판단 대기입니다.');
  if (formal && result.scoreScope === 'csat_component') notes.push('수능 반영점수입니다. 학생부·면접·실기와 최종 소수점 처리는 별도 확인이 필요합니다.');
  if (publishedIndex) notes.push(`${result.possibility.sourceYear}학년도 입결 · ${result.possibility.targetYear}학년도 반영 기준의 지수입니다.`);
  return { group, label, status: score ? 'ready' : 'held', identity: { university: target.selection.universityName, campus: target.selection.campusName, unit: target.selection.unitName, track: target.selection.trackName }, score,
    indicator: { band, label: bandLabel(band), points: finite(points) ? `${points} / 100` : null, caption: publishedIndex ? '합격 가능성 지수' : '자료 기준 참고 지수' },
    reference: referenceDisplay(reference, formal, publishedIndex), notes };
}

export function createCalculatorPortfolio({ profile, plan, conversion, input }) {
  if (!profile || !plan || !conversion || !Array.isArray(plan.targets) || !validRepresentatives(plan.representatives, plan.targets) || !Object.values(plan.representatives).some(Boolean)
    || input?.profileRevision !== profile.revision || JSON.stringify(input.scores) !== JSON.stringify(profile.scores) || JSON.stringify(input.targets) !== JSON.stringify(plan.targets)
    || !Array.isArray(conversion.results) || conversion.results.length !== plan.targets.length || conversion.basis !== profile.scores.basis) return null;
  const compared = calculatorComparisonScores(conversion, profile.scores);
  if (!compared || !conversion.results.every((row, index) => row && row.university === plan.targets[index].university && row.major === plan.targets[index].major
    && (!plan.targets[index].selection || row.selectionKey === plan.targets[index].selection.key))) return null;
  return { title: '나의 정시 포트폴리오', name: plan.name, scoreSummary: summarizeScores(profile.scores, compared),
    cards: CALCULATOR_GROUPS.map(([group, label]) => {
      const index = plan.targets.findIndex(target => target.selection?.key === plan.representatives[group]);
      return representativeCard(group, label, index === -1 ? null : plan.targets[index], conversion.results[index]);
    }),
    disclaimer: '참고 지수와 지원 단계는 실제 합격 확률이 아닙니다. 개인별 지원 자격과 학생부·면접·실기 반영은 별도 확인이 필요합니다.',
    probability: '예상 합격률은 검증된 자료가 준비된 뒤 제공합니다.' };
}

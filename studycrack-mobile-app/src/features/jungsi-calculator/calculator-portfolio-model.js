import { SUBJECTS } from './calculator-model.js';
import { calculatorComparisonScores } from './calculator-execution.js';
import { CALCULATOR_RISK_BANDS } from './calculator-indicators.js';
import { CALCULATOR_GROUPS, validRepresentatives } from './calculator-plan-model.js';
import { CALCULATOR_STAGE_NOTE, calculatorCutoffLines, formatCalculatorScore as format, HISTORICAL_CUTOFF_NOTE, PREVIEW_SCORE_NOTE, referenceCaution, referenceScoreLabel } from './calculator-display.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const bandLabel = band => CALCULATOR_RISK_BANDS.find(([key]) => key === band)?.[1] || '판단 대기';

function summarizeScores(scores, compared) {
  const items = SUBJECTS.map(([key, label]) => {
    const row = scores.exam[key], metrics = compared.basis === 'official' ? compared.exam[key] : null;
    return { label, subject: row.opt || row.name, value: scores.basis === 'raw' ? `원점수 ${row.raw}` : `표준점수 ${row.std}`,
      detail: metrics ? `${scores.basis === 'raw' ? '예상 ' : ''}표점 ${metrics.std} · 백분위 ${metrics.pct} · ${metrics.grd}등급` : '예상 성적 계산 대기' };
  });
  return { basis: scores.basis === 'raw' ? '2027학년도 수능 가채점 기준 · 표준점수·백분위·등급은 추정치입니다.' : '2027학년도 성적표 기준', items,
    grades: `영어 ${scores.exam.eng.grd}등급 · 한국사 ${scores.exam.hist.grd}등급${scores.exam.foreign ? ` · ${scores.exam.foreign.name} ${scores.exam.foreign.grd}등급` : ''}` };
}

function representativeCard(group, label, target, result) {
  if (!target) return { group, label, status: 'empty', identity: null, score: null, indicator: null, reference: null, notes: ['이 군의 지원 후보를 선택하지 않았습니다.'] };
  const formal = result.status === 'available' && finite(result.convertedScore), reference = result.referenceComparison;
  const preview = result.previewCutoff;
  const hasReference = finite(reference?.convertedScore), publishedIndex = formal && result.possibility?.status === 'available';
  const band = publishedIndex ? result.possibility.riskBand : null;

  const score = formal ? { label: '예상 환산점수', value: `${format(result.convertedScore)}점`,
    maximum: finite(result.maximumScore) ? `기준 만점 ${format(result.maximumScore)}점 · 가산점에 따라 초과할 수 있습니다.` : '별도 기준 만점이 없는 점수입니다.' }
    : preview ? { label: '가채점 환산점수', value: `${format(preview.convertedScore)}점`, maximum: null }
    : hasReference ? { label: referenceScoreLabel(reference), value: `${format(reference.convertedScore)}점`, maximum: reference.legacyScore ? referenceCaution(reference) : null } : null;
  const notes = [];
  if (result.reasonCodes?.includes('UNIT_SELECTION_CHANGED')) notes.push('모집단위 자료가 바뀌었습니다. 지원 조합에서 후보를 다시 선택해주세요.');
  else if (result.status === 'ineligible') notes.push('현재 응시 과목이나 지원 조건을 확인해야 합니다.');
  else if (!score) notes.push('계산에 필요한 자료를 확인 중입니다. 지원 단계는 판단 대기입니다.');
  if ((formal ? result.scoreScope : preview?.scoreScope) === 'csat_component') notes.push('수능 반영점수입니다. 학생부·면접·실기와 최종 소수점 처리는 별도 확인이 필요합니다.');
  if (publishedIndex) notes.push(`${result.possibility.sourceYear}학년도 입결 · ${result.possibility.targetYear}학년도 반영 기준의 지수입니다.`);
  if (preview) notes.push(PREVIEW_SCORE_NOTE);
  const lines = calculatorCutoffLines(reference, publishedIndex ? result.possibility : preview);
  if (formal && hasReference) lines.push({ label: '별도 산식 환산점수', value: `${format(reference.convertedScore)}점` });
  return { group, label, status: score ? 'ready' : 'held', identity: { university: target.selection.universityName, campus: target.selection.campusName, unit: target.selection.unitName, track: target.selection.trackName }, score,
    indicator: { band, label: bandLabel(band), points: null, caption: '지원 단계' },
    reference: score ? { label: '입결 기준', lines, note: reference?.historical70 ? HISTORICAL_CUTOFF_NOTE : null } : null, notes };
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
    disclaimer: CALCULATOR_STAGE_NOTE,
    probability: '예상 합격률은 검증된 자료가 준비된 뒤 제공합니다.' };
}

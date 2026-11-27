import { SUBJECTS } from './calculator-model.js';
import { calculatorComparisonScores } from './calculator-execution.js';
import { calculatorIndicator, calculatorSelectionNotice } from './calculator-indicators.js';
import { CALCULATOR_GROUPS, validRepresentatives } from './calculator-plan-model.js';
import { CALCULATOR_STAGE_NOTE, calculatorCutoffLines, formatCalculatorScore as format, HISTORICAL_CUTOFF_NOTE, OFFER_ESTIMATE_NOTE, previewScoreLabel, previewScoreNote, referenceCaution, referenceScoreLabel } from './calculator-display.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);

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
  if (!target) return { group, label, status: 'empty', identity: null, score: null, cutoff: null, indicator: null, reference: null, notes: [] };
  const preview = result.previewCutoff;
  const formal = !preview && result.status === 'available' && finite(result.convertedScore), reference = result.referenceComparison;
  const notice = calculatorSelectionNotice(result);
  const hasReference = finite(reference?.convertedScore), publishedIndex = formal && result.possibility?.status === 'available';

  const score = formal || preview || hasReference ? {
    label: formal ? '예상 환산점수' : preview ? previewScoreLabel(preview) : referenceScoreLabel(reference),
    value: `${format(formal ? result.convertedScore : preview ? preview.convertedScore : reference.convertedScore)}점`,
    maximum: formal ? (finite(result.maximumScore) ? `기준 만점 ${format(result.maximumScore)}점 · 가산점에 따라 초과할 수 있습니다.` : '별도 기준 만점이 없는 점수입니다.')
      : !preview && reference.legacyScore ? referenceCaution(reference) : null
  } : null;
  const notes = [];
  if (notice) notes.push(notice.note);
  else if (result.reasonCodes?.includes('UNIT_SELECTION_CHANGED')) notes.push('모집단위 자료가 바뀌었습니다. 지원 조합에서 후보를 다시 선택해주세요.');
  else if (result.status === 'ineligible') notes.push('현재 응시 과목이나 지원 조건을 확인해야 합니다.');
  else if (!score) notes.push('계산에 필요한 자료를 확인 중입니다. 지원 단계는 판단 대기입니다.');
  if ((formal ? result.scoreScope : preview?.scoreScope) === 'csat_component') notes.push('수능 반영점수입니다. 학생부·면접·실기와 최종 소수점 처리는 별도 확인이 필요합니다.');
  if (publishedIndex) notes.push(`${result.possibility.sourceYear}학년도 입결 · ${result.possibility.targetYear}학년도 반영 기준의 지수입니다.`);
  if (preview) notes.push(previewScoreNote(preview));
  const cutoff = formal ? result.possibility : preview;
  if (cutoff?.offerEstimate) notes.push(OFFER_ESTIMATE_NOTE);
  const lines = calculatorCutoffLines(reference, cutoff);
  if (formal && hasReference) lines.push({ label: '별도 산식 환산점수', value: `${format(reference.convertedScore)}점` });
  return { group, label, status: score || notice ? 'ready' : 'held', identity: { university: target.selection.universityName, campus: result.selectionCampusName ?? target.selection.campusName, unit: target.selection.unitName, track: target.selection.trackName }, score, cutoff: notice ? null : lines[0].value,
    indicator: { ...calculatorIndicator(result), points: null, caption: notice ? '전형 확인' : '지원 단계' },
    reference: score && !notice ? { label: '입결 기준', lines, note: reference?.historical70 ? HISTORICAL_CUTOFF_NOTE : null } : null, notes };
}

function portfolioSummary(profile, plan, compared, cards) {
  return { title: '나의 정시 포트폴리오', name: plan.name, scoreSummary: summarizeScores(profile.scores, compared),
    basisLabel: profile.scores.basis === 'raw' ? '가채점 기준' : '성적표 기준', cards, disclaimer: CALCULATOR_STAGE_NOTE };
}

export function createCalculatorComparisonPortfolio({ profile, plan, entries }) {
  if (!profile || !plan?.targets.length || !validRepresentatives(plan.representatives, plan.targets)) return null;
  const candidates = plan.targets.map(target => {
    const entry = entries.get(target.selection.key);
    const result = entry?.result;
    const current = result?.selectionKey === target.selection.key && result.university === target.university && result.major === target.major;
    return { target, status: current ? 'ready' : entry?.status === 'error' ? 'error' : entry?.status === 'idle' ? 'idle' : 'loading',
      error: entry?.error, result: current ? result : null, response: current ? entry.response : null };
  });
  const response = candidates.find(candidate => candidate.response)?.response;
  const compared = response && calculatorComparisonScores(response, profile.scores) || profile.scores;
  const selected = Object.values(plan.representatives).filter(Boolean);
  const cards = CALCULATOR_GROUPS.map(([group, label]) => {
    const candidate = candidates.find(row => row.target.selection.key === plan.representatives[group]);
    return representativeCard(group, label, candidate && candidate.result ? candidate.target : null, candidate?.result);
  });
  return { ...portfolioSummary(profile, plan, compared, cards),
    candidates: candidates.map(({ response, ...candidate }) => candidate), representatives: plan.representatives,
    exportMessage: !selected.length ? '대표 후보를 선택해주세요.'
      : selected.every(key => candidates.some(candidate => candidate.target.selection.key === key && candidate.result)) ? '' : '대표 후보의 계산 결과를 확인하고 있습니다.' };
}

export function createCalculatorPortfolio({ profile, plan, conversion, input }) {
  if (!profile || !plan || !conversion || !Array.isArray(plan.targets) || !validRepresentatives(plan.representatives, plan.targets) || !Object.values(plan.representatives).some(Boolean)
    || input?.profileRevision !== profile.revision || JSON.stringify(input.scores) !== JSON.stringify(profile.scores) || JSON.stringify(input.targets) !== JSON.stringify(plan.targets)
    || !Array.isArray(conversion.results) || conversion.results.length !== plan.targets.length || conversion.basis !== profile.scores.basis) return null;
  const compared = calculatorComparisonScores(conversion, profile.scores);
  if (!compared || !conversion.results.every((row, index) => row && row.university === plan.targets[index].university && row.major === plan.targets[index].major
    && (!plan.targets[index].selection || row.selectionKey === plan.targets[index].selection.key))) return null;
  const cards = CALCULATOR_GROUPS.map(([group, label]) => {
    const index = plan.targets.findIndex(target => target.selection?.key === plan.representatives[group]);
    return representativeCard(group, label, plan.targets[index], conversion.results[index]);
  });
  return portfolioSummary(profile, plan, compared, cards);
}

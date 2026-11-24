import { prepareCalculatorScores } from './calculator-model.js';
import { calculatorScoreboardId } from './calculator-score-conversion.js';
import { calculatorDigest as digest, calculatorReasonCodes } from './calculator-validation.js';

const subject = value => typeof value === 'string' ? value.normalize('NFKC').replace(/II$/, '2').replace(/I$/, '1').replace(/\s/g, '') : '';

export function calculatorComparisonScores(body, scores) {
  const published = body.execution === undefined && body.publishedScoreExecution !== undefined;
  const execution = published ? body.publishedScoreExecution : body.execution;
  if (execution === undefined) return scores;
  const conversion = execution?.scoreConversion;
  if (execution?.contractVersion !== 'calculator-execution-v1' || execution.mode !== (published ? 'published' : 'development_preview')
    || published && scores.basis !== 'raw'
    || execution.inputBasis !== scores.basis || execution.inputScoreDigest !== body.scoreDigest || !conversion
    || !calculatorReasonCodes(conversion.reasonCodes)) return null;
  if (scores.basis === 'official') return execution.comparisonBasis === 'official' && execution.comparisonScores === null
    && conversion.status === 'not_required' && conversion.scoreboardId === null && conversion.scoreboardDigest === null && !conversion.reasonCodes.length ? scores : null;
  if (conversion.status === 'unavailable') return execution.comparisonBasis === null && execution.comparisonScores === null
    && conversion.scoreboardId === null && conversion.scoreboardDigest === null && conversion.reasonCodes.length ? scores : null;
  if (!['estimated', 'official'].includes(conversion.status) || execution.comparisonBasis !== conversion.status || conversion.reasonCodes.length
    || conversion.scoreboardId !== calculatorScoreboardId(conversion.status === 'estimated')
    || !digest(conversion.scoreboardDigest) || execution.comparisonScores?.basis !== 'official') return null;
  const candidate = { ...execution.comparisonScores, exam: { ...execution.comparisonScores.exam } };
  for (const key of ['kor', 'math', 'inq1', 'inq2']) {
    const field = ['kor', 'math'].includes(key) ? 'opt' : 'name';
    if (subject(candidate.exam[key]?.[field]) !== subject(scores.exam[key][field])) return null;
    candidate.exam[key] = { ...candidate.exam[key], [field]: scores.exam[key][field] };
  }
  if (scores.exam.foreign) {
    if (subject(candidate.exam.foreign?.name) !== subject(scores.exam.foreign.name)) return null;
    candidate.exam.foreign = { ...candidate.exam.foreign, name: scores.exam.foreign.name };
  }
  const prepared = prepareCalculatorScores(candidate);
  if (!prepared.ok) return null;
  for (const key of ['eng', 'hist']) if (prepared.data.exam[key].grd !== scores.exam[key].grd) return null;
  if (JSON.stringify(prepared.data.exam.foreign ?? null) !== JSON.stringify(scores.exam.foreign ?? null)) return null;
  return prepared.data;
}

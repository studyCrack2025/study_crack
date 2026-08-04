import { scoreExamTypeToKey } from './score-model.js';

export function uniqueTargetList(list = []) {
  return Array.from(new Set((list || []).map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 6);
}

export function resolveAnalysisExamMode(state = {}) {
  const explicitKey = state.scoreExamKey || scoreExamTypeToKey(state.scoreExamType);
  if (explicitKey && explicitKey !== 'active') return explicitKey;
  const quantitative = state.user?.quantitative || {};
  return ['jun', 'may', 'mar', 'apr', 'jul', 'sep', 'oct', 'csat']
    .find((examKey) => {
      const item = quantitative[examKey];
      return item && typeof item === 'object' && (item.kor || item.math || item.eng || item.inq1 || item.inq2);
    }) || explicitKey || 'mar';
}

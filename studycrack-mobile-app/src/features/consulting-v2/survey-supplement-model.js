export function supplementAnswer(snapshot, field) {
  if (typeof field !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+){0,3}$/.test(field)
    || field.split('.').some(key => ['__proto__', 'prototype', 'constructor'].includes(key))) return undefined;
  if (field.startsWith('scores.')) {
    const area = field.slice(7), inquiry = /^inquiry([12])$/.exec(area);
    return inquiry ? snapshot.scores?.records?.filter(row => row.area === 'inquiry')[Number(inquiry[1]) - 1]
      : snapshot.scores?.records?.find(row => row.area === area);
  }
  return field.split('.').reduce((value, key) => value?.[key], snapshot);
}

export function supplementAnswerText(value) {
  if (value == null || value === '') return '입력 없음';
  if (typeof value === 'boolean') return value ? '예' : '아니요';
  if (Array.isArray(value)) return value.map(supplementAnswerText).join(' · ') || '입력 없음';
  if (typeof value === 'object') return [value.subject, value.selection,
    ...[['commonRawScore', '공통'], ['electiveRawScore', '선택'], ['rawScore', '원점수'], ['standardScore', '표준점수'], ['percentile', '백분위'], ['grade', '등급']]
      .filter(([key]) => value[key] != null).map(([key, label]) => `${label} ${value[key]}`)].filter(Boolean).join(' · ') || '입력 없음';
  return String(value);
}

export function supplementFieldChanged(field, before, after, beforeFiles, afterFiles) {
  const value = field === 'files' ? [[...beforeFiles].sort(), [...afterFiles].sort()]
    : [supplementAnswer(before, field), supplementAnswer(after, field)];
  return JSON.stringify(value[0]) !== JSON.stringify(value[1]);
}

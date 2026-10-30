import React from 'react';
import { RISK_LABELS, formatAnalysisRange } from '../candidate-analysis-model.js';

export function CandidateCards({ candidates }) {
  return <div className="consulting-report-candidates">{candidates.map((candidate, index) => <article key={candidate.candidateId || `${candidate.universityName}-${index}`}><span>{({ ga: '가군', na: '나군', da: '다군', other: '기타군' })[candidate.admissionGroup] || candidate.admissionGroup || '모집군 확인'}</span><h3>{candidate.universityName} {candidate.admissionUnitName}</h3><p>{candidate.rationale}</p><small>{candidate.probabilityStatus === 'manual_review' ? '상담사 수동 검토 · 확률 미제공' : `${RISK_LABELS[candidate.riskBand] || '판단 보류'} · ${candidate.probabilityStatus === 'available' ? formatAnalysisRange(candidate.probability, '%') : '확률 미제공'}`}</small></article>)}</div>;
}


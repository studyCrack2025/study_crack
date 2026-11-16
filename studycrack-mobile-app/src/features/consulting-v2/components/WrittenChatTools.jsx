import React from 'react';
import { getWrittenPreparation } from '../written-session-api.js';
import { COMMUTE_OPTIONS, CONSULTATION_TOPIC_LABELS } from '../survey-model.js';

export const WRITTEN_CHECKLIST = [['questionsAddressed', '추가 질문에 답변함'], ['scoresConfirmed', '성적·지원 조건을 확인함'], ['followUpCaptured', '보고서 반영 사항을 정리함']];
export function WrittenPreparation({ binding, caseId }) {
  const [resource, setResource] = React.useState({ status: 'loading' }), [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    const controller = new AbortController();
    getWrittenPreparation(binding, caseId, controller.signal).then(result => {
      if (!controller.signal.aborted) setResource(result.ok ? { status: 'ready', data: result.data.preparation } : { status: 'error' });
    }).catch(() => { if (!controller.signal.aborted) setResource({ status: 'error' }); });
    return () => controller.abort();
  }, [binding, caseId, attempt]);
  if (resource.status === 'loading') return <p>기초조사서를 불러오는 중…</p>;
  if (resource.status === 'error') return <div><p>기초조사서를 불러오지 못했어요.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>자료 다시 불러오기</button></div>;
  const data = resource.data;
  if (!data) return <p>제출된 기초조사서가 없습니다.</p>;
  const records = Array.isArray(data.scores?.records) ? data.scores.records : [];
  const choices = Array.isArray(data.preferences?.rankedChoices) ? data.preferences.rankedChoices : [];
  const topics = Array.isArray(data.qualitative?.consultationTopics) ? data.qualitative.consultationTopics : [];
  const questions = Array.isArray(data.qualitative?.consultationQuestions) ? data.qualitative.consultationQuestions : typeof data.qualitative?.consultationQuestions === 'string' ? [data.qualitative.consultationQuestions] : [];
  const allowed = value => value === true ? '가능' : value === false ? '어려움' : '미입력';
  return <div className="consulting-chat-preparation">
    <h3>성적</h3><ul>{records.filter(row => row.grade != null || row.standardScore != null || row.rawScore != null).map((row, index) => <li key={index}><strong>{row.selection || row.subject || row.area}</strong><span>{[['원점수', row.rawScore], ['표준점수', row.standardScore], ['백분위', row.percentile], ['등급', row.grade]].filter(([, value]) => value != null).map(([label, value]) => `${label} ${value}`).join(' · ')}</span></li>)}</ul>
    <h3>지원 조건</h3><p>{COMMUTE_OPTIONS.find(([key]) => key === data.conditions?.commuteLimit)?.[1] || '통학 시간 미정'} · 기숙사 {allowed(data.conditions?.dormitoryAllowed)} · 재수 {allowed(data.conditions?.repeatStudyAllowed)}</p>
    <h3>희망 지원</h3><ol>{choices.map((choice, index) => <li key={index}>{[choice.university, choice.track].filter(Boolean).join(' · ') || '미정'}</li>)}</ol><p>{data.preferences?.additionalPreference}</p>
    <h3>상담 질문</h3><p>{topics.map(topic => CONSULTATION_TOPIC_LABELS[topic] || '').filter(Boolean).join(' · ')}</p><p>{data.qualitative?.decisionOptions}</p><ul>{questions.map((question, index) => <li key={index}>{question}</li>)}</ul><p>{data.qualitative?.specialCircumstances}</p>
  </div>;
}

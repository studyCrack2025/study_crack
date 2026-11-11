import React from 'react';
import { CONSULTATION_TOPIC_LABELS, PRIORITY_LABELS } from '../survey-model.js';

const choices = {
  high_school_senior: '고3 재학생', graduate: '졸업생', qualification_exam: '검정고시',
  general: '일반고', specialized: '특목·특성화고', autonomous: '자율고', other: '기타',
  safe: '안정 중심', balanced: '균형', challenge: '도전 중심'
};
const scoreNames = { korean: '국어', math: '수학', english: '영어', korean_history: '한국사', foreign_language: '제2외국어·한문', inquiry: '탐구' };
const scoreFields = { commonRawScore: '공통', electiveRawScore: '선택', rawScore: '원점수', standardScore: '표준점수', percentile: '백분위', grade: '등급' };
const examNames = { csat: '수능', june_mock: '6월 모의평가', september_mock: '9월 모의평가', other: '기타 시험' };
export const legacyPreferences = { desiredRegions: '희망 지역', desiredUniversities: '희망 대학', desiredMajors: '희망 학과', desiredTracks: '희망 계열', requiredCandidates: '필수 후보', excludedCandidates: '제외 후보' };
const names = {
  studentStatus: { applicantType: '지원자 구분', graduationYear: '졸업 연도', schoolType: '학교 유형', schoolName: '학교명', residenceRegion: '거주 지역' },
  conditions: { dormitoryAllowed: '기숙사 생활 가능', repeatStudyAllowed: '재수 가능성', tuitionBudgetAnnual: '연간 등록금 상한' },
  strategy: { riskTolerance: '지원 위험 선호', priorityOrder: '대학 선택 우선순위' },
  qualitative: { consultationTopics: '상담 주제', decisionOptions: '비교 중인 선택지와 기준', consultationQuestions: '상담에서 답을 받고 싶은 질문',
    specialCircumstances: '함께 알아야 할 사항' },
  consent: { accurateInformation: '입력 내용 확인', analysisUse: '분석 이용 동의' }
};
const numberOrDash = value => value === true ? '예' : value === false ? '아니요' : value ?? '—';
function display(key, value) {
  if (Array.isArray(value)) {
    const labels = key === 'priorityOrder' ? PRIORITY_LABELS : key === 'consultationTopics' ? CONSULTATION_TOPIC_LABELS : {};
    return value.map(item => Object.hasOwn(labels, item) ? labels[item] : item).join('\n');
  }
  if (['applicantType', 'schoolType', 'riskTolerance'].includes(key) && Object.hasOwn(choices, value)) return choices[value];
  return numberOrDash(value);
}

function entries(section, value) {
  if (section === 'scores') {
    const { examYear, examType, records } = value;
    return [
      ['시험', [examType === 'csat' && examYear ? `${examYear + 1}학년도` : examYear, examNames[examType]].filter(Boolean).join(' ')],
      ...(records || []).filter(row => row.area !== 'foreign_language' || row.subject).map(row => [
        row.subject || scoreNames[row.area],
        [row.selection, ...Object.entries(scoreFields).filter(([key]) => row[key] != null).map(([key, label]) => `${label} ${row[key]}`)].filter(Boolean).join(' · ')
      ])
    ];
  }
  if (section === 'preferences' && Array.isArray(value.rankedChoices)) return [
    ...value.rankedChoices.map(({ region, university, track }, index) => [`${index + 1}지망`, [region, university, track].filter(Boolean).join(' · ')]),
    ['추가 희망', value.additionalPreference]
  ];
  const fields = section === 'preferences' ? legacyPreferences : names[section] || {};
  const result = Object.entries(fields).filter(([key]) => Object.hasOwn(value, key)).map(([key, label]) => [label, display(key, value[key])]);
  if (section === 'conditions') result.unshift(['최대 편도 통학 시간', value.commuteLimit === 'over_120' ? '2시간 이상도 가능' : value.commuteMaxMinutes != null ? `${value.commuteMaxMinutes}분 이내` : '—']);
  return result;
}

export function SurveyAnswerView({ section, value = {} }) {
  return <dl className="consulting-survey-answer-list">{entries(section, value).map(([label, answer], index) =>
    <div key={`${label}-${index}`}><dt>{label}</dt><dd>{answer === '' || answer == null ? '—' : answer}</dd></div>
  )}</dl>;
}

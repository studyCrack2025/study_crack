import { normalizeMbtiCode } from '../../constants/mbti.js';

const text = value => typeof value === 'string' ? value.trim() : '';
const positive = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) && Number(value) > 0;
const hasGrade = subject => { const grade = Number(subject?.grd ?? subject?.grade); return Number.isInteger(grade) && grade >= 1 && grade <= 9; };

function hasSavedExam(quantitative) {
  return quantitative && typeof quantitative === 'object' && Object.values(quantitative).some(exam =>
    ['kor', 'math', 'inq1', 'inq2'].every(subject => positive(exam?.[subject]?.std))
    && ['eng', 'hist'].every(subject => hasGrade(exam?.[subject])));
}

export function buildAccountProfile({ user = {}, userLoadStatus = 'idle' } = {}) {
  const ready = userLoadStatus === 'ready';
  const qualitative = ready ? user?.qualitative || {} : {};
  const status = text(qualitative.status);
  const stream = text(qualitative.stream);
  const streamLabel = { natural: '자연계', science: '자연계', humanities: '인문계', liberal: '인문계' }[stream.toLowerCase()] || stream;
  const target = ready ? text(user?.targetUniversity) : '';
  const mbtiCode = ready ? normalizeMbtiCode(qualitative.mbti || user?.mbti) : '';
  const checklist = [
    { id: 'basics', label: '학년 · 계열', complete: Boolean(status && stream), target: status && stream ? 'qualInfo' : 'ob1' },
    { id: 'scores', label: '모의고사 성적', complete: Boolean(hasSavedExam(ready ? user?.quantitative : null)), target: 'ob2' },
    { id: 'learning', label: '학습유형 MBTI', complete: Boolean(mbtiCode), target: 'ob3' },
    { id: 'target', label: '목표 대학', complete: Boolean(target), target: 'addUniversity' }
  ];
  return Object.freeze({
    source: 'server', status: userLoadStatus, asOf: null,
    name: ready ? text(user?.name) || '회원' : '회원 정보 확인 중',
    avatarUrl: ready ? text(user?.profileImage) : '',
    meta: [status, streamLabel].filter(Boolean).join(' · ') || '학년·계열 정보를 등록해주세요',
    target, mbtiCode,
    checklist: Object.freeze(checklist.map(row => Object.freeze({ ...row, complete: ready ? row.complete : null })))
  });
}

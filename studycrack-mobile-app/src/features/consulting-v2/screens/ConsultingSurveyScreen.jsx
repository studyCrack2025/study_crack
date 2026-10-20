import React from 'react';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';
import { clientSurveyError, createEmptySurvey, joinList, normalizeSurveyDraft, PRIORITY_LABELS, splitList, SURVEY_STEPS } from '../survey-model.js';
import { getV2SurveyDraft, getV2SurveySchema, saveV2SurveyDraft, submitV2Survey, uploadV2ScoreFile } from '../survey-api.js';

const toOptionalNumber = value => value === '' ? null : Number(value);
const idempotencyKey = prefix => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function Field({ children, label }) {
  return <label className="consulting-survey-field"><span>{label}</span>{children}</label>;
}

function StudentStatusStep({ snapshot, update }) {
  const value = snapshot.studentStatus;
  return <div className="consulting-survey-grid"><Field label="지원자 구분"><select value={value.applicantType} onChange={event => update({ applicantType: event.target.value })}><option value="">선택</option><option value="high_school_senior">고3 재학생</option><option value="graduate">졸업생</option><option value="qualification_exam">검정고시</option></select></Field><Field label="졸업 연도"><input type="number" min="2020" max="2027" value={value.graduationYear ?? ''} onChange={event => update({ graduationYear: toOptionalNumber(event.target.value) })} /></Field><Field label="학교 유형"><select value={value.schoolType} onChange={event => update({ schoolType: event.target.value })}><option value="">선택</option><option value="general">일반고</option><option value="specialized">특목·특성화고</option><option value="autonomous">자율고</option><option value="other">기타</option></select></Field><Field label="학교명"><input maxLength="80" value={value.schoolName} onChange={event => update({ schoolName: event.target.value })} /></Field><Field label="거주 지역"><input maxLength="40" placeholder="예: 서울 송파구" value={value.residenceRegion} onChange={event => update({ residenceRegion: event.target.value })} /></Field></div>;
}

function ScoresStep({ snapshot, update }) {
  const value = snapshot.scores;
  const changeRow = (index, patch) => update({ records: value.records.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) });
  return <><div className="consulting-survey-grid"><Field label="시험 연도"><input type="number" min="2025" max="2027" value={value.examYear ?? ''} onChange={event => update({ examYear: toOptionalNumber(event.target.value) })} /></Field><Field label="시험 종류"><select value={value.examType} onChange={event => update({ examType: event.target.value })}><option value="">선택</option><option value="june_mock">6월 모의평가</option><option value="september_mock">9월 모의평가</option><option value="csat">수능</option><option value="other">기타</option></select></Field></div><div className="consulting-score-list">{value.records.map((row, index) => <fieldset key={`${row.area}-${index}`}><legend>{row.area === 'inquiry' ? `탐구 ${value.records.filter((item, rowIndex) => item.area === 'inquiry' && rowIndex <= index).length}` : ({ korean: '국어', math: '수학', english: '영어', korean_history: '한국사' }[row.area] || row.area)}</legend><input aria-label="과목명" maxLength="40" placeholder="과목명" value={row.subject} onChange={event => changeRow(index, { subject: event.target.value })} /><input aria-label="선택과목" maxLength="40" placeholder="선택과목" value={row.selection || ''} onChange={event => changeRow(index, { selection: event.target.value })} /><input aria-label="표준점수" type="number" min="0" max="200" placeholder="표준" value={row.standardScore ?? ''} onChange={event => changeRow(index, { standardScore: toOptionalNumber(event.target.value) })} /><input aria-label="백분위" type="number" min="0" max="100" placeholder="백분위" value={row.percentile ?? ''} onChange={event => changeRow(index, { percentile: toOptionalNumber(event.target.value) })} /><input aria-label="등급" type="number" min="1" max="9" placeholder="등급" value={row.grade ?? ''} onChange={event => changeRow(index, { grade: toOptionalNumber(event.target.value) })} /><label className="consulting-survey-check"><input type="checkbox" checked={row.confirmed} onChange={event => changeRow(index, { confirmed: event.target.checked })} /> 성적표와 확인</label></fieldset>)}</div></>;
}

function ConditionsStep({ snapshot, update }) {
  const value = snapshot.conditions;
  return <div className="consulting-survey-grid"><Field label="연간 등록금 상한(원, 선택)"><input type="number" min="0" max="100000000" value={value.tuitionBudgetAnnual ?? ''} onChange={event => update({ tuitionBudgetAnnual: toOptionalNumber(event.target.value) })} /></Field><Field label="최대 통학 시간(분)"><input type="number" min="0" max="300" value={value.commuteMaxMinutes ?? ''} onChange={event => update({ commuteMaxMinutes: toOptionalNumber(event.target.value) })} /></Field><label className="consulting-survey-check"><input type="checkbox" checked={value.dormitoryAllowed} onChange={event => update({ dormitoryAllowed: event.target.checked })} /> 기숙사 생활 가능</label><label className="consulting-survey-check"><input type="checkbox" checked={value.repeatStudyAllowed} onChange={event => update({ repeatStudyAllowed: event.target.checked })} /> 재도전 가능성 고려</label></div>;
}

function PreferencesStep({ snapshot, update }) {
  const value = snapshot.preferences;
  const list = (key, max) => event => update({ [key]: splitList(event.target.value, max) });
  return <div className="consulting-survey-grid"><Field label="희망 지역(쉼표 구분)"><input value={joinList(value.desiredRegions)} onChange={list('desiredRegions', 10)} placeholder="서울, 경기" /></Field><Field label="희망 대학"><input value={joinList(value.desiredUniversities)} onChange={list('desiredUniversities', 12)} placeholder="대학명을 쉼표로 구분" /></Field><Field label="희망 학과"><input value={joinList(value.desiredMajors)} onChange={list('desiredMajors', 12)} placeholder="경영학과, 경제학과" /></Field><Field label="희망 계열"><input value={joinList(value.desiredTracks)} onChange={list('desiredTracks', 8)} placeholder="인문, 상경" /></Field><Field label="반드시 검토할 후보(최대 6)"><input value={joinList(value.requiredCandidates)} onChange={list('requiredCandidates', 6)} /></Field><Field label="제외할 후보(최대 10)"><input value={joinList(value.excludedCandidates)} onChange={list('excludedCandidates', 10)} /></Field></div>;
}

function StrategyStep({ snapshot, update }) {
  const value = snapshot.strategy;
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= value.priorityOrder.length) return;
    const next = [...value.priorityOrder];
    [next[index], next[target]] = [next[target], next[index]];
    update({ priorityOrder: next });
  };
  return <><Field label="지원 위험 선호"><select value={value.riskTolerance} onChange={event => update({ riskTolerance: event.target.value })}><option value="">선택</option><option value="safe">안정 중심</option><option value="balanced">균형</option><option value="challenge">도전 중심</option></select></Field><div className="consulting-priority-list" aria-label="우선순위">{value.priorityOrder.map((key, index) => <div key={key}><strong>{index + 1}. {PRIORITY_LABELS[key]}</strong><span><button type="button" onClick={() => move(index, -1)} disabled={index === 0}>위</button><button type="button" onClick={() => move(index, 1)} disabled={index === value.priorityOrder.length - 1}>아래</button></span></div>)}</div></>;
}

function QualitativeStep({ snapshot, update }) {
  const value = snapshot.qualitative;
  const question = value.consultationQuestions[0] || '';
  return <div className="consulting-survey-grid consulting-survey-grid-single"><Field label="강점"><textarea maxLength="1500" value={value.strengths} onChange={event => update({ strengths: event.target.value })} /></Field><Field label="현재 가장 큰 고민"><textarea maxLength="1500" value={value.concerns} onChange={event => update({ concerns: event.target.value })} /></Field><Field label="보호자 의견"><textarea maxLength="1000" value={value.guardianOpinion} onChange={event => update({ guardianOpinion: event.target.value })} /></Field><Field label="특이사항"><textarea maxLength="1000" value={value.specialCircumstances} onChange={event => update({ specialCircumstances: event.target.value })} /></Field><Field label="기초조사서 외에 상담에서 꼭 묻고 싶은 점"><textarea maxLength="500" required value={question} onChange={event => update({ consultationQuestions: [event.target.value] })} /></Field></div>;
}

function ConsentStep({ snapshot, update, files, onUpload, uploading }) {
  return <><div className="consulting-file-panel"><h3>성적표 파일</h3><p>PDF·JPG·PNG, 파일당 10MB 이하. 보안 검사가 끝나야 제출할 수 있습니다.</p><input type="file" accept="application/pdf,image/jpeg,image/png" disabled={uploading} onChange={event => event.target.files?.[0] && onUpload(event.target.files[0])} />{files.length ? <ul>{files.map(file => <li key={file.fileId}><span>{file.displayName}</span><strong data-status={file.status}>{({ ready: '검사 완료', linked: '제출됨', quarantined: '검사 중', rejected: '업로드 거절' }[file.status] || file.status)}</strong></li>)}</ul> : <p>등록된 파일이 없습니다.</p>}</div><label className="consulting-survey-check"><input type="checkbox" checked={snapshot.consent.accurateInformation} onChange={event => update({ accurateInformation: event.target.checked })} /> 입력한 정보가 사실과 같음을 확인합니다.</label><label className="consulting-survey-check"><input type="checkbox" checked={snapshot.consent.analysisUse} onChange={event => update({ analysisUse: event.target.checked })} /> 컨설팅 분석을 위한 자료 이용에 동의합니다.</label></>;
}

export function ConsultingSurveyScreen({ binding }) {
  const [resource, setResource] = React.useState({ status: 'loading', message: '' });
  const [snapshot, setSnapshot] = React.useState(createEmptySurvey);
  const [files, setFiles] = React.useState([]);
  const [caseId, setCaseId] = React.useState('');
  const [workflowState, setWorkflowState] = React.useState('ONBOARDING');
  const [step, setStep] = React.useState(0);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const revision = React.useRef(0);
  const editRevision = React.useRef(0);

  const load = React.useCallback(async () => {
    setResource({ status: 'loading', message: '' });
    const [schema, draft] = await Promise.all([getV2SurveySchema(binding), getV2SurveyDraft(binding)]);
    if (!schema.ok || !draft.ok || schema.data.caseId !== draft.data.caseId) return setResource({ status: 'error', message: draft.error || schema.error || '조사서를 불러오지 못했습니다.' });
    setCaseId(draft.data.caseId);
    setWorkflowState(draft.data.workflowState);
    setSnapshot(normalizeSurveyDraft(draft.data.draft?.snapshot));
    setFiles(Array.isArray(draft.data.files) ? draft.data.files : []);
    revision.current = Number(draft.data.draft?.draftRevision || 0);
    setDirty(false);
    setResource({ status: 'ready', message: '' });
  }, [binding]);
  React.useEffect(() => { load(); }, [load]);

  const updateSection = (key, patch) => {
    editRevision.current += 1;
    setSnapshot(current => ({ ...current, [key]: { ...current[key], ...patch } }));
    setDirty(true);
  };
  const save = React.useCallback(async current => {
    if (!caseId || busy) return false;
    const savedEditRevision = editRevision.current;
    setBusy(true);
    const result = await saveV2SurveyDraft(binding, { expectedDraftRevision: revision.current, snapshot: current });
    setBusy(false);
    if (!result.ok) { setResource({ status: 'ready', message: result.error || '저장하지 못했습니다.' }); return false; }
    revision.current = result.data.draftRevision;
    setWorkflowState(result.data.workflowState);
    setDirty(editRevision.current !== savedEditRevision);
    setResource({ status: 'ready', message: '자동 저장되었습니다.' });
    return true;
  }, [binding, busy, caseId]);
  React.useEffect(() => {
    if (!dirty || resource.status !== 'ready' || busy) return undefined;
    const timer = setTimeout(() => save(snapshot), 1200);
    return () => clearTimeout(timer);
  }, [busy, dirty, resource.status, save, snapshot]);

  const upload = async file => {
    if (files.length >= 3) return setResource({ status: 'ready', message: '성적표는 최대 3개까지 등록할 수 있습니다.' });
    if (dirty && !(await save(snapshot))) return;
    setBusy(true);
    const result = await uploadV2ScoreFile(binding, { caseId, file });
    setBusy(false);
    if (!result.ok) return setResource({ status: 'ready', message: result.error || '업로드하지 못했습니다.' });
    setFiles(current => [...current.filter(item => item.fileId !== result.data.fileId), result.data]);
    setResource({ status: 'ready', message: result.data.status === 'ready' ? '성적표 검사가 완료되었습니다.' : '성적표를 업로드했고 보안 검사를 기다리고 있습니다.' });
  };
  const submit = async () => {
    const readyFiles = files.filter(file => file.status === 'ready');
    const validation = clientSurveyError(snapshot, readyFiles);
    if (validation) return setResource({ status: 'ready', message: validation });
    if (dirty && !(await save(snapshot))) return;
    if (!globalThis.confirm?.('제출 후에는 운영자 보완 요청 전까지 내용을 수정할 수 없습니다. 제출하시겠습니까?')) return;
    setBusy(true);
    const supplement = workflowState === 'SUPPLEMENT_REQUIRED';
    const result = await submitV2Survey(binding, { fileIds: readyFiles.map(file => file.fileId), idempotencyKey: idempotencyKey(supplement ? 'survey-supplement' : 'survey-submit') }, supplement);
    setBusy(false);
    if (!result.ok) return setResource({ status: 'ready', message: result.error || '제출하지 못했습니다.' });
    navigateConsulting(CONSULTING_ROUTES.materials, { replace: true });
  };

  if (resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">기초조사서를 불러오고 있습니다.</p></main>;
  if (resource.status === 'error') return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>조사서를 불러오지 못했습니다</h1><p className="consulting-v2-status" data-tone="error">{resource.message}</p><button className="consulting-v2-primary consulting-v2-wide" onClick={load}>다시 시도</button></section></main>;
  const key = SURVEY_STEPS[step].key;
  return <main className="consulting-survey"><header><button type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>← 진행 현황</button><span>{busy ? '저장 중…' : dirty ? '저장 대기' : '저장됨'}</span></header><section className="consulting-survey-card"><p className="consulting-v2-kicker">{step + 1} / {SURVEY_STEPS.length}</p><h1>{SURVEY_STEPS[step].label}</h1><div className="consulting-survey-progress"><span style={{ width: `${((step + 1) / SURVEY_STEPS.length) * 100}%` }} /></div>{key === 'studentStatus' && <StudentStatusStep snapshot={snapshot} update={patch => updateSection(key, patch)} />}{key === 'scores' && <ScoresStep snapshot={snapshot} update={patch => updateSection(key, patch)} />}{key === 'conditions' && <ConditionsStep snapshot={snapshot} update={patch => updateSection(key, patch)} />}{key === 'preferences' && <PreferencesStep snapshot={snapshot} update={patch => updateSection(key, patch)} />}{key === 'strategy' && <StrategyStep snapshot={snapshot} update={patch => updateSection(key, patch)} />}{key === 'qualitative' && <QualitativeStep snapshot={snapshot} update={patch => updateSection(key, patch)} />}{key === 'consent' && <ConsentStep snapshot={snapshot} update={patch => updateSection(key, patch)} files={files} onUpload={upload} uploading={busy} />}{resource.message ? <p className="consulting-survey-message" role="status">{resource.message}</p> : null}<footer><button type="button" className="consulting-v2-secondary" disabled={step === 0 || busy} onClick={() => setStep(value => value - 1)}>이전</button>{step < SURVEY_STEPS.length - 1 ? <button type="button" className="consulting-v2-primary" disabled={busy} onClick={async () => { if (!dirty || await save(snapshot)) setStep(value => value + 1); }}>저장하고 다음</button> : <button type="button" className="consulting-v2-primary" disabled={busy} onClick={submit}>{workflowState === 'SUPPLEMENT_REQUIRED' ? '보완 제출' : '최종 제출'}</button>}</footer></section></main>;
}

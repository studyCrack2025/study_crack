import React from 'react';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';
import { clientSurveyError, COMMUTE_OPTIONS, CONSULTATION_TOPIC_LABELS, createEmptySurvey, currentConsultationAnswers, DECISION_OPTIONS_MAX, hasPreviousExamScores,
  MAX_CONSULTATION_QUESTIONS, MAX_CONSULTATION_TOPICS, normalizeSurveyDraft, PRIORITY_LABELS, surveySaveSnapshot, SURVEY_FORM_VERSION, SURVEY_STEPS } from '../survey-model.js';
import { confirmV2ScoreUpload, deleteV2ScoreFile, getV2SurveyDraft, getV2SurveySchema, saveV2SurveyDraft, saveV2SurveyRevision, submitV2Survey, uploadV2ScoreFile } from '../survey-api.js';
import { useSurveyFileScan } from '../use-survey-file-scan.js';
import { ConsultingSurveyPreferences } from './ConsultingSurveyPreferences.jsx';
import { ConsultingSurveyScores } from './ConsultingSurveyScores.jsx';
import { SurveyScoreFiles } from './SurveyScoreFiles.jsx';
import { legacyPreferences, SurveyAnswerView } from './SurveyAnswerView.jsx';
import { SurveySupplementNotes } from './SurveySupplementNotes.jsx';
import { SurveyFieldScope, useSurveyFieldAllowed } from './SurveyFieldScope.jsx';
import { SurveySupplementEditor } from './SurveySupplementEditor.jsx';

const toOptionalNumber = value => value === '' ? null : Number(value);
const idempotencyKey = prefix => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

const supplementSection = field => field === 'files' ? 'consent' : field.split('.')[0];

function Field({ children, label, field }) {
  if (!useSurveyFieldAllowed(field)) return null;
  return <label className="consulting-survey-field" data-survey-field={field}><span>{label}</span>{children}</label>;
}

function StudentStatusStep({ snapshot, update }) {
  const value = snapshot.studentStatus;
  return <div className="consulting-survey-grid">
    <Field label="지원자 구분" field="studentStatus.applicantType"><select value={value.applicantType} onChange={event => update({ applicantType: event.target.value })}><option value="">선택</option><option value="high_school_senior">고3 재학생</option><option value="graduate">졸업생</option><option value="qualification_exam">검정고시</option></select></Field>
    <Field label="졸업 연도" field="studentStatus.graduationYear"><input type="number" min="2020" max="2027" value={value.graduationYear ?? ''} onChange={event => update({ graduationYear: toOptionalNumber(event.target.value) })} /></Field>
    <Field label="학교 유형" field="studentStatus.schoolType"><select value={value.schoolType} onChange={event => update({ schoolType: event.target.value })}><option value="">선택</option><option value="general">일반고</option><option value="specialized">특목·특성화고</option><option value="autonomous">자율고</option><option value="other">기타</option></select></Field>
    <Field label="학교명" field="studentStatus.schoolName"><input maxLength="80" value={value.schoolName} onChange={event => update({ schoolName: event.target.value })} /></Field>
    <Field label="거주 지역" field="studentStatus.residenceRegion"><input maxLength="40" placeholder="예: 서울 송파구" value={value.residenceRegion} onChange={event => update({ residenceRegion: event.target.value })} /></Field>
  </div>;
}

function ConditionsStep({ snapshot, update, legacy }) {
  const value = snapshot.conditions;
  return <div className="consulting-survey-grid consulting-survey-grid-single">
    {legacy ? <Field label="최대 편도 통학 시간 (분)"><input type="number" min="0" max="300" value={value.commuteMaxMinutes ?? ''} onChange={event => update({ commuteMaxMinutes: toOptionalNumber(event.target.value) })} /></Field>
    : <Field label="최대 편도 통학 시간" field="conditions.commuteLimit">
      <select value={value.commuteLimit} onChange={event => {
        const limit = event.currentTarget.value;
        update({ commuteLimit: limit, commuteMaxMinutes: limit && limit !== 'over_120' ? Number(limit) : null });
      }}>
        <option value="">선택해 주세요</option>
        {COMMUTE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </Field>}
    {!legacy && !value.commuteLimit && value.commuteMaxMinutes != null && <p className="consulting-score-note">이전에 {value.commuteMaxMinutes}분으로 입력했어요. 현재 선택지에서 다시 골라주세요.</p>}
    <SurveyFieldScope field="conditions.dormitoryAllowed"><label className="consulting-survey-check" data-survey-field="conditions.dormitoryAllowed"><input type="checkbox" checked={value.dormitoryAllowed} onChange={event => update({ dormitoryAllowed: event.target.checked })} /> 기숙사 생활 가능</label></SurveyFieldScope>
    <SurveyFieldScope field="conditions.repeatStudyAllowed"><div>
      <label className="consulting-survey-check" data-survey-field="conditions.repeatStudyAllowed"><input type="checkbox" checked={value.repeatStudyAllowed} aria-describedby="survey-repeat-guide"
        onChange={event => update({ repeatStudyAllowed: event.target.checked })} /> 재수 가능성</label>
      <p id="survey-repeat-guide" className="consulting-score-note">올해 원하는 선택지가 없으면 재수를 고려할 수 있어요.</p>
    </div></SurveyFieldScope>
  </div>;
}

function LegacyScoresStep({ value, update, raw }) {
  const change = (index, key, fieldValue) => update({ records: value.records.map((row, rowIndex) => index === rowIndex ? { ...row, [key]: fieldValue } : row) });
  let inquiry = 0;
  return <div className="consulting-score-list">{value.records.map((row, index) => {
    const field = `scores.${row.area === 'inquiry' ? `inquiry${++inquiry}` : row.area}`;
    const fields = raw && ['korean', 'math'].includes(row.area) ? [['commonRawScore', '공통 원점수'], ['electiveRawScore', '선택 원점수']]
      : raw ? [['rawScore', '원점수'], ['grade', '등급']] : [['standardScore', '표준점수'], ['percentile', '백분위'], ['grade', '등급']];
    return <SurveyFieldScope field={field} key={index}><fieldset className="consulting-score-card" data-survey-field={field}>
      <legend>{row.subject}</legend>
      <Field label="과목명"><input maxLength="40" value={row.subject} onChange={event => change(index, 'subject', event.target.value)} /></Field>
      <Field label="선택과목"><input maxLength="40" value={row.selection || ''} onChange={event => change(index, 'selection', event.target.value)} /></Field>
      {fields.map(([field, label]) => <Field key={field} label={label}><input type="number" value={row[field] ?? ''} onChange={event => change(index, field, toOptionalNumber(event.target.value))} /></Field>)}
    </fieldset></SurveyFieldScope>;
  })}</div>;
}

function LegacyPreferencesStep({ value, update }) {
  return <div className="consulting-survey-grid">{Object.entries(legacyPreferences).map(([field, label]) => <Field key={field} label={label}>
    <textarea value={(value[field] || []).join('\n')} onChange={event => update({ [field]: event.target.value.split('\n') })} />
  </Field>)}</div>;
}

function StrategyStep({ snapshot, update }) {
  const value = snapshot.strategy;
  const changeRank = (key, target) => {
    const index = value.priorityOrder.indexOf(key);
    const next = [...value.priorityOrder];
    [next[index], next[target]] = [next[target], next[index]];
    update({ priorityOrder: next });
  };
  return <>
    <Field label="지원 위험 선호" field="strategy.riskTolerance"><select value={value.riskTolerance} onChange={event => update({ riskTolerance: event.target.value })}><option value="">선택</option><option value="safe">안정 중심</option><option value="balanced">균형</option><option value="challenge">도전 중심</option></select></Field>
    <SurveyFieldScope field="strategy.priorityOrder"><section className="consulting-priority-list" aria-labelledby="consulting-priority-title" data-survey-field="strategy.priorityOrder">
      <h2 id="consulting-priority-title">대학 선택 우선순위</h2>
      <p className="consulting-score-note">가장 중요한 기준을 1순위로 골라주세요. 이미 사용한 순위를 고르면 두 기준의 순위가 서로 바뀝니다.</p>
      {Object.entries(PRIORITY_LABELS).map(([key, label]) => {
        const rank = value.priorityOrder.indexOf(key);
        return <label className="consulting-priority-row" key={key} data-first={rank === 0 || undefined}>
          <span>{label}</span>
          <select aria-label={`${label} 순위`} value={rank} onChange={event => changeRank(key, Number(event.currentTarget.value))}>
            {value.priorityOrder.map((item, position) => <option key={item} value={position}>{position + 1}순위</option>)}
          </select>
        </label>;
      })}
    </section></SurveyFieldScope>
  </>;
}

function QualitativeStep({ snapshot, update }) {
  const value = snapshot.qualitative;
  const topics = value.consultationTopics || [];
  const questions = value.consultationQuestions.length ? value.consultationQuestions : [''];
  return <div className="consulting-survey-grid consulting-survey-grid-single">
    <SurveyFieldScope field="qualitative.consultationTopics"><fieldset className="consulting-survey-preference-rank" aria-describedby="survey-consultation-topics-guide" data-survey-field="qualitative.consultationTopics">
      <legend>상담 주제</legend>
      <p id="survey-consultation-topics-guide" className="consulting-score-note">함께 다루고 싶은 주제를 최대 {MAX_CONSULTATION_TOPICS}개 골라주세요. 선택 항목입니다.</p>
      <div>{Object.entries(CONSULTATION_TOPIC_LABELS).map(([topic, topicLabel]) => {
        const selected = topics.includes(topic);
        return <label className="consulting-survey-check" key={topic}>
          <input type="checkbox" checked={selected} disabled={!selected && topics.length >= MAX_CONSULTATION_TOPICS} onChange={() => {
            const next = selected ? topics.filter(item => item !== topic) : [...topics, topic];
            update({ consultationTopics: next.length ? next : undefined });
          }} /> {topicLabel}
        </label>;
      })}</div>
    </fieldset></SurveyFieldScope>
    <Field label="비교 중인 선택지와 기준 (선택)" field="qualitative.decisionOptions">
      <textarea maxLength={DECISION_OPTIONS_MAX} value={value.decisionOptions || ''} placeholder="A대 인문계열과 B대 사회계열 중 통학과 전공을 기준으로 비교하고 싶어요."
        onChange={event => update({ decisionOptions: event.target.value || undefined })} />
    </Field>
    <SurveyFieldScope field="qualitative.consultationQuestions"><div className="consulting-survey-grid consulting-survey-grid-single" data-survey-field="qualitative.consultationQuestions">
      <p id="survey-consultation-questions-guide" className="consulting-score-note">답을 받고 싶은 질문을 한 가지 이상 적어 주세요.</p>
      {questions.map((question, index) => <div key={index}>
        <Field label={index ? `추가 질문 ${index}` : '상담에서 답을 받고 싶은 질문'}>
          <textarea maxLength="500" value={question} aria-describedby="survey-consultation-questions-guide"
            placeholder={index === 0 ? '올해 진학을 우선하면 가군에 상향을 쓰고 나·다군은 어떻게 배치하면 좋을까요?' : undefined}
            onChange={event => update({ consultationQuestions: questions.map((item, position) => position === index ? event.target.value : item) })} />
        </Field>
        {index > 0 && <button className="consulting-v2-secondary consulting-survey-refresh" type="button" aria-label={`추가 질문 ${index} 삭제`}
          onClick={() => update({ consultationQuestions: questions.filter((_, position) => position !== index) })}>질문 삭제</button>}
      </div>)}
      {questions.length < MAX_CONSULTATION_QUESTIONS && <button className="consulting-v2-secondary" type="button"
        onClick={() => update({ consultationQuestions: [...questions, ''] })}>질문 추가</button>}
    </div></SurveyFieldScope>
    <Field label="함께 알아야 할 사항 (선택)" field="qualitative.specialCircumstances">
      <textarea maxLength="1000" value={value.specialCircumstances} placeholder="보호자와 의견이 다른 점이나 지원에 영향을 주는 상황을 적어 주세요."
        onChange={event => update({ specialCircumstances: event.target.value })} />
    </Field>
  </div>;
}

function ConsentStep({ snapshot, update, fileActions }) {
  return <>
    <SurveyFieldScope field="files"><SurveyScoreFiles {...fileActions} /></SurveyFieldScope>
    <SurveyFieldScope field="consent.accurateInformation"><label className="consulting-survey-check" data-survey-field="consent.accurateInformation"><input type="checkbox" disabled={fileActions.readOnly} checked={snapshot.consent.accurateInformation} onChange={event => update({ accurateInformation: event.target.checked })} /> 입력한 정보가 사실과 같음을 확인합니다.</label></SurveyFieldScope>
    <SurveyFieldScope field="consent.analysisUse"><label className="consulting-survey-check" data-survey-field="consent.analysisUse"><input type="checkbox" disabled={fileActions.readOnly} checked={snapshot.consent.analysisUse} onChange={event => update({ analysisUse: event.target.checked })} /> 컨설팅 분석을 위한 자료 이용에 동의합니다.</label></SurveyFieldScope>
  </>;
}

const SAVE_LABELS = Object.freeze({ idle: '작성 전', pending: '저장 대기', saving: '저장 중…', saved: '저장됨', failed: '저장 실패' });
const CONFLICT_MESSAGE = '다른 화면에서 먼저 저장했습니다. 지금 입력한 내용은 이 화면에 남아 있어요.';
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const edits = (before, next) => Object.fromEntries(SURVEY_STEPS.map(({ key }) => key).filter(key => !equal(before[key], next[key])).map(key => [key, next[key]]));
const pending = session => session?.snapshot && Object.keys(edits(session.saved, session.snapshot)).length > 0;
const mayLeave = session => !pending(session) || globalThis.confirm?.('저장하지 않은 답변이 있어요. 이 화면을 나갈까요?');
const legacySubmission = submission => submission && submission.snapshot.formVersion !== SURVEY_FORM_VERSION;
const loadSnapshot = (saved, legacy) => legacy ? { ...saved, qualitative: currentConsultationAnswers(saved.qualitative) } : normalizeSurveyDraft(saved);
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
function applyEdits(before, mine, latest, field) {
  if (equal(before, mine)) return latest;
  if (isRecord(before) && isRecord(mine) && isRecord(latest)) {
    const keys = new Set([...Object.keys(latest), ...Object.keys(mine)]);
    return Object.fromEntries([...keys].map(key => [key, applyEdits(before[key], mine[key], latest[key], key)]));
  }
  if (field !== 'consultationTopics' && [before, mine, latest].every(Array.isArray) && before.length === mine.length && mine.length === latest.length) {
    return mine.map((value, index) => applyEdits(before[index], value, latest[index]));
  }
  return mine;
}

export function ConsultingSurveyScreen({ binding, leaveGuard }) {
  const [resource, setResource] = React.useState({ status: 'loading', message: '' });
  const [snapshot, setSnapshot] = React.useState(createEmptySurvey);
  const [files, setFiles] = React.useState([]);
  const [excludedFileIds, setExcludedFileIds] = React.useState([]);
  const [step, setStep] = React.useState(0);
  const [saveState, setSaveState] = React.useState({ kind: 'idle' });
  const [notice, setNotice] = React.useState(null);
  const [actionBusy, setActionBusy] = React.useState(false);
  const [viewOnly, setViewOnly] = React.useState(false);
  const [comparison, setComparison] = React.useState(null);
  const draft = React.useRef(null);
  const heading = React.useRef(null);
  const fields = React.useRef(null);
  const focusField = React.useRef(null);

  const load = React.useCallback(async () => {
    const session = {};
    draft.current = session;
    setResource({ status: 'loading', message: '' });
    setNotice(null);
    setComparison(null);
    setActionBusy(false);
    const [schema, result] = await Promise.all([getV2SurveySchema(binding), getV2SurveyDraft(binding)]);
    if (draft.current !== session) return;
    if (!schema.ok || !result.ok || schema.data.caseId !== result.data.caseId) return setResource({ status: 'error', message: result.error || schema.error || '조사서를 불러오지 못했습니다.' });
    const saved = result.data.draft;
    const submission = result.data.submission;
    const supplement = result.data.workflowState === 'SUPPLEMENT_REQUIRED' ? result.data.supplement : null;
    const revisionEditing = Boolean(submission && result.data.workflowState !== 'SUPPLEMENT_REQUIRED');
    const target = globalThis.history?.state?.surveyField;
    focusField.current = supplement?.fields?.some(({ field }) => field === target) ? target : null;
    const current = revisionEditing ? submission : saved;
    const initial = loadSnapshot(current?.snapshot, Boolean(supplement) || revisionEditing && legacySubmission(submission));
    Object.assign(session, {
      caseId: result.data.caseId,
      workflowState: result.data.workflowState,
      submission,
      supplement,
      revisionEditing,
      held: result.data.serviceHold === true,
      snapshot: initial,
      saved: initial,
      needsFormUpgrade: Boolean(!supplement && !revisionEditing && saved && saved.snapshot?.formVersion !== SURVEY_FORM_VERSION),
      previousExamScores: hasPreviousExamScores(saved?.snapshot?.scores),
      revision: Number((revisionEditing ? submission.revision : saved?.draftRevision) || 0)
    });
    setSnapshot(session.snapshot);
    setFiles(Array.isArray(result.data.files) ? result.data.files : []);
    setExcludedFileIds([]);
    setStep(focusField.current ? Math.max(0, SURVEY_STEPS.findIndex(({ key }) => key === supplementSection(focusField.current))) : 0);
    setViewOnly(revisionEditing || (session.held && Boolean(submission)));
    setSaveState({ kind: current ? 'saved' : 'idle' });
    setResource({ status: 'ready', message: '' });
  }, [binding]);
  React.useEffect(() => {
    load();
    return () => { draft.current = null; };
  }, [load]);
  React.useEffect(() => {
    if (resource.status !== 'ready') return;
    const field = focusField.current;
    focusField.current = null;
    const target = field && Array.from(fields.current?.querySelectorAll('[data-survey-field]') || []).find(node => node.dataset.surveyField === field);
    const control = target && (target.hasAttribute('tabindex') ? target : target.querySelector('input:not([hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)'));
    (control || heading.current)?.focus();
  }, [resource.status, step, viewOnly]);
  React.useEffect(() => {
    if (!leaveGuard) return undefined;
    leaveGuard.current = () => !draft.current?.action && mayLeave(draft.current);
    return () => { leaveGuard.current = null; };
  }, [leaveGuard]);
  React.useEffect(() => {
    if (!pending(draft.current)) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    globalThis.addEventListener('beforeunload', warn);
    return () => globalThis.removeEventListener('beforeunload', warn);
  }, [snapshot, saveState.kind]);

  const updateSection = React.useCallback((key, patch) => {
    const session = draft.current;
    if (!session?.snapshot || session.action) return;
    const current = session.snapshot;
    const changes = typeof patch === 'function' ? patch(current[key]) : patch;
    if (!changes) return;
    session.snapshot = { ...current, [key]: { ...current[key], ...changes } };
    setSnapshot(session.snapshot);
    setSaveState(previous => session.conflict ? previous : { kind: pending(session) ? 'pending' : 'saved' });
    setNotice(null);
  }, []);
  const updateScores = React.useCallback(patch => updateSection('scores', patch), [updateSection]);
  const { key, label, guide } = SURVEY_STEPS[step];
  const fileScan = useSurveyFileScan({
    binding, draft, session: resource.status === 'ready' && (key === 'consent' || draft.current?.supplement?.fields?.some(({ field }) => field === 'files')) && !viewOnly && !draft.current?.revisionEditing ? draft.current : null,
    files, setFiles
  });
  const save = async session => {
    if (session.conflict || draft.current !== session) return false;
    const serialized = surveySaveSnapshot(session.snapshot);
    const changes = edits(surveySaveSnapshot(session.saved), serialized);
    if (!Object.keys(changes).length && !session.needsFormUpgrade && session.workflowState !== 'ONBOARDING') {
      session.saved = session.snapshot;
      setSaveState({ kind: 'saved' });
      return true;
    }
    setSaveState({ kind: 'saving' });
    const result = await (session.revisionEditing
      ? saveV2SurveyRevision(binding, { expectedSurveyRevision: session.revision, changes })
      : saveV2SurveyDraft(binding, { expectedDraftRevision: session.revision, snapshot: serialized,
        ...(session.supplement?.requestId ? { supplementRequestId: session.supplement.requestId } : {}) }));
    if (draft.current !== session) return false;
    if (!result.ok) {
      session.conflict = result.code === 'REVISION_CONFLICT';
      setSaveState({ kind: 'failed', message: session.conflict ? CONFLICT_MESSAGE : result.error || '저장하지 못했어요. 입력한 내용은 그대로 남아 있습니다.', conflict: session.conflict });
      return false;
    }
    if (session.revisionEditing) {
      session.submission = result.data.submission;
      session.revision = session.submission.revision;
      session.snapshot = loadSnapshot(session.submission.snapshot, legacySubmission(session.submission));
      setSnapshot(session.snapshot);
    } else session.revision = result.data.draftRevision;
    session.workflowState = result.data.workflowState;
    session.needsFormUpgrade = false;
    session.saved = session.snapshot;
    setSaveState({ kind: 'saved' });
    return true;
  };

  const runAction = async action => {
    const session = draft.current;
    if (!session?.snapshot || session.action) return;
    session.action = true;
    setActionBusy(true);
    try {
      return await action(session);
    } finally {
      session.action = false;
      if (draft.current === session) setActionBusy(false);
    }
  };

  const showNotice = (text, error = false) => setNotice({ text, error });
  const next = () => runAction(async session => {
    setNotice(null);
    if (await save(session)) setStep(value => value + 1);
  });

  const rememberFile = file => setFiles(current => [...current.filter(item => item.fileId !== file.fileId), file]);
  const showUploadResult = result => {
    if (!result.ok) {
      if (result.pendingFile) rememberFile(result.pendingFile);
      return showNotice(result.error || '업로드하지 못했습니다.', true);
    }
    rememberFile(result.data);
    if (result.data.status === 'rejected') showNotice('성적표가 보안 검사에서 거절됐어요. 다른 파일을 첨부해 주세요.', true);
  };
  const upload = file => runAction(async session => {
    if (files.filter(file => file.status !== 'linked').length >= 3) return showNotice('새 성적표는 최대 3개까지 등록할 수 있습니다. 필요 없는 새 첨부를 지운 뒤 다시 올려주세요.', true);
    setNotice(null);
    const result = await uploadV2ScoreFile(binding, { caseId: session.caseId, file });
    if (draft.current === session) showUploadResult(result);
  });
  const confirmUpload = file => runAction(async session => {
    setNotice(null);
    const result = await confirmV2ScoreUpload(binding, { caseId: session.caseId, fileId: file.fileId });
    if (draft.current === session) showUploadResult(result);
  });
  const deleteFile = file => runAction(async session => {
    if (!globalThis.confirm?.('첨부한 성적표를 삭제할까요?')) return;
    const result = await deleteV2ScoreFile(binding, { caseId: session.caseId, fileId: file.fileId });
    if (draft.current !== session) return;
    if (!result.ok) return showNotice(result.error || '성적표를 삭제하지 못했습니다.', true);
    setFiles(current => current.filter(item => item.fileId !== file.fileId));
    showNotice('첨부한 성적표를 삭제했습니다.');
  });
  const submit = () => runAction(async session => {
    const supplement = session.workflowState === 'SUPPLEMENT_REQUIRED';
    const keepFiles = supplement && session.supplement?.fields?.length && !session.supplement.fields.some(({ field }) => field === 'files');
    const readyFiles = keepFiles ? files.filter(file => session.submission?.fileIds?.includes(file.fileId)) : files.filter(file => file.status === 'ready' || (supplement && file.status === 'linked'
      && session.submission?.fileIds?.includes(file.fileId) && !excludedFileIds.includes(file.fileId)));
    const validation = supplement ? null : clientSurveyError(session.snapshot, readyFiles);
    if (supplement && (readyFiles.length < 1 || readyFiles.length > 3)) return showNotice('보안 검사를 통과한 성적표를 1~3개 선택해 주세요. 교체할 기존 첨부는 이번 제출에서 제외할 수 있어요.', true);
    if (validation) {
      setStep(SURVEY_STEPS.findIndex(item => item.key === validation.section));
      return showNotice(validation.message, true);
    }
    if (!globalThis.confirm?.(supplement ? '보완한 답변을 운영팀에 다시 제출할까요?' : '기초조사서를 최종 제출할까요?')) return;
    if (!(await save(session))) return;
    const fileIds = readyFiles.map(file => file.fileId);
    const submission = [session.revision, ...fileIds].join('|');
    if (session.submitAttempt?.inputs !== submission) {
      session.submitAttempt = { inputs: submission, key: idempotencyKey(supplement ? 'survey-supplement' : 'survey-submit') };
    }
    const result = await submitV2Survey(binding, { fileIds, expectedDraftRevision: session.revision, idempotencyKey: session.submitAttempt.key,
      ...(session.supplement?.requestId ? { supplementRequestId: session.supplement.requestId } : {}) }, supplement);
    if (draft.current !== session) return;
    if (result.code === 'REVISION_CONFLICT') {
      session.conflict = true;
      setSaveState({ kind: 'failed', message: CONFLICT_MESSAGE, conflict: true });
      return;
    }
    if (!result.ok) return showNotice(result.error || '제출하지 못했습니다.', true);
    session.action = false;
    navigateConsulting(CONSULTING_ROUTES.materials, { replace: true });
  });
  const compareLatest = () => runAction(async session => {
    const result = await getV2SurveyDraft(binding);
    if (draft.current !== session) return;
    if (!result.ok || result.data.caseId !== session.caseId) return showNotice('최신 답변을 불러오지 못했어요. 다시 시도해 주세요.', true);
    const remote = result.data;
    const next = session.revisionEditing ? remote.submission : remote.draft;
    const nextRevision = session.revisionEditing ? next?.revision : next?.draftRevision;
    const draftBecameSubmitted = !session.revisionEditing && remote.submission && remote.workflowState !== 'SUPPLEMENT_REQUIRED';
    if (!next?.snapshot || !Number.isSafeInteger(nextRevision) || remote.serviceHold || draftBecameSubmitted
        || (session.revisionEditing && remote.workflowState === 'SUPPLEMENT_REQUIRED')) {
      return showNotice('조사서의 진행 상태가 바뀌었어요. 최신 화면을 다시 열어 주세요.', true);
    }
    setComparison({ remote, nextRevision, snapshot: loadSnapshot(next.snapshot, session.revisionEditing && legacySubmission(next)) });
  });
  const resolveComparison = keepEdits => {
    const session = draft.current;
    if (!session || !comparison) return;
    const { remote, nextRevision, snapshot: fresh } = comparison;
    session.snapshot = keepEdits ? applyEdits(session.saved, session.snapshot, fresh) : fresh;
    session.saved = fresh;
    session.submission = remote.submission;
    session.revision = nextRevision;
    session.workflowState = remote.workflowState;
    session.conflict = false;
    setSnapshot(session.snapshot);
    setFiles(remote.files || []);
    setComparison(null);
    setSaveState({ kind: pending(session) ? 'pending' : 'saved' });
    showNotice(keepEdits ? '최신 답변에 내 변경을 합쳤어요. 내용을 확인한 뒤 저장해 주세요.' : '최신 답변을 열었어요.');
  };
  const viewSaved = () => {
    const session = draft.current;
    if (!mayLeave(session)) return;
    session.snapshot = session.saved;
    session.conflict = false;
    setSnapshot(session.saved);
    setComparison(null);
    setSaveState({ kind: 'saved' });
    setNotice(null);
    setViewOnly(true);
  };

  if (resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">기초조사서를 불러오고 있습니다.</p></main>;
  if (resource.status === 'error') return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>조사서를 불러오지 못했습니다</h1><p className="consulting-v2-status" data-tone="error">{resource.message}</p><button className="consulting-v2-primary consulting-v2-wide" onClick={load}>다시 시도</button></section></main>;
  const session = draft.current;
  const { submission, held, revisionEditing, supplement } = session;
  const needsSupplement = session.workflowState === 'SUPPLEMENT_REQUIRED';
  const legacy = (revisionEditing || needsSupplement) && legacySubmission(submission);
  const update = patch => updateSection(key, patch);
  const submittedFiles = files.filter(file => submission?.fileIds?.includes(file.fileId));
  const editFiles = files.filter(file => file.status !== 'linked' || submission?.fileIds?.includes(file.fileId));
  const fileActions = { files: revisionEditing ? submittedFiles : editFiles, readOnly: revisionEditing,
    excludedFileIds, onIncludeLinked: needsSupplement ? (fileId, include) => setExcludedFileIds(current => include ? current.filter(id => id !== fileId) : [...current, fileId]) : undefined,
    onUpload: upload, onConfirmUpload: confirmUpload, onDelete: deleteFile, ...fileScan };
  const isLastStep = step === SURVEY_STEPS.length - 1;
  const changeStep = index => { setNotice(null); setStep(index); };
  if (needsSupplement && supplement?.fields?.length && !viewOnly) {
    const selectedFileIds = supplement.fields.some(({ field }) => field === 'files')
      ? editFiles.filter(file => file.status === 'ready' || file.status === 'linked' && !excludedFileIds.includes(file.fileId)).map(file => file.fileId)
      : submission?.fileIds || [];
    const renderField = field => {
      const section = supplementSection(field), update = patch => updateSection(section, patch);
      if (section === 'studentStatus') return <StudentStatusStep snapshot={snapshot} update={update} />;
      if (section === 'conditions') return <ConditionsStep snapshot={snapshot} update={update} legacy={false} />;
      if (section === 'preferences') return <ConsultingSurveyPreferences value={snapshot.preferences} update={update} />;
      if (section === 'strategy') return <StrategyStep snapshot={snapshot} update={update} />;
      if (section === 'qualitative') return <QualitativeStep snapshot={snapshot} update={update} />;
      if (section === 'consent') return <ConsentStep snapshot={snapshot} update={update} fileActions={fileActions} />;
      if (section === 'scores') return legacy ? <LegacyScoresStep value={snapshot.scores} update={updateScores} raw={snapshot.formVersion === 3} />
        : <ConsultingSurveyScores value={snapshot.scores} update={updateScores} binding={binding} actionBusy={actionBusy} autoConvert={false} />;
      return null;
    };
    return <SurveySupplementEditor supplement={supplement} snapshot={snapshot} submission={submission} selectedFileIds={selectedFileIds}
      busy={actionBusy} held={held} saveState={saveState} notice={notice} renderField={renderField} fieldsRef={fields} headingRef={heading}
      onBack={() => navigateConsulting(CONSULTING_ROUTES.materials)} onSubmit={submit}
      onSave={() => runAction(async current => { if (await save(current)) showNotice('임시 저장했어요. 운영팀에는 아직 재제출되지 않았어요.'); })}
      onReload={() => { if (mayLeave(session)) load(); }} />;
  }
  return <main className="consulting-survey">
    <header>
      <button type="button" disabled={actionBusy} onClick={() => navigateConsulting(needsSupplement ? CONSULTING_ROUTES.materials : CONSULTING_ROUTES.home)}>
        {needsSupplement ? '← 보완 요청 보기' : '← 나의 컨설팅'}
      </button>
      <span className="consulting-survey-save-state" data-state={saveState.kind} role="status">{viewOnly ? '제출한 답변' : SAVE_LABELS[saveState.kind]}</span>
    </header>
    <section className="consulting-survey-card" aria-labelledby="survey-title">
      <div className="consulting-survey-intro">
        <div>
          <p className="consulting-survey-position">{submission ? viewOnly ? '제출한 기초조사서' : revisionEditing ? '기초조사서 수정' : '보완 작성' : '기초조사서'} <span>{step + 1} / {SURVEY_STEPS.length}</span></p>
          <h1 id="survey-title" tabIndex={-1} ref={heading}>{label}</h1>
          <p className="consulting-survey-guide">{viewOnly ? held ? '서비스가 일시 보류 중입니다. 저장된 답변을 볼 수 있어요.' : '항목을 골라 제출한 답변을 확인하세요.' : guide}</p>
        </div>
        <img className="consulting-survey-mascot" src="/assets/images/mascots/crack_showresult.png" width="1024" height="776" alt="" decoding="async" />
      </div>
      {notice ? <p className="consulting-survey-message" data-tone={notice.error ? 'error' : 'info'} role={notice.error ? 'alert' : 'status'}>{notice.text}</p> : null}
      {!viewOnly && needsSupplement && <SurveySupplementNotes reasonText={supplement?.reasonText} fields={supplement?.fields?.filter(({ field }) => supplementSection(field) === key)} />}
      {viewOnly ? <>
        <Field label="조사서 항목"><select value={step} onChange={event => changeStep(Number(event.currentTarget.value))}>{SURVEY_STEPS.map(({ label: itemLabel, key: itemKey }, index) => <option key={itemKey} value={index}>{itemLabel}</option>)}</select></Field>
        <SurveyAnswerView section={key} value={submission?.snapshot?.[key]} />
        {key === 'consent' && <SurveyScoreFiles files={submittedFiles} readOnly />}
      </> : <fieldset className="consulting-survey-fields" ref={fields} disabled={actionBusy || held} aria-labelledby="survey-title">
        {key === 'studentStatus' && <StudentStatusStep snapshot={snapshot} update={update} />}
        {key === 'scores' && (legacy ? <LegacyScoresStep value={snapshot.scores} update={updateScores} raw={snapshot.formVersion === 3} />
          : <ConsultingSurveyScores value={snapshot.scores} update={updateScores} binding={binding} actionBusy={actionBusy}
            autoConvert={!revisionEditing} previousExamScores={!revisionEditing && session.previousExamScores} />)}
        {key === 'conditions' && <ConditionsStep snapshot={snapshot} update={update} legacy={legacy && !snapshot.formVersion} />}
        {key === 'preferences' && (legacy && !snapshot.formVersion ? <LegacyPreferencesStep value={snapshot.preferences} update={update} /> : <ConsultingSurveyPreferences value={snapshot.preferences} update={update} />)}
        {key === 'strategy' && <StrategyStep snapshot={snapshot} update={update} />}
        {key === 'qualitative' && <QualitativeStep snapshot={snapshot} update={update} />}
        {key === 'consent' && <ConsentStep snapshot={snapshot} update={update} fileActions={fileActions} />}
      </fieldset>}
      {saveState.kind === 'failed' ? <div className="consulting-survey-save-error">
        <p role="alert">{saveState.message}</p>
        {saveState.conflict ? <>
          <button className="consulting-v2-secondary" type="button" disabled={actionBusy} onClick={compareLatest}>최신 답변과 비교</button>
          <button className="consulting-v2-secondary" type="button" disabled={actionBusy} onClick={() => { if (mayLeave(session)) load(); }}>저장본 다시 열기</button>
        </> : <button className="consulting-v2-secondary" type="button" disabled={actionBusy} onClick={() => runAction(save)}>다시 저장</button>}
      </div> : null}
      {comparison && <section className="consulting-survey-comparison" aria-label="저장 충돌 비교">
        {SURVEY_STEPS.filter(({ key: section }) => !equal(session.saved[section], snapshot[section])).map(({ key: section, label: sectionLabel }) =>
          <details key={section} open><summary>{sectionLabel}</summary><div className="consulting-survey-grid">
            <section><h3>최신 답변</h3><SurveyAnswerView section={section} value={comparison.snapshot[section]} /></section>
            <section><h3>내 입력</h3><SurveyAnswerView section={section} value={snapshot[section]} /></section>
          </div></details>)}
        <div className="consulting-score-lookup">
          <button type="button" className="consulting-v2-secondary" onClick={() => resolveComparison(false)}>최신 답변 사용</button>
          <button type="button" className="consulting-v2-primary" onClick={() => resolveComparison(true)}>내 변경 이어서 편집</button>
        </div>
      </section>}
      <footer>
        <button type="button" className="consulting-v2-secondary" disabled={step === 0 || actionBusy} onClick={() => changeStep(step - 1)}>이전</button>
        {viewOnly ? !held && <button type="button" className="consulting-v2-primary" onClick={() => { setNotice(null); setViewOnly(false); }}>{revisionEditing ? '이 항목 수정' : '보완 작성하기'}</button>
          : <button type="button" className="consulting-v2-primary" disabled={actionBusy || held || saveState.conflict}
            onClick={!isLastStep ? next : revisionEditing ? () => runAction(async current => {
              if (await save(current)) { setViewOnly(true); showNotice('저장된 답변을 확인할 수 있어요.'); }
            }) : submit}>{!isLastStep ? '저장하고 다음' : revisionEditing ? '변경 저장' : needsSupplement ? '보완 답변 재제출' : '최종 제출'}</button>}
      </footer>
      {!viewOnly && submission && <button type="button" className="consulting-v2-secondary consulting-survey-refresh" disabled={actionBusy} onClick={viewSaved}>제출한 답변 보기</button>}
    </section>
  </main>;
}

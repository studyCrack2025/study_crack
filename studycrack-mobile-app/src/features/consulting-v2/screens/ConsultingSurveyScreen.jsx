import React from 'react';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';
import { clientSurveyError, COMMUTE_OPTIONS, createEmptySurvey, hasPreviousExamScores, normalizeSurveyDraft, PRIORITY_LABELS, surveySaveSnapshot, SURVEY_FORM_VERSION, SURVEY_STEPS } from '../survey-model.js';
import { confirmV2ScoreUpload, deleteV2ScoreFile, getV2SurveyDraft, getV2SurveySchema, saveV2SurveyDraft, submitV2Survey, uploadV2ScoreFile } from '../survey-api.js';
import { useSurveyFileScan } from '../use-survey-file-scan.js';
import { ConsultingSurveyPreferences } from './ConsultingSurveyPreferences.jsx';
import { ConsultingSurveyScores } from './ConsultingSurveyScores.jsx';
import { SurveyScoreFiles } from './SurveyScoreFiles.jsx';

const toOptionalNumber = value => value === '' ? null : Number(value);
const idempotencyKey = prefix => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function Field({ children, label }) {
  return <label className="consulting-survey-field"><span>{label}</span>{children}</label>;
}

function StudentStatusStep({ snapshot, update }) {
  const value = snapshot.studentStatus;
  return <div className="consulting-survey-grid"><Field label="지원자 구분"><select value={value.applicantType} onChange={event => update({ applicantType: event.target.value })}><option value="">선택</option><option value="high_school_senior">고3 재학생</option><option value="graduate">졸업생</option><option value="qualification_exam">검정고시</option></select></Field><Field label="졸업 연도"><input type="number" min="2020" max="2027" value={value.graduationYear ?? ''} onChange={event => update({ graduationYear: toOptionalNumber(event.target.value) })} /></Field><Field label="학교 유형"><select value={value.schoolType} onChange={event => update({ schoolType: event.target.value })}><option value="">선택</option><option value="general">일반고</option><option value="specialized">특목·특성화고</option><option value="autonomous">자율고</option><option value="other">기타</option></select></Field><Field label="학교명"><input maxLength="80" value={value.schoolName} onChange={event => update({ schoolName: event.target.value })} /></Field><Field label="거주 지역"><input maxLength="40" placeholder="예: 서울 송파구" value={value.residenceRegion} onChange={event => update({ residenceRegion: event.target.value })} /></Field></div>;
}

function ConditionsStep({ snapshot, update }) {
  const value = snapshot.conditions;
  return <div className="consulting-survey-grid consulting-survey-grid-single">
    <Field label="최대 편도 통학 시간">
      <select value={value.commuteLimit} onChange={event => {
        const limit = event.currentTarget.value;
        update({ commuteLimit: limit, commuteMaxMinutes: limit && limit !== 'over_120' ? Number(limit) : null });
      }}>
        <option value="">선택해 주세요</option>
        {COMMUTE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </Field>
    {!value.commuteLimit && value.commuteMaxMinutes != null && <p className="consulting-score-note">이전에 {value.commuteMaxMinutes}분으로 입력했어요. 현재 선택지에서 다시 골라주세요.</p>}
    <label className="consulting-survey-check"><input type="checkbox" checked={value.dormitoryAllowed} onChange={event => update({ dormitoryAllowed: event.target.checked })} /> 기숙사 생활 가능</label>
    <label className="consulting-survey-check"><input type="checkbox" checked={value.repeatStudyAllowed} onChange={event => update({ repeatStudyAllowed: event.target.checked })} /> 재도전 가능성 고려</label>
  </div>;
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
    <Field label="지원 위험 선호"><select value={value.riskTolerance} onChange={event => update({ riskTolerance: event.target.value })}><option value="">선택</option><option value="safe">안정 중심</option><option value="balanced">균형</option><option value="challenge">도전 중심</option></select></Field>
    <section className="consulting-priority-list" aria-labelledby="consulting-priority-title">
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
    </section>
  </>;
}

function QualitativeStep({ snapshot, update }) {
  const value = snapshot.qualitative;
  const question = value.consultationQuestions[0] || '';
  return <div className="consulting-survey-grid consulting-survey-grid-single"><Field label="강점"><textarea maxLength="1500" value={value.strengths} onChange={event => update({ strengths: event.target.value })} /></Field><Field label="현재 가장 큰 고민"><textarea maxLength="1500" value={value.concerns} onChange={event => update({ concerns: event.target.value })} /></Field><Field label="보호자 의견"><textarea maxLength="1000" value={value.guardianOpinion} onChange={event => update({ guardianOpinion: event.target.value })} /></Field><Field label="특이사항"><textarea maxLength="1000" value={value.specialCircumstances} onChange={event => update({ specialCircumstances: event.target.value })} /></Field><Field label="기초조사서 외에 상담에서 꼭 묻고 싶은 점"><textarea maxLength="500" required value={question} onChange={event => update({ consultationQuestions: [event.target.value, ...value.consultationQuestions.slice(1)] })} /></Field></div>;
}

function ConsentStep({ snapshot, update, fileActions }) {
  return <>
    <SurveyScoreFiles {...fileActions} />
    <label className="consulting-survey-check"><input type="checkbox" checked={snapshot.consent.accurateInformation} onChange={event => update({ accurateInformation: event.target.checked })} /> 입력한 정보가 사실과 같음을 확인합니다.</label>
    <label className="consulting-survey-check"><input type="checkbox" checked={snapshot.consent.analysisUse} onChange={event => update({ analysisUse: event.target.checked })} /> 컨설팅 분석을 위한 자료 이용에 동의합니다.</label>
  </>;
}

const SAVE_LABELS = Object.freeze({ idle: '작성 전', pending: '저장 대기', saving: '저장 중…', saved: '저장됨', failed: '저장 실패' });
const CONFLICT_MESSAGE = '다른 화면에서 먼저 저장했습니다. 지금 입력한 내용은 이 화면에 남아 있어요.';

export function ConsultingSurveyScreen({ binding }) {
  const [resource, setResource] = React.useState({ status: 'loading', message: '' });
  const [snapshot, setSnapshot] = React.useState(createEmptySurvey);
  const [files, setFiles] = React.useState([]);
  const [step, setStep] = React.useState(0);
  const [saveState, setSaveState] = React.useState({ kind: 'idle' });
  const [notice, setNotice] = React.useState(null);
  const [actionBusy, setActionBusy] = React.useState(false);
  const draft = React.useRef(null);
  const heading = React.useRef(null);

  const load = React.useCallback(async () => {
    const session = {};
    draft.current = session;
    setResource({ status: 'loading', message: '' });
    setNotice(null);
    setActionBusy(false);
    const [schema, result] = await Promise.all([getV2SurveySchema(binding), getV2SurveyDraft(binding)]);
    if (draft.current !== session) return;
    if (!schema.ok || !result.ok || schema.data.caseId !== result.data.caseId) return setResource({ status: 'error', message: result.error || schema.error || '조사서를 불러오지 못했습니다.' });
    const saved = result.data.draft;
    Object.assign(session, {
      caseId: result.data.caseId,
      workflowState: result.data.workflowState,
      snapshot: normalizeSurveyDraft(saved?.snapshot),
      needsFormUpgrade: Boolean(saved && saved.snapshot?.formVersion !== SURVEY_FORM_VERSION),
      previousExamScores: hasPreviousExamScores(saved?.snapshot?.scores),
      revision: Number(saved?.draftRevision || 0),
      edit: 0,
      savedEdit: 0
    });
    setSnapshot(session.snapshot);
    setFiles(Array.isArray(result.data.files) ? result.data.files : []);
    setStep(0);
    setSaveState({ kind: saved ? 'saved' : 'idle' });
    setResource({ status: 'ready', message: '' });
  }, [binding]);
  React.useEffect(() => {
    load();
    return () => { draft.current = null; };
  }, [load]);
  React.useEffect(() => { heading.current?.focus(); }, [step]);

  const updateSection = React.useCallback((key, patch) => {
    const session = draft.current;
    if (!session?.snapshot || session.action) return;
    const current = session.snapshot;
    const changes = typeof patch === 'function' ? patch(current[key]) : patch;
    if (!changes) return;
    session.snapshot = { ...current, [key]: { ...current[key], ...changes } };
    session.edit += 1;
    setSnapshot(session.snapshot);
    setSaveState(previous => session.inFlight || session.conflict ? previous : { kind: 'pending' });
    setNotice(null);
  }, []);
  const updateScores = React.useCallback(patch => updateSection('scores', patch), [updateSection]);
  const { key, label, guide } = SURVEY_STEPS[step];
  const fileScan = useSurveyFileScan({
    binding, draft, session: resource.status === 'ready' && key === 'consent' ? draft.current : null,
    files, setFiles
  });
  const save = React.useCallback(session => {
    if (session.inFlight) return session.inFlight;
    if (session.conflict || draft.current !== session) return Promise.resolve(false);
    if (session.edit === session.savedEdit) return Promise.resolve(true);
    const edit = session.edit;
    setSaveState({ kind: 'saving' });
    session.inFlight = saveV2SurveyDraft(binding, {
      expectedDraftRevision: session.revision,
      snapshot: surveySaveSnapshot(session.snapshot)
    }).then(result => {
      session.inFlight = null;
      if (draft.current !== session) return false;
      if (!result.ok) {
        session.failedEdit = edit;
        session.conflict = result.code === 'REVISION_CONFLICT';
        setSaveState({ kind: 'failed', message: session.conflict ? CONFLICT_MESSAGE : '저장하지 못했어요. 입력한 내용은 그대로 남아 있습니다.', conflict: session.conflict });
        return false;
      }
      session.revision = result.data.draftRevision;
      session.workflowState = result.data.workflowState;
      session.needsFormUpgrade = false;
      session.savedEdit = edit;
      session.failedEdit = null;
      setSaveState({ kind: session.edit === edit ? 'saved' : 'pending' });
      return true;
    });
    return session.inFlight;
  }, [binding]);

  React.useEffect(() => {
    const session = draft.current;
    if (resource.status !== 'ready' || !session || session.action || session.inFlight || session.conflict || session.savedEdit === session.edit || session.failedEdit === session.edit) return undefined;
    const edit = session.edit;
    const timer = setTimeout(() => {
      if (draft.current === session && !session.action && session.edit === edit) save(session);
    }, 2000);
    return () => clearTimeout(timer);
  }, [actionBusy, resource.status, save, saveState.kind, snapshot]);

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

  const flush = async session => {
    if (session.inFlight && !(await session.inFlight) && session.failedEdit === session.edit) return false;
    if (session.needsFormUpgrade && session.savedEdit === session.edit) session.edit += 1;
    return await save(session) && draft.current === session && session.savedEdit === session.edit;
  };
  const showNotice = (text, error = false) => setNotice({ text, error });
  const next = () => runAction(async session => {
    setNotice(null);
    if (await flush(session)) setStep(value => value + 1);
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
    if (files.length >= 3) return showNotice('성적표는 최대 3개까지 등록할 수 있습니다.', true);
    if (session.workflowState === 'ONBOARDING' && session.savedEdit === session.edit) session.edit += 1;
    if (!(await flush(session))) return;
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
    const readyFiles = files.filter(file => file.status === 'ready');
    const validation = clientSurveyError(session.snapshot, readyFiles);
    if (validation) {
      setStep(SURVEY_STEPS.findIndex(item => item.key === validation.section));
      return showNotice(validation.message, true);
    }
    if (!(await flush(session))) return;
    if (!globalThis.confirm?.('제출 후에는 운영자 보완 요청 전까지 내용을 수정할 수 없습니다. 제출하시겠습니까?')) return;
    const supplement = session.workflowState === 'SUPPLEMENT_REQUIRED';
    const fileIds = readyFiles.map(file => file.fileId);
    const submission = [session.revision, ...fileIds].join('|');
    if (session.submission?.inputs !== submission) {
      session.submission = { inputs: submission, key: idempotencyKey(supplement ? 'survey-supplement' : 'survey-submit') };
    }
    const result = await submitV2Survey(binding, { fileIds, expectedDraftRevision: session.revision, idempotencyKey: session.submission.key }, supplement);
    if (draft.current !== session) return;
    if (result.code === 'REVISION_CONFLICT') {
      session.conflict = true;
      setSaveState({ kind: 'failed', message: CONFLICT_MESSAGE, conflict: true });
      return;
    }
    if (!result.ok) return showNotice(result.error || '제출하지 못했습니다.', true);
    navigateConsulting(CONSULTING_ROUTES.materials, { replace: true });
  });

  if (resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">기초조사서를 불러오고 있습니다.</p></main>;
  if (resource.status === 'error') return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>조사서를 불러오지 못했습니다</h1><p className="consulting-v2-status" data-tone="error">{resource.message}</p><button className="consulting-v2-primary consulting-v2-wide" onClick={load}>다시 시도</button></section></main>;
  const update = patch => updateSection(key, patch);
  const fileActions = { files, onUpload: upload, onConfirmUpload: confirmUpload, onDelete: deleteFile, ...fileScan };
  return <main className="consulting-survey">
    <header>
      <button type="button" disabled={actionBusy} onClick={() => runAction(async session => {
        const saved = await flush(session);
        if (draft.current !== session) return;
        if (saved || globalThis.confirm?.('저장하지 못한 입력이 있습니다. 나의 컨설팅으로 돌아갈까요?')) navigateConsulting(CONSULTING_ROUTES.home);
      })}>← 나의 컨설팅</button>
      <span className="consulting-survey-save-state" data-state={saveState.kind} role="status">{SAVE_LABELS[saveState.kind]}</span>
    </header>
    <section className="consulting-survey-card" aria-labelledby="survey-title">
      <div className="consulting-survey-intro">
        <div>
          <p className="consulting-survey-position">기초조사서 <span>{step + 1} / {SURVEY_STEPS.length}</span></p>
          <h1 id="survey-title" tabIndex={-1} ref={heading}>{label}</h1>
          <p className="consulting-survey-guide">{guide}</p>
        </div>
        <img className="consulting-survey-mascot" src="/assets/images/mascots/crack_showresult.png" width="1024" height="776" alt="" decoding="async" />
      </div>
      {notice ? <p className="consulting-survey-message" data-tone={notice.error ? 'error' : 'info'} role={notice.error ? 'alert' : 'status'}>{notice.text}</p> : null}
      <fieldset className="consulting-survey-fields" disabled={actionBusy} aria-labelledby="survey-title">
        {key === 'studentStatus' && <StudentStatusStep snapshot={snapshot} update={update} />}
        {key === 'scores' && <ConsultingSurveyScores value={snapshot.scores} update={updateScores} binding={binding} actionBusy={actionBusy} previousExamScores={draft.current.previousExamScores} />}
        {key === 'conditions' && <ConditionsStep snapshot={snapshot} update={update} />}
        {key === 'preferences' && <ConsultingSurveyPreferences value={snapshot.preferences} update={update} />}
        {key === 'strategy' && <StrategyStep snapshot={snapshot} update={update} />}
        {key === 'qualitative' && <QualitativeStep snapshot={snapshot} update={update} />}
        {key === 'consent' && <ConsentStep snapshot={snapshot} update={update} fileActions={fileActions} />}
      </fieldset>
      {saveState.kind === 'failed' ? <div className="consulting-survey-save-error">
        <p role="alert">{saveState.message}</p>
        {saveState.conflict
          ? <button className="consulting-v2-secondary" type="button" disabled={actionBusy} onClick={() => {
            if (globalThis.confirm?.('서버에 저장된 답변을 불러올까요? 현재 화면의 미저장 입력은 사라집니다.')) load();
          }}>저장본 다시 열기</button>
          : <button className="consulting-v2-secondary" type="button" disabled={actionBusy} onClick={() => runAction(flush)}>다시 저장</button>}
      </div> : null}
      <footer>
        <button type="button" className="consulting-v2-secondary" disabled={step === 0 || actionBusy} onClick={() => { setNotice(null); setStep(value => value - 1); }}>이전</button>
        {step < SURVEY_STEPS.length - 1
          ? <button type="button" className="consulting-v2-primary" disabled={actionBusy || saveState.conflict} onClick={next}>저장하고 다음</button>
          : <button type="button" className="consulting-v2-primary" disabled={actionBusy || saveState.conflict} onClick={submit}>{draft.current?.workflowState === 'SUPPLEMENT_REQUIRED' ? '보완 제출' : '최종 제출'}</button>}
      </footer>
    </section>
  </main>;
}

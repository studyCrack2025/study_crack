import React from 'react';
import { SecondaryIntro, SecondaryScreenShell, SecondaryState } from '../../components/SecondaryScreen.jsx';
import { createBlankConsultingSurvey, createSurveyRequestKey, normalizeConsultingSurveyDraft } from '../../features/consulting/survey-model.js';

const { useCallback, useEffect, useRef, useState } = React;

function resultData(result) {
  return result?.ok ? result.data?.data : null;
}

function Field({ children, label }) {
  return <label className="consulting-field"><span>{label}</span>{children}</label>;
}

function Select({ children, value, onChange }) {
  return <select value={value ?? ''} onChange={onChange}><option value="">선택</option>{children}</select>;
}

export function ConsultingSurveyScreen({ finalizeConsultingInitialSurvey, loadConsultingHome, loadConsultingSurveyDraft, loadConsultingSurveySchema, persistConsultingSurveyDraft, removeConsultingScoreDocument, uploadConsultingScoreDocument }) {
  const [caseInfo, setCaseInfo] = useState(null);
  const [survey, setSurvey] = useState(createBlankConsultingSurvey);
  const [draftRevision, setDraftRevision] = useState(0);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const initializedRef = useRef(false);
  const lastSavedRef = useRef('');

  const loadDraft = useCallback(async (caseId, signal) => {
    const result = await loadConsultingSurveyDraft({ caseId, signal });
    if (!result.ok) throw new Error(result.error);
    const data = resultData(result) || {};
    const nextSurvey = normalizeConsultingSurveyDraft(data.draft?.snapshot);
    setSurvey(nextSurvey);
    setDraftRevision(Number(data.draft?.draftRevision || 0));
    setFiles(Array.isArray(data.files) ? data.files : []);
    setCaseInfo((current) => current ? { ...current, supplementReason: data.supplementReason || null, scoreVerificationStatus: data.scoreVerificationStatus || null } : current);
    lastSavedRef.current = JSON.stringify(nextSurvey);
    initializedRef.current = true;
    return data;
  }, [loadConsultingSurveyDraft]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const homeResult = await loadConsultingHome(controller.signal);
        if (!homeResult.ok) throw new Error(homeResult.error);
        const home = resultData(homeResult) || {};
        if (!home.available || !home.case) { setStatus('empty'); return; }
        setCaseInfo(home.case);
        if (home.case.workflowState === 'PAYMENT_PENDING') { setStatus('ready'); return; }
        await Promise.all([loadConsultingSurveySchema({ caseId: home.case.caseId, signal: controller.signal }), loadDraft(home.case.caseId, controller.signal)]);
        setStatus('ready');
      } catch (error) {
        if (error?.name !== 'AbortError') { setMessage(error?.message || '컨설팅 정보를 불러오지 못했습니다.'); setStatus('error'); }
      }
    })();
    return () => controller.abort();
  }, [loadConsultingHome, loadConsultingSurveySchema, loadDraft]);

  const save = useCallback(async ({ silent = false } = {}) => {
    if (!caseInfo?.caseId || !initializedRef.current) return false;
    const signature = JSON.stringify(survey);
    if (signature === lastSavedRef.current) return true;
    setSaving(true);
    const result = await persistConsultingSurveyDraft({ caseId: caseInfo.caseId, expectedDraftRevision: draftRevision, snapshot: survey });
    setSaving(false);
    if (!result.ok) { if (!silent) setMessage(result.error); return false; }
    const data = resultData(result) || {};
    setDraftRevision(Number(data.draftRevision || draftRevision + 1));
    lastSavedRef.current = signature;
    if (!silent) setMessage('저장했습니다.');
    return true;
  }, [caseInfo, draftRevision, persistConsultingSurveyDraft, survey]);

  useEffect(() => {
    if (!initializedRef.current || JSON.stringify(survey) === lastSavedRef.current) return undefined;
    const timer = setTimeout(() => save({ silent: true }), 1200);
    return () => clearTimeout(timer);
  }, [save, survey]);

  const patchSection = (section, patch) => setSurvey((current) => ({ ...current, [section]: { ...current[section], ...patch } }));
  const updateScore = (index, key, value) => patchSection('scores', { records: survey.scores.records.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row) });
  const updateTarget = (index, key, value) => patchSection('preferences', { targets: survey.preferences.targets.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row) });

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !caseInfo?.caseId) return;
    setUploading(true);
    const result = await uploadConsultingScoreDocument({ caseId: caseInfo.caseId, file });
    setUploading(false);
    setMessage(result.ok ? '파일을 올렸습니다. 안전 검사가 끝나면 제출할 수 있습니다.' : result.error);
    if (result.ok) await loadDraft(caseInfo.caseId);
  };

  const removeFile = async (fileId) => {
    const result = await removeConsultingScoreDocument({ caseId: caseInfo.caseId, fileId });
    setMessage(result.ok ? '파일을 삭제했습니다.' : result.error);
    if (result.ok) await loadDraft(caseInfo.caseId);
  };

  const submit = async () => {
    setMessage('');
    if (!(await save())) return;
    const readyFileIds = files.filter((file) => file.status === 'ready').map((file) => file.fileId);
    if (!readyFileIds.length) { setMessage('안전 검사가 완료된 성적표 파일이 필요합니다.'); return; }
    setSubmitting(true);
    const result = await finalizeConsultingInitialSurvey({ caseId: caseInfo.caseId, fileIds: readyFileIds, idempotencyKey: createSurveyRequestKey(caseInfo.caseId) });
    setSubmitting(false);
    setMessage(result.ok ? '조사서를 제출했습니다. 성적표 검수를 기다려주세요.' : result.error);
    if (result.ok) setCaseInfo((current) => ({ ...current, workflowState: 'MATERIAL_REVIEW' }));
  };

  if (status === 'loading') return <SecondaryScreenShell screen="consulting" title="정시 컨설팅"><SecondaryState kind="loading" title="컨설팅 정보를 불러오는 중이에요" /></SecondaryScreenShell>;
  if (status === 'error') return <SecondaryScreenShell screen="consulting" title="정시 컨설팅"><SecondaryState kind="error" title="컨설팅 정보를 불러오지 못했어요" description={message} /></SecondaryScreenShell>;
  if (status === 'empty') return <SecondaryScreenShell screen="consulting" title="정시 컨설팅"><SecondaryState title="진행 중인 정시 컨설팅이 없어요" description="결제가 확인되면 조사서를 작성할 수 있습니다." /></SecondaryScreenShell>;
  if (caseInfo?.workflowState === 'PAYMENT_PENDING') return <SecondaryScreenShell screen="consulting" title="정시 컨설팅"><SecondaryState kind="loading" title="결제 확인을 기다리고 있어요" description="결제 승인 후 조사서 작성이 열립니다." /></SecondaryScreenShell>;
  if (caseInfo?.workflowState === 'MATERIAL_REVIEW') return <SecondaryScreenShell screen="consulting" title="정시 컨설팅"><div className="consulting-survey-page"><SecondaryIntro eyebrow="MATERIAL REVIEW" title="자료를 검수하고 있어요" description="입력한 성적과 성적표를 확인한 뒤 다음 단계가 열립니다." />{message ? <p className="consulting-message">{message}</p> : null}</div></SecondaryScreenShell>;
  if (['ROUND1_OPEN', 'ROUND1_EDIT_OPEN'].includes(caseInfo?.workflowState)) return <SecondaryScreenShell screen="consulting" title="정시 컨설팅"><div className="consulting-survey-page"><SecondaryIntro eyebrow="ROUND 1" title="1차 지원 전략 작성 단계예요" description="다음 구현 단계에서 상담사 배정과 1차안을 연결합니다." /></div></SecondaryScreenShell>;

  const canEdit = ['PAYMENT_COMPLETED', 'SURVEY_DRAFT', 'SUPPLEMENT_REQUIRED'].includes(caseInfo?.workflowState);
  return <SecondaryScreenShell screen="consulting" title="정시 컨설팅"><div className="consulting-survey-page"><SecondaryIntro eyebrow="JUNGSI CONSULTING" title={caseInfo?.workflowState === 'SUPPLEMENT_REQUIRED' ? '자료를 보완해주세요' : '사전 조사서를 작성해주세요'} description="작성 내용은 서버에 자동 저장되며, 제출 전까지 수정할 수 있습니다." />{caseInfo?.workflowState === 'SUPPLEMENT_REQUIRED' && caseInfo.supplementReason ? <div className="consulting-alert"><b>보완 요청</b><p>{caseInfo.supplementReason.message || caseInfo.supplementReason.reasonText || '성적 또는 제출 자료를 다시 확인해주세요.'}</p></div> : null}<fieldset disabled={!canEdit || submitting} className="consulting-survey-form">
    <section className="consulting-survey-section"><h3>1. 지원자 정보</h3><div className="consulting-field-grid"><Field label="졸업 연도"><input type="number" value={survey.identity.graduationYear ?? ''} onChange={(e) => patchSection('identity', { graduationYear: e.target.value })} /></Field><Field label="지원자 구분"><Select value={survey.identity.applicantType} onChange={(e) => patchSection('identity', { applicantType: e.target.value })}><option value="high_school_senior">고3</option><option value="repeat_1">재수</option><option value="repeat_2_plus">N수</option></Select></Field><Field label="학교 유형"><Select value={survey.identity.schoolType} onChange={(e) => patchSection('identity', { schoolType: e.target.value })}><option value="general">일반고</option><option value="autonomous">자사고</option><option value="specialized">특목고</option><option value="vocational">특성화고</option><option value="other">기타</option></Select></Field><Field label="거주 지역"><input value={survey.identity.residenceRegion} onChange={(e) => patchSection('identity', { residenceRegion: e.target.value })} /></Field><Field label="통학 가능 시간(분)"><input type="number" value={survey.identity.commute?.maxMinutes ?? ''} onChange={(e) => patchSection('identity', { commute: { maxMinutes: e.target.value } })} /></Field></div></section>
    <section className="consulting-survey-section"><h3>2. 확정 성적</h3><div className="consulting-field-grid"><Field label="시험 연도"><input type="number" value={survey.scores.examYear ?? ''} onChange={(e) => patchSection('scores', { examYear: e.target.value })} /></Field><Field label="시험 종류"><input value={survey.scores.examType} placeholder="예: 2027학년도 수능" onChange={(e) => patchSection('scores', { examType: e.target.value })} /></Field></div><div className="consulting-score-table">{survey.scores.records.map((row, index) => <div className="consulting-score-row" key={`${row.area}-${index}`}><input aria-label={`${index + 1} 과목`} value={row.subject} onChange={(e) => updateScore(index, 'subject', e.target.value)} /><input aria-label={`${row.subject} 표준점수`} type="number" placeholder="표준" value={row.standardScore ?? ''} onChange={(e) => updateScore(index, 'standardScore', e.target.value)} /><input aria-label={`${row.subject} 백분위`} type="number" placeholder="백분위" value={row.percentile ?? ''} onChange={(e) => updateScore(index, 'percentile', e.target.value)} /><input aria-label={`${row.subject} 등급`} type="number" placeholder="등급" value={row.grade ?? ''} onChange={(e) => updateScore(index, 'grade', e.target.value)} /><label><input type="checkbox" checked={row.confirmed === true} onChange={(e) => updateScore(index, 'confirmed', e.target.checked)} />확정</label></div>)}</div></section>
    <section className="consulting-survey-section"><h3>3. 지원 선호</h3>{survey.preferences.targets.map((target, index) => <div className="consulting-target-row" key={index}><input placeholder="대학" value={target.university} onChange={(e) => updateTarget(index, 'university', e.target.value)} /><input placeholder="학과" value={target.major} onChange={(e) => updateTarget(index, 'major', e.target.value)} /><input placeholder="지역" value={target.region} onChange={(e) => updateTarget(index, 'region', e.target.value)} /></div>)}<button type="button" className="consulting-add-button" disabled={survey.preferences.targets.length >= 5} onClick={() => patchSection('preferences', { targets: [...survey.preferences.targets, { university: '', major: '', region: '' }] })}>희망 지원 추가</button><label className="consulting-check"><input type="checkbox" checked={survey.preferences.similarMajorAllowed === true} onChange={(e) => patchSection('preferences', { similarMajorAllowed: e.target.checked })} />유사 전공도 함께 검토해도 좋아요</label></section>
    <section className="consulting-survey-section"><h3>4. 상담 질문</h3><div className="consulting-field-grid"><Field label="지원 성향"><Select value={survey.qualitative.riskTolerance} onChange={(e) => patchSection('qualitative', { riskTolerance: e.target.value })}><option value="conservative">안정 중심</option><option value="balanced">균형</option><option value="aggressive">도전 중심</option></Select></Field><Field label="재도전 의향"><Select value={survey.qualitative.retryWillingness} onChange={(e) => patchSection('qualitative', { retryWillingness: e.target.value })}><option value="yes">있음</option><option value="no">없음</option><option value="undecided">미정</option></Select></Field><Field label="합격 시 등록 의사"><Select value={survey.qualitative.enrollmentIntent} onChange={(e) => patchSection('qualitative', { enrollmentIntent: e.target.value })}><option value="yes">있음</option><option value="no">없음</option><option value="undecided">미정</option></Select></Field></div><Field label="보호자와 의견 차이"><textarea value={survey.qualitative.guardianDifference} onChange={(e) => patchSection('qualitative', { guardianDifference: e.target.value })} /></Field><Field label="상담에서 꼭 묻고 싶은 내용"><textarea value={survey.qualitative.consultationQuestions[0] || ''} onChange={(e) => patchSection('qualitative', { consultationQuestions: [e.target.value] })} /></Field></section>
    <section className="consulting-survey-section"><h3>성적표 첨부</h3><p>PDF·JPG·PNG, 파일당 10MB 이하로 최대 3개까지 올릴 수 있습니다.</p><label className="consulting-upload-button">{uploading ? '업로드 중...' : '성적표 파일 선택'}<input type="file" accept="application/pdf,image/jpeg,image/png" disabled={uploading || files.length >= 3} onChange={uploadFile} /></label><div className="consulting-file-list">{files.map((file) => <div className="consulting-file-row" key={file.fileId}><div><b>{file.displayName}</b><span>{file.status === 'ready' ? '검사 완료' : file.status === 'quarantined' ? '안전 검사 중' : file.status === 'rejected' ? '사용 불가' : file.status}</span></div>{['upload_pending', 'quarantined', 'ready', 'rejected'].includes(file.status) ? <button type="button" onClick={() => removeFile(file.fileId)}>삭제</button> : null}</div>)}</div></section>
  </fieldset><div className="consulting-submit-bar"><span>{saving ? '자동 저장 중...' : `저장본 ${draftRevision}`}</span><button type="button" className="btn btn-secondary" disabled={saving || submitting} onClick={() => save()}>저장</button><button type="button" className="btn btn-primary" disabled={!canEdit || saving || submitting} onClick={submit}>{submitting ? '제출 중...' : '검수 요청하기'}</button></div>{message ? <p className="consulting-message" role="status">{message}</p> : null}</div></SecondaryScreenShell>;
}

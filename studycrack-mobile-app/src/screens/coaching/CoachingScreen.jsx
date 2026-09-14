import { buildCoachingPresentation, COACHING_PROCESS_STEPS } from './presentation.js';
import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { PrimaryScreenHeader } from '../../components/PrimaryScreenHeader.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';

const STEP_COPY = {
  5: ['학습 계획 점검', '현재 계획에서 확신이 없거나 수정이 필요한 부분을 적어주세요.', 'step5', '예: 하루 계획이 자꾸 밀립니다. 현실적인 수정이 필요합니다.'],
  6: ['학습 방향성 설정', '현재 공부 방향과 입시 전략에 대한 고민을 적어주세요.', 'step6', '예: 내신 기간의 수능 공부 균형을 어떻게 잡아야 할까요?'],
  7: ['튜터에게 묻고 싶은 질문', '이번 주 피드백에서 꼭 답변받고 싶은 질문을 적어주세요.', 'step7', '예: 수학은 기출 반복과 N제 중 무엇을 우선할까요?'],
  8: ['멘탈 및 기타 고민', '슬럼프나 불안감 등 학습 외 고민도 자유롭게 남겨주세요.', 'step8', '자유롭게 작성해주세요.']
};

export function CoachingMark() {
  return <span className="coaching-mark" aria-hidden="true"><i /><i /><i /></span>;
}

function CoachingHero({ statusSummary, submitted = false }) {
  const summary = statusSummary || {};
  return (
    <section className="coaching-hero">
      <div className="coaching-hero-copy"><span>SKY 선배 1:1 멘토링</span><h3>{summary.title || '이번 주 공부, 혼자 고민하지 마세요'}</h3><p>{summary.description || '학습 기록과 고민을 보내면 다음 주 방향을 구체적인 피드백으로 정리해 드려요.'}</p></div>
      <div className="coaching-week-status" data-status={summary.tone || 'empty'}><small>{summary.eyebrow || '이번 주 코칭'}</small><CoachingMark /></div>
      <button type="button" data-action="openCoachingSheet">{submitted ? '이번 주 점검 수정하기' : '이번 주 코칭 신청하기'}<b aria-hidden="true">›</b></button>
    </section>
  );
}

export function CoachingProcess() {
  return (
    <section className="coaching-process">
      <div className="coaching-process-head"><span>3단계 합격 설계</span><h3>분석부터 실행까지 한 흐름으로 이어가요</h3></div>
      <div className="coaching-process-list">
        {COACHING_PROCESS_STEPS.map((step) => <div className="coaching-process-step" key={step.number}><strong>{step.number}</strong><span><b>{step.title}</b><small>{step.description}</small></span></div>)}
      </div>
    </section>
  );
}

function CoachingSegment({ active = 'sessions' }) {
  return (
    <div className="coaching-segment" aria-label="코칭 내역 보기">
      <button type="button" className={active === 'sessions' ? 'active' : ''} data-action="setCoachingView" data-coaching-view="sessions">이번 주 점검</button>
      <button type="button" className={active === 'feedback' ? 'active' : ''} data-action="setCoachingView" data-coaching-view="feedback">받은 피드백</button>
    </div>
  );
}

function CoachingEmpty({ view = 'sessions', loading = false }) {
  const copy = loading
    ? ['코칭 내역을 불러오고 있어요', '잠시만 기다려 주세요.']
    : view === 'feedback'
      ? ['아직 도착한 피드백이 없어요', '튜터 검토가 끝나면 이곳에서 바로 확인할 수 있어요.']
      : ['아직 제출한 학습 점검이 없어요', '이번 주 기록과 질문을 남기고 첫 코칭을 시작해 보세요.'];
  return <EmptyState className="coaching-empty" loading={loading} title={copy[0]} description={copy[1]} />;
}

function SessionRow({ item }) {
  return (
    <button type="button" className="coaching-history-row coaching-session-row" data-action="goto" data-target="weekly">
      <span className={`coaching-session-status ${item.feedbackReady ? 'ready' : ''}`} aria-hidden="true"><i /></span>
      <span className="coaching-session-copy"><small>{item.dateLabel} · {item.tutorName}</small><b>{item.weekLabel}</b><em>{item.statusLabel}</em></span>
      <strong aria-hidden="true">›</strong>
    </button>
  );
}

function FeedbackRow({ item }) {
  return (
    <button type="button" className="coaching-history-row coaching-feedback-row" data-action="goto" data-target="weekly">
      <span className="coaching-feedback-avatar" aria-hidden="true">SKY</span>
      <span><small>{item.tutorName} · {item.dateLabel}</small><b>{item.title}</b><p>{item.summary}</p></span>
      <strong aria-hidden="true">›</strong>
    </button>
  );
}

function SubjectStep({ rows = [] }) {
  return (
    <div className="coach-step-body"><div className="coach-step-copy"><span>필수</span><h4>과목별 학습 달성률</h4><p>과목별 세부 내용과 계획·실제 학습 시간을 입력하세요.</p></div>
      <div className="coach-subject-list">
        {rows.map((row) => {
          const planned = Number(row.planned) || 0;
          const actual = Number(row.actual) || 0;
          const rate = planned > 0 ? Math.min(999, Math.round((actual / planned) * 100)) : 0;
          return (
            <section className="coach-subject-card" key={row.id}>
              <div className="coach-subject-head"><b>{row.subject || '기타'}</b>{row.removable ? <button type="button" className="coach-delete-btn" data-action="removeCoachingSubject" data-coach-row={row.id}>삭제</button> : null}</div>
              <input className="planner-input" data-coach-detail={row.id} defaultValue={row.detail || ''} placeholder={row.placeholder || '세부과목 입력'} />
              <div className="coach-hours-row"><label><span>계획</span><input className="planner-input" data-coach-plan={row.id} defaultValue={row.planned || ''} inputMode="decimal" type="number" placeholder="시간" /></label><label><span>실제</span><input className="planner-input" data-coach-actual={row.id} defaultValue={row.actual || ''} inputMode="decimal" type="number" placeholder="시간" /></label><div className="coach-rate-box" data-coach-rate={row.id}>{rate}%</div></div>
            </section>
          );
        })}
      </div>
      <button type="button" className="coach-add-subject" data-action="addCoachingSubject">+ 과목 추가</button>
    </div>
  );
}

function UploadList({ files = [], removeAction = '' }) {
  return files.length ? <div className="coach-thumb-list">{files.map((file, index) => <div className="coach-thumb" key={`${file.name || 'file'}-${index}`}><span>{file.name || `사진 ${index + 1}`}</span>{removeAction === 'removePlannerPhoto' ? <button type="button" data-action="removePlannerPhoto" data-photo-index={index}>삭제</button> : <button type="button" data-action="removeExamPhoto" data-photo-index={index}>삭제</button>}</div>)}</div> : <p className="coach-upload-empty">선택된 사진이 없습니다.</p>;
}

function PlannerProofStep({ files = [] }) {
  return <div className="coach-step-body"><div className="coach-step-copy"><span>선택</span><h4>플래너 인증</h4><p>이번 주 플래너 사진을 첨부하면 점검 자료와 함께 저장됩니다.</p></div><div className="coach-upload-box"><input type="file" className="coach-hidden-file" data-field="coachPlannerFiles" accept="image/*" multiple /><span aria-hidden="true">＋</span><b>플래너 사진 첨부</b><p>최대 5장까지 추가할 수 있어요.</p><button type="button" className="coach-upload-action" data-action="openPlannerFilePicker">사진 선택</button></div><UploadList files={files} removeAction="removePlannerPhoto" /></div>;
}

function ExamStep({ examType = '', files = [], scores = {} }) {
  const examTypes = ['미응시', '교내', '평가원/교육청', '사설'];
  const scoreFields = [['국어', 'koreanRaw', '원점수'], ['수학', 'mathRaw', '원점수'], ['영어', 'englishGrade', '등급'], ['탐구 1', 'inq1Raw', '원점수'], ['탐구 2', 'inq2Raw', '원점수']];
  return <div className="coach-step-body"><div className="coach-step-copy"><span>필수</span><h4>모의고사 응시 여부</h4><p>이번 주에 응시한 시험과 성적을 알려주세요.</p></div><div className="coach-choice-row">{examTypes.map((type) => <button type="button" className={examType === type ? 'active' : ''} data-action="setCoachingExamType" data-coach-exam={type} key={type}>{type}</button>)}</div>{examType && examType !== '미응시' ? <div className="coach-exam-form"><input type="file" className="coach-hidden-file" data-field="coachExamFiles" accept="image/*" multiple /><button type="button" className="coach-upload-action" data-action="openExamFilePicker">성적 인증 사진 첨부</button><UploadList files={files} removeAction="removeExamPhoto" /><div className="coach-exam-subject-list">{scoreFields.map(([label, key, placeholder]) => <label key={key}><span>{label}</span><input className="planner-input" data-coach-field={key} defaultValue={scores[key] || ''} inputMode="numeric" placeholder={placeholder} /></label>)}</div></div> : null}</div>;
}

function TrendStep({ answers = {}, reasons = [], trend = '' }) {
  const reasonOptions = ['계획 과다', '실전 감각 저하', '컨디션/건강', '기타'];
  return <div className="coach-step-body"><div className="coach-step-copy"><span>필수</span><h4>최근 2주 학업 추이</h4><p>최근 학습 흐름이 어떻게 변했는지 선택하세요.</p></div><div className="coach-choice-row">{['상승', '유지', '하락'].map((value) => <button type="button" className={trend === value ? 'active' : ''} data-action="setCoachingTrend" data-coach-trend={value} key={value}>{value}</button>)}</div>{trend === '하락' ? <div className="coach-drop-box"><b>하락 원인</b><div className="coach-choice-row">{reasonOptions.map((reason) => <button type="button" className={reasons.includes(reason) ? 'active' : ''} data-action="toggleDropReason" data-drop-reason={reason} key={reason}>{reason}</button>)}</div><textarea className="planner-input coach-textarea" data-coach-answer="step4Reason" maxLength="200" defaultValue={answers.step4Reason || ''} placeholder="구체적인 이유를 간단히 적어주세요." /><p className="coach-count" data-coach-count="step4Reason">{(answers.step4Reason || '').length}/200</p></div> : null}</div>;
}

function TextStep({ answers = {}, step = 5 }) {
  const [title, description, key, placeholder] = STEP_COPY[step] || STEP_COPY[8];
  const value = answers[key] || '';
  return <div className="coach-step-body"><div className="coach-step-copy"><span>선택</span><h4>{title}</h4><p>{description}</p></div><textarea className="planner-input coach-textarea" data-coach-answer={key} maxLength="200" defaultValue={value} placeholder={placeholder} /><p className="coach-count" data-coach-count={key}>{value.length}/200</p></div>;
}

function CoachingStepBody(ctx) {
  const { coachingAnswers = {}, coachingDropReasons = [], coachingExamFiles = [], coachingExamScores = {}, coachingExamType = '', coachingPlannerFiles = [], coachingStep = 1, coachingSubjectRows = [], coachingTrend = '' } = ctx;
  if (coachingStep === 1) return <SubjectStep rows={coachingSubjectRows} />;
  if (coachingStep === 2) return <PlannerProofStep files={coachingPlannerFiles} />;
  if (coachingStep === 3) return <ExamStep examType={coachingExamType} files={coachingExamFiles} scores={coachingExamScores} />;
  if (coachingStep === 4) return <TrendStep answers={coachingAnswers} reasons={coachingDropReasons} trend={coachingTrend} />;
  return <TextStep answers={coachingAnswers} step={coachingStep} />;
}

function CoachingSheet(ctx) {
  const { coachingSheetOpen = false, coachingStep = 1, coachingSubmitting = false } = ctx;
  if (!coachingSheetOpen) return null;
  return <div className="sc-overlay sc-overlay--sheet sc-sheet-overlay coach-sheet-overlay" data-action="closeCoachingSheet"><section className="sc-sheet coach-sheet" data-action="noopModal" role="dialog" aria-modal="true"><div className="sc-sheet-handle" aria-hidden="true" /><header className="sc-sheet-head coach-sheet-head"><div><span>주간 학습 점검</span><h3>튜터에게 보낼 이번 주 기록</h3></div><button type="button" className="sc-overlay-close coach-close" data-action="closeCoachingSheet" aria-label="닫기">×</button></header><div className="coach-step-progress"><i style={{ width: `${(coachingStep / 8) * 100}%` }} /><span>{coachingStep} / 8</span></div><div className="sc-sheet-body coach-sheet-body"><CoachingStepBody {...ctx} /></div><footer className="sc-sheet-footer coach-sheet-footer"><button type="button" className="btn btn-secondary" data-action="coachingPrev" disabled={coachingStep === 1 || coachingSubmitting}>이전</button><button type="button" className="btn btn-primary" data-action="coachingNext" disabled={coachingSubmitting}>{coachingStep === 8 ? (coachingSubmitting ? '제출 중' : '작성 완료 및 제출') : '다음 단계'}</button></footer></section></div>;
}

export function CoachingScreen(ctx) {
  const { coachingSheetOpen = false, coachingView = 'sessions', dimmed = false, tab = 'strategy', weeklyReports = [], weeklyReportsStatus = 'idle' } = ctx;
  const presentation = buildCoachingPresentation(weeklyReports, weeklyReportsStatus);
  const activeView = coachingView === 'feedback' ? 'feedback' : 'sessions';
  const rows = activeView === 'feedback' ? presentation.feedback : presentation.sessions;
  return <AppScreenShell screen="strategy" tab={tab} dimmed={dimmed} overlays={coachingSheetOpen ? <CoachingSheet {...ctx} /> : null}><main className="coach-page coaching-screen"><PrimaryScreenHeader className="coaching-context" eyebrow="SKY 선배 직접 코칭" title="학습 코칭" /><CoachingHero statusSummary={presentation.statusSummary} submitted={presentation.submitted} /><CoachingProcess /><section className="coaching-history"><div className="coaching-history-head"><div><span>코칭 내역</span><h3>{activeView === 'feedback' ? '받은 피드백' : '이번 주 점검'}</h3></div>{presentation.feedbackReady ? <em>새 피드백</em> : null}</div><CoachingSegment active={activeView} /><div className="coaching-history-list">{rows.length ? rows.map((item) => activeView === 'feedback' ? <FeedbackRow item={item} key={item.weekId} /> : <SessionRow item={item} key={item.weekId} />) : <CoachingEmpty view={activeView} loading={presentation.isLoading} />}</div>{activeView === 'sessions' && !presentation.isLoading ? <button type="button" className="coaching-new-request" data-action="openCoachingSheet"><span>+</span><b>새 학습 점검 작성</b><small>이번 주 기록과 질문 남기기</small></button> : null}</section></main></AppScreenShell>;
}

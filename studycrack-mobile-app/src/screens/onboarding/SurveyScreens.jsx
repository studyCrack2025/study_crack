import { CRACKY_SRC } from '../../constants/assets.js';
import { EXAM_OPTIONS, GRADE_STATUS_OPTIONS } from '../../constants/options.js';
import { OnboardingScreenShell } from './OnboardingShell.jsx';

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const TRACKS = ['예체능', '인문', '자연'];
const SOCIAL_INQUIRY_SUBJECTS = ['생활과 윤리', '윤리와 사상', '한국지리', '세계지리', '동아시아사', '세계사', '경제', '정치와 법', '사회·문화'];
const SCIENCE_INQUIRY_SUBJECTS = ['물리학Ⅰ', '화학Ⅰ', '생명과학Ⅰ', '지구과학Ⅰ', '물리학Ⅱ', '화학Ⅱ', '생명과학Ⅱ', '지구과학Ⅱ'];

function Required() {
  return <span className="ob-required">*</span>;
}

function GradeSelect({ field, value = '' }) {
  return <select className="ob1-score-select" data-field={field} defaultValue={value}><option value="">등급 선택</option>{GRADES.map((grade) => <option value={grade} key={grade}>{grade}등급</option>)}</select>;
}

function InquirySelect({ field, value = '' }) {
  return <select className="ob1-score-select" data-field={field} defaultValue={value}><option value="">과목 선택</option><optgroup label="사회탐구">{SOCIAL_INQUIRY_SUBJECTS.map((subject) => <option value={subject} key={subject}>{subject}</option>)}</optgroup><optgroup label="과학탐구">{SCIENCE_INQUIRY_SUBJECTS.map((subject) => <option value={subject} key={subject}>{subject}</option>)}</optgroup></select>;
}

export function Ob1Screen(ctx) {
  const { crackySrc = CRACKY_SRC, obGradeStatus = '', obGoalText = '', obQuestionText = '', obSchoolName = '', obTrack = '예체능' } = ctx;
  return <OnboardingScreenShell screen="ob1" step={1} title="학습성향 진단 1-1" crackySrc={crackySrc} subcopy={<>지금 성적과 공부 습관을 바탕으로<br />나에게 맞는 합격 전략을 찾아볼게요.</>} bubble="성적만 보는 게 아니라, 공부 방식까지 같이 봐야 정확해요!" cta={<button type="button" className="cta-button" data-action="saveQualInfo">저장하고 성적 입력으로</button>}>
    <div className="ob1-survey-card"><h3>정성조사서</h3><p className="ob1-subtitle">학습 상황과 고민을 알려주시면 더 정확한 전략을 만들 수 있어요.</p><p className="ob1-subtitle ob-required-copy">* 표시는 필수 입력 항목입니다.</p><div className="ob1-field-stack">
      <div className="ob1-field"><label>현재 학년 <Required /></label><div className="ob1-pill-row">{GRADE_STATUS_OPTIONS.map((grade) => <button type="button" className={`ob1-pill ${obGradeStatus === grade ? 'active' : ''}`} data-action="setObGradeStatus" data-ob-grade={grade} key={grade}>{grade}</button>)}</div></div>
      <div className="ob1-field"><label>출신 학교 <Required /></label><input className="ob1-input sc-input" data-field="obSchoolName" defaultValue={obSchoolName} placeholder="출신 학교 입력" /></div>
      <div className="ob1-field"><label>희망 계열 <Required /></label><select className="ob1-select sc-select" data-field="obTrack" defaultValue={obTrack}>{TRACKS.map((track) => <option value={track} key={track}>{track}</option>)}</select></div>
      <div className="ob1-field"><label>스터디크랙을 통해 얻고 싶은 점 <Required /></label><textarea className="ob1-textarea sc-textarea" data-field="obGoalText" defaultValue={obGoalText} placeholder="자유롭게 입력" /></div>
      <div className="ob1-field"><label>입시 고민 및 질문</label><textarea className="ob1-textarea" data-field="obQuestionText" defaultValue={obQuestionText} placeholder="자유롭게 입력" /></div>
    </div></div>
  </OnboardingScreenShell>;
}

export function Ob2Screen(ctx) {
  const { crackySrc = CRACKY_SRC, scoreEditState = {}, scoreExamType = EXAM_OPTIONS[0], scoreSubjectSaving = false } = ctx;
  return <OnboardingScreenShell screen="ob2" step={2} title="학습성향 진단 1-2" crackySrc={crackySrc} subcopy={<>과목별 성적을 입력하면 현재 위치를<br />더 정확하게 계산할 수 있어요.</>} bubble="입력한 성적은 서버에서 환산한 뒤 내 성적 정보에 안전하게 저장돼요." cta={<><button type="button" className="cta-button" data-action="saveScoreEdit" disabled={scoreSubjectSaving}>{scoreSubjectSaving ? '저장 중...' : '저장하고 학습 MBTI로'}</button><button type="button" className="auth-link-btn" data-action="skipOb2WithoutScore" disabled={scoreSubjectSaving}>시험 성적이 없어요</button></>}>
    <div className="ob1-score-wrap"><h3>성적 입력 <Required /></h3><p className="score-subtitle">모든 과목을 입력하면 선택한 시험 기준으로 환산해 저장합니다.</p><div className="ob1-score-exam"><label>시험 선택</label><select className="ob1-score-select" data-field="scoreExamType" defaultValue={scoreExamType}>{EXAM_OPTIONS.map((label) => <option value={label} key={label}>{label}</option>)}</select></div><div className="ob1-score-grid">
      <div className="ob1-subject-card"><h4>국어</h4><select className="ob1-score-select" data-field="v2e-korean-type" defaultValue={scoreEditState.korean?.type || ''}><option value="">선택</option><option value="화법과작문">화법과작문</option><option value="언어와매체">언어와매체</option></select><div className="ob1-score-two-col"><input className="ob1-score-input score-direct-input" data-field="v2e-korean-common" data-score-max="76" defaultValue={scoreEditState.korean?.common || ''} placeholder="공통 원점수" type="number" /><input className="ob1-score-input score-direct-input" data-field="v2e-korean-elective" data-score-max="24" defaultValue={scoreEditState.korean?.elective || ''} placeholder="선택 원점수" type="number" /></div></div>
      <div className="ob1-subject-card"><h4>수학</h4><select className="ob1-score-select" data-field="v2e-math-type" defaultValue={scoreEditState.math?.type || ''}><option value="">선택</option><option value="확률과통계">확률과통계</option><option value="미적분">미적분</option><option value="기하">기하</option></select><div className="ob1-score-two-col"><input className="ob1-score-input score-direct-input" data-field="v2e-math-common" data-score-max="74" defaultValue={scoreEditState.math?.common || ''} placeholder="공통 원점수" type="number" /><input className="ob1-score-input score-direct-input" data-field="v2e-math-elective" data-score-max="26" defaultValue={scoreEditState.math?.elective || ''} placeholder="선택 원점수" type="number" /></div></div>
      <div className="ob1-subject-card"><h4>영어</h4><GradeSelect field="v2e-english" value={scoreEditState.english || ''} /></div>
      <div className="ob1-subject-card"><h4>한국사</h4><GradeSelect field="v2e-history" value={scoreEditState.history || ''} /></div>
      <div className="ob1-subject-card"><h4>탐구1</h4><InquirySelect field="v2e-inq1-subject" value={scoreEditState.inquiry1?.subject || ''} /><input className="ob1-score-input score-direct-input" data-field="v2e-inq1-score" data-score-max="50" defaultValue={scoreEditState.inquiry1?.score || ''} placeholder="원점수" type="number" /></div>
      <div className="ob1-subject-card"><h4>탐구2</h4><InquirySelect field="v2e-inq2-subject" value={scoreEditState.inquiry2?.subject || ''} /><input className="ob1-score-input score-direct-input" data-field="v2e-inq2-score" data-score-max="50" defaultValue={scoreEditState.inquiry2?.score || ''} placeholder="원점수" type="number" /></div>
    </div></div>
  </OnboardingScreenShell>;
}

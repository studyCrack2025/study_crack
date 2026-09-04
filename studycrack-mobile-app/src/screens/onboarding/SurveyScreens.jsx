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

function GradeSelect({ field, scoreKey }) {
  return <select className="ob1-score-select" {...(field ? { 'data-field': field } : { 'data-score-key': scoreKey })} defaultValue=""><option value="">등급 선택</option>{GRADES.map((grade) => <option value={grade} key={grade}>{grade}등급</option>)}</select>;
}

function InquirySelect({ field }) {
  return <select className="ob1-score-select" data-field={field} defaultValue=""><option value="">과목 선택</option><optgroup label="사회탐구">{SOCIAL_INQUIRY_SUBJECTS.map((subject) => <option value={subject} key={subject}>{subject}</option>)}</optgroup><optgroup label="과학탐구">{SCIENCE_INQUIRY_SUBJECTS.map((subject) => <option value={subject} key={subject}>{subject}</option>)}</optgroup></select>;
}

export function Ob1Screen(ctx) {
  const { crackySrc = CRACKY_SRC, obGradeStatus = '', obGoalText = '', obQuestionText = '', obSchoolName = '', obTrack = '예체능' } = ctx;
  return <OnboardingScreenShell screen="ob1" step={1} title="학습성향 진단 1-1" crackySrc={crackySrc} subcopy={<>지금 성적과 공부 습관을 바탕으로<br />나에게 맞는 합격 전략을 찾아볼게요.</>} bubble="성적만 보는 게 아니라, 공부 방식까지 같이 봐야 정확해요!" cta={<button type="button" className="cta-button" data-action="goto" data-target="ob2">1-2 성적 입력으로</button>}>
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
  const { crackySrc = CRACKY_SRC, obExamType = EXAM_OPTIONS[0] } = ctx;
  return <OnboardingScreenShell screen="ob2" step={2} title="학습성향 진단 1-2" crackySrc={crackySrc} subcopy={<>과목별 성적을 입력하면 현재 위치를<br />더 정확하게 계산할 수 있어요.</>} bubble="점수는 세밀할수록 좋아요! 입력한 정보로 맞춤 분석을 진행할게요." cta={<><button type="button" className="cta-button" data-action="goto" data-target="ob3">1-3 학습 MBTI로</button><button type="button" className="auth-link-btn" data-action="skipOb2WithoutScore">시험 성적이 없어요</button></>}>
    <div className="ob1-score-wrap"><h3>성적 입력 <Required /></h3><p className="score-subtitle">과목별 입력을 완료하면 현재 위치를 더 정확하게 계산해요.</p><div className="ob1-score-exam"><label>시험 선택</label><select className="ob1-score-select" data-field="obExamType" defaultValue={obExamType}>{EXAM_OPTIONS.map((label) => <option value={label} key={label}>{label}</option>)}</select></div><div className="ob1-score-grid">
      <div className="ob1-subject-card"><h4>국어</h4><select className="ob1-score-select" data-field="obKoreanType" defaultValue=""><option value="">선택</option><option value="화법과작문">화법과작문</option><option value="언어와매체">언어와매체</option></select><div className="ob1-score-two-col"><input className="ob1-score-input" data-score-key="korean_common" placeholder="공통 원점수" type="number" /><input className="ob1-score-input" data-score-key="korean_elective" placeholder="선택 원점수" type="number" /></div></div>
      <div className="ob1-subject-card"><h4>수학</h4><select className="ob1-score-select" data-field="obMathType" defaultValue=""><option value="">선택</option><option value="확률과통계">확률과통계</option><option value="미적분">미적분</option><option value="기하">기하</option></select><div className="ob1-score-two-col"><input className="ob1-score-input" data-score-key="math_common" placeholder="공통 원점수" type="number" /><input className="ob1-score-input" data-score-key="math_elective" placeholder="선택 원점수" type="number" /></div></div>
      <div className="ob1-subject-card"><h4>영어</h4><GradeSelect scoreKey="english_grade" /></div>
      <div className="ob1-subject-card"><h4>한국사</h4><GradeSelect field="obHistoryType" /></div>
      <div className="ob1-subject-card"><h4>탐구1</h4><InquirySelect field="obInquiry1Subject" /><input className="ob1-score-input" data-score-key="inquiry1_raw" placeholder="원점수" type="number" /></div>
      <div className="ob1-subject-card"><h4>탐구2</h4><InquirySelect field="obInquiry2Subject" /><input className="ob1-score-input" data-score-key="inquiry2_raw" placeholder="원점수" type="number" /></div>
    </div></div>
  </OnboardingScreenShell>;
}

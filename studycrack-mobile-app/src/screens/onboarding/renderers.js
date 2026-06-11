import { EXAM_OPTIONS } from '../../constants/options.js';
import { CRACKY_SRC } from '../../constants/assets.js';

const GRADE_STATUS_OPTIONS = ['고1/2 재학', '고3 재학', 'N수생', '검정고시', '기타'];
const ENGLISH_HISTORY_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SOCIAL_INQUIRY_SUBJECTS = ['생활과 윤리', '윤리와 사상', '한국지리', '세계지리', '동아시아사', '세계사', '경제', '정치와 법', '사회·문화'];
const SCIENCE_INQUIRY_SUBJECTS = ['물리학Ⅰ', '화학Ⅰ', '생명과학Ⅰ', '지구과학Ⅰ', '물리학Ⅱ', '화학Ⅱ', '생명과학Ⅱ', '지구과학Ⅱ'];

export function renderOnboardingProgress(step) {
  return `<div class="ob-progress"><span>${step}/3</span><div class="ob-dots"><i class="${step >= 1 ? 'active' : ''}"></i><i class="${step >= 2 ? 'active' : ''}"></i><i class="${step >= 3 ? 'active' : ''}"></i></div></div>`;
}

function selected(value, candidate) {
  return value === candidate ? 'selected' : '';
}

function active(value, candidate) {
  return value === candidate ? 'active' : '';
}

function renderGradeButtons(current) {
  return GRADE_STATUS_OPTIONS.map((grade) => `<button class="ob1-pill ${active(current, grade)}" data-action="setObGradeStatus" data-ob-grade="${grade}">${grade}</button>`).join('');
}

function renderGradeOptions() {
  return ENGLISH_HISTORY_GRADES.map((grade) => `<option value="${grade}">${grade}등급</option>`).join('');
}

function renderInquirySubjectOptions() {
  const social = SOCIAL_INQUIRY_SUBJECTS.map((subject) => `<option value="${subject}">${subject}</option>`).join('');
  const science = SCIENCE_INQUIRY_SUBJECTS.map((subject) => `<option value="${subject}">${subject}</option>`).join('');
  return `<option value="">과목 선택</option><optgroup label="사회탐구">${social}</optgroup><optgroup label="과학탐구">${science}</optgroup>`;
}

function renderBubble(text, crackySrc = CRACKY_SRC) {
  return `<div class="card ob-bubble-card"><img loading="lazy" decoding="async" src="${crackySrc}" class="ob-cracky" alt="크랙이"/><p>${text}</p></div>`;
}

export function renderOb1Screen(ctx) {
  const {
    appbar,
    layout,
    obGradeStatus,
    obGoalText,
    obQuestionText,
    obSchoolName,
    obTrack,
    crackySrc = CRACKY_SRC
  } = ctx;

  return layout(
    `<div class="onboarding-container"><div class="content">
       ${renderOnboardingProgress(1)}
       ${appbar('학습성향 진단 1-1', true)}
       <p class="sub ob-subcopy">지금 성적과 공부 습관을 바탕으로<br/>나에게 맞는 합격 전략을 찾아볼게요.</p>
       ${renderBubble('성적만 보는 게 아니라, 공부 방식까지 같이 봐야 정확해요!', crackySrc)}
       <div class="ob1-survey-card">
         <h3>정성조사서</h3>
         <p class="ob1-subtitle">학습 상황과 고민을 알려주시면 더 정확한 전략을 만들 수 있어요.</p><p class="ob1-subtitle" style="color:#ef4444;font-weight:700;">* 표시는 필수 입력 항목입니다.</p>
         <div class="ob1-field-stack">
           <div class="ob1-field">
            <label>현재 학년 <span style="color:#ef4444">*</span></label>
             <div class="ob1-pill-row">${renderGradeButtons(obGradeStatus)}</div>
           </div>
           <div class="ob1-field">
            <label>출신 학교 <span style="color:#ef4444">*</span></label>
             <input class="ob1-input" data-field="obSchoolName" value="${obSchoolName}" placeholder="출신 학교 입력" />
           </div>
           <div class="ob1-field">
            <label>희망 계열 <span style="color:#ef4444">*</span></label>
             <select class="ob1-select" data-field="obTrack">
               <option ${selected(obTrack, '예체능')}>예체능</option>
               <option ${selected(obTrack, '인문')}>인문</option>
               <option ${selected(obTrack, '자연')}>자연</option>
             </select>
           </div>
           <div class="ob1-field">
             <label>스터디크랙을 통해 얻고 싶은 점 <span style="color:#ef4444">*</span></label>
             <textarea class="ob1-textarea" data-field="obGoalText" placeholder="자유롭게 입력">${obGoalText}</textarea>
           </div>
           <div class="ob1-field">
             <label>입시 고민 및 질문</label>
             <textarea class="ob1-textarea" data-field="obQuestionText" placeholder="자유롭게 입력">${obQuestionText}</textarea>
           </div>
         </div>
       </div>
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta"><button class="cta-button" data-action="goto" data-target="ob2">1-2 성적 입력으로</button></div></div>`,
    false
  );
}

export function renderOb2Screen(ctx) {
  const { appbar, layout, obExamType, crackySrc = CRACKY_SRC } = ctx;

  return layout(
    `<div class="onboarding-container"><div class="content">
       ${renderOnboardingProgress(2)}
       ${appbar('학습성향 진단 1-2', true)}
       <p class="sub ob-subcopy">과목별 성적을 입력하면 현재 위치를<br/>더 정확하게 계산할 수 있어요.</p>
       ${renderBubble('점수는 세밀할수록 좋아요! 입력한 정보로 맞춤 분석을 진행할게요.', crackySrc)}
       <div class="ob1-score-wrap">
         <h3>성적 입력 <span style="color:#ef4444">*</span></h3>
         <p class="score-subtitle">과목별 입력을 완료하면 현재 위치를 더 정확하게 계산해요.</p>
         <div class="ob1-score-exam">
           <label>시험 선택</label>
           <select class="ob1-score-select" data-field="obExamType">
             ${EXAM_OPTIONS.map((label) => `<option value="${label}" ${selected(obExamType, label)}>${label}</option>`).join('')}
           </select>
         </div>
         <div class="ob1-score-grid">
           <div class="ob1-subject-card">
             <h4>국어</h4>
             <select class="ob1-score-select" data-field="obKoreanType"><option value="">선택</option><option value="화법과작문">화법과작문</option><option value="언어와매체">언어와매체</option></select>
             <div class="ob1-score-two-col"><input class="ob1-score-input" data-score-key="korean_common" placeholder="공통 원점수" type="number"/><input class="ob1-score-input" data-score-key="korean_elective" placeholder="선택 원점수" type="number"/></div>
           </div>
           <div class="ob1-subject-card">
             <h4>수학</h4>
             <select class="ob1-score-select" data-field="obMathType"><option value="">선택</option><option value="확률과통계">확률과통계</option><option value="미적분">미적분</option><option value="기하">기하</option></select>
             <div class="ob1-score-two-col"><input class="ob1-score-input" data-score-key="math_common" placeholder="공통 원점수" type="number"/><input class="ob1-score-input" data-score-key="math_elective" placeholder="선택 원점수" type="number"/></div>
           </div>
          <div class="ob1-subject-card"><h4>영어</h4><select class="ob1-score-select" data-score-key="english_grade"><option value="">등급 선택</option>${renderGradeOptions()}</select></div>
           <div class="ob1-subject-card"><h4>한국사</h4><select class="ob1-score-select" data-field="obHistoryType"><option value="">등급 선택</option>${renderGradeOptions()}</select></div>
           <div class="ob1-subject-card"><h4>탐구1</h4><select class="ob1-score-select" data-field="obInquiry1Subject">${renderInquirySubjectOptions()}</select><input class="ob1-score-input" data-score-key="inquiry1_raw" placeholder="원점수" type="number"/></div>
           <div class="ob1-subject-card"><h4>탐구2</h4><select class="ob1-score-select" data-field="obInquiry2Subject">${renderInquirySubjectOptions()}</select><input class="ob1-score-input" data-score-key="inquiry2_raw" placeholder="원점수" type="number"/></div>
         </div>
       </div>
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta"><button class="cta-button" data-action="goto" data-target="ob3">1-3 학습 MBTI로</button><button type="button" class="auth-link-btn" data-action="skipOb2WithoutScore">시험 성적이 없어요</button></div></div>`,
    false
  );
}

export function renderOb3Screen(ctx) {
  const {
    appbar,
    layout,
    mbtiAnswers,
    mbtiDone,
    mbtiModalOpen,
    mbtiResult,
    crackySrc = CRACKY_SRC
  } = ctx;

  return layout(
    `<div class="onboarding-container"><div class="content">
       ${renderOnboardingProgress(3)}
       ${appbar('학습성향 진단 1-3', true)}
       <p class="sub ob-subcopy">마지막 단계예요.<br/>학습 MBTI로 내 공부 성향을 진단해보세요.</p>
       ${renderBubble('짧은 질문 4개로 학습 성향을 빠르게 확인할 수 있어요!', crackySrc)}
       <div class="card ob-card">
         <p class="analysis-title">학습 MBTI 검사</p>
         <p class="sub">4문항으로 빠르게 진단해요.</p>
         <button class="btn btn-secondary" data-action="openMbtiModal">MBTI 시작하기</button>
         ${mbtiResult ? `<div class="card" style="margin-top:12px;border:2px solid #2563EB;background:#EFF6FF;"><p class="analysis-title">진단 결과</p><p style="margin:6px 0 2px;font-size:30px;font-weight:900;letter-spacing:.08em;color:#1D4ED8;text-shadow:0 6px 18px rgba(37,99,235,.18);">CSDR</p><p class="sub" style="margin:0 0 12px;font-size:12px;color:#1E40AF;">(컨셉형, 직관령, 분석형, 루틴)</p><button class="btn btn-secondary" disabled>맞춤 공부법 PDF 준비 중</button></div>` : ''}
       </div>
       ${mbtiModalOpen ? `<div class="home-modal-overlay" data-action="closeMbtiModal"><div class="home-modal ob-mbti-modal" data-action="noopModal">
         <p class="home-modal-title">학습 MBTI 검사</p>
         <div class="ob-mbti-q"><p>1) 계획을 세우고 공부하는 편인가요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q1" data-mbti-v="plan" class="${active(mbtiAnswers.q1, 'plan')}">네</button><button data-action="setMbti" data-mbti-q="q1" data-mbti-v="flex" class="${active(mbtiAnswers.q1, 'flex')}">아니오</button></div></div>
         <div class="ob-mbti-q"><p>2) 혼자 공부할 때 집중이 잘 되나요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q2" data-mbti-v="solo" class="${active(mbtiAnswers.q2, 'solo')}">네</button><button data-action="setMbti" data-mbti-q="q2" data-mbti-v="group" class="${active(mbtiAnswers.q2, 'group')}">아니오</button></div></div>
         <div class="ob-mbti-q"><p>3) 부족한 과목부터 먼저 하는 편인가요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q3" data-mbti-v="weak_first" class="${active(mbtiAnswers.q3, 'weak_first')}">네</button><button data-action="setMbti" data-mbti-q="q3" data-mbti-v="strong_first" class="${active(mbtiAnswers.q3, 'strong_first')}">아니오</button></div></div>
         <div class="ob-mbti-q"><p>4) 피드백이 있으면 공부가 더 잘 되나요?</p><div class="ob-mbti-opt"><button data-action="setMbti" data-mbti-q="q4" data-mbti-v="feedback" class="${active(mbtiAnswers.q4, 'feedback')}">네</button><button data-action="setMbti" data-mbti-q="q4" data-mbti-v="self" class="${active(mbtiAnswers.q4, 'self')}">아니오</button></div></div>
         <button class="btn btn-primary ${mbtiDone ? '' : 'disabled'}" data-action="completeMbti" ${mbtiDone ? '' : 'disabled'}>검사 완료</button>
       </div></div>` : ''}
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta"><button class="cta-button" data-action="goto" data-target="ob4">분석 결과 보기</button></div></div>`,
    false
  );
}

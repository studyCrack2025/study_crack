import { renderGradeButtons } from '../../components/grade-buttons.js';
import { renderMbtiModal } from '../../components/mbti-modal.js';
import { scoreTierClass as defaultScoreTierClass } from '../../components/score-journey.js';
import { EXAM_OPTIONS } from '../../constants/options.js';
import { CRACKY_SRC, ONBOARDING_LOGO_SRC } from '../../constants/assets.js';

const ENGLISH_HISTORY_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SOCIAL_INQUIRY_SUBJECTS = ['생활과 윤리', '윤리와 사상', '한국지리', '세계지리', '동아시아사', '세계사', '경제', '정치와 법', '사회·문화'];
const SCIENCE_INQUIRY_SUBJECTS = ['물리학Ⅰ', '화학Ⅰ', '생명과학Ⅰ', '지구과학Ⅰ', '물리학Ⅱ', '화학Ⅱ', '생명과학Ⅱ', '지구과학Ⅱ'];

export function renderOnboardingProgress(step) {
  return `<div class="ob-progress"><span>${step}/3</span><div class="ob-dots"><i class="${step >= 1 ? 'active' : ''}"></i><i class="${step >= 2 ? 'active' : ''}"></i><i class="${step >= 3 ? 'active' : ''}"></i></div></div>`;
}

function selected(value, candidate) {
  return value === candidate ? 'selected' : '';
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

export function renderSplashScreen(ctx) {
  const { icon, onboardingLogoSrc = ONBOARDING_LOGO_SRC } = ctx;
  return `<div class="app-shell"><div class="app-frame"><div class="splash"><div class="logo-bolt">${icon('bolt', true)}</div><img class="brand-logo" src="${onboardingLogoSrc}" alt="logo"/><h1 style="margin:0;font-size:30px">스터디크랙</h1><p>합격까지 가장 빠른 전략</p></div></div></div>`;
}

export function renderOn1Screen() {
  return `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="onboarding-shot"><div class="onboarding-shot-head"><h2><span class="accent">데이터 기반으로</span>
내 합격 가능성을 분석해요</h2><p>흔들리지 않는 방향을
제시해드립니다.</p></div><div class="onboarding-center"><div class="onboarding-card data"><div class="onboarding-label">합격 가능성</div><div class="onboarding-score">72<em>%</em></div><svg class="onboarding-graph data" viewBox="0 0 320 124"><defs><linearGradient id="obDataFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#BFD8FF" stop-opacity="0.65"/><stop offset="100%" stop-color="#BFD8FF" stop-opacity="0"/></linearGradient></defs><path d="M16 106 L42 84 L66 92 L94 60 L122 76 L146 92 L172 74 L196 36 L224 76 L248 62 L272 24 L292 56 L310 10 L310 124 L16 124 Z" fill="url(#obDataFill)"/><path d="M16 106 L42 84 L66 92 L94 60 L122 76 L146 92 L172 74 L196 36 L224 76 L248 62 L272 24 L292 56 L310 10" stroke="#0B6BFF" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="310" cy="10" r="5" fill="#0B6BFF"/></svg></div></div><img src="${CRACKY_SRC}" class="onboarding-character on1" alt="크랙이"/><div class="onboarding-shot-dots"><i class="active"></i><i></i><i></i></div><button class="onboarding-next" data-action="goto" data-target="on2">다음</button></div></div></div></div>`;
}

export function renderOn2Screen() {
  return `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="onboarding-shot"><div class="onboarding-shot-head"><h2>나에게 최적화된
점수 상승 전략을 제공해요</h2><p>과목별 효율과 목표 도달 시간을
정확하게 예측해 드려요.</p></div><div class="onboarding-center"><div class="onboarding-card strategy"><div class="onboarding-stat">수학 +12점
합격 가능성 +18%</div><svg class="onboarding-graph strategy" viewBox="0 0 320 96"><rect x="72" y="58" width="16" height="38" rx="3" fill="#0B6BFF" fill-opacity="0.85"/><rect x="142" y="40" width="16" height="56" rx="3" fill="#0B6BFF" fill-opacity="0.85"/><rect x="212" y="22" width="16" height="74" rx="3" fill="#0B6BFF" fill-opacity="0.85"/><rect x="282" y="-2" width="16" height="98" rx="3" fill="#0B6BFF" fill-opacity="0.85"/><path d="M18 88 L56 84 L92 70 L126 62 L162 48 L196 42 L232 30 L266 20 L302 12" stroke="#4A8DFF" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="88" r="3" fill="#4A8DFF"/><circle cx="302" cy="12" r="3" fill="#4A8DFF"/></svg></div></div><img src="${CRACKY_SRC}" class="onboarding-character on2" alt="크랙이"/><div class="onboarding-shot-dots"><i></i><i class="active"></i><i></i></div><button class="onboarding-next" data-action="goto" data-target="on3">다음</button></div></div></div></div>`;
}

export function renderOn3Screen() {
  return `<div class="app-shell"><div class="app-frame"><div class="screen app-screen app-content"><div class="onboarding-shot"><div class="onboarding-shot-head"><h2>실행부터 관리까지
끝까지 함께해요</h2><p>플래너, 주간 점검, Sky튜터 피드백,
프로 보고서로 완성됩니다.</p></div><div class="onboarding-center"><div class="onboarding-card list"><div class="onboarding-list-item"><span class="onboarding-icon-box"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 12l2 2 4-4"/></svg></span><span>플래너 & 주간 점검</span></div><div class="onboarding-list-item"><span class="onboarding-icon-box"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.8-4 5-6 8-6s6.2 2 8 6"/></svg></span><span>Sky튜터 1:1 피드백</span></div><div class="onboarding-list-item long-report"><span class="onboarding-icon-box"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v6h6"/></svg></span><span>중장기 합격 전략 리포트</span></div></div></div><img src="${CRACKY_SRC}" class="onboarding-character on3" alt="크랙이"/><div class="onboarding-shot-dots"><i></i><i></i><i class="active"></i></div><button class="onboarding-next" data-action="goto" data-target="authLogin">시작하기</button></div></div></div></div>`;
}

function renderOnboardingScreen(ctx, { step, title, subcopy, bubbleText, body = '', cta = '' }) {
  const { appbar, layout, crackySrc = CRACKY_SRC } = ctx;

  return layout(
    `<div class="onboarding-container"><div class="content">
       ${renderOnboardingProgress(step)}
       ${appbar(title, true)}
       <p class="sub ob-subcopy">${subcopy}</p>
       ${renderBubble(bubbleText, crackySrc)}
       ${body}
       </div><div class="cta-wrapper cta-container onboarding-fixed-cta">${cta}</div></div>`,
    false
  );
}

export function renderOb1Screen(ctx) {
  const { obGradeStatus, obGoalText, obQuestionText, obSchoolName, obTrack } = ctx;

  const body = `<div class="ob1-survey-card">
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
       </div>`;

  return renderOnboardingScreen(ctx, {
    step: 1,
    title: '학습성향 진단 1-1',
    subcopy: '지금 성적과 공부 습관을 바탕으로<br/>나에게 맞는 합격 전략을 찾아볼게요.',
    bubbleText: '성적만 보는 게 아니라, 공부 방식까지 같이 봐야 정확해요!',
    body,
    cta: '<button class="cta-button" data-action="goto" data-target="ob2">1-2 성적 입력으로</button>'
  });
}

export function renderOb2Screen(ctx) {
  const { obExamType } = ctx;

  const body = `<div class="ob1-score-wrap">
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
       </div>`;

  return renderOnboardingScreen(ctx, {
    step: 2,
    title: '학습성향 진단 1-2',
    subcopy: '과목별 성적을 입력하면 현재 위치를<br/>더 정확하게 계산할 수 있어요.',
    bubbleText: '점수는 세밀할수록 좋아요! 입력한 정보로 맞춤 분석을 진행할게요.',
    body,
    cta: '<button class="cta-button" data-action="goto" data-target="ob3">1-3 학습 MBTI로</button><button type="button" class="auth-link-btn" data-action="skipOb2WithoutScore">시험 성적이 없어요</button>'
  });
}

export function renderOb3Screen(ctx) {
  const { mbtiAnswers, mbtiDone, mbtiModalOpen, mbtiResult } = ctx;

  const body = `<div class="card ob-card">
         <p class="analysis-title">학습 MBTI 검사</p>
         <p class="sub">4문항으로 빠르게 진단해요.</p>
         <button class="btn btn-secondary" data-action="openMbtiModal">MBTI 시작하기</button>
         ${mbtiResult ? `<div class="card" style="margin-top:12px;border:2px solid #2563EB;background:#EFF6FF;"><p class="analysis-title">진단 결과</p><p style="margin:6px 0 2px;font-size:30px;font-weight:900;letter-spacing:.08em;color:#1D4ED8;text-shadow:0 6px 18px rgba(37,99,235,.18);">CSDR</p><p class="sub" style="margin:0 0 12px;font-size:12px;color:#1E40AF;">(컨셉형, 직관령, 분석형, 루틴)</p><button class="btn btn-secondary" disabled>맞춤 공부법 PDF 준비 중</button></div>` : ''}
       </div>
       ${renderMbtiModal({ mbtiModalOpen, mbtiAnswers, mbtiDone })}`;

  return renderOnboardingScreen(ctx, {
    step: 3,
    title: '학습성향 진단 1-3',
    subcopy: '마지막 단계예요.<br/>학습 MBTI로 내 공부 성향을 진단해보세요.',
    bubbleText: '짧은 질문 4개로 학습 성향을 빠르게 확인할 수 있어요!',
    body,
    cta: '<button class="cta-button" data-action="goto" data-target="ob4">분석 결과 보기</button>'
  });
}

export function renderOb4Screen(ctx) {
  const {
    analysisGaugeColor = '#2563EB',
    analysisGaugeFill = 0,
    analysisSelected = {},
    analysisStatus = '',
    analysisStatusColor = '#2563EB',
    liveCurrentScore = 0,
    mbtiResult = '',
    scoreTierClass = defaultScoreTierClass,
    targetMajor = ''
  } = ctx;
  const score = Number(analysisSelected.score || 0);
  const gap = score - 100;
  const recommended = ['연세대학교 경영학과', '고려대학교 경영학과', '성균관대학교 글로벌경영학과'];
  const body = `<div class="card ob-card">
         <p class="analysis-title">현재 성적 기준 추천 대학</p>
         <div class="ob-uni-list">${recommended.map((name) => `<button class="ob-uni-item ${targetMajor === name ? 'active' : ''}" data-action="selectTarget" data-target-major="${name}">${name}</button>`).join('')}</div>
       </div>
       <div class="card ob-card analysis-top">
         <p class="analysis-title">합격 가능성 분석</p>
         <div class="analysis-v2-summary-top">
           <div><p class="analysis-v2-univ">${targetMajor}</p><p class="analysis-v2-label">AI 점수 · 합격컷 대비 위치</p></div>
           <div class="analysis-v2-score-wrap"><span class="analysis-v2-verdict ${scoreTierClass(score)}" style="color:${analysisStatusColor};border-color:${analysisStatusColor}">${analysisStatus}</span><strong>${score}점</strong><small>AI 점수</small></div>
         </div>
         <div class="analysis-v2-gauge"><i class="${scoreTierClass(score)}" style="width:${analysisGaugeFill}%;background:${analysisGaugeColor}"></i><span class="cut pass" style="left:40%"></span><span class="cut safe" style="left:60%"></span></div>
         <div class="analysis-v2-gauge-meta"><span>0</span><span>합격컷 100점</span><span>안정컷 150점</span><span>MAX 250점</span></div>
         <div class="kpi-row score-row"><div class="kpi-item"><b>${liveCurrentScore}점</b>현재성적</div><div class="kpi-item"><b>100점</b>합격 컷</div><div class="kpi-item danger"><b>${gap > 0 ? `+${gap}` : gap}점</b>격차</div></div>
       </div>
       <div class="card ob-card plus-one-card">
         <p class="analysis-title">+1점 상승 시뮬레이션</p>
         <div class="analysis-impact-item">수학<div class="track"><i style="width:90%"></i></div><span>+12점 → +18%</span></div>
         <div class="analysis-impact-item">탐구<div class="track"><i style="width:68%;background:#14b8a6"></i></div><span>+6점 → +9%</span></div>
         <div class="analysis-impact-item">영어<div class="track"><i style="width:48%;background:#f59e0b"></i></div><span>+3점 → +5%</span></div>
       </div>
       ${mbtiResult ? `<div class="card ob-card" style="border:2px solid #2563EB;background:#EFF6FF;"><p class="analysis-title">진단 결과</p><p style="margin:6px 0 2px;font-size:30px;font-weight:900;letter-spacing:.08em;color:#1D4ED8;text-shadow:0 6px 18px rgba(37,99,235,.18);">CSDR</p><p class="sub" style="margin:0 0 12px;font-size:12px;color:#1E40AF;">(컨셉형, 직관령, 분석형, 루틴)</p><button class="btn btn-secondary" disabled>맞춤 공부법 PDF 준비 중</button></div>` : ''}`;

  return renderOnboardingScreen(ctx, {
    step: 2,
    title: '목표 설정 및 분석',
    subcopy: '현재 성적 기준으로 도전 가능한 대학과<br/>합격 가능성을 분석해드릴게요.',
    bubbleText: '목표 대학마다 유리한 과목이 달라요. 그래서 대학별로 따로 봐야 해요!',
    body,
    cta: '<button type="button" class="cta-button" data-action="goto" data-target="ob5">내 맞춤 솔루션 보기</button>'
  });
}

export function renderOb5Screen(ctx) {
  const {
    gaugeCurrent = 0,
    gaugeCurrentPct = 0,
    gaugePassPct = 40,
    gaugeSafePct = 60,
    gaugeTarget = 0,
    gaugeTargetPct = 0,
    ob3IsAnalyzing = false,
    scoreJourneyCard = (title) => `<p class="analysis-title">${title}</p>`,
    scoreTierClass = defaultScoreTierClass
  } = ctx;
  const possibleUniversities = [
    ['국민대 경영학부', gaugeCurrent + 6],
    ['숭실대 경제학과', gaugeCurrent + 10],
    ['세종대 미디어커뮤니케이션학과', gaugeCurrent + 14]
  ];
  const body = `<div class="card ob-card">${scoreJourneyCard('최소 노력 대비 합격 도달 성적')}</div>
       <div class="eta-card"><div class="card ob-card ob-period-card on-eta-card"><span class="eyebrow">현재 학습분석 기반</span><b>Standard 이용 시 평균 3개월 내 도달 예상</b><p>주간 플래너 피드백과 학습 방향 코칭 제공</p></div>${ob3IsAnalyzing ? `<div class="loading-overlay"><div class="loading-box"><div class="dots">● ● ●</div><div>분석중입니다</div><div>잠시만 기다려주세요</div></div></div>` : ''}</div>
       <div class="ob5-after-eta">
       <div class="card ob-card">
         <p class="analysis-title">합격 가능성 변화</p>
         <div class="ob-total-compare"><div><span>현재</span><b>${gaugeCurrent}점</b></div><i>→</i><div><span>목표</span><b class="target">${gaugeTarget}점</b></div></div>
         <div class="ob-gauge">
           <div class="ob-gauge-current ${scoreTierClass(gaugeCurrent)}" style="width:${gaugeCurrentPct}%"></div>
           <div class="ob-gauge-target ${scoreTierClass(gaugeTarget)}" style="width:${gaugeTargetPct}%"></div>
           <i class="ob-gauge-cut pass" style="left:${gaugePassPct}%"></i>
           <i class="ob-gauge-cut safe" style="left:${gaugeSafePct}%"></i>
         </div>
         <div class="ob-gauge-labels"><span>합격컷 100점</span><span>안정컷 150점</span></div>
         <p class="sub"><b>현재 → 합격권 진입 구간</b></p>
       </div>
       <div class="card ob-card">
         <p class="analysis-title">성적 변화 시 가능한 대학</p>
         <div class="possible-univ-slider" data-slider-group="possible"><div class="possible-univ-track">
         ${possibleUniversities.map(([name, target]) => `<div class="possible-univ-card"><button type="button" class="card ob-card" style="margin:10px 0 0; width:100%; text-align:left;" data-action="addPossibleUniversity" data-target-major="${name}">
           <p class="analysis-title">${name}</p>
           <div class="ob-total-compare"><div><span>현재</span><b>${gaugeCurrent}점</b></div><i>→</i><div><span>목표</span><b class="target">${target}점</b></div></div>
           <div class="ob-gauge">
             <div class="ob-gauge-current ${scoreTierClass(gaugeCurrent)}" style="width:${Math.min(100, (gaugeCurrent / 250) * 100)}%"></div>
             <div class="ob-gauge-target ${scoreTierClass(target)}" style="width:${Math.min(100, (target / 250) * 100)}%"></div>
             <i class="ob-gauge-cut pass" style="left:${gaugePassPct}%"></i>
             <i class="ob-gauge-cut safe" style="left:${gaugeSafePct}%"></i>
           </div>
           <div class="ob-gauge-labels"><span>합격컷 100점</span><span>안정컷 150점</span></div>
           <p class="sub"><b>현재 → 합격권 진입 구간</b></p>
         </button></div>`).join('')}</div></div><div class="possible-univ-nav"><button type="button" data-action="slidePrev">‹</button><div class="possible-univ-dots slider-indicator possible-univ-indicator possible-slider-indicator"><button data-action="slideTo" data-slide-index="0" class="active slider-dot possible-univ-dot possible-slider-dot"></button><button data-action="slideTo" data-slide-index="1" class="slider-dot possible-univ-dot possible-slider-dot"></button><button data-action="slideTo" data-slide-index="2" class="slider-dot possible-univ-dot possible-slider-dot"></button></div><button type="button" data-action="slideNext">›</button></div>
       </div></div>`;

  return renderOnboardingScreen(ctx, {
    step: 3,
    title: '공부 성향 맞춤 솔루션',
    subcopy: '현재 성적에서 합격컷까지,<br/>가장 효율적인 점수 상승 루트를 보여드릴게요.',
    bubbleText: '무작정 전 과목을 올리는 게 아니라, 합격에 가장 크게 기여하는 과목부터 잡아야 해요!',
    body,
    cta: '<button type="button" class="cta-button" data-action="startStandard">Standard로 시작하기</button><button type="button" class="auth-link-btn" data-action="completeOnboarding">홈으로 이동</button>'
  });
}

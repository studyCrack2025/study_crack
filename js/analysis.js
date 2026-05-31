// js/analysis.js

// ============================================================
// [설정] API 및 상수 정의
// ============================================================
const MYPAGE_API_URL = CONFIG.api.user;
const UNIV_DATA_API_URL = CONFIG.api.analysis;
// FILE_API_URL / REPORT_API_URL 은 shared/api.js 에서 글로벌 선언됨 — 여기서 재선언 X
const PDF_API_URL = CONFIG.api.pdf;

let currentUserTier = 'free';
let univChangeRemaining = 0;
let userRecentPaymentDate = null;
let userTargetUnivs = [null, null, null, null, null, null]; // 6슬롯
let univData = []; 
let univMap = {};  
let userQuantData = null; 
let weeklyDataHistory = []; // 💡 이제 별도 API로 받아옴
let cachedProReports = [];  // 💡 이제 별도 API로 받아옴
let currentSelectStep = 'univ';
let selectedUnivForMajor = '';
let userGracePeriodUntil = null;

let scrollPosition = 0;
let currentTutorName = "수석 튜터";
let userStream = null;

// 대학 선택 모달 관련
let currentSlotIndex = null;
let recommendedUnivCandidates = [];

// 플래너 파일 업로드 관련
let currentPlannerFiles = []; 
let originalPlannerFiles = [];

// 시험 모드 (수능/평가원 등)
let currentExamMode = 'csat'; 
const ANALYSIS_EXAM_MODE_STORAGE_KEY = 'analysis_exam_mode';

const EXAM_DISPLAY_NAMES = {
    "csat": "대학수학능력시험 (수능)",
    "sep": "9월 모의평가",
    "jun": "6월 모의평가",
    "jul": "7월 학력평가",
    "oct": "10월 학력평가",
    "mar": "3월 학력평가",
    "may": "5월 학력평가"
};

function getExamModeStorageKey(userId) {
    return `${ANALYSIS_EXAM_MODE_STORAGE_KEY}_${userId || 'guest'}`;
}

function getAvailableExamModes() {
    if (!userQuantData) return [];
    return Object.keys(userQuantData).filter((key) => {
        const data = userQuantData[key];
        return data && (data.kor || data.math || data.eng);
    });
}

function pickPreferredExamMode(availableExams) {
    if (!availableExams || availableExams.length === 0) return null;
    const priority = ['csat', 'may', 'mar', 'sep', 'jun', 'oct', 'jul'];
    const found = priority.find((key) => availableExams.includes(key));
    return found || availableExams[0];
}

function persistExamMode(mode, userId = localStorage.getItem('userId')) {
    if (!mode || !userId) return;
    try {
        localStorage.setItem(getExamModeStorageKey(userId), mode);
    } catch (_) {
        // ignore storage failures
    }
}

function restoreExamModeFromStorage(userId = localStorage.getItem('userId')) {
    const availableExams = getAvailableExamModes();
    if (!userId || availableExams.length === 0) return false;

    try {
        const saved = localStorage.getItem(getExamModeStorageKey(userId));
        if (saved && availableExams.includes(saved)) {
            currentExamMode = saved;
            return true;
        }
    } catch (_) {
        // ignore storage failures
    }
    return false;
}

function ensureValidExamMode(userId = localStorage.getItem('userId')) {
    const availableExams = getAvailableExamModes();
    if (availableExams.length === 0) return false;
    if (currentExamMode && availableExams.includes(currentExamMode)) {
        persistExamMode(currentExamMode, userId);
        return true;
    }
    currentExamMode = pickPreferredExamMode(availableExams);
    persistExamMode(currentExamMode, userId);
    return true;
}

// ============================================================
// [초기화] DOM 로드 시 실행 (💡 병렬 데이터 로딩으로 개편)
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const userId = localStorage.getItem('userId');

    if (window.DEV_MOCK?.enabled) {
        const m = window.DEV_MOCK;
        renderUserInfo({ name: m.user.name, email: m.user.email, phone: m.user.phone, mbti: m.user.mbti, profileImage: null, computedTier: m.user.tier, qualitative: m.analysis.qualitative, quantitative: m.analysis.quantitative, targetUnivs: m.analysis.targetUnivs, univChangeRemaining: m.analysis.univChangeRemaining });
        applyUserTier(m.user.tier);
        userTargetUnivs = m.analysis.targetUnivs;
        userQuantData = m.analysis.quantitative;
        univChangeRemaining = m.analysis.univChangeRemaining;
        updateQuotaUI();
        setWeeklyLoadingStatus(true);
        initUnivGrid();
        updateAnalysisUI();
        initProSection();
        setWeeklyLoadingStatus(false);
        setTimeout(() => { applyCoachTierLock(); applySimTierLock(); }, 500);
        const devLoader = document.getElementById('pageLoadingOverlay');
        if (devLoader) setTimeout(() => devLoader.classList.add('hidden'), 500);
        return;
    }

    if (!localStorage.getItem('userId')) {
        const refreshed = await tryRefreshToken();
        if (!refreshed) {
            clearClientSession();
            alert("로그인이 필요합니다.");
            window.location.href = '/login';
            return;
        }
        checkLoginStatus();
    }

    setWeeklyLoadingStatus(true);

    try {
        // P1-4: fetchUnivData는 등급에 무관하므로 fetchUserData와 동시에 시작
        const userPromise = fetchUserData(userId);
        const univPromise = fetchUnivData();

        // 등급 확인 후 등급별 추가 호출 결정
        await userPromise;
        const tieredTasks = [];
        if (['standard', 'pro'].includes(currentUserTier)) {
            tieredTasks.push(fetchWeeklyHistory()); // 코칭 탭용 데이터
        }
        if (['pro'].includes(currentUserTier)) {
            tieredTasks.push(fetchInitialProReports()); // PRO 탭용 데이터
        }

        const results = await Promise.allSettled([univPromise, ...tieredTasks]);
        results.forEach((res, idx) => {
            if (res.status === 'rejected') console.error(`Data Load Error [${idx}]:`, res.reason);
        });

        // 3️⃣ UI 초기화 로직 실행
        initUnivGrid();
        updateAnalysisUI();
        initProSection();

        setWeeklyLoadingStatus(false);
        setTimeout(() => {
            // 주간 상태 체크도 권한이 있는 사람만 실행
            if (['standard', 'pro'].includes(currentUserTier)) {
                checkWeeklyStatus();
            }
            applyCoachTierLock();
            applySimTierLock();
        }, 500);

        const loader = document.getElementById('pageLoadingOverlay');
        if (loader) {
            setTimeout(() => {
                loader.classList.add('hidden');
                // 👇 추가: 로딩 오버레이가 사라질 때 높이 최종 동기화
                if (window.innerWidth <= 768) syncMobileHeight();
            }, 500);
        }

        // URL 파라미터 확인 (?sol=sim 등)
        const params = new URLSearchParams(window.location.search);
        const sol = params.get('sol');
        if (sol) setTimeout(() => openSolution(sol), 100);

        const targetTab = params.get('tab');
        if (targetTab) openSolution(targetTab);

        // 1-7: 솔루션 탭 스와이프 폐기 → triggerSolutionTabHintOnce 호출 제거
        // 기본 활성 탭(univ) 카드 스와이프 힌트만 1회 — 명시적 openSolution 미호출 케이스 대비
        if (!sol && !targetTab) triggerSwipeHintForTab('univ');
    } catch (e) {
        console.error("Initialization Error:", e);
    }

    // 💡 튜토리얼 5단계 (모바일 말풍선 가려짐 완벽 해결 및 PRO 분할 로직)
    const pendingTutorial = localStorage.getItem('pending_tutorial');
    
    if (pendingTutorial === 'step3') {
        const warnTutorialExit = (e) => {
            if (localStorage.getItem('pending_tutorial')) {
                e.preventDefault(); e.returnValue = '정말 튜토리얼을 종료하시겠습니까?'; 
            }
        };
        window.addEventListener('beforeunload', warnTutorialExit);

        document.querySelectorAll('.logo-link, .nav-btn').forEach(link => {
            link.addEventListener('click', (e) => {
                if (localStorage.getItem('pending_tutorial')) {
                    if (!confirm('현재 튜토리얼이 거의 끝났습니다!\n정말로 튜토리얼을 그만 하시겠습니까?')) e.preventDefault(); 
                    else { 
                        localStorage.removeItem('pending_tutorial'); 
                        window.removeEventListener('beforeunload', warnTutorialExit); 
                        document.body.classList.remove('tutorial-lock');
                        document.body.style.removeProperty('position');
                        document.body.style.removeProperty('width');
                        document.body.style.removeProperty('top');
                    }
                }
            });
        });

        let tutStep = 0;
        let isTooltipHidden = false;
        let lockedScrollY = 0;
        
        const msgEl = document.getElementById('tutorialMsg');
        const prevBtn = document.getElementById('tutPrevBtn');
        const nextBtn = document.getElementById('tutNextBtn');
        const skipBtn = document.getElementById('skipTutorialBtn');
        
        // 💡 메시지 5개로 분할
        const tutMsgs = [
            'Basic 등급 이상에서 사용 가능합니다. 현재 점수를 통해 각 대학에서 본인의 현재 위치를 알려줍니다.',
            'Standard 등급 이상에서 사용 가능합니다. 현재 점수와 각 대학의 반영비를 통해 어떤 과목을 공부하는 가장 효율적인지를 보여줍니다.',
            'Standard 등급 이상에서 사용 가능합니다. SKY 출신 선생님들이 목표대학 합격을 위해 매주 어떻게 공부를 해야하는지 플래너를 검토해줍니다.',
            'PRO 등급 이상에서 사용 가능합니다. 현재 학습 상황과 고민을 작성하여 1:1 맞춤형 프리미엄 전략 리포트를 요청할 수 있습니다.',
            '담당 컨설턴트가 데이터를 기반으로 분석한 최종 리포트를 2주마다 제공받아, 목표 대학 합격률을 극대화할 수 있습니다.'
        ];
        
        // 💡 탭 순서도 5개로 분할
        const tabKeys = ['univ', 'sim', 'coach', 'pro', 'pro'];

        const injectDummyData = (step) => {
            const contents = document.querySelectorAll('.sol-content');
            contents.forEach(c => c.classList.remove('tutorial-focus-content'));

            const targetContent = document.getElementById(`sol-${tabKeys[step]}`);
            if (!targetContent) return;
            
            targetContent.classList.add('tutorial-focus-content');

            // 💡 튜토리얼 진행 시에는 임시로 블러(잠금) 효과를 해제하여 잘 보이게 처리
            if (tabKeys[step] === 'coach') {
                const coachContainer = document.querySelector('.coach-container');
                if (coachContainer) {
                    coachContainer.classList.remove('tier-locked');
                    const lockOverlay = coachContainer.querySelector('.coach-tier-lock-overlay');
                    if (lockOverlay) lockOverlay.style.display = 'none';
                }
            }
            if (tabKeys[step] === 'sim') {
                const simContainer = document.querySelector('.sim-container-new');
                if (simContainer) {
                    const lockOverlay = simContainer.querySelector('.sim-tier-lock-overlay');
                    if (lockOverlay) lockOverlay.style.display = 'none';
                }
            }

            if (step === 0) {
                // ... 기존 step 0 코드와 동일 ...
                const resArea = document.getElementById('univAnalysisResult');
                if(resArea) resArea.innerHTML = `
                    <div class="analysis-card" style="border-left-color: #10b981; margin-top:20px;">
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:10px; margin-bottom:15px;">
                            <div><h4 style="margin:0; font-size:1.2rem;">고려대학교 <small style="color:#64748b;">컴퓨터학과</small></h4></div>
                            <div><span style="background:#10b98115; color:#10b981; padding:6px 12px; border-radius:20px; font-weight:bold;">안정</span></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-weight:bold;"><span style="color:#64748b">환산점수</span> <span style="color:#10b981; font-size:1.2rem;">152.4점</span></div>
                    </div>`;
            } else if (step === 1) {
                // ... 기존 step 1 코드와 동일 ...
                const simArea = document.querySelector('#sol-sim .sim-container-new');
                if(simArea) simArea.innerHTML = `
                    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px; text-align:center;">
                        <div style="font-size:1.5rem; color:#2563EB; font-weight:900; margin-bottom:10px;">수학 (+1점) 상승 시</div>
                        <div style="color:#475569; margin-bottom:20px;">합격 확률이 <strong style="color:#ef4444;">45%</strong> 대폭 상승합니다!</div>
                        <div style="height:120px; display:flex; justify-content:center; align-items:flex-end; gap:20px; border-bottom:2px solid #cbd5e1;">
                            <div style="width:40px; height:60px; background:#cbd5e1; border-radius:6px 6px 0 0;"></div>
                            <div style="width:40px; height:100px; background:#2563EB; border-radius:6px 6px 0 0; position:relative;"><span style="position:absolute; top:-25px; left:-10px; background:#ef4444; color:white; font-size:0.7rem; padding:2px 6px; border-radius:10px; font-weight:bold; white-space:nowrap;">합격권 진입!</span></div>
                        </div>
                    </div>`;
            } else if (step === 2) {
                // ... 기존 step 2 코드와 동일 ...
                const coachArea = document.querySelector('#sol-coach .coach-container');
                if(coachArea) coachArea.innerHTML = `
                    <div class="coach-box" style="border-left: 4px solid #8b5cf6;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                            <h3 style="margin:0; font-size:1.1rem;">💌 주간학습 피드백 도착</h3>
                            <span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:bold;">열람 가능</span>
                        </div>
                        <p style="color:#475569; font-size:0.9rem; margin-bottom:15px;">SKY 출신 컨설턴트가 이번 주 플래너를 꼼꼼히 분석했습니다.</p>
                        <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; color:#334155; font-size:0.9rem;">
                            "수학 기출 분석 2회독은 잘 지켜졌으나, 탐구 과목 투자 시간이 상대적으로 부족합니다. 다음 주에는 탐구 비율을 15% 늘려보세요..."
                        </div>
                    </div>`;
            } else if (step === 3) {
                // 💡 [수정] 3단계: PRO 리포트 요청 화면
                const proArea = document.getElementById('sol-pro');
                if(proArea) proArea.innerHTML = `
                    <div class="pro-theme" style="padding:30px;">
                        <div style="text-align:center; margin-bottom:20px;">
                            <span style="background:#3b82f6; color:white; padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:bold;">PRO EXCLUSIVE</span>
                            <h2 style="margin:10px 0; font-size:1.6rem; color:white;">프리미엄 전략 리포트 요청</h2>
                        </div>
                        <div style="background:rgba(255,255,255,0.1); border-radius:12px; padding:25px; text-align:center;">
                            <div style="color:#bfdbfe; margin-bottom:15px; font-size:0.95rem;">⏳ 요청 마감: <strong>일요일 자정</strong> 까지</div>
                            <button style="background: white; color: #1e3a8a; font-weight: 700; padding: 12px 30px; border-radius: 8px; border: none; font-size: 1rem; cursor:default;"><i class="fas fa-edit"></i> 분석 요청서 작성하기</button>
                        </div>
                    </div>`;
            } else if (step === 4) {
                // 💡 [수정] 4단계: PRO 리포트 보관함 (다운로드) 화면
                const proArea = document.getElementById('sol-pro');
                if(proArea) proArea.innerHTML = `
                    <div class="pro-theme" style="padding:30px;">
                        <div style="text-align:center; margin-bottom:20px;">
                            <span style="background:#3b82f6; color:white; padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:bold;">PRO EXCLUSIVE</span>
                            <h2 style="margin:10px 0; font-size:1.6rem; color:white;">프리미엄 전략 리포트 보관함</h2>
                        </div>
                        <div style="background:#1e293b; border: 1px solid #3b82f6; border-radius:12px; padding:20px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <strong style="color:white; display:block; font-size:1.1rem; margin-bottom:5px;">2026년 3월 2주차 PRO 분석</strong>
                                <span style="color:#4ade80; font-size:0.9rem;">● 열람 가능</span>
                            </div>
                            <i class="fas fa-download" style="font-size:1.5rem; color:#3b82f6;"></i>
                        </div>
                    </div>`;
            }
        };

        setTimeout(() => {
            const isMobile = window.innerWidth <= 768;
            const menuEl = document.querySelector('.solution-menu');
            const swipeWrapper = document.querySelector('.sol-swipe-wrapper');
            const overlay = document.getElementById('tutorialOverlay');
            const cloneContainer = document.getElementById('tutorialCloneContainer');
            const tooltip = document.getElementById('tutorialTooltip');
            const bottomBar = document.querySelector('.tutorial-bottom-bar');
            
            if (tooltip) { 
                document.body.appendChild(tooltip); 
                tooltip.style.zIndex = '10005'; 
                tooltip.style.pointerEvents = 'auto'; // 🔥 클릭 방지 해제 (가장 중요)
            }
            if (bottomBar) { document.body.appendChild(bottomBar); bottomBar.style.zIndex = '10005'; }

            if (overlay && cloneContainer) {
                const targetEl = (isMobile && swipeWrapper) ? swipeWrapper : menuEl;
                const headerHeight = document.querySelector('header') ? document.querySelector('header').offsetHeight : 70;
                const targetY = targetEl ? (targetEl.getBoundingClientRect().top + window.pageYOffset - headerHeight - 15) : 0;
                
                window.scrollTo(0, targetY);

                setTimeout(() => {
                    lockedScrollY = window.pageYOffset || document.documentElement.scrollTop;
                    document.body.classList.add('tutorial-lock');
                    document.body.style.position = 'fixed';
                    document.body.style.width = '100%';
                    document.body.style.top = `-${lockedScrollY}px`;

                    overlay.classList.remove('hidden');
                    
                    if (!isMobile && menuEl) {
                        const cloneMenu = menuEl.cloneNode(true);
                        cloneMenu.querySelectorAll('.sol-btn').forEach(btn => { 
                            btn.removeAttribute('onclick'); 
                            btn.style.pointerEvents = 'none';
                        });
                        cloneContainer.appendChild(cloneMenu);
                        cloneContainer.style.display = 'block';
                    } else {
                        cloneContainer.style.display = 'none';
                    }

                    const updatePositions = () => {
                        if (localStorage.getItem('pending_tutorial') !== 'step3') return;
                        
                        const isMobileNow = window.innerWidth <= 768;
                        
                        if (isMobileNow) {
                            cloneContainer.style.display = 'none';
                            
                            if (tooltip) {
                                // 🔥 모바일: 화면 밖으로 밀려나지 않게 하단 컨트롤 바 바로 위에 고정
                                tooltip.style.top = 'auto';
                                tooltip.style.bottom = '120px';
                                tooltip.style.left = '50%';
                                tooltip.style.transform = 'translateX(-50%)';
                                tooltip.style.width = '90%';
                                tooltip.style.maxWidth = '400px';
                            }
                        } else {
                            const menuEl = document.querySelector('.solution-menu');
                            if(menuEl && cloneContainer.style.display !== 'none') {
                                const rect = menuEl.getBoundingClientRect();
                                cloneContainer.style.top = `${rect.top}px`;
                                cloneContainer.style.left = `${rect.left}px`;
                                cloneContainer.style.width = `${rect.width}px`;
                                cloneContainer.style.height = `${rect.height}px`;

                                const cloneBtns = cloneContainer.querySelectorAll('.sol-btn');
                                const targetBtnIdx = tutStep === 4 ? 3 : tutStep;
                                if (cloneBtns[targetBtnIdx] && tooltip) {
                                    const btnRect = cloneBtns[targetBtnIdx].getBoundingClientRect();
                                    tooltip.style.bottom = 'auto'; // PC 복구 시 bottom 해제
                                    tooltip.style.width = 'auto';
                                    tooltip.style.top = `${btnRect.bottom + 15}px`;
                                    tooltip.style.left = `${Math.max(10, btnRect.left + (btnRect.width / 2))}px`;
                                    tooltip.style.transform = `translateX(-50%)`;
                                    tooltip.style.setProperty('--arrow-pos', `50%`);
                                }
                            }
                        }
                    };

                    window.addEventListener('resize', updatePositions);

                    const finishTutorialAction = (showModal) => {
                        localStorage.removeItem('pending_tutorial');
                        window.removeEventListener('beforeunload', warnTutorialExit);
                        window.removeEventListener('resize', updatePositions);
                        
                        document.body.classList.remove('tutorial-lock');
                        document.body.style.removeProperty('position');
                        document.body.style.removeProperty('width');
                        document.body.style.removeProperty('top');
                        window.scrollTo(0, lockedScrollY);

                        overlay.classList.add('hidden');
                        if (tooltip) tooltip.style.display = 'none';
                        if (bottomBar) bottomBar.style.display = 'none';
                        cloneContainer.remove();
                        
                        document.querySelectorAll('.sol-content').forEach(c => c.classList.remove('tutorial-focus-content'));
                        openSolution('univ'); 
                        
                        applyCoachTierLock();
                        applySimTierLock();

                        if (showModal) {
                            document.getElementById('tutorialCompleteModal').classList.remove('hidden');
                            document.getElementById('tutorialCompleteModal').style.display = 'flex';
                        } else {
                            location.reload(); 
                        }
                    };

                    let isDetailMode = false; // 자세히 보기 상태 확인용 변수

                    const updateStep = () => {
                        openSolution(tabKeys[tutStep], true); 
                        injectDummyData(tutStep);

                        const isMobileNow = window.innerWidth <= 768;
                        if (isMobileNow) {
                            const wrapper = document.querySelector('.sol-swipe-wrapper');
                            const targetContent = document.getElementById(`sol-${tabKeys[tutStep]}`);
                            if (wrapper && targetContent) {
                                // 위아래 여백을 위해 높이를 살짝 더 여유 있게 잡아줌
                                wrapper.style.height = `${targetContent.offsetHeight + 30}px`;
                            }
                        }

                        const cloneBtns = cloneContainer.querySelectorAll('.sol-btn');
                        cloneBtns.forEach((btn, idx) => {
                            const isActive = (tutStep === 4 && idx === 3) || (idx === tutStep);
                            if (isActive) {
                                btn.classList.add('active');
                                btn.style.opacity = '1';
                            } else {
                                btn.classList.remove('active');
                                btn.style.opacity = '0.4';
                            }
                        });
                        
                        // 💡 상태 초기화: 말풍선 보이기 & 버튼 텍스트 세팅
                        isDetailMode = false;
                        isTooltipHidden = false;
                        tooltip.style.display = 'block';
                        updatePositions(); 
                        
                        msgEl.innerText = tutMsgs[tutStep];
                        prevBtn.style.display = tutStep > 0 ? 'block' : 'none';
                        
                        // 💡 말풍선 안쪽 버튼은 '자세히 보기', 하단 바는 '건너뛰기'
                        nextBtn.style.display = 'block';
                        nextBtn.innerText = '자세히 보기';
                        skipBtn.innerText = '튜토리얼 건너뛰기';
                        skipBtn.classList.remove('highlight-border');
                    };

                    // [이전] 버튼
                    prevBtn.addEventListener('click', () => { 
                        if (tutStep > 0) { tutStep--; updateStep(); } 
                    });
                    
                    // [자세히 보기] 버튼 (기존 '다음' 버튼)
                    nextBtn.addEventListener('click', () => { 
                        isDetailMode = true;
                        tooltip.style.display = 'none'; // 말풍선 숨김
                        
                        // 하단 바 버튼을 '다음 단계로' 변경하고 강조
                        if (tutStep === 4) {
                            skipBtn.innerText = '튜토리얼 완료하기';
                        } else {
                            skipBtn.innerText = '다음 단계로';
                        }
                        skipBtn.classList.add('highlight-border'); 
                    });
                    
                    // [건너뛰기 / 다음 단계로] 하단 바 버튼
                    skipBtn.addEventListener('click', () => {
                        if (isDetailMode) {
                            // 자세히 보기 모드일 때는 '다음' 역할 수행
                            if (tutStep === 4) {
                                finishTutorialAction(true);
                            } else {
                                tutStep++;
                                updateStep();
                            }
                        } else {
                            // 일반 모드일 때는 '건너뛰기' 역할 수행
                            if (!confirm("정말로 그만두시겠습니까?\n튜토리얼 완료 시 제공되는 무료 대학 분석 기회를 받지 못할 수 있습니다.")) return;
                            finishTutorialAction(false);
                        }
                    });

                    updateStep(); 
                }, 50); 
            }
        }, 500);
    }
    
    // 1-7: 솔루션 탭 스와이프 폐기 → scroll 리스너/mainSwipeHint 미사용 (제거)
    // 잔존 mainSwipeHint 엘리먼트가 있으면 정리
    const stale = document.getElementById('mainSwipeHint');
    if (stale) stale.remove();

    // 기본 활성 탭(univ) 클래스 보장 — HTML에 이미 .active 있지만 안전을 위해 명시
    if (window.innerWidth <= 768) {
        const firstTab = document.getElementById('sol-univ');
        if (firstTab && !firstTab.classList.contains('active')) firstTab.classList.add('active');
    }
});

window.finishTutorialComplete = async function() {
    const submitBtn = document.querySelector('#tutorialCompleteModal button');
    if (submitBtn) {
        submitBtn.innerText = "처리 중...";
        submitBtn.disabled = true;
    }

    try {
        // 튜토리얼 보상으로 trial 티어 부여 및 횟수 4회 충전 요청
        await apiFetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'grant_tutorial_trial' })
        });
    } catch (e) {
        console.error("Trial 승급 요청 실패:", e);
    }

    document.getElementById('tutorialCompleteModal').style.display = 'none';
    location.reload(); 
};

// [보안] XSS 방지용 이스케이프 함수
function escapeHtml(text) {
    if (text == null) return ""; 
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 1-7: 솔루션 탭이 클릭+페이드 모드로 전환되어 더 이상 wrapper 높이를 강제할 필요 없음.
// 기존 호출자가 많아 호환을 위해 함수는 유지하되 인라인 height만 비워 자연 높이로 복원.
function syncMobileHeight() {
    const wrapper = document.querySelector('.sol-swipe-wrapper');
    if (wrapper && wrapper.style.height) wrapper.style.height = '';
}

function getStandardLockOverlayHTML(featureName) {
    return `
        <div style="background: white; padding: 30px 20px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; border: 1px solid #e2e8f0; width: 90%; max-width: 320px; box-sizing: border-box;">
            <i class="fas fa-lock" style="font-size: 2.5rem; color: #7c9eef; margin-bottom: 15px;"></i>
            <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.25rem; word-break: keep-all;">Standard 멤버십 전용</h3>
            <p style="color: #475569; font-size: 0.95rem; margin-bottom: 20px; line-height: 1.5; word-break: keep-all;">
                ${featureName}은(는)<br><strong style="color:#4c79ee;">Standard 등급 이상</strong>부터 이용 가능합니다.
            </p>
            <button onclick="location.href='/payment'" style="width: 100%; padding: 14px 0; background: #4c79ee; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer; transition: background 0.2s; white-space: nowrap; word-break: keep-all;">
                🚀 멤버십 알아보기
            </button>
        </div>`;
}

function applySimTierLock() {
    const container = document.querySelector('.sim-container-new') || document.getElementById('sol-sim');
    if (!container) return;

    // 💡 수정됨: 'trial'을 잠금 대상에서 제외 ('free', 'basic'만 잠금)
    if (['free', 'basic'].includes(currentUserTier)) {
        container.style.position = 'relative';
        container.style.minHeight = '400px'; // 모달 위치 통일용 강제 고정
        if (container.querySelector('.sim-tier-lock-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'sim-tier-lock-overlay';
        overlay.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(200, 217, 255, 0.82); backdrop-filter: blur(6px); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 50; border-radius: 12px;";
        overlay.innerHTML = getStandardLockOverlayHTML('점수 상승 시뮬레이션');
        container.appendChild(overlay);
    } else {
        // 💡 추가됨: 'trial', 'standard', 'pro' 일 경우 자물쇠 원상복구(해제)
        container.style.minHeight = 'auto';
        const existingOverlay = container.querySelector('.sim-tier-lock-overlay');
        if (existingOverlay) existingOverlay.remove();
    }
}

// [유틸] DynamoDB JSON 파서
function parseDynamoItem(item) {
    if (item === undefined || item === null) return null;
    if (typeof item !== 'object') return item;
    if (Array.isArray(item)) return item.map(parseDynamoItem);
    if (item.S !== undefined) return item.S;
    if (item.N !== undefined) return Number(item.N);
    if (item.BOOL !== undefined) return item.BOOL;
    if (item.NULL === true) return null;
    if (item.L !== undefined) {
        if (Array.isArray(item.L)) return item.L.map(parseDynamoItem);
        return [];
    }
    if (item.M !== undefined) {
        const obj = {};
        for (const key in item.M) obj[key] = parseDynamoItem(item.M[key]);
        return obj;
    }
    const obj = {};
    for (const key in item) obj[key] = parseDynamoItem(item[key]);
    return obj;
}

// ============================================================
// [데이터 로드] 사용자 정보 & 리포트 데이터
// ============================================================
async function fetchUserData(userId) {
    const safeUserId = userId || localStorage.getItem('userId'); 
    try {
        const response = await apiFetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user_analysis', userId: safeUserId })
        });
        if (!response.ok) throw new Error("사용자 데이터 로드 실패");
        
        const rawData = await response.json();
        const data = parseDynamoItem(rawData);

        userGracePeriodUntil = data.gracePeriodUntil || null;

        if (data.tutorName) currentTutorName = data.tutorName;
        
        if (data.currentSubscription && data.currentSubscription.startDate) {
             userRecentPaymentDate = new Date(data.currentSubscription.startDate);
        }
        
        renderUserInfo(data);
        applyUserTier(data.computedTier || 'free');

        // 사이드바 정량 렌더(updateSurveyStatus) 가 글로벌 userQuantData/currentExamMode 를 읽으므로
        // 반드시 그 호출 *전* 에 두 값을 세팅해야 초기 진입 시 정량 데이터가 비어 보이지 않음.
        if (data.quantitative) userQuantData = data.quantitative;
        restoreExamModeFromStorage(safeUserId);
        ensureValidExamMode(safeUserId);

        updateSurveyStatus(data);
        checkMbtiReport(data);

        if (data.targetUnivs) {
            userTargetUnivs = data.targetUnivs;
            // 💡 [추가] Free, Trial 유저는 5, 6번째 슬롯(인덱스 4, 5) 데이터를 강제로 비워 분석을 차단합니다.
            if (['free', 'trial'].includes(currentUserTier)) {
                userTargetUnivs[4] = null;
                userTargetUnivs[5] = null;
            }
        }
        if (data.qualitative?.stream) userStream = data.qualitative.stream;

        if (currentUserTier === 'free') {
            univChangeRemaining = 0;
        } else {
            univChangeRemaining = data.univChangeRemaining !== undefined ? data.univChangeRemaining : 30;
        }
        updateQuotaUI();
        
        if (typeof buildUnivMap === 'function') buildUnivMap();
        
        if (data && data.profileImage) {
            const imgElem = document.getElementById('profileImg');
            if (imgElem) imgElem.src = escapeHtml(data.profileImage);
        }
    } catch (error) {
        // 401은 shared apiFetch가 redirectToLogin으로 처리하므로 여기선 swallow
    }
}

async function fetchWeeklyHistory() {
    try {
        const response = await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_weekly_reports' }) 
        });
        
        if (response.ok) {
            const data = await response.json();
            weeklyDataHistory = data.weeklyReports || [];
        }
    } catch (e) { console.error("Weekly Data Load Error:", e); }
}

async function fetchInitialProReports() {
    try {
        const res = await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_pro_reports', data: { requesterRole: 'student' } })
        });
        if (res.ok) {
            const data = await res.json();
            cachedProReports = data.reports || []; 
        }
    } catch (e) { console.error("Pro Reports Load Error:", e); }
}

async function fetchUnivData() {
    const userId = localStorage.getItem('userId');
    try {
        const response = await apiFetch(UNIV_DATA_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_univ_list_only', userId: userId }) 
        });
        
        if (!response.ok) throw new Error(`서버 응답 오류`);
        const data = await response.json();
        
        univData = Array.isArray(data) ? data : (data.univs || []); 
        univMap = {};
        univData.forEach(item => { 
            univMap[item.univName] = item.majors.map(m => ({ name: m })); 
        });
    } catch (e) { console.error("대학 데이터 로드 실패:", e); }
}

function buildUnivMap() {}

// ============================================================
// 이하 UI 렌더링 로직
// ============================================================
function renderUserInfo(data) {
    const nameEl = document.getElementById('userNameDisplay');
    const tierBadgeEl = document.getElementById('userTierBadge');
    
    if (nameEl) nameEl.textContent = data.name || '이름 없음';
    
    if (tierBadgeEl) {
        const tier = data.computedTier || 'free';
        let tierText = 'FREE'; 
        let tierClass = 'tier-badge-free'; 
        let iconClass = '';

        if (tier === 'basic') { tierText = 'BASIC'; tierClass = 'tier-badge-basic'; }
        else if (tier === 'starter') { tierText = 'STARTER'; tierClass = 'tier-badge-basic'; }
        else if (tier === 'standard') { tierText = 'STANDARD'; tierClass = 'tier-badge-standard'; iconClass = 'fa-gem'; }
        else if (tier === 'pro') { tierText = 'PRO'; tierClass = 'tier-badge-pro'; iconClass = 'fa-crown'; }
        else if (tier === 'trial') { tierText = 'TRIAL (무료 체험)'; tierClass = 'tier-badge-trial'; iconClass = 'fa-gift'; }

        tierBadgeEl.className = `user-tier-badge ${tierClass}`;
        tierBadgeEl.innerHTML = ''; 
        
        if (iconClass) {
            const icon = document.createElement('i');
            icon.className = `fas ${iconClass}`;
            icon.style.marginRight = '4px';
            tierBadgeEl.appendChild(icon);
        }
        tierBadgeEl.appendChild(document.createTextNode(tierText));
    }
}

function applyUserTier(tier) { currentUserTier = tier; }

function updateSurveyStatus(data) {
    const qual = data.qualitative;
    const isQualDone = !!qual; 

    const qualStatusEl = document.getElementById('qualStatus');
    const qualGradeRow = document.getElementById('qualGradeRow');
    const qualStreamRow = document.getElementById('qualStreamRow');
    const qualTargetRow = document.getElementById('qualTargetRow');
    
    if (isQualDone) {
        qualStatusEl.innerHTML = '<span style="color:#166534; font-weight:bold;">✅ 작성완료</span>';
        
        const statusVal = qual.status || '';
        if (statusVal) { document.getElementById('qualGrade').innerText = statusVal; qualGradeRow.style.display = 'flex'; } 
        else { qualGradeRow.style.display = 'none'; }

        const groupMap = { 'humanities': '인문', 'natural': '자연', 'nature': '자연', 'arts': '예체능', 'undefined': '미정' };
        const groupKey = qual.stream || 'undefined';
        document.getElementById('qualStream').innerText = groupMap[groupKey] || groupKey;
        qualStreamRow.style.display = 'flex';

        let targets = [];
        if (Array.isArray(qual.targets)) targets = qual.targets.filter(t => t && t.trim() !== "");
        if (targets.length === 0 && data.targetUnivs) data.targetUnivs.forEach(t => { if(t && t.univ) targets.push(t.univ); });

        const targetContainer = document.getElementById('qualTargetContainer');
        targetContainer.innerHTML = '';

        if (targets.length > 0) {
            const uniqueTargets = [...new Set(targets)].slice(0, 2);
            let targetHtml = '';
            if (uniqueTargets[0]) targetHtml += `<div class="target-row first">${escapeHtml(uniqueTargets[0])}<span class="target-rank">1지망</span></div>`;
            if (uniqueTargets[1]) targetHtml += `<div class="target-row second">${escapeHtml(uniqueTargets[1])}<span class="target-rank">2지망</span></div>`;
            const mbti = getUserMbti(data);
            if (mbti) targetHtml += `<div class="target-row mbti">${escapeHtml(mbti)}<span class="target-rank">MBTI</span></div>`;
            targetContainer.innerHTML = targetHtml;
            qualTargetRow.style.display = 'flex';
        } else {
            const mbti = getUserMbti(data);
            if (mbti) {
                targetContainer.innerHTML = `<div class="target-row mbti">${escapeHtml(mbti)}<span class="target-rank">MBTI</span></div>`;
                qualTargetRow.style.display = 'flex';
            } else {
                qualTargetRow.style.display = 'none';
            }
        }
    } else {
        qualStatusEl.innerHTML = '<span style="color:#991b1b; font-weight:bold;">❌ 미작성</span>';
        qualGradeRow.style.display = 'none'; qualStreamRow.style.display = 'none'; qualTargetRow.style.display = 'none';
    }

    const quan = data.quantitative;
    const validExams = [];
    if (quan) { Object.keys(quan).forEach(key => { const d = quan[key]; if (d && (d.kor || d.math || d.eng)) validExams.push(key); }); }
    
    const isQuanDone = validExams.length > 0;
    const quanEmptyEl = document.getElementById('quanEmpty');
    const quanContentBox = document.getElementById('quanContentBox');
    const selector = document.getElementById('sideQuanSelector');
    const detailBox = document.getElementById('sideQuanDetail');

    if (isQuanDone) {
        quanEmptyEl.style.display = 'none';
        quanContentBox.style.display = 'block';

        const sortOrder = ['mar', 'apr', 'may', 'jun', 'jul', 'sep', 'oct', 'csat'];
        validExams.sort((a, b) => sortOrder.indexOf(b) - sortOrder.indexOf(a));

        selector.innerHTML = validExams.map(key => {
            const name = EXAM_DISPLAY_NAMES[key] || key.toUpperCase();
            return `<option value="${key}">${name}</option>`;
        }).join('');

        // 사이드바 정량 토글의 초기값을 currentExamMode 와 맞춰 두면 시뮬/목표대학 영역과 시작부터 동기화됨
        const initialKey = (currentExamMode && validExams.includes(currentExamMode))
            ? currentExamMode
            : validExams[0];
        selector.value = initialKey;
        renderSideQuanDetail(initialKey);
        // 사이드바에서 정량 토글 변경 → 본문(목표대학/시뮬)도 같이 갱신
        selector.onchange = (e) => {
            const next = e.target.value;
            renderSideQuanDetail(next);
            if (next !== currentExamMode) changeExamMode(next);
        };
    } else {
        quanEmptyEl.style.display = 'block';
        quanContentBox.style.display = 'none';
    }

    const badge = document.getElementById('statusBadge');
    if(badge) {
        badge.className = 'status-badge';
        if (isQualDone && isQuanDone) { badge.classList.add('complete'); badge.innerText = "분석 준비 완료"; } 
        else if (isQualDone || isQuanDone) { badge.classList.add('partial'); badge.innerText = "데이터 부족"; } 
        else { badge.classList.add('incomplete'); badge.innerText = "시작 필요"; }
    }
}

function openSolution(type) {
    const targetContent = document.getElementById(`sol-${type}`);

    // 1-7: 모바일/PC 통합 — 클래스 토글로 탭 전환 (페이드 애니메이션은 CSS .sol-content.active에서)
    document.querySelectorAll('.sol-content').forEach(el => {
        el.classList.remove('active');
        // 과거에 inline display로 토글했던 잔여 스타일 제거
        el.style.display = '';
    });
    if (targetContent) targetContent.classList.add('active');

    // 상단 탭 버튼 활성화 UI 변경
    document.querySelectorAll('.solution-menu .sol-btn').forEach(btn => {
        btn.classList.remove('active');
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${type}'`)) {
            btn.classList.add('active');
        }
    });

    if (type === 'sim') initSimulation();
    // 스와이프 힌트: 해당 탭의 내부 카드/슬라이드 surface에서 1회 자연스럽게 발동
    triggerSwipeHintForTab(type);

    // 뷰포트 상단으로 부드러운 스크롤 (모바일에서 탭 전환 후 상단부터 보이게)
    if (window.innerWidth <= 768 && targetContent) {
        const top = targetContent.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
}

// viewport 회전/리사이즈 시 deck 토글 (모바일 ↔ PC 경계)
let _univDeckResizeBound = false;
function bindUnivDeckResize() {
    if (_univDeckResizeBound) return;
    _univDeckResizeBound = true;
    let t = null;
    window.addEventListener('resize', () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => renderUnivDeck(), 180);
    });
}
if (typeof window !== 'undefined') bindUnivDeckResize();

// ============================================================
// 모바일 — 슬롯(1~6지망) + 분석카드 통합 deck 렌더
//   PC: 기존 2-section 레이아웃 유지. 모바일에서만 deck 활성화.
//   변경 발생 시(슬롯 저장/분석 응답) 매번 재렌더 → 데이터 동기화 보장
// ============================================================
function renderUnivDeck() {
    const sub = document.getElementById('sol-univ');
    if (!sub) return;
    const isMobile = window.innerWidth <= 768;
    const wrap = document.getElementById('univDeckWrap');

    if (!isMobile) {
        if (wrap) wrap.style.display = 'none';
        // 원본 컨테이너 복원 (PC 모드)
        ['univGrid', 'univAnalysisResult', 'btnSaveTarget'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });
        document.querySelectorAll('#sol-univ .univ-sub-header, #sol-univ hr.divider').forEach(el => el.style.display = '');
        return;
    }

    const univGrid = document.getElementById('univGrid');
    const cardsContainer = document.getElementById('analysisCardsContainer');
    if (!univGrid) return;
    const slots = univGrid.querySelectorAll('.univ-slot');
    if (slots.length === 0) return;
    const cards = cardsContainer ? cardsContainer.querySelectorAll('.analysis-card, .empty-state') : [];

    // 래퍼 + 하위 영역 1회 생성
    let deckWrap = wrap;
    if (!deckWrap) {
        deckWrap = document.createElement('div');
        deckWrap.id = 'univDeckWrap';
        deckWrap.className = 'univ-deck-wrap';
        deckWrap.innerHTML = `
            <div class="univ-deck-topbar">
                <div class="univ-deck-exam"></div>
                <div class="univ-deck-indicator"><span id="univDeckIndicator">1 / ${slots.length}</span></div>
            </div>
            <div id="univDeck" class="univ-deck"></div>
            <div id="univDeckBottomBar" class="univ-deck-bottombar"></div>
        `;
        // sol-univ 첫 번째 sub-header 직후에 삽입
        const subHeader = sub.querySelector('.univ-sub-header');
        if (subHeader && subHeader.parentNode) subHeader.parentNode.insertBefore(deckWrap, subHeader.nextSibling);
        else sub.insertBefore(deckWrap, sub.firstChild);
    }
    deckWrap.style.display = '';

    // 상단 examSelector chip 동기화 (있을 때만)
    const examSelEl = document.querySelector('#univAnalysisResult #examSelector');
    const examSlot = deckWrap.querySelector('.univ-deck-exam');
    if (examSlot) {
        if (examSelEl) {
            const options = Array.from(examSelEl.options).map(o => `<option value="${escapeHtml(o.value)}" ${o.selected ? 'selected' : ''}>${escapeHtml(o.textContent)}</option>`).join('');
            examSlot.innerHTML = `<label>기준 시험</label><select onchange="changeExamMode(this.value)">${options}</select>`;
        } else {
            examSlot.innerHTML = '';
        }
    }

    // 슬라이드 빌드
    const deck = document.getElementById('univDeck');
    deck.innerHTML = '';
    slots.forEach((slot, i) => {
        const slide = document.createElement('div');
        slide.className = 'univ-slide';
        slide.appendChild(slot.cloneNode(true));
        if (cards[i]) {
            slide.appendChild(cards[i].cloneNode(true));
        } else {
            const ph = document.createElement('div');
            ph.className = 'analysis-card';
            ph.style.cssText = 'text-align:center; padding:30px; color:#94a3b8; font-size:0.9rem;';
            ph.innerHTML = '<i class="fas fa-info-circle" style="font-size:1.4rem; margin-bottom:8px;"></i><br>이 슬롯에 대학을 추가하면<br>분석 결과가 표시됩니다.';
            slide.appendChild(ph);
        }
        deck.appendChild(slide);
    });

    // 인디케이터 (현재 슬라이드 위치)
    if (!deck._indicatorBound) {
        const indEl = document.getElementById('univDeckIndicator');
        const updateInd = () => {
            const w = deck.clientWidth;
            if (w <= 0 || !indEl) return;
            const idx = Math.round(deck.scrollLeft / w);
            indEl.textContent = `${Math.min(idx + 1, slots.length)} / ${slots.length}`;
        };
        deck.addEventListener('scroll', updateInd, { passive: true });
        deck._indicatorBound = true;
        updateInd();
    } else {
        // 슬라이드 수 변경 시 인디케이터도 즉시 갱신
        const indEl = document.getElementById('univDeckIndicator');
        if (indEl) indEl.textContent = `${Math.min(Math.round(deck.scrollLeft / Math.max(deck.clientWidth, 1)) + 1, slots.length)} / ${slots.length}`;
    }

    // 저장 버튼을 deck 하단으로 이동 (1회만)
    const saveBtn = document.getElementById('btnSaveTarget');
    const bottomBar = document.getElementById('univDeckBottomBar');
    if (saveBtn && bottomBar && saveBtn.parentNode !== bottomBar) {
        bottomBar.appendChild(saveBtn);
    }

    // 원본 컨테이너/헤더/구분선 모바일에서 숨김
    // - #univAnalysisResult 통째로 숨김 (그 안의 examSelector chip + cards container 모두 deck로 대체됨)
    univGrid.style.display = 'none';
    const univAnalysisResult = document.getElementById('univAnalysisResult');
    if (univAnalysisResult) univAnalysisResult.style.display = 'none';
    document.querySelectorAll('#sol-univ .univ-sub-header, #sol-univ hr.divider').forEach(el => el.style.display = 'none');
}

// ============================================================
// 모바일 스와이프 가능 힌트 (1회, surface별 LocalStorage 플래그)
// ============================================================
const SWIPE_HINT_VERSION = 'v1';
const SWIPE_HINT_PREFERS_REDUCED = (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

function _swipeHintIsMobile() { return window.innerWidth <= 768; }
function _swipeHintAlreadyShown(key) {
    try { return !!localStorage.getItem(`swipeHint_${SWIPE_HINT_VERSION}_${key}`); } catch { return false; }
}
function _swipeHintMark(key) {
    try { localStorage.setItem(`swipeHint_${SWIPE_HINT_VERSION}_${key}`, '1'); } catch { /* 무시 */ }
}
function _swipeHintScrollable(el) {
    return el && el.scrollWidth > el.clientWidth + 4;
}

function _swipeHintShowChevron(container) {
    if (!container) return;
    const parent = container.parentElement || container;
    if (parent !== container && getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
    }
    const chev = document.createElement('div');
    chev.className = 'swipe-hint-chevron';
    chev.innerHTML = '<i class="fas fa-chevron-right"></i>';
    parent.appendChild(chev);
    const cleanup = () => chev.remove();
    chev.addEventListener('animationend', cleanup);
    container.addEventListener('scroll', cleanup, { once: true, passive: true });
}

function _swipeHintBump(container, peek = 28, durationMs = 700) {
    return new Promise(resolve => {
        if (!container) return resolve();
        const startTime = performance.now();
        let cancelled = false;
        const cancel = () => { cancelled = true; container.scrollLeft = 0; };
        container.addEventListener('touchstart', cancel, { passive: true, once: true });
        container.addEventListener('wheel', cancel, { passive: true, once: true });

        function step(now) {
            if (cancelled) return resolve();
            const t = Math.min(1, (now - startTime) / durationMs);
            // 0 → peak at t=0.42 → 0
            const peak = 0.42;
            const phase = t < peak ? (t / peak) : (1 - (t - peak) / (1 - peak));
            const ease = 1 - Math.pow(1 - phase, 3);
            container.scrollLeft = Math.round(ease * peek);
            if (t < 1) requestAnimationFrame(step);
            else { container.scrollLeft = 0; resolve(); }
        }
        requestAnimationFrame(step);
    });
}

async function maybeShowSwipeHint(selector, hintKey) {
    const debug = (() => { try { return !!localStorage.getItem('DEV_LOG_SWIPE_HINT'); } catch { return false; } })();
    const mobile = _swipeHintIsMobile();
    const hinted = _swipeHintAlreadyShown(hintKey);
    const el = document.querySelector(selector);
    const scrollable = _swipeHintScrollable(el);
    if (debug) console.log('[swipeHint]', { selector, hintKey, mobile, hinted, scrollable, elFound: !!el });
    if (!mobile) return;
    if (hinted) return;
    if (!el) return;
    if (!scrollable) return;
    _swipeHintMark(hintKey);
    _swipeHintShowChevron(el);
    if (!SWIPE_HINT_PREFERS_REDUCED) await _swipeHintBump(el);
}

// 디버그: 콘솔에서 모든 swipeHint 플래그 리셋 (재검증용)
window.resetSwipeHints = function () {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('swipeHint_')) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
        console.log(`[swipeHint] reset ${keys.length} keys:`, keys);
    } catch (e) { console.error(e); }
};

// 탭별 1순위 surface 매핑
const SWIPE_HINT_SURFACES = {
    univ:  { selector: '#analysisCardsContainer', key: 'univ_cards' },
    sim:   { selector: '.sim-detail-card-area',   key: 'sim_detail_cards' },
    // coach/pro 등은 추후 (해당 영역 스크롤 컨테이너 도입 시 매핑)
};

function triggerSwipeHintForTab(tabType) {
    if (!_swipeHintIsMobile()) return;
    const cfg = SWIPE_HINT_SURFACES[tabType];
    if (!cfg) return;
    // 800ms 지연: 사용자 시선이 콘텐츠에 안착하는 타이밍 + 렌더 완료 보장
    setTimeout(() => maybeShowSwipeHint(cfg.selector, cfg.key), 800);
}

// 시뮬 카드 안 과목 스와이프는 시뮬 카드 진입 2초 후 1회 (renderDetailedSimCard 끝에서 호출)
function triggerSubjScrollHintOnce() {
    if (!_swipeHintIsMobile()) return;
    setTimeout(() => maybeShowSwipeHint('.subj-scroll-container', 'sim_subj_scroll'), 2000);
}

// 솔루션 탭 간 좌우 전환은 페이지 첫 진입 시 1회 (DOMContentLoaded 800ms 후)
function triggerSolutionTabHintOnce() {
    if (!_swipeHintIsMobile()) return;
    setTimeout(() => maybeShowSwipeHint('.sol-swipe-wrapper', 'solution_tabs'), 1200);
}

function checkMbtiReport(data) {
    const container = document.getElementById('mbtiReportContainer');
    if (!container) return;
    const mbti = getUserMbti(data);
    if (!mbti) { container.innerHTML = ''; return; }
    
    container.innerHTML = `
        <button onclick="downloadMbtiReport('${mbti}')" id="mbtiDownBtn" class="btn-go-survey" style="background-color: #10b981; color: white; border: none; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">
            <i class="fas fa-file-download"></i> [${escapeHtml(mbti)}] 보고서 다운받기
        </button>`;
}

function getUserMbti(data) {
    const rawMbti = data?.mbti || data?.qualitative?.mbti;
    if (rawMbti && /^[A-Z]{4}$/i.test(String(rawMbti).trim())) {
        return String(rawMbti).trim().toUpperCase();
    }

    const promo = data?.promoCode;
    if (!promo || !promo.includes("-STC")) return '';

    const hex = promo.replace("-STC", "").replace("-", "");
    let decoded = '';
    for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substr(i, 2), 16);
        if (!Number.isFinite(code)) return '';
        decoded += String.fromCharCode(code);
    }
    return /^[A-Z]{4}$/i.test(decoded) ? decoded.toUpperCase() : '';
}

async function downloadMbtiReport(mbtiType) {
    const mbti = String(mbtiType || '').trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(mbti)) {
        alert("MBTI 결과를 확인할 수 없습니다.");
        return;
    }

    const btn = document.getElementById('mbtiDownBtn');
    if (btn) { btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 발급 중...`; btn.disabled = true; }

    const newWindow = window.open('about:blank', '_blank');

    try {
        const res = await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_mbti_pdf_url', mbtiType: mbti })
        });
        const data = await res.json();
        
        if (res.ok && data.success && data.downloadUrl) {
            newWindow.location.href = data.downloadUrl;
        } else {
            newWindow.close();
            alert(data.error || "보고서 발급에 실패했습니다.");
        }
    } catch (e) {
        newWindow.close();
        alert("서버 통신 오류가 발생했습니다.");
    } finally {
        if (btn) { btn.innerHTML = `<i class="fas fa-file-download"></i> [${escapeHtml(mbti)}] 보고서 다운받기`; btn.disabled = false; }
    }
}

// [추가] 메인 탭 좌우 스와이프 동적 안내 헬퍼 함수
function updateMainSwipeHint(type) {
    const hintDiv = document.getElementById('mainSwipeHint');
    if (!hintDiv) return;
    
    const tabs = [
        { id: 'univ', name: '목표대학' },
        { id: 'sim', name: '시뮬레이션' },
        { id: 'coach', name: '플래너 코칭' },
        { id: 'pro', name: 'PRO 분석' }
    ];
    const idx = tabs.findIndex(t => t.id === type);
    if (idx === -1) return;

    let leftText = idx > 0 ? `<i class="fas fa-chevron-left swipe-arrow swipe-arrow-left"></i> ${tabs[idx-1].name}` : '';
    let rightText = idx < tabs.length - 1 ? `${tabs[idx+1].name} <i class="fas fa-chevron-right swipe-arrow swipe-arrow-right"></i>` : '';

    hintDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; max-width:340px; margin:0 auto; font-weight:600; color:#94a3b8;">
            <div style="flex:1; text-align:left; font-size:0.85rem; color:#64748b;">${leftText}</div>
            <div style="flex:0 0 auto; font-size:0.72rem; color:#cbd5e1; font-weight:normal; margin:0 10px;">메뉴 스와이프</div>
            <div style="flex:1; text-align:right; font-size:0.85rem; color:#64748b;">${rightText}</div>
        </div>
    `;
}

// [추가] 시뮬레이션 대학 카드 좌우 스와이프 동적 안내 헬퍼 함수
function updateSimCardSwipeHint(index) {
    const hintDiv = document.getElementById('simCardSwipeHint');
    if (!hintDiv || simDisplayList.length <= 1) return;

    let leftName = index > 0 && simDisplayList[index - 1] ? escapeHtml(simDisplayList[index - 1].univ.replace('학교', '')) : '';
    let rightName = index < simDisplayList.length - 1 && simDisplayList[index + 1] ? escapeHtml(simDisplayList[index + 1].univ.replace('학교', '')) : '';

    let leftHtml = leftName ? `<i class="fas fa-chevron-left"></i> ${leftName}` : '';
    let rightHtml = rightName ? `${rightName} <i class="fas fa-chevron-right"></i>` : '';

    hintDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:700; color:#475569;">
            <div style="flex:1; text-align:left; font-size:0.9rem; color:#ea580c;">${leftHtml}</div>
            <div style="flex:0 0 auto; color:#94a3b8; font-size:0.75rem; font-weight:normal; margin:0 10px;">다른 대학 보기</div>
            <div style="flex:1; text-align:right; font-size:0.9rem; color:#ea580c;">${rightHtml}</div>
        </div>
    `;
}

// ------------------------------------------------------------
// [기능 1] 목표대학 설정
// ------------------------------------------------------------
function initUnivGrid() {
    const grid = document.getElementById('univGrid');
    if(!grid) return;
    grid.innerHTML = ''; 
    
    const isUnlimited = ['standard', 'pro'].includes(currentUserTier);
    const isQuotaZero = !isUnlimited && (univChangeRemaining <= 0);
    
    // 💡 [핵심] Free, Trial 유저인지 확인
    const isLockedTier = ['free', 'trial'].includes(currentUserTier);

    for (let i = 0; i < 6; i++) {
        // 💡 5, 6지망(인덱스 4, 5) 잠금 여부 판별
        const isThisSlotLocked = isLockedTier && (i >= 4);

        const savedData = userTargetUnivs[i] || { univ: '', major: '', date: null };
        const slotDiv = document.createElement('div');
        slotDiv.className = 'univ-slot';
        
        slotDiv.style.position = 'relative';
        slotDiv.style.alignSelf = 'start'; 
        slotDiv.style.height = 'max-content'; 
        
        // 💡 잠긴 슬롯이면 CSS locked-tier 클래스 추가 (자물쇠 UI)
        if (isThisSlotLocked) {
            slotDiv.classList.add('locked-tier');
            slotDiv.setAttribute('data-msg', '🔒 Basic 멤버십 이상 지원');
        }

        const safeUniv = escapeHtml(savedData.univ);
        const safeMajor = escapeHtml(savedData.major);
        // 잠긴 슬롯은 무조건 데이터 없는 것으로 처리
        const hasData = isThisSlotLocked ? false : !!(savedData.univ && savedData.major); 
        
        const btnText = hasData ? `<strong>${safeUniv}</strong><br><small>${safeMajor}</small>` : `<span class="placeholder">대학 및 학과를 선택하세요</span>`;
        const clickHandler = (isQuotaZero || isThisSlotLocked) ? '' : `openUnivSelectModal(${i})`;
        const cursorStyle = (isQuotaZero || isThisSlotLocked) ? 'cursor:not-allowed; opacity:0.8; background-color:#f1f5f9;' : '';
        const iconHtml = (isQuotaZero || isThisSlotLocked) ? '<i class="fas fa-lock" style="color:#ef4444;"></i>' : '<i class="fas fa-chevron-right"></i>';
        const deleteBtnHtml = hasData ? `<button class="univ-delete-btn" onclick="clearUnivSlot(${i})" title="대학 삭제"><i class="fas fa-times"></i></button>` : '';

        slotDiv.innerHTML = `
            <label>지망 ${i+1}</label>
            ${deleteBtnHtml}
            <button type="button" class="univ-select-btn" onclick="${clickHandler}" style="${cursorStyle}" ${(isQuotaZero || isThisSlotLocked) ? 'disabled' : ''}>
                <div style="flex:1; min-width:0; text-align: left;">${btnText}</div>
                <div style="flex-shrink:0;">${iconHtml}</div>
            </button>
        `;
        grid.appendChild(slotDiv);
    }
    
    if (window.innerWidth <= 768) {
        // deck 모드에서는 안내 문구 불필요 (인디케이터로 대체)
        const old = document.getElementById('univGridSwipeHint');
        if (old) old.remove();
    }
    // 슬롯 재렌더 후 모바일 deck도 즉시 재구성
    renderUnivDeck();
}

function clearUnivSlot(index) {
    const isBasic = ['free', 'basic', 'trial'].includes(currentUserTier);
    const msg = isBasic ? `${index + 1}지망 대학을 삭제하시겠습니까?\n(대학을 삭제하는 것은 횟수가 차감되지 않습니다.\n삭제 후 하단의 '저장하기'를 눌러야 반영됩니다.)`
                        : `${index + 1}지망 대학을 삭제하시겠습니까?\n(삭제 후 하단의 '저장하기'를 눌러야 반영됩니다.)`;
    if (confirm(msg)) {
        userTargetUnivs[index] = null; 
        initUnivGrid(); 
    }
}

function updateQuotaUI() {
    const container = document.getElementById('univQuotaContainer');
    if (!container) return;

    if (currentUserTier === 'standard' || currentUserTier === 'pro') {
        container.innerHTML = `<div class="quota-info-box" style="background:#f0fdf4; border-color:#bbf7d0; color:#166534; flex-wrap:wrap; gap:8px;">
            <span><i class="fas fa-check-circle"></i> Standard/Pro 멤버십 혜택</span>
            <span style="font-weight:bold;">목표대학 무제한 설정 가능</span>
        </div>`;
        return;
    }

    const isZero = univChangeRemaining <= 0;
    
    // 💡 Trial 티어일 경우의 UI 처리 (변수 선언 오류 수정)
    if (currentUserTier === 'trial') {
        let graceText = "";
        if (isZero && userGracePeriodUntil && new Date() <= new Date(userGracePeriodUntil)) {
            const diffMs = new Date(userGracePeriodUntil) - new Date();
            const diffHrs = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
            graceText = `<div style="width: 100%; text-align: right; font-size:0.85rem; color:#ef4444; margin-top:5px; font-weight:bold;">⏳ ${diffHrs}시간 후 무료 등급으로 전환됩니다.</div>`;
        }

        let html = `<div class="quota-info-box" style="background:#fdf4ff; border-color:#e879f9; flex-wrap:wrap; gap:8px;">
            <span><i class="fas fa-gift"></i> 신규 가입 무료 체험 혜택</span>
            <span><strong class="remain-count" style="font-size:1.2rem; color:#c026d3;">${univChangeRemaining}</strong> / 4회</span>
            ${graceText}
        </div>`;
    
        if (isZero) {
            html += `<div class="upgrade-promo-banner" style="border-color:#fb923c; background:#fffaf0; flex-wrap:wrap; gap:12px;">
                <div style="flex:1; min-width:240px; word-break:keep-all;">
                    <p style="margin:0; font-size:0.9rem; line-height:1.5;">무료 체험이 종료되었습니다.<br>Standard 멤버십으로 <strong>무제한 대학 분석</strong>을 이용해보세요.</p>
                </div>
                <button class="upgrade-btn-small" style="background:#ea580c; margin:0; flex:1; min-width:140px; padding:12px;" onclick="location.href='/payment'">멤버십 알아보기</button>
            </div>`;
        }
        container.innerHTML = html;
        return;
    }

    // 💡 Basic / Free 티어일 경우의 UI 처리
    const isWarning = univChangeRemaining < 10;
    const isUpsell = univChangeRemaining <= 5;
    
    let boxStyle = ''; let textColor = '#2563eb';
    if (isZero) { boxStyle = 'background:#fef2f2; border-color:#fecaca;'; textColor = '#ef4444'; }
    else if (isWarning) { boxStyle = 'background:#fff7ed; border-color:#fed7aa;'; textColor = '#ea580c'; }

    let html = `<div class="quota-info-box" style="${boxStyle} flex-wrap:wrap; gap:8px;">
        <span><i class="fas fa-ticket-alt"></i> 목표대학 설정 잔여 횟수</span>
        <span><strong class="remain-count" style="font-size:1.2rem; color:${textColor};">${univChangeRemaining}</strong> / 30회</span>
    </div>`;

    if (isUpsell) {
        const bannerStyle = isZero ? 'border-color:#ef4444; background:#fef2f2;' : 'border-color:#fb923c; background:#fffaf0;';
        const btnStyle = isZero ? 'background:#ef4444;' : 'background:#ea580c;';
        const msg = isZero ? '⛔ <strong>목표대학 설정 횟수가 모두 소진되었습니다!</strong>' : `⚠️ <strong>설정 가능 횟수가 ${univChangeRemaining}회밖에 남지 않았습니다!</strong>`;
        
        html += `<div class="upgrade-promo-banner" style="${bannerStyle} flex-wrap:wrap; gap:12px;">
            <div style="flex:1; min-width:240px; word-break:keep-all;">
                <p style="margin:0; font-size:0.9rem; line-height:1.5;">${msg}<br>Standard 멤버십으로 업그레이드하고 <strong>무제한 대학 분석</strong>을 이용해보세요.</p>
            </div>
            <button class="upgrade-btn-small" style="${btnStyle} margin:0; flex:1; min-width:140px; padding:12px;" onclick="location.href='/payment'">멤버십 알아보기</button>
        </div>`;
    }
    container.innerHTML = html;
}

// ============================================================
// [추천대학] 모달 내 추천대학/학과 선택
// ============================================================
function calcTotalStdScore(scoreData) {
    const korStd = parseFloat(scoreData?.kor?.std) || 0;
    const mathStd = parseFloat(scoreData?.math?.std) || 0;
    const inq1Std = parseFloat(scoreData?.inq1?.std) || 0;
    const inq2Std = parseFloat(scoreData?.inq2?.std) || 0;
    return korStd + mathStd + inq1Std + inq2Std;
}

function inferStream(scoreData) {
    const mathOpt = (scoreData?.math?.opt || '').replace(/\s/g, '');
    const inq1Name = (scoreData?.inq1?.name || '').replace(/\s/g, '');
    const inq2Name = (scoreData?.inq2?.name || '').replace(/\s/g, '');
    const sciSubjects = ['물리학','화학','생명과학','지구과학'];
    const hasSci = [inq1Name, inq2Name].some(n => sciSubjects.some(s => n.includes(s)));
    const isMijet = mathOpt.includes('미적분') || mathOpt.includes('기하');
    if (isMijet || hasSci) return 'natural';
    return 'humanities';
}

async function handleRecommendUniv() {
    const btn = document.getElementById('recommendBtn');
    if (!btn || btn.disabled) return;

    const scoreData = userQuantData?.[currentExamMode];
    if (!scoreData) {
        alert('성적 데이터가 없습니다. 기초조사서를 먼저 작성해주세요.');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 추천 중...';

    try {
        const totalStdScore = calcTotalStdScore(scoreData);
        const stream = userStream || inferStream(scoreData);

        const res = await apiFetch(UNIV_DATA_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'get_tutorial_recommendations',
                userScores: scoreData,
                stream: stream,
                totalStdScore: totalStdScore,
                examMode: currentExamMode
            })
        });

        const data = await res.json();
        const selected = data.selected || [];

        if (selected.length === 0) {
            alert('추천할 수 있는 대학이 없습니다.');
            return;
        }

        // 이미 등록된 대학 제외 (없으면 원본 사용)
        const existingKeys = new Set(
            (userTargetUnivs || []).filter(t => t && t.univ).map(t => `${t.univ}||${t.major}`)
        );
        const available = selected.filter(s => !existingKeys.has(`${s.school}||${s.major}`));
        const uniqueMap = new Map();
        available.forEach(item => uniqueMap.set(`${item.school}||${item.major}`, item));
        if (uniqueMap.size < 3) {
            selected.forEach(item => {
                if (uniqueMap.size >= 3) return;
                const key = `${item.school}||${item.major}`;
                if (!uniqueMap.has(key)) uniqueMap.set(key, item);
            });
        }
        recommendedUnivCandidates = Array.from(uniqueMap.values()).slice(0, 3);
        const shortageMessage = (recommendedUnivCandidates.length < 3)
            ? `기준을 충족하는 대학이 부족해 ${recommendedUnivCandidates.length}개만 추천합니다.`
            : '';
        showRecommendedUnivChoices(recommendedUnivCandidates, shortageMessage);
    } catch(e) {
        console.error('추천대학 API 오류:', e);
        alert('추천 중 오류가 발생했습니다.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-magic"></i> 추천대학/학과';
    }
}

function showRecommendedUnivChoices(candidates, shortageMessage = '') {
    const modalTitle = document.getElementById('modalTitle');
    const listContainer = document.getElementById('stepUnivList');
    const majorList = document.getElementById('stepMajorList');
    const footer = document.getElementById('modalFooter');
    const backBtn = footer ? footer.querySelector('.back-step-btn') : null;
    const searchBox = document.querySelector('.modal-search-box');

    currentSelectStep = 'recommend';
    if (modalTitle) modalTitle.innerText = '추천 대학/학과 선택';
    if (searchBox) searchBox.style.display = 'none';
    if (majorList) majorList.style.display = 'none';
    if (listContainer) listContainer.style.display = 'grid';
    if (footer) footer.style.display = 'flex';
    if (backBtn) backBtn.innerText = '← 전체 대학 목록 보기';

    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!Array.isArray(candidates) || candidates.length === 0) {
        listContainer.innerHTML = '<div class="empty-search-result"><i class="fas fa-exclamation-circle" style="font-size:2.2rem; color:#cbd5e1;"></i>추천 결과가 없습니다. 다시 시도해주세요.</div>';
        return;
    }

    const frag = document.createDocumentFragment();
    if (shortageMessage) {
        const note = document.createElement('div');
        note.style.gridColumn = '1 / -1';
        note.style.marginBottom = '6px';
        note.style.padding = '10px 12px';
        note.style.border = '1px solid #fde68a';
        note.style.background = '#fffbeb';
        note.style.borderRadius = '10px';
        note.style.color = '#92400e';
        note.style.fontSize = '0.86rem';
        note.style.fontWeight = '600';
        note.textContent = shortageMessage;
        frag.appendChild(note);
    }
    candidates.forEach((item, idx) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'selection-item selection-item-recommend';
        card.innerHTML = `<span class="recommend-rank">추천 ${idx + 1}</span><strong>${item.school}</strong><em>${item.major}</em>`;
        card.onclick = () => selectComplete(item.school, item.major);
        frag.appendChild(card);
    });
    listContainer.appendChild(frag);
}

function closeUnivModal() {
    document.getElementById('univSelectModal').style.display = 'none';

    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('top');
    window.scrollTo(0, scrollPosition);

    currentSlotIndex = null; selectedUnivForMajor = ''; recommendedUnivCandidates = [];
}

function applySafeHighlight(container, text, keyword) {
    if (!keyword) {
        container.textContent = text;
        return;
    }
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    parts.forEach(part => {
        if (part.toLowerCase() === keyword.toLowerCase()) {
            const b = document.createElement('strong');
            b.style.cssText = 'color:#2563EB; font-weight:900;';
            b.textContent = part;
            container.appendChild(b);
        } else {
            container.appendChild(document.createTextNode(part));
        }
    });
}

function openUnivSelectModal(index) {
    currentSlotIndex = index;
    const modal = document.getElementById('univSelectModal');
    modal.style.display = 'block';
    scrollPosition = window.pageYOffset || document.documentElement.scrollTop;

    document.body.classList.add('modal-open');
    document.body.style.top = `-${scrollPosition}px`;

    const searchInput = document.getElementById('univSearchInput');
    if(searchInput) searchInput.value = '';

    document.getElementById('stepUnivList').innerHTML = '<div style="padding:50px; text-align:center; color:#94a3b8; grid-column: 1/-1;"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>대학 목록을 불러오는 중...</div>';

    const recommendWrap = document.getElementById('recommendBtnWrap');
    if (recommendWrap) {
        recommendWrap.style.display = (userQuantData && userQuantData[currentExamMode]) ? 'flex' : 'none';
    }

    showUnivStep(true);
}

function showUnivStep(isDeferred = false) {
    currentSelectStep = 'univ'; selectedUnivForMajor = '';
    document.getElementById('modalTitle').innerText = "대학 선택";
    
    const listEl = document.getElementById('stepUnivList');
    listEl.style.display = 'grid';
    listEl.style.pointerEvents = 'none'; 
    
    document.getElementById('stepMajorList').style.display = 'none';
    document.getElementById('modalFooter').style.display = 'none';
    const searchBox = document.querySelector('.modal-search-box');
    if (searchBox) searchBox.style.display = 'block';
    const backBtn = document.querySelector('#modalFooter .back-step-btn');
    if (backBtn) backBtn.innerText = '← 대학 다시 선택';

    const searchInput = document.getElementById('univSearchInput');
    if(searchInput) { searchInput.placeholder = "대학명 검색 (예: 서울대, 연세)"; searchInput.value = ''; }

    if (isDeferred) {
        setTimeout(() => { 
            renderUnivList(''); 
            setTimeout(() => { listEl.style.pointerEvents = 'auto'; }, 300);
        }, 50);
    } else {
        renderUnivList('');
        setTimeout(() => { listEl.style.pointerEvents = 'auto'; }, 300);
    }
}

function showMajorStep(univName) {
    currentSelectStep = 'major'; selectedUnivForMajor = univName;
    document.getElementById('modalTitle').innerText = `${univName} - 학과 선택`;
    document.getElementById('stepUnivList').style.display = 'none';
    
    const listEl = document.getElementById('stepMajorList');
    listEl.style.display = 'grid';
    listEl.style.pointerEvents = 'none'; 
    
    document.getElementById('modalFooter').style.display = 'flex';

    const searchInput = document.getElementById('univSearchInput');
    if(searchInput) { searchInput.placeholder = "학과명 검색 (예: 컴퓨터, 경영)"; searchInput.value = ''; }
    const searchBox = document.querySelector('.modal-search-box');
    if (searchBox) searchBox.style.display = 'block';
    const backBtn = document.querySelector('#modalFooter .back-step-btn');
    if (backBtn) backBtn.innerText = '← 대학 다시 선택';

    listEl.innerHTML = '<div style="padding:50px; text-align:center; color:#94a3b8; grid-column: 1/-1;"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>학과 목록을 불러오는 중...</div>';
    
    setTimeout(() => { 
        renderMajorList(univName, ''); 
        setTimeout(() => { 
            listEl.style.pointerEvents = 'auto'; 
        }, 300);
    }, 30);
}

function renderUnivList(filterText) {
    const listContainer = document.getElementById('stepUnivList');
    listContainer.innerHTML = ''; 
    
    const allUnivs = Object.keys(univMap).sort();
    const filteredUnivs = allUnivs.filter(u => u.toLowerCase().includes(filterText));

    if (filteredUnivs.length === 0) {
        listContainer.innerHTML = '<div class="empty-search-result"><i class="fas fa-search" style="font-size:2.5rem; color:#cbd5e1;"></i>찾으시는 대학이 없습니다.</div>';
        return;
    }

    const fragment = document.createDocumentFragment(); 
    filteredUnivs.forEach(univName => {
        const item = document.createElement('div');
        item.className = 'selection-item';
        
        const span = document.createElement('span');
        span.style.cssText = 'word-break: keep-all; line-height: 1.3;';
        applySafeHighlight(span, univName, filterText); 
        
        item.appendChild(span);
        item.onclick = () => showMajorStep(univName);
        fragment.appendChild(item);
    });
    listContainer.appendChild(fragment);
}

function renderMajorList(univName, filterText) {
    const listContainer = document.getElementById('stepMajorList');
    listContainer.innerHTML = '';
    const majors = univMap[univName] || [];
    const filteredMajors = [...majors].sort((a,b) => a.name.localeCompare(b.name)).filter(m => m.name.toLowerCase().includes(filterText));

    if (filteredMajors.length === 0) {
        listContainer.innerHTML = '<div class="empty-search-result"><i class="fas fa-search" style="font-size:2.5rem; color:#cbd5e1;"></i>찾으시는 학과가 없습니다.</div>';
        return;
    }

    const fragment = document.createDocumentFragment(); 
    filteredMajors.forEach(majorObj => {
        const item = document.createElement('div'); 
        item.className = 'selection-item';

        const span = document.createElement('span');
        span.style.cssText = 'word-break: keep-all; line-height: 1.3;';
        applySafeHighlight(span, majorObj.name, filterText);

        item.appendChild(span);
        item.onclick = () => selectComplete(univName, majorObj.name);
        fragment.appendChild(item);
    });
    listContainer.appendChild(fragment);
}

function handleModalSearch(e) {
    const text = e.target.value.trim().toLowerCase();
    if (currentSelectStep === 'univ') renderUnivList(text);
    else if (currentSelectStep === 'major') renderMajorList(selectedUnivForMajor, text);
}

function selectComplete(univ, major) {
    if (currentSlotIndex !== null) {
        userTargetUnivs[currentSlotIndex] = { univ: univ, major: major, date: null };
        initUnivGrid();
    }
    closeUnivModal();
}

async function saveTargetUnivs() {
    if (['free', 'basic', 'trial'].includes(currentUserTier)) {
        if(!confirm("목표 대학을 저장하시겠습니까?\n(새로 등록/변경된 대학 수만큼 남은 횟수에서 차감됩니다.)")) return;
    } else {
        if(!confirm("목표 대학을 저장하시겠습니까?")) return;
    }

    const nowISO = new Date().toISOString();
    const newUnivs = [];
    const isLockedTier = ['free', 'trial'].includes(currentUserTier);

    for(let i = 0; i < 6; i++) {
        if (i >= 4 && isLockedTier) {
            newUnivs.push(null);
            continue;
        }

        const slot = userTargetUnivs[i];
        if (slot && slot.univ && slot.major) { 
            newUnivs.push({ univ: slot.univ, major: slot.major, date: slot.date ? slot.date : nowISO });
        } else { newUnivs.push(null); }
    }
    
    const userId = localStorage.getItem('userId');
    
    try {
        const response = await apiFetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'update_target_univs', userId: userId, data: newUnivs })
        });
        const resData = await response.json();
        if(response.ok) { 
            let msg = (['free', 'basic', 'trial'].includes(currentUserTier)) 
                ? (resData.changedCount > 0 ? `저장되었습니다. (차감 횟수: ${resData.changedCount}회, 남은 횟수: ${resData.remainCount}회)` : "저장되었습니다. (변경된 내용 없음)")
                : "목표 대학이 성공적으로 저장되었습니다.";
            alert(msg); location.reload(); 
        } else { throw new Error(resData.error || "저장 실패"); }
    } catch(e) { alert(e.message || "통신 오류 발생"); }
}

// ============================================================
// [기능 2] 목표대학 분석 리포트
// ============================================================
async function updateAnalysisUI() {
    const container = document.getElementById('univAnalysisResult');
    if (!container) return;

    if (window.DEV_MOCK?.enabled) {
        const cardsHtml = window.DEV_MOCK.analysis.cards.map(renderAnalysisCard).join('');
        container.innerHTML = `<div class="analysis-cards-wrapper">${cardsHtml}</div>`;
        return;
    }

    const hasTargets = userTargetUnivs && userTargetUnivs.some(u => u && u.univ);
    const availableExams = getAvailableExamModes();
    const userId = localStorage.getItem('userId');

    if (!hasTargets || availableExams.length === 0) { 
        container.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:40px; color:#64748b; background:#f8fafc; border-radius:12px;">
                <i class="fas fa-exclamation-circle fa-2x" style="margin-bottom:10px; color:#94a3b8;"></i><br>
                목표 대학을 설정하고 성적표를 입력해주세요.
            </div>`; 
        return; 
    }
    
    ensureValidExamMode(userId);

    const selectorHTML = `
        <div class="analysis-controls" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-bottom:20px; background:#fff; padding:15px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05); border:1px solid #e2e8f0;">
            <div style="font-weight:700; color:#334155; font-size:1rem;">
                <i class="fas fa-chart-pie" style="color:#3b82f6; margin-right:6px;"></i> 합격 예측 리포트
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <label for="examSelector" style="font-size:0.85rem; color:#64748b; font-weight:500; white-space:nowrap;">기준 시험:</label>
                <select id="examSelector" onchange="changeExamMode(this.value)" style="padding:6px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem; color:#1e293b; outline:none; cursor:pointer; font-family:inherit; background-color:#f8fafc; max-width: 150px; text-overflow: ellipsis;">
                    ${availableExams.map(key => `<option value="${key}" ${key === currentExamMode ? 'selected' : ''}>${EXAM_DISPLAY_NAMES[key] || key.toUpperCase()}</option>`).join('')}
                </select>
            </div>
        </div>
        <div id="analysisCardsContainer" style="display: flex; flex-direction: column; gap: 20px;">
            <div style="padding:60px; text-align:center; color:#3b82f6;">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p style="margin-top:15px; font-weight:600;">${EXAM_DISPLAY_NAMES[currentExamMode]} 기준으로<br>분석 중입니다...</p>
            </div>
        </div>
    `;
    container.innerHTML = selectorHTML;
    
    const cardsContainer = document.getElementById('analysisCardsContainer');
    const currentScoreData = userQuantData[currentExamMode];

    try {
        const res = await apiFetch(UNIV_DATA_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'analyze_my_targets', userId: userId, targetUnivs: userTargetUnivs, userScores: currentScoreData, examMode: currentExamMode
            })
        });
        const data = await res.json();

        // 💡 [수정] 서버 데이터 배열 추출 로직 안정화
        const results = Array.isArray(data) ? data : (data.results || data.data || []);

        if (results.length === 0) {
            cardsContainer.innerHTML = `<div style="text-align:center; padding:40px;">분석 가능한 결과가 없습니다.</div>`;
        } else {
            cardsContainer.innerHTML = results.map(item => renderAnalysisCard(item)).join('');
            // 카드 컨테이너가 이제 막 DOM에 채워졌으니 univ 탭 힌트 재시도 (DOMContentLoaded 시점엔 아직 비어있었을 수 있음)
            if (window.innerWidth <= 768) triggerSwipeHintForTab('univ');
        }
        // 모바일 deck도 카드 새 데이터로 즉시 재구성
        renderUnivDeck();

        if (window.innerWidth <= 768) {
            setTimeout(syncMobileHeight, 150); // 렌더링 후 높이 재조정
        }
    } catch (e) {
        console.error("분석 API 호출 중 오류 발생:", e);
        cardsContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#ef4444;">분석 중 오류가 발생했습니다.</div>`;
    }
}

// 사이드바 정량 데이터 디테일 박스 렌더 (모듈 스코프 — changeExamMode 에서도 호출)
function renderSideQuanDetail(examKey) {
    const detailBox = document.getElementById('sideQuanDetail');
    if (!detailBox) return;
    const d = userQuantData ? userQuantData[examKey] : null;
    if (!d) { detailBox.innerHTML = ''; return; }

    const makeRow = (label, obj) => {
        if (!obj) return '';
        let optText = '';
        if (obj.opt && obj.opt !== 'none') {
            optText = `<span class="score-opt">(${escapeHtml(obj.opt)})</span>`;
        } else if (obj.name) {
            optText = `<span class="score-opt">(${escapeHtml(obj.name)})</span>`;
        }
        const grd = obj.grd ? escapeHtml(obj.grd) : '-';
        let pctStr = '';
        if (label !== '영어' && label !== '한국사') {
            const std = escapeHtml(obj.std) || '-';
            const pct = obj.pct ? escapeHtml(obj.pct) + '%' : '-';
            pctStr = `${std} / ${pct}`;
        }
        return `<div class="score-row"><span class="score-subj">${label}${optText}</span><span class="score-nums">${pctStr}</span><span class="score-grd">${grd}</span></div>`;
    };

    let html = '<div class="score-list">';
    html += makeRow('국어', d.kor); html += makeRow('수학', d.math); html += makeRow('영어', d.eng);
    html += makeRow('탐구1', d.inq1); html += makeRow('탐구2', d.inq2);
    html += '</div>';
    detailBox.innerHTML = html;
}

function changeExamMode(mode) {
    currentExamMode = mode;
    persistExamMode(mode);
    // 본문(목표대학/시뮬) ↔ 사이드바 정량 토글 양방향 동기화.
    // 값만 바꾸고 change 이벤트는 dispatch 하지 않음 (onchange → changeExamMode 재귀 방지).
    const sideSel = document.getElementById('sideQuanSelector');
    if (sideSel && sideSel.value !== mode) {
        const hasOption = Array.from(sideSel.options).some(o => o.value === mode);
        if (hasOption) {
            sideSel.value = mode;
            renderSideQuanDetail(mode);
        }
    }
    updateAnalysisUI();
    // 시뮬레이션 차트도 같이 새 examMode 로 즉시 재요청 (한 번이라도 시뮬을 본 적이 있으면).
    // 안 본 사용자는 sim 탭 진입 시 openSolution('sim') → initSimulation 으로 lazy 로드되므로 중복 호출 회피.
    if (Array.isArray(cachedSimData) && cachedSimData.length > 0) {
        cachedSimData = [];
        simDisplayList = [];
        selectedSimIndex = null;
        initSimulation();
    }
}

function renderAnalysisCard(res) {
    if (res.msg.includes("오류") || res.msg.includes("데이터 없음") || res.status === '분석 불가') {
        return `
        <div class="analysis-card">
            <div class="ac-head">
                <span class="ac-rank">${escapeHtml(res.idx + 1)}지망</span>
                <span class="ac-badge" style="background:#94a3b8;">데이터 부족</span>
                <span class="ac-univ">${escapeHtml(res.univ)}</span>
                <span class="ac-major">${escapeHtml(res.major)}</span>
            </div>
            <p style="color:#64748b; font-size:0.9rem; margin:0;">${escapeHtml(res.msg || '해당 학과의 작년 입시 데이터가 없습니다.')}</p>
        </div>`;
    }

    const safeIdx = escapeHtml(res.idx + 1); const safeUniv = escapeHtml(res.univ); const safeMajor = escapeHtml(res.major);
    const safeStatus = escapeHtml(res.status); const safeMsg = escapeHtml(res.msg); const safeScore = escapeHtml(res.converted_score);

    const MAX_SCORE = 250;
    const barWidth = Math.min((res.converted_score / MAX_SCORE) * 100, 100);

    return `
        <div class="analysis-card">
            <div class="ac-head">
                <span class="ac-rank">${safeIdx}지망</span>
                <span class="ac-badge" style="background:${res.color};">${safeStatus}</span>
                <span class="ac-univ">${safeUniv}</span>
                <span class="ac-major">${safeMajor}</span>
            </div>
            <div class="ac-score-row">
                <span class="ac-score-label">AI 환산 진단점수</span>
                <span class="ac-score-value" style="color:${res.color};">${safeScore}<span class="ac-score-unit">점</span></span>
            </div>
            <div class="score-bar-bg" style="position:relative;">
                <div class="score-bar-fill" style="height:100%; width:${barWidth}%; background:${res.color};"></div>
                <!-- 100점(합격), 150점(안정) 기준선 — 0~250 스케일에서 40%, 60% -->
                <span class="score-bar-tick" style="position:absolute; top:-2px; bottom:-2px; left:40%; width:2px; background:#3b82f6; border-radius:1px;"></span>
                <span class="score-bar-tick" style="position:absolute; top:-2px; bottom:-2px; left:60%; width:2px; background:#10b981; border-radius:1px;"></span>
            </div>
            <!-- 축 라벨: 숫자 줄 / 한글 줄 2단으로 겹침 방지 -->
            <div class="ac-axis-nums">
                <span style="position:absolute; left:0;">0</span>
                <span class="ac-axis-100" style="position:absolute; left:40%; transform:translateX(-50%);">100</span>
                <span class="ac-axis-150" style="position:absolute; left:60%; transform:translateX(-50%);">150</span>
                <span style="position:absolute; right:0;">250</span>
            </div>
            <div class="ac-axis-tags">
                <span class="ac-axis-100" style="position:absolute; left:40%; transform:translateX(-50%);">합격</span>
                <span class="ac-axis-150" style="position:absolute; left:60%; transform:translateX(-50%);">안정</span>
            </div>
            <p class="ac-msg-outer" style="font-size:14px; font-weight:600; color:${res.color}; text-align:right; margin:0 0 8px;">${safeMsg}</p>
            <div class="ac-comment-box" style="background:#fff; border-radius:6px; padding:12px 16px; box-shadow:10px 20px 40px rgba(179,179,179,.1);">
                <p style="font-size:15px; font-weight:700; color:#30363e; margin:0 0 6px 0;">#합격 전략 코멘트</p>
                <p class="ac-msg-inner" style="font-size:14px; font-weight:700; color:${res.color}; margin:0 0 6px;">${safeMsg}</p>
                <p style="font-size:15px; color:#30363e; line-height:1.75; margin:0;">${getSimpleAdvice(res.converted_score, res.status)}</p>
            </div>
        </div>`;
}

function getSimpleAdvice(score, status) {
    if (score >= 170) return `<strong>👑 최초 합격 / 장학금 유력</strong> 구간입니다. 더 높은 대학을 과감하게 상향 지원해보는 전략이 필요합니다.`;
    if (score >= 145) return `<strong>매우 안정 (최초합 유력)</strong>입니다. 이 대학을 보험으로 두고 상향 지원 전략을 짜세요.`;
    if (score >= 120) return `<strong>합격 가능성이 높습니다. (안정)</strong> 무난한 합격이 예상됩니다.`;
    if (score >= 100) return `<strong>적정 지원 (추합권)</strong>입니다. 추가 합격 가능성이 높으며 경쟁률 변화를 주시해야 합니다.`;
    if (score >= 85) return `<strong>소신 지원 (문 닫고 입학)</strong> 전략입니다. 불합격 리스크를 감수해야 합니다.`;
    if (score >= 65) return `<strong>상향 지원 (위험)</strong>입니다. 반드시 다른 군에 확실한 안정 카드를 확보하세요.`;
    return `<strong>지원 불가 / 초고위험</strong> 구간입니다. 눈높이를 낮추거나 전형을 변경하는 것을 권장합니다.`;
}

// ============================================================
// [기능 3] 점수 상승 시뮬레이션
// ============================================================
let currentSimChartType = 'bar';
let cachedSimData = [];
let simDisplayList = []; 
let selectedSimIndex = null;

function initSimulation() {
    const chartArea = document.getElementById('simChartArea');
    if (!chartArea) return;

    if (!['trial', 'standard', 'pro'].includes(currentUserTier)) {
        chartArea.innerHTML = `<div style="width:100%; height:100%; min-height: 260px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-weight:600; font-size:1.1rem;">Standard 멤버십 이상 전용 기능입니다.</div>`;
        renderDetailedSimCard(); // 블러 뒤에 나타날 타겟 CTA 렌더링 호출
        return;
    }
    
    if (!userQuantData || Object.keys(userQuantData).length === 0) {
        chartArea.innerHTML = `<div style="width:100%; height:100%; min-height: 200px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:10px; color:#94a3b8;">
            <i class="fas fa-exclamation-circle fa-2x" style="color:#cbd5e1;"></i>
            <span style="font-weight:600;">성적 데이터를 먼저 입력해야 시뮬레이션을 실행할 수 있습니다.</span>
        </div>`;
        return;
    }
    
    if (!ensureValidExamMode()) {
        chartArea.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#94a3b8;">유효한 성적 데이터가 없습니다.</div>`;
        return;
    }

    const validTargets = userTargetUnivs ? userTargetUnivs.filter(t => t && t.univ) : [];
    if (validTargets.length === 0) {
        chartArea.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#94a3b8;">목표 대학을 먼저 설정해주세요.</div>`;
        return;
    }
    
    fetchSimulationData();
}

async function fetchSimulationData() {
    const chartArea = document.getElementById('simChartArea');
    if (!chartArea) return;

    if (window.DEV_MOCK?.enabled) {
        cachedSimData = window.DEV_MOCK.analysis.simData;
        simDisplayList = cachedSimData.map((item, i) => ({ ...item, originalIdx: i }));
        selectedSimIndex = 0;
        renderSimChart();
        return;
    }

    chartArea.innerHTML = '<div style="margin:auto; color:#3b82f6;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    
    const userId = localStorage.getItem('userId');
    
    let scoreData = null;
    if (userQuantData[currentExamMode]) {
        scoreData = JSON.parse(JSON.stringify(userQuantData[currentExamMode]));
    }
    
    try {
        const res = await apiFetch(UNIV_DATA_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'simulate_score_rise', 
                userId: userId, 
                targetUnivs: userTargetUnivs, 
                userScores: scoreData,
                examMode: currentExamMode 
            })
        });
        cachedSimData = await res.json();
        
        if (!res.ok) {
            chartArea.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#ef4444; font-weight:bold;"><i class="fas fa-lock" style="margin-right:8px;"></i> ${cachedSimData.error || "데이터 로드 실패"}</div>`;
            return;
        }

        simDisplayList = [];
        (userTargetUnivs || []).forEach((target, originalIdx) => {
            if (!target || !target.univ) return;
            if (Array.isArray(cachedSimData)) {
                const simItem = cachedSimData.find(d => d && d.univ === target.univ && d.major === target.major);
                if (simItem) {
                    // _uiMode: 'default' | 'loading' | 'backtrace' | 'upsell' (역추적 UX 4-상태)
                    simDisplayList.push({ ...simItem, originalIdx, _uiMode: 'default' });
                } else {
                    simDisplayList.push({ ineligible: true, univ: target.univ, major: target.major, originalIdx, _uiMode: 'default' });
                }
            } else {
                simDisplayList.push({ ineligible: true, univ: target.univ, major: target.major, originalIdx, _uiMode: 'default' });
            }
        });

        // 역추적은 사용자가 CTA 클릭 시점에 lazy 호출 (enrichBacktracePlansIfNeeded 제거)

        if (simDisplayList.length > 0) selectedSimIndex = 0;
        renderSimChart();
        
    } catch (e) { 
        chartArea.innerHTML = '<div style="color:#ef4444; padding:20px; text-align:center;">데이터 로드 실패</div>'; 
        console.error("Simulation Fetch Error:", e);
    }
}

async function enrichBacktracePlansIfNeeded(scoreData, userId) {
    if (!Array.isArray(simDisplayList) || simDisplayList.length === 0) return;
    if (!scoreData) return;

    const candidates = simDisplayList
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => {
            if (!item || item.ineligible || item.backtrace_plan) return false;
            const coreKeys = ['kor', 'math', 'inq1', 'inq2'];
            const maxSingleRise = coreKeys.reduce((acc, key) => {
                const v = Number(item.sim_data?.[key]?.uiDiff || 0);
                return v > acc ? v : acc;
            }, 0);
            const roundedBase = Math.round(Number(item.base_ui_score || 0));
            return roundedBase <= 0 && maxSingleRise < 15;
        });

    if (candidates.length === 0) return;

    await Promise.all(candidates.map(async ({ item, idx }) => {
        try {
            const res = await apiFetch(UNIV_DATA_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'backtrace_required_raw',
                    userId,
                    targetUniv: { univ: item.univ, major: item.major },
                    userScores: scoreData,
                    examMode: currentExamMode,
                    targetUiMin: 100,
                    targetUiMax: 150,
                    maxTotalRaw: 20
                })
            });

            if (!res.ok) return;
            const payload = await res.json();
            const plan = payload?.result || payload?.backtrace_plan || null;
            if (plan) {
                simDisplayList[idx].needs_backtrace = true;
                simDisplayList[idx].backtrace_plan = plan;
            }
        } catch (_) {
            // 역추적 보강은 보조 경로이므로 실패 시 기존 시뮬레이션 렌더링을 유지
        }
    }));
}

function setSimChartType(type) {
    currentSimChartType = type;
    document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
    const btnIdx = type === 'bar' ? 0 : 1;
    document.querySelectorAll('.toggle-btn')[btnIdx].classList.add('active');
    renderSimChart();
}


// ============================================================
// [역추적 UX + sim-card 4-상태] → js/analysis/backtrace.js 로 분리 (2026-06-01)
//   포함: renderSimChart, renderDetailedSimCard, requestBacktrace, goBackFromBacktrace,
//         selectSimUniv, renderSimUnivButtons, updateSimBarGraph, updateSimLineGraph,
//         initSimSvg, createGuideGroup, extractBacktraceRawSnapshot, _findSimItemByOriginalIdx
// ============================================================

// ============================================================
// [코칭 & 주간 학습 점검] → js/analysis/coaching.js 로 분리 (2026-06-01)
//   포함: checkWeeklyStatus, switchWeeklyTab, renderFeedbackList, openFeedbackModal,
//         openWeeklyCheckModal/closeWeeklyModal, addSubjectCard, downloadReportPDF,
//         renderPdfToImages, applyCoachTierLock, getWeekOfMonth/Title/Id 등 30+ 함수
// ============================================================
// ============================================================
// [기능 5] PRO EXCLUSIVE 섹션 렌더링
// ============================================================
function initProSection() {
    const container = document.getElementById('sol-pro');
    if (!container) return;
    if (['pro'].includes(currentUserTier)) renderProDashboard(container);
    else renderProPromo(container);
}

function renderProPromo(container) {
    container.innerHTML = `
        <div style="display: block;">
            <div class="pro-header"><span class="pro-badge">PREMIUM STRATEGY</span><h2 class="pro-title">PRO EXCLUSIVE :<br>최소 학습, 최대 효율</h2><p class="pro-desc">추상적인 조언은 배제합니다. 데이터 기반으로 목표 대학을 향한 최단 경로를 설계하세요.</p></div>
            <div class="pro-promo-grid">
                <div class="pro-feature-card">
                    <span class="feat-icon">📊</span>
                    <div class="feat-text-box">
                        <span class="feat-title">학습 정밀 진단</span>
                        <p class="feat-desc">단순한 착석 시간이 아닌 <strong>유효 학습 시간, 오답 회수율</strong> 등 객관적 지표로 학습 밀도를 진단합니다.</p>
                    </div>
                </div>
                <div class="pro-feature-card">
                    <span class="feat-icon">🎯</span>
                    <div class="feat-text-box">
                        <span class="feat-title">합격 기여도 분석</span>
                        <p class="feat-desc">목표 대학 합격선까지의 부족한 점수(ΔCut)를 파악하고, 점수 상승 <strong>기여도가 가장 높은 과목</strong>을 짚어냅니다.</p>
                    </div>
                </div>
                <div class="pro-feature-card highlight">
                    <span class="feat-icon">⚡</span>
                    <div class="feat-text-box">
                        <span class="feat-title">명확한 Next Step</span>
                        <p class="feat-desc">막연한 조언 대신 특정 인강 수강, 실전 모의고사 등 당장 실행해야 할 <strong>구체적인 행동 지침</strong>을 제시합니다.</p>
                    </div>
                </div>
            </div>
            <button onclick="location.href='/payment'" class="pro-cta-btn">🚀 PRO 멤버십으로<br>업그레이드 하기<div style="font-size:0.8rem; opacity:0.8; margin-top:5px; font-weight:400;">데이터 기반 1:1 맞춤 컨설팅 시작하기</div></button>
        </div>
    `;
}

function generateReportKey(dateObj) {
    const year = dateObj.getFullYear().toString().slice(2); 
    const month = String(dateObj.getMonth() + 1).padStart(2, '0'); 
    const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const dayOfWeek = startOfMonth.getDay(); 
    const offsetDate = dateObj.getDate() + dayOfWeek - 1;
    const weekNum = String(Math.floor(offsetDate / 7) + 1).padStart(2, '0'); 
    return `${year}${month}${weekNum}`;
}

function formatReportKey(key) {
    if (!key || key.length !== 6) return key;
    const yStr = key.substring(0, 2); const mStr = parseInt(key.substring(2, 4), 10); const wStr = parseInt(key.substring(4, 6), 10);
    return `20${yStr}년 ${mStr}월 ${wStr}주차 PRO 분석`;
}

async function renderProDashboard(container) {
    const now = new Date(); const currentKey = generateReportKey(now); 
    const displayDateStr = formatReportKey(currentKey).replace(" PRO 분석", ""); 
    
    let paymentDate = userRecentPaymentDate || new Date();
    let deadlineDate = new Date(paymentDate); deadlineDate.setDate(deadlineDate.getDate() + 7); 
    const daysToSunday = (7 - deadlineDate.getDay()) % 7; deadlineDate.setDate(deadlineDate.getDate() + daysToSunday); deadlineDate.setHours(23, 59, 59, 999);
    let releaseDate = new Date(deadlineDate); releaseDate.setDate(releaseDate.getDate() + 3);

    const isDeadlinePassed = now > deadlineDate;
    const deadlineStr = `${deadlineDate.getMonth() + 1}월 ${deadlineDate.getDate()}일(일) 자정`;
    const releaseStr = `${releaseDate.getMonth() + 1}월 ${releaseDate.getDate()}일(수)`;

    container.innerHTML = `
        <div style="display: block;">
            <div class="pro-header">
                <div style="font-size:2rem; margin-bottom:10px;">🎓</div><h2 class="pro-title">PRO STRATEGY LOUNGE</h2><p class="pro-desc">상위 1%를 위한 프리미엄 분석 센터입니다.<br><strong>${displayDateStr}</strong> 회차 리포트 요청이 진행 중입니다.</p>
                <div style="margin-top:10px; font-size:0.85rem; color:#cbd5e1;"><i class="fas fa-bell" style="color:#fbbf24;"></i> 리포트는 <strong>${releaseStr}</strong>에 일괄 발송됩니다.</div>
            </div>
            <div class="pro-dashboard-layout">
                <div class="dashboard-actions">
                    <div style="color:#bfdbfe; margin-bottom:15px; font-size:0.95rem;">⏳ 요청 마감: <strong>${deadlineStr}</strong> 까지</div>
                    <div id="requestBtnContainer"><button class="req-btn" onclick="openProReportModal()"><i class="fas fa-edit"></i> 분석 요청서 작성하기</button></div>
                </div>
                <div class="report-list-container">
                    <h4 style="color:white; margin:0 0 15px 0;">📑 분석 보고서 보관함</h4>
                    <div id="proReportListArea"><div style="text-align:center; color:#64748b; padding:20px;"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</div></div>
                </div>
            </div>
        </div>
    `;
    renderProReportList(currentKey, isDeadlinePassed);
}

function renderProReportList(currentKey, isDeadlinePassed) {
    const listArea = document.getElementById('proReportListArea');
    const btnContainer = document.getElementById('requestBtnContainer');

    if (cachedProReports.length === 0) {
        listArea.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:30px;">발행된 보고서가 없습니다.</div>`;
    } else {
        const gridDiv = document.createElement('div');
        gridDiv.className = 'report-grid';
        
        cachedProReports.forEach(rep => {
            const hasReportLink = !!(rep.reportLink && String(rep.reportLink).trim() !== '');
            const isReady = (rep.status === 'published' || rep.status === 'sent') && hasReportLink;
            const formattedName = formatReportKey(rep.key);
            const isPublishedNoLink = (rep.status === 'published' || rep.status === 'sent') && !hasReportLink;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'report-item';
            itemDiv.style.cssText = `cursor:${isReady ? 'pointer' : 'default'}; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 15px 12px;`;
            itemDiv.onclick = () => {
                if(isReady) window.open(rep.reportLink);
                else if (isPublishedNoLink) alert('리포트 파일 연결을 준비 중입니다. 잠시 후 다시 확인해주세요.');
                else alert('튜터가 리포트를 최종 검수 중입니다. 잠시만 기다려주세요.');
            };

            const infoDiv = document.createElement('div');
            infoDiv.className = 'rep-info';
            infoDiv.style.cssText = 'flex: 1; min-width: 0;';

            const nameStrong = document.createElement('strong');
            nameStrong.style.cssText = 'display: block; color: #fff; font-size: 0.95rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
            nameStrong.textContent = formattedName; // 🔒 안전

            const statusSpan = document.createElement('span');
            statusSpan.style.cssText = isReady ? 'color:#4ade80; font-size:0.8rem;' : (isPublishedNoLink ? 'color:#93c5fd; font-size:0.8rem;' : 'color:#fbbf24; font-size:0.8rem;');
            statusSpan.textContent = isReady ? '● 열람 가능' : (isPublishedNoLink ? '● 파일 준비중' : '● 분석중'); // 🔒 안전

            infoDiv.appendChild(nameStrong);
            infoDiv.appendChild(statusSpan);

            const iconDiv = document.createElement('div');
            iconDiv.className = 'rep-icon';
            iconDiv.style.cssText = 'flex-shrink: 0;';
            iconDiv.innerHTML = `<i class="fas fa-download" style="color:${isReady ? '#3b82f6' : '#475569'}"></i>`; // 아이콘은 안전

            itemDiv.appendChild(infoDiv);
            itemDiv.appendChild(iconDiv);
            gridDiv.appendChild(itemDiv);
        });
        
        listArea.innerHTML = '';
        listArea.appendChild(gridDiv);
    }

    // 하단 버튼 처리 (기존 코드 유지)
    const currentData = cachedProReports.find(r => r.key === currentKey);
    const hasRequested = currentData && currentData.request;
    window.currentProRequestText = hasRequested ? currentData.request : '';

    if (isDeadlinePassed) {
        btnContainer.innerHTML = `<button class="req-btn disabled" disabled style="background:#e2e8f0; color:#94a3b8; cursor:not-allowed;"><i class="fas fa-lock"></i> 접수 마감됨</button>`;
    } else if (hasRequested) {
        btnContainer.innerHTML = `<button class="req-btn" style="background:#dcfce7; color:#166534; border:1px solid #86efac;" onclick="modifyProRequest()"><i class="fas fa-check-circle"></i> 요청 완료 (수정하기)</button>`;
    }
}

function openProReportModal(existingText = '') {
    const modal = document.getElementById('proReportModal'); const textarea = document.getElementById('proReportRequest');
    if (modal) {
        modal.style.display = 'block';
        if(textarea) { textarea.value = typeof existingText === 'string' ? existingText : ''; textarea.focus(); updateCharCount(textarea); }
        document.body.style.overflow = 'hidden';
    }
}

function closeProModal() { document.getElementById('proReportModal').style.display = 'none'; document.body.style.overflow = 'auto'; }

async function submitProReport() {
    const text = document.getElementById('proReportRequest').value;
    if (text.trim().length < 10) { alert("요청 사항을 10자 이상 구체적으로 적어주세요."); return; }
    if (!confirm("작성하신 내용으로 보고서를 요청하시겠습니까?\n(제출 후에는 수정이 어렵습니다)")) return;

    const submitBtn = document.querySelector('.pro-submit-btn'); const originalText = submitBtn.innerText;
    submitBtn.innerText = "처리 중..."; submitBtn.disabled = true;
    
    try {
        const res = await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'request_pro_report', data: { requestText: text } })
        });
        const data = await res.json();

        if (res.ok) {
            alert(data.msg || "요청이 정상적으로 접수되었습니다.");
            const url = new URL(window.location.href); url.searchParams.set('tab', 'pro'); window.location.href = url.toString();
        } else { throw new Error(data.msg || "요청 처리 중 오류가 발생했습니다."); }
    } catch (e) { alert(e.message); } 
    finally { submitBtn.innerText = originalText; submitBtn.disabled = false; }
}

document.addEventListener('input', function(e) {
    if(e.target.id === 'proReportRequest') {
        const countSpan = e.target.parentElement.querySelector('.char-count span');
        if(countSpan) countSpan.innerText = e.target.value.length;
    }
});

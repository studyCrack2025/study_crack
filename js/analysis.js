// js/analysis.js

// ============================================================
// [설정] API 및 상수 정의
// ============================================================
const MYPAGE_API_URL = CONFIG.api.user;
const UNIV_DATA_API_URL = CONFIG.api.analysis;
const FILE_API_URL = CONFIG.api.file;
const REPORT_API_URL = CONFIG.api.report;
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

// 대학 선택 모달 관련
let currentSlotIndex = null;

// 플래너 파일 업로드 관련
let currentPlannerFiles = []; 
let originalPlannerFiles = [];

// 시험 모드 (수능/평가원 등)
let currentExamMode = 'csat'; 

const EXAM_DISPLAY_NAMES = {
    "csat": "대학수학능력시험 (수능)",
    "sep": "9월 모의평가",
    "jun": "6월 모의평가",
    "jul": "7월 학력평가",
    "oct": "10월 학력평가",
    "mar": "3월 학력평가",
    "may": "5월 학력평가"
};

// ============================================================
// [초기화] DOM 로드 시 실행 (💡 병렬 데이터 로딩으로 개편)
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const idToken = localStorage.getItem('idToken'); 
    const userId = localStorage.getItem('userId');

    if (!idToken) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    setWeeklyLoadingStatus(true);

    try {
        // 1️⃣ [핵심] 유저 데이터를 가장 먼저 가져와서 등급(Tier)을 확인합니다.
        await fetchUserData(userId);

        // 2️⃣ [핵심] 확인된 등급에 따라 굳이 필요 없는 무거운 API 연산/호출은 배열에서 제외합니다.
        const parallelTasks = [fetchUnivData()];
        
        if (['standard', 'pro'].includes(currentUserTier)) {
            parallelTasks.push(fetchWeeklyHistory()); // 코칭 탭용 데이터
        }
        if (['pro'].includes(currentUserTier)) {
            parallelTasks.push(fetchInitialProReports()); // PRO 탭용 데이터
        }

        const results = await Promise.allSettled(parallelTasks);
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
    
    const swipeWrapper = document.querySelector('.sol-swipe-wrapper');
    if (swipeWrapper) {
        let scrollTimeout;
        swipeWrapper.addEventListener('scroll', () => {
            if (window.innerWidth > 768) return; // 모바일에서만 작동
            
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollLeft = swipeWrapper.scrollLeft;
                const width = swipeWrapper.clientWidth;
                // 현재 스크롤 위치를 계산해 몇 번째 탭인지 파악
                const index = Math.round(scrollLeft / width);
                const types = ['univ', 'sim', 'coach', 'pro'];
                const currentType = types[index];
                
                const targetContent = document.getElementById(`sol-${currentType}`);
                if (targetContent) {
                    swipeWrapper.style.height = `${targetContent.offsetHeight}px`;
                }
                
                // 버튼 상태 동기화
                document.querySelectorAll('.solution-menu .sol-btn').forEach(btn => {
                    btn.classList.remove('active');
                    const onclickAttr = btn.getAttribute('onclick');
                    if (onclickAttr && onclickAttr.includes(`'${currentType}'`)) {
                        btn.classList.add('active');
                    }
                });
                
                // 시뮬레이션 탭 도달 시 데이터 로드 안 되어있으면 로드
                if (currentType === 'sim' && document.getElementById('simChartArea').innerHTML.trim() === '') {
                    initSimulation();
                }
            }, 100); // 부드러운 전환을 위해 스크롤 종료 0.1초 후 인식
        });
    }
    
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            const firstTab = document.getElementById('sol-univ');
            const wrapper = document.querySelector('.sol-swipe-wrapper');
            if (firstTab && wrapper) {
                wrapper.style.height = `${firstTab.offsetHeight}px`;
                if (!document.getElementById('mainSwipeHint')) {
                    const hintDiv = document.createElement('div');
                    hintDiv.id = 'mainSwipeHint';
                    hintDiv.style.cssText = "text-align:center; color:#94a3b8; font-size:0.8rem; padding:10px 0 5px 0; display:flex; justify-content:center; align-items:center; gap:8px;";
                    hintDiv.innerHTML = '<i class="fas fa-angle-double-left"></i> 화면을 좌우로 밀어서 메뉴 이동 <i class="fas fa-angle-double-right"></i>';
                    // wrapper 바로 위에 안내문구 삽입
                    wrapper.parentNode.insertBefore(hintDiv, wrapper);
                }
            }
        }, 1000); // 모든 병렬 태스크(fetch)가 어느 정도 끝날 시점
    }
});

window.finishTutorialComplete = async function() {
    const submitBtn = document.querySelector('#tutorialCompleteModal button');
    if (submitBtn) {
        submitBtn.innerText = "처리 중...";
        submitBtn.disabled = true;
    }

    try {
        const token = localStorage.getItem('idToken');
        // 튜토리얼 보상으로 trial 티어 부여 및 횟수 4회 충전 요청
        await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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

function syncMobileHeight() {
    if (window.innerWidth > 768) return; // PC는 실행 안 함
    
    const wrapper = document.querySelector('.sol-swipe-wrapper');
    if (!wrapper) return;

    // 스크롤 애니메이션 진행 중 오작동을 막기 위해 활성화된 탭을 강제 추적합니다.
    const activeBtn = document.querySelector('.solution-menu .sol-btn.active');
    let targetId = null;

    if (activeBtn) {
        const onclickAttr = activeBtn.getAttribute('onclick');
        if (onclickAttr) {
            const match = onclickAttr.match(/'([^']+)'/);
            if (match) targetId = `sol-${match[1]}`;
        }
    }

    // 폴백: 활성화된 버튼을 찾지 못한 경우 기존 방식(스크롤 위치) 사용
    if (!targetId) {
        const index = Math.round(wrapper.scrollLeft / Math.max(wrapper.clientWidth, 1));
        const types = ['univ', 'sim', 'coach', 'pro'];
        targetId = `sol-${types[index]}`;
    }

    const activeTab = document.getElementById(targetId);

    if (activeTab) {
        // 브라우저가 레이아웃을 다시 그릴 시간을 약간 준 뒤 높이 측정
        requestAnimationFrame(() => {
            wrapper.style.height = `${activeTab.offsetHeight}px`;
        });
    }
}

function getStandardLockOverlayHTML(featureName) {
    return `
        <div style="background: white; padding: 30px 20px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; border: 1px solid #e2e8f0; width: 90%; max-width: 320px; box-sizing: border-box;">
            <i class="fas fa-lock" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 15px;"></i>
            <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.25rem; word-break: keep-all;">Standard 멤버십 전용</h3>
            <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 20px; line-height: 1.5; word-break: keep-all;">
                ${featureName}은(는)<br><strong>Standard 등급 이상</strong>부터 이용 가능합니다.
            </p>
            <button onclick="location.href='/payment'" style="width: 100%; padding: 14px 0; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer; transition: background 0.2s; white-space: nowrap; word-break: keep-all;">
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
        overlay.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(6px); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 50; border-radius: 12px;";
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
    const token = localStorage.getItem('idToken');
    const safeUserId = userId || localStorage.getItem('userId'); 
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: safeUserId }) 
        });
        
        if (response.status === 401) {
            alert("세션이 만료되었습니다. 다시 로그인해주세요.");
            window.location.href = '/login';
            return;
        }
        if (!response.ok) throw new Error("사용자 데이터 로드 실패");
        
        const rawData = await response.json();
        const data = parseDynamoItem(rawData);
        
        userGracePeriodUntil = data.gracePeriodUntil || null;

        if (data.tutorName) currentTutorName = data.tutorName;
        
        if (data.currentSubscription && data.currentSubscription.startDate) {
             userRecentPaymentDate = new Date(data.currentSubscription.startDate);
        } else if (data.payments && Array.isArray(data.payments)) {
            const paid = data.payments.filter(p => p.status === 'paid').sort((a,b) => new Date(b.date) - new Date(a.date));
            if (paid.length > 0 && paid[0].date) userRecentPaymentDate = new Date(paid[0].date);
        }
        
        renderUserInfo(data);
        applyUserTier(data.computedTier || 'free'); 
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
        if (data.quantitative) userQuantData = data.quantitative;
        
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
        if(error.message.includes("401")) { location.href='/login'; }
    }
}

async function fetchWeeklyHistory() {
    const token = localStorage.getItem('idToken');
    try {
        const response = await fetch(REPORT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_weekly_reports' }) 
        });
        
        if (response.ok) {
            const data = await response.json();
            weeklyDataHistory = data.weeklyReports || [];
        }
    } catch (e) { console.error("Weekly Data Load Error:", e); }
}

async function fetchInitialProReports() {
    const token = localStorage.getItem('idToken');
    try {
        const res = await fetch(REPORT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_pro_reports', data: { requesterRole: 'student' } })
        });
        if (res.ok) {
            const data = await res.json();
            cachedProReports = data.reports || []; 
        }
    } catch (e) { console.error("Pro Reports Load Error:", e); }
}

async function fetchUnivData() {
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    try {
        const response = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
        tierBadgeEl.appendChild(document.createTextNode(`${tierText} 멤버십`));
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
            if (uniqueTargets[0]) targetHtml += `<div class="target-row"><span class="target-badge first">1지망</span> ${escapeHtml(uniqueTargets[0])}</div>`;
            if (uniqueTargets[1]) targetHtml += `<div class="target-row"><span class="target-badge second">2지망</span> ${escapeHtml(uniqueTargets[1])}</div>`;
            targetContainer.innerHTML = targetHtml;
            qualTargetRow.style.display = 'flex';
        } else {
            qualTargetRow.style.display = 'none';
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

        const renderSideScore = (examKey) => {
            const d = quan[examKey];
            if (!d) return;

            const makeRow = (label, obj) => {
                if (!obj) return ''; 
                let optText = '';
                if (obj.opt && obj.opt !== 'none') {
                    optText = `<span class="opt-badge">(${escapeHtml(obj.opt)})</span>`;
                }
                else if (obj.name) {
                    optText = `<span class="opt-badge">(${escapeHtml(obj.name)})</span>`;
                }

                const std = escapeHtml(obj.std) || '-';
                const pct = obj.pct ? escapeHtml(obj.pct) + '%' : '-';
                const grd = obj.grd ? `<span class="grade-circle">${escapeHtml(obj.grd)}</span>` : '';

                let valStr = '';
                if (label === '영어' || label === '한국사') valStr = grd; 
                else valStr = `${std} / ${pct} ${grd}`;

                return `<tr><td class="subj-label">${label}</td><td class="score-info">${optText} ${valStr}</td></tr>`;
            };

            let html = '<table class="side-score-table">';
            html += makeRow('국어', d.kor); html += makeRow('수학', d.math); html += makeRow('영어', d.eng);
            html += makeRow('탐구1', d.inq1); html += makeRow('탐구2', d.inq2);
            html += '</table>';
            detailBox.innerHTML = html;
        };

        renderSideScore(validExams[0]);
        selector.onchange = (e) => { renderSideScore(e.target.value); };
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
    const isMobile = window.innerWidth <= 768;
    const targetContent = document.getElementById(`sol-${type}`);

    if (isMobile) {
        // 모바일: 스와이프 래퍼 스크롤 이동 (display:none 처리 안 함)
        const wrapper = document.querySelector('.sol-swipe-wrapper');
        if (wrapper && targetContent) {
            // 해당 탭의 위치로 부드럽게 스크롤
            wrapper.scrollTo({ left: targetContent.offsetLeft - wrapper.offsetLeft, behavior: 'smooth' });
            setTimeout(syncMobileHeight, 350);
        }
    } else {
        // PC: 기존처럼 display로 탭 전환
        document.querySelectorAll('.sol-content').forEach(el => el.style.display = 'none');
        if (targetContent) targetContent.style.display = 'block';
    }

    // 상단 탭 버튼 활성화 UI 변경
    document.querySelectorAll('.solution-menu .sol-btn').forEach(btn => {
        btn.classList.remove('active');
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${type}'`)) {
            btn.classList.add('active');
        }
    });

    if (type === 'sim') initSimulation();
}

function checkMbtiReport(data) {
    const container = document.getElementById('mbtiReportContainer');
    if (!container) return;
    const promo = data.promoCode; 
    if (!promo || !promo.includes("-STC") || data.mbtiReportDownloaded) { container.innerHTML = ''; return; }
    
    let hex = promo.replace("-STC", "").replace("-", "");
    let mbti = '';
    for (let i = 0; i < hex.length; i += 2) mbti += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    
    container.innerHTML = `
        <button onclick="downloadMbtiReport()" id="mbtiDownBtn" class="btn-go-survey" style="background-color: #10b981; color: white; border: none; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">
            <i class="fas fa-file-download"></i> [${mbti.toUpperCase()}] 보고서 다운받기
        </button>`;
}

async function downloadMbtiReport() {
    if (!confirm("해당 MBTI 리포트는 1회만 다운로드 가능합니다.\n지금 다운로드 하시겠습니까?")) return;
    const btn = document.getElementById('mbtiDownBtn');
    if (btn) { btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 발급 중...`; btn.disabled = true; }

    // 💡 [핵심 방어] 서버 통신(await)을 시작하기 전, 사용자가 클릭한 즉시 빈 창을 먼저 엽니다!
    const newWindow = window.open('about:blank', '_blank');

    const token = localStorage.getItem('idToken');
    try {
        const res = await fetch(REPORT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_mbti_report' })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
            alert("다운로드가 시작되었습니다.");
            
            // 💡 [핵심 방어] 미리 열어둔 빈 창의 주소를 받아온 S3 다운로드 링크로 쓱 바꿔치기 합니다.
            newWindow.location.href = data.downloadUrl;
            
            const container = document.getElementById('mbtiReportContainer');
            if (container) container.innerHTML = ''; 
        } else {
            // 실패하면 열어둔 빈 창을 조용히 닫아줍니다.
            newWindow.close();
            alert(data.error || "보고서 발급에 실패했습니다.");
            if (btn) { btn.innerHTML = `<i class="fas fa-file-download"></i> 보고서 다운받기`; btn.disabled = false; }
        }
    } catch (e) {
        newWindow.close(); // 에러 시에도 빈 창 닫기
        alert("서버 통신 오류가 발생했습니다.");
        if (btn) { btn.innerHTML = `<i class="fas fa-file-download"></i> 보고서 다운받기`; btn.disabled = false; }
    }
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

function closeUnivModal() {
    document.getElementById('univSelectModal').style.display = 'none';
    
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('top');
    window.scrollTo(0, scrollPosition);

    currentSlotIndex = null; selectedUnivForMajor = '';
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
    const token = localStorage.getItem('idToken'); 
    
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
    
    const hasTargets = userTargetUnivs && userTargetUnivs.some(u => u && u.univ);
    const availableExams = userQuantData ? Object.keys(userQuantData).filter(key => {
        const data = userQuantData[key];
        return data && (data.kor || data.math || data.eng);
    }) : [];

    if (!hasTargets || availableExams.length === 0) { 
        container.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:40px; color:#64748b; background:#f8fafc; border-radius:12px;">
                <i class="fas fa-exclamation-circle fa-2x" style="margin-bottom:10px; color:#94a3b8;"></i><br>
                목표 대학을 설정하고 성적표를 입력해주세요.
            </div>`; 
        return; 
    }
    
    if (!currentExamMode || !availableExams.includes(currentExamMode)) {
        if (availableExams.includes('csat')) currentExamMode = 'csat';
        else currentExamMode = availableExams[0];
    }

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
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    const currentScoreData = userQuantData[currentExamMode];

    try {
        const res = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
        }
        
        if (window.innerWidth <= 768) {
            setTimeout(syncMobileHeight, 150); // 렌더링 후 높이 재조정
        }
    } catch (e) {
        console.error("분석 API 호출 중 오류 발생:", e);
        cardsContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#ef4444;">분석 중 오류가 발생했습니다.</div>`;
    }
}

function changeExamMode(mode) { currentExamMode = mode; updateAnalysisUI(); }

function renderAnalysisCard(res) {
    if (res.msg.includes("오류") || res.msg.includes("데이터 없음") || res.status === '분석 불가') {
        return `
        <div class="analysis-card" style="border-left-color: #94a3b8;">
            <div class="analysis-header" style="margin-bottom:10px;">
                <h4 style="margin:0;">${escapeHtml(res.idx + 1)}지망: ${escapeHtml(res.univ)} <small style="color:#64748b;">${escapeHtml(res.major)}</small></h4>
                <span style="background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:4px; font-size:0.8rem; margin-top:5px; display:inline-block;">데이터 부족</span>
            </div>
            <p style="color:#64748b; font-size:0.9rem; margin:0;">${escapeHtml(res.msg || '해당 학과의 작년 입시 데이터가 없습니다.')}</p>
        </div>`;
    }

    const badgeStyle = `background: ${res.color}15; color: ${res.color}; border: 1px solid ${res.color};`; 
    const scoreStyle = `color: ${res.color}; font-weight: 800; font-size: 1.5rem;`;

    const safeIdx = escapeHtml(res.idx + 1); const safeUniv = escapeHtml(res.univ); const safeMajor = escapeHtml(res.major);
    const safeStatus = escapeHtml(res.status); const safeMsg = escapeHtml(res.msg); const safeScore = escapeHtml(res.converted_score);

    const MAX_SCORE = 250;
    const barWidth = Math.min((res.converted_score / MAX_SCORE) * 100, 100);

    return `
        <div class="analysis-card" style="border-left-color: ${res.color}; display: flex; flex-direction: column; gap: 15px;">
            <div class="analysis-header" style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; border-bottom:1px solid #f1f5f9; padding-bottom:15px;">
                <div style="flex: 1; min-width: 0;">
                    <span style="color:#64748b; font-size:1.1rem; font-weight:800; display:block; margin-bottom:5px;">${safeIdx}지망</span>
                    <h4 style="margin:0; font-size:1.2rem; color:#1e293b; letter-spacing:-0.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeUniv}</h4>
                    <div style="color:#64748b; font-size:0.95rem; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeMajor}</div>
                </div>
                <div style="text-align:right; flex-shrink: 0;">
                    <span style="${badgeStyle} padding:6px 14px; border-radius:20px; font-size:0.9rem; font-weight:bold; display:inline-block; margin-bottom:5px; white-space:nowrap;">${safeStatus}</span>
                    <div style="font-size:0.8rem; color:${res.color}; font-weight:600; white-space:nowrap;">${safeMsg}</div>
                </div>
            </div>
            <div class="analysis-body" style="display:flex; flex-direction:column; gap:20px;">
                <div class="score-section">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:5px;">
                        <span style="font-size:0.95rem; color:#475569; font-weight:600;">AI 환산 진단점수</span>
                        <span style="${scoreStyle}">${safeScore}<span style="font-size:1rem; font-weight:normal; margin-left:2px; color:#64748b;">점</span></span>
                    </div>
                    <div class="score-bar-container">
                        <div class="score-bar-bg">
                            <div style="position:absolute; left:40%; top:-5px; bottom:-5px; width:1px; border-left:1px dashed #cbd5e1; z-index:2;"></div>
                            <div style="position:absolute; left:60%; top:-5px; bottom:-5px; width:1px; border-left:1px dashed #cbd5e1; z-index:2;"></div>
                            <div class="score-bar-fill" style="width: ${barWidth}%; background: ${res.color};"></div>
                        </div>
                        <div class="score-labels">
                            <span class="label-min">0</span>
                            <span class="label-pass">합격<span class="m-line">(100)</span></span>
                            <span class="label-stable">안정<span class="m-line">(150)</span></span>
                            <span class="label-max">MAX<span class="m-line">(${MAX_SCORE})</span></span>
                        </div>
                    </div>
                </div>
                <div class="advice-section" style="background:#f8fafc; border-radius:10px; padding:18px; border:1px solid #e2e8f0;">
                    <h5 style="margin:0 0 8px 0; font-size:0.9rem; color:#334155; display:flex; align-items:center;">
                        <i class="fas fa-lightbulb" style="color:#fbbf24; margin-right:6px;"></i> 합격 전략 코멘트
                    </h5>
                    <p style="margin:0; font-size:0.95rem; color:#475569; line-height:1.6;">${getSimpleAdvice(res.converted_score, res.status)}</p>
                </div>
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
    
    if (!currentExamMode || !userQuantData[currentExamMode]) {
        const availableExams = Object.keys(userQuantData).filter(k => userQuantData[k] && (userQuantData[k].kor || userQuantData[k].math || userQuantData[k].eng));
        if (availableExams.length > 0) currentExamMode = availableExams[0];
        else { chartArea.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#94a3b8;">유효한 성적 데이터가 없습니다.</div>`; return; }
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
    
    chartArea.innerHTML = '<div style="margin:auto; color:#3b82f6;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    
    let scoreData = null;
    if (userQuantData[currentExamMode]) {
        scoreData = JSON.parse(JSON.stringify(userQuantData[currentExamMode]));
    }
    
    try {
        const res = await fetch(UNIV_DATA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
                    simDisplayList.push({ ...simItem, originalIdx });
                } else {
                    simDisplayList.push({ ineligible: true, univ: target.univ, major: target.major, originalIdx });
                }
            } else {
                simDisplayList.push({ ineligible: true, univ: target.univ, major: target.major, originalIdx });
            }
        });

        if (simDisplayList.length > 0) selectedSimIndex = 0;
        renderSimChart();
        
    } catch (e) { 
        chartArea.innerHTML = '<div style="color:#ef4444; padding:20px; text-align:center;">데이터 로드 실패</div>'; 
        console.error("Simulation Fetch Error:", e);
    }
}

function setSimChartType(type) {
    currentSimChartType = type;
    document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
    const btnIdx = type === 'bar' ? 0 : 1;
    document.querySelectorAll('.toggle-btn')[btnIdx].classList.add('active');
    renderSimChart();
}

let simSvgRefs = null;

function renderSimChart() {
    const container = document.getElementById('simChartArea');
    if (!container || !simDisplayList || simDisplayList.length === 0) return;
    
    const examName = EXAM_DISPLAY_NAMES[currentExamMode] || currentExamMode;
    const getBadgeHTML = () => `<div class="sim-info-badge"><span><i class="fas fa-history"></i> ${examName} 기준</span></div>`;

    if (!document.getElementById('simExtensionStyle')) {
        const style = document.createElement('style');
        style.id = 'simExtensionStyle';
        style.innerHTML = `
            .sim-extension-bar { width: 40px; background: #ffffff !important; border: 2px dashed #f59e0b; border-bottom: none; border-radius: 6px 6px 0 0; box-sizing: border-box; pointer-events: none; z-index: 2; position: absolute; }
            .sim-bar-item { -webkit-tap-highlight-color: transparent; }
            .sim-label-item { -webkit-tap-highlight-color: transparent; }
            @media (max-width: 768px) {
                .sim-extension-bar { width: 28px; }
                .sim-bar { width: 28px !important; }
            }
        `;
        document.head.appendChild(style);
    }

    const isMobile = window.innerWidth <= 768;

    if (currentSimChartType === 'bar') {
        simSvgRefs = null;
        if (!document.getElementById('simBarWrapper')) {
            container.innerHTML = ''; 
            container.style.overflow = 'visible';

            const wrapper = document.createElement('div');
            wrapper.id = 'simBarWrapper'; wrapper.className = 'chart-inner-container'; wrapper.style.height = 'auto'; wrapper.style.minHeight = '360px';
            wrapper.insertAdjacentHTML('beforeend', getBadgeHTML());
            
            const graphArea = document.createElement('div'); graphArea.className = 'chart-graph-area';
            const labelArea = document.createElement('div'); labelArea.className = 'chart-label-area';

            const MAX_SCORE = 250; 

            if (isMobile) {
                graphArea.style.padding = '0 15px'; graphArea.style.marginTop = '40px'; graphArea.style.height = '200px'; 
            } else {
                graphArea.style.padding = '0 60px 0 20px'; graphArea.style.marginTop = '50px'; graphArea.style.height = '260px'; 
            }

            let graphHtml = ''; let labelHtml = '';
            const guideStyle100 = `bottom: ${(100 / MAX_SCORE) * 100}%; border-top-color: #3b82f6;`;
            const guideStyle150 = `bottom: ${(150 / MAX_SCORE) * 100}%; border-top-color: #10b981;`;
            
            graphHtml += `<div class="chart-guide-line guide-100" style="${guideStyle100}"><span class="chart-guide-label">합격(100)</span></div>`;
            graphHtml += `<div class="chart-guide-line guide-150" style="${guideStyle150}"><span class="chart-guide-label">안정(150)</span></div>`;

            simDisplayList.forEach((item, index) => {
                const choiceNum = item.originalIdx + 1;
                const shortUniv = item.univ.replace('학교', '');

                if (item.ineligible) {
                    graphHtml += `
                        <div class="sim-bar-item" onclick="selectSimUniv(${index})" style="flex:1; align-self:stretch; position:relative; cursor:pointer; -webkit-tap-highlight-color:transparent;">
                            <div style="position:relative; height:100%; width:100%;">
                                <div class="sim-bar" style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); height:8%; background:repeating-linear-gradient(45deg,#fca5a5,#fca5a5 4px,#fee2e2 4px,#fee2e2 8px); border:1px dashed #ef4444; border-radius:6px 6px 0 0; z-index:1;">
                                    <span class="sim-score-label" style="position:absolute; top:-22px; left:50%; transform:translateX(-50%); color:#ef4444; font-size:0.65rem; white-space:nowrap;">불가</span>
                                </div>
                            </div>
                        </div>`;
                    labelHtml += `
                        <div class="sim-label-item" onclick="selectSimUniv(${index})" style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer; -webkit-tap-highlight-color:transparent;">
                            <span class="label-mobile" style="word-break:keep-all; font-size:0.75rem;">${choiceNum}지망</span>
                            <span class="label-pc" style="word-break:keep-all; line-height:1.2;"><strong>${choiceNum}지망</strong><br>${escapeHtml(shortUniv)}<br><span style="color:#ef4444; font-size:0.75em;">지원불가</span></span>
                        </div>`;
                    return;
                }

                const score = item.base_ui_score;
                const currentHeightPct = `${(score / MAX_SCORE) * 100}%`;
                let color = '#ef4444';
                if (score >= 150) color = '#10b981'; else if (score >= 100) color = '#3b82f6';
                const safeScore = Math.round(score);
                let extensionHtml = ''; let maxRise = 0;

                if (item.sim_data) { Object.values(item.sim_data).forEach(sub => { if (sub && sub.uiDiff > maxRise) maxRise = sub.uiDiff; }); }

                if (maxRise > 0 && score < MAX_SCORE) {
                    const potentialScore = Math.min(score + maxRise, MAX_SCORE);
                    const riseAmount = potentialScore - score;
                    const riseHeightPct = `${(riseAmount / MAX_SCORE) * 100}%`;
                    
                    extensionHtml = `
                        <div class="sim-extension-bar" data-target-height="${riseHeightPct}" style="position:absolute; bottom:${currentHeightPct}; left:50%; transform:translateX(-50%); height:0; opacity:0; z-index:2; transition:height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; pointer-events:none;">
                             <span style="position:absolute; top:-25px; left:50%; transform:translateX(-50%); color:#d97706; font-size:0.8rem; font-weight:800; white-space:nowrap;">
                                ${Math.round(potentialScore)} <span style="font-size:0.7rem;">(+${maxRise.toFixed(1)})</span>
                             </span>
                        </div>`;
                }

                graphHtml += `
                    <div class="sim-bar-item" onclick="selectSimUniv(${index})" style="flex:1; align-self:stretch; position:relative; cursor:pointer; -webkit-tap-highlight-color:transparent;">
                        <div style="position:relative; height:100%; width:100%;">
                            <div class="sim-bar" style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); height:${currentHeightPct}; background:${color}; border-radius:6px 6px 0 0; z-index:1; transition:border-radius 0.3s;">
                                <span class="sim-score-label" style="position:absolute; top:-22px; left:50%; transform:translateX(-50%); font-weight:bold; color:${color}; transition:opacity 0.2s;">${safeScore}</span>
                            </div>
                            ${extensionHtml}
                        </div>
                    </div>`;

                labelHtml += `
                    <div class="sim-label-item" onclick="selectSimUniv(${index})" style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer; -webkit-tap-highlight-color:transparent;">
                        <span class="label-mobile" style="word-break:keep-all; font-size:0.75rem;">${choiceNum}지망</span>
                        <span class="label-pc" style="word-break:keep-all; line-height:1.2;"><strong>${choiceNum}지망</strong><br>${escapeHtml(shortUniv)}<br>${escapeHtml(item.major)}</span>
                    </div>`;
            });

            graphArea.innerHTML = graphHtml; labelArea.innerHTML = labelHtml;
            wrapper.appendChild(graphArea); wrapper.appendChild(labelArea);

            const mobileLegendDiv = document.createElement('div'); mobileLegendDiv.className = 'mobile-legend-area';
            mobileLegendDiv.style.cssText = "display: flex; justify-content: center; align-items: center; gap: 20px; padding-top: 15px; margin-top: 10px; border-top: 1px dashed #cbd5e1;";
            mobileLegendDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px; font-size:0.85rem; color:#475569; font-weight:700;"><div style="width:16px; height:4px; background:#10b981; border-radius:2px;"></div> 안정(150)</div>
                <div style="display:flex; align-items:center; gap:6px; font-size:0.85rem; color:#475569; font-weight:700;"><div style="width:16px; height:4px; background:#3b82f6; border-radius:2px;"></div> 합격(100)</div>
            `;
            container.appendChild(wrapper); container.appendChild(mobileLegendDiv);
        }
        updateSimBarGraph(selectedSimIndex || 0);
    }
    else if (currentSimChartType === 'line') {
        if (!document.getElementById('simLineWrapper')) {
            container.innerHTML = ''; container.style.overflow = 'visible';
            const wrapper = document.createElement('div'); wrapper.id = 'simLineWrapper'; wrapper.className = 'sim-line-container';
            wrapper.insertAdjacentHTML('beforeend', getBadgeHTML());

            const chartArea = document.createElement('div'); chartArea.className = 'sim-line-chart-area'; chartArea.style.overflow = "visible"; 
            wrapper.appendChild(chartArea); 
            
            // 💡 [수정] 모바일이 아닐 때만 꺾은선 하단의 대학 선택 버튼을 그립니다.
            if (!isMobile) {
                const btnBox = document.createElement('div'); btnBox.className = 'sim-univ-scroll-box'; 
                wrapper.appendChild(btnBox); 
                renderSimUnivButtons(btnBox);
            }

            container.appendChild(wrapper);
            initSimSvg(chartArea); 
        }
        updateSimLineGraph(selectedSimIndex || 0);
    }
    renderDetailedSimCard();
    
    if (window.innerWidth <= 768) {
        setTimeout(syncMobileHeight, 300); // 그래프 애니메이션 후 높이 재조정
    }
}

function updateSimBarGraph(idx) {
    const items = document.querySelectorAll('.sim-bar-item');
    const container = document.querySelector('.chart-scroll-container'); // 막대그래프 감싸는 래퍼

    items.forEach((item, i) => {
        const extBar = item.querySelector('.sim-extension-bar');
        const mainBar = item.querySelector('.sim-bar');
        const scoreLabel = item.querySelector('.sim-score-label');
        
        if (i === idx) {
            item.classList.add('active');
            if (extBar) {
                void extBar.offsetWidth; 
                extBar.style.height = extBar.getAttribute('data-target-height');
                extBar.style.opacity = '1';
                if (mainBar) mainBar.style.borderRadius = '0 0 0 0'; 
                if (scoreLabel) scoreLabel.style.opacity = '0'; 
            }
            
            // 💡 [수정된 부분] 모바일 막대그래프 강제 스크롤 동기화 로직
            if (container && window.innerWidth <= 768) {
                const scrollPos = item.offsetLeft - (container.clientWidth / 2) + (item.clientWidth / 2);
                container.scrollTo({ left: scrollPos, behavior: 'smooth' });
            }
        } else {
            item.classList.remove('active');
            if (extBar) {
                extBar.style.height = '0';
                extBar.style.opacity = '0';
            }
            if (mainBar) mainBar.style.borderRadius = '6px 6px 0 0';
            if (scoreLabel) scoreLabel.style.opacity = '1';
        }
    });
}

function initSimSvg(targetDiv) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "sim-svg-layer"); svg.style.overflow = "visible";
    const isMobile = window.innerWidth <= 768; const baseRadius = isMobile ? "4" : "6";
    
    const guides = {
        gBottom: createGuideGroup(ns, "#cbd5e1", ""), gMid: createGuideGroup(ns, "#cbd5e1", ""), gTop: createGuideGroup(ns, "#cbd5e1", ""),
        g100: createGuideGroup(ns, "#3b82f6", "100 합격"), g150: createGuideGroup(ns, "#10b981", "150 안정")
    };

    const path = document.createElementNS(ns, "path"); path.setAttribute("class", "sim-path");
    svg.appendChild(guides.gBottom.g); svg.appendChild(guides.gMid.g); svg.appendChild(guides.gTop.g);
    svg.appendChild(guides.g100.g); svg.appendChild(guides.g150.g); svg.appendChild(path);

    const points = []; const labels = []; const labelsGroup = document.createElementNS(ns, "g");
    for(let i=0; i<4; i++) {
        const c = document.createElementNS(ns, "circle"); c.setAttribute("class", "sim-point"); c.setAttribute("r", baseRadius);
        const t = document.createElementNS(ns, "text"); t.setAttribute("class", "sim-point-label");
        svg.appendChild(c); labelsGroup.appendChild(t); points.push(c); labels.push(t);
    }
    svg.appendChild(labelsGroup); targetDiv.appendChild(svg);

    const xAxis = document.createElement('div');
    xAxis.style.cssText = "position:absolute; bottom:0; left:0; width:100%; display:flex; justify-content:space-around; padding-bottom:5px; pointer-events:none;";
    const xAxisTexts = [];
    ['국어', '수학', '탐구1', '탐구2'].forEach(txt => {
        const sp = document.createElement('span'); sp.innerText = txt; sp.style.cssText = "font-size:11px; color:#64748b; font-weight:600; width:40px; text-align:center;";
        xAxis.appendChild(sp); xAxisTexts.push(sp);
    });
    targetDiv.appendChild(xAxis);
    simSvgRefs = { svg, guides, path, points, labels, xAxisTexts };
}

function createGuideGroup(ns, color, txt) {
    const g = document.createElementNS(ns, "g");
    const line = document.createElementNS(ns, "line"); line.setAttribute("class", "sim-guide-line"); line.setAttribute("stroke", color);
    const text = document.createElementNS(ns, "text"); text.setAttribute("class", "sim-guide-text"); text.setAttribute("fill", color); text.textContent = txt;
    g.appendChild(line); g.appendChild(text);
    return { g, line, text };
}

function renderSimUnivButtons(targetDiv) {
    targetDiv.innerHTML = '';
    const fragment = document.createDocumentFragment(); 

    simDisplayList.forEach((d, i) => {
        const btn = document.createElement('div'); 
        btn.className = `univ-select-btn ${i === selectedSimIndex ? 'active' : ''}`;
        
        const univName = d.univ.replace('학교', ''); 
        const deptName = d.major || '학부';
        const choiceNum = d.originalIdx + 1;

        const innerContainer = document.createElement('div');
        innerContainer.style.cssText = "flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px;";

        const topSpan = document.createElement('span');
        topSpan.style.cssText = "font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;";
        topSpan.textContent = `${choiceNum}지망 ${univName}`; 
        
        if (d.ineligible) {
            const inelSpan = document.createElement('span');
            inelSpan.style.cssText = "color:#ef4444; font-size:0.8em;";
            inelSpan.textContent = " (지원불가)";
            topSpan.appendChild(inelSpan);
        }

        const botSpan = document.createElement('span');
        botSpan.style.cssText = "font-size:0.85em; opacity:0.9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;";
        botSpan.textContent = deptName; 

        innerContainer.appendChild(topSpan);
        innerContainer.appendChild(botSpan);
        btn.appendChild(innerContainer);

        btn.onclick = () => {
            selectSimUniv(i);
            targetDiv.querySelectorAll('.univ-select-btn').forEach((b, idx) => { 
                if (idx === i) b.classList.add('active'); else b.classList.remove('active'); 
            });
        };
        fragment.appendChild(btn);
    });
    targetDiv.appendChild(fragment);
}

function updateSimLineGraph(idx) {
    if (!simSvgRefs) return;
    window.lastSimGraphIdx = idx;
    if (!window.simGraphResizeHandler) {
        window.simGraphResizeHandler = () => { if (typeof window.lastSimGraphIdx !== 'undefined') updateSimLineGraph(window.lastSimGraphIdx); };
        window.addEventListener('resize', window.simGraphResizeHandler);
    }

    const item = simDisplayList[idx];
    if (!item) return;
    if (item.ineligible) { simSvgRefs.svg.parentNode.style.height = '80px'; simSvgRefs.path.setAttribute("d", ""); simSvgRefs.points.forEach(p => { p.setAttribute("cx", -999); p.setAttribute("cy", -999); }); return; }
    const data = item;

    const TARGET_HEIGHT = 260; 
    simSvgRefs.svg.parentNode.style.height = `${TARGET_HEIGHT}px`; simSvgRefs.svg.parentNode.style.minHeight = `${TARGET_HEIGHT}px`;
    const svgEl = simSvgRefs.svg; const W = svgEl.clientWidth || 300; 
    
    const realNames = ['국어', '수학'];
    realNames.push(data.sim_data.inq1?.name || '탐구1'); realNames.push(data.sim_data.inq2?.name || '탐구2');
    simSvgRefs.xAxisTexts.forEach((span, i) => { span.innerText = realNames[i]; });

    const keys = ['kor', 'math', 'inq1', 'inq2'];
    const currentScore = data.base_ui_score;
    const scores = keys.map(k => {
        const rise = (data.sim_data && data.sim_data[k]) ? data.sim_data[k].uiDiff : 0;
        return Math.min(250, currentScore + rise);
    });

    let minS = Math.min(...scores); let maxS = Math.max(...scores); const scoreDiff = maxS - minS;
    let GAP = 25; if (scoreDiff > 160) GAP = 125; else if (scoreDiff > 90) GAP = 100; else if (scoreDiff > 40) GAP = 50;
    let centerScore = (minS + maxS) / 2; let midLine = Math.round(centerScore / 25) * 25;

    if (midLine + GAP < maxS) midLine += 25; if (midLine - GAP > minS) midLine -= 25;
    if (midLine - GAP < 0) midLine = GAP; if (midLine + GAP > 250) midLine = 250 - GAP;

    const midY = 130; const pixelPerGap = 90; const getY = (score) => midY - ((score - midLine) / GAP) * pixelPerGap;

    const targetGuides = [
        { obj: simSvgRefs.guides.gBottom, val: midLine - GAP, isFixed: false }, { obj: simSvgRefs.guides.gMid, val: midLine, isFixed: false },
        { obj: simSvgRefs.guides.gTop, val: midLine + GAP, isFixed: false }, { obj: simSvgRefs.guides.g100, val: 100, isFixed: true, label: "100 합격" },
        { obj: simSvgRefs.guides.g150, val: 150, isFixed: true, label: "150 안정" }
    ];

    targetGuides.forEach(guide => {
        const { obj, val, isFixed, label } = guide;
        if (val >= midLine - GAP && val <= midLine + GAP) {
            obj.g.style.opacity = 1; const y = getY(val);
            obj.line.setAttribute("x1", 0); obj.line.setAttribute("x2", W); obj.line.setAttribute("y1", y); obj.line.setAttribute("y2", y);
            obj.text.setAttribute("x", W - 5); obj.text.setAttribute("y", y - 4);
            if (isFixed) { obj.text.textContent = label; obj.line.style.opacity = 1; } 
            else { if (val === 100 || val === 150) { obj.text.textContent = ""; obj.line.style.opacity = 0; } else { obj.text.textContent = val; obj.line.style.opacity = 0.5; } }
        } else { obj.g.style.opacity = 0; }
    });

    const sectionW = W / 4; let d = ""; 
    const isFlat = (minS === maxS); const maxIdx = isFlat ? -1 : scores.indexOf(maxS); const minIdx = isFlat ? -1 : scores.indexOf(minS);

    scores.forEach((s, i) => {
        const cx = (sectionW * i) + (sectionW / 2); const cy = getY(s);
        if (i === 0) d += `M ${cx} ${cy}`; else d += ` L ${cx} ${cy}`;
        simSvgRefs.points[i].setAttribute("cx", cx); simSvgRefs.points[i].setAttribute("cy", cy);
        
        const pointEl = simSvgRefs.points[i]; const labelEl = simSvgRefs.labels[i];
        pointEl.style.fill = "#bfdbfe"; pointEl.style.stroke = "#2563EB"; 
        labelEl.style.opacity = 0; labelEl.style.fontWeight = "normal"; labelEl.style.fill = "#1e293b";

        if (!isFlat) {
            if (i === maxIdx) { pointEl.style.fill = "#10b981"; pointEl.style.stroke = "#059669"; labelEl.style.fill = "#10b981"; labelEl.style.opacity = 1; labelEl.style.fontWeight = "bold"; }
            if (i === minIdx) { pointEl.style.fill = "#ef4444"; pointEl.style.stroke = "#b91c1c"; labelEl.style.fill = "#ef4444"; labelEl.style.opacity = 1; labelEl.style.fontWeight = "bold"; }
        }
        labelEl.textContent = Math.round(s); labelEl.setAttribute("x", cx); labelEl.setAttribute("y", cy - 12);
    });
    simSvgRefs.path.setAttribute("d", d);
}

function selectSimUniv(index, fromScroll = false) {
    selectedSimIndex = index;
    if (currentSimChartType === 'bar') updateSimBarGraph(index);
    else if (currentSimChartType === 'line') {
        updateSimLineGraph(index);
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            document.querySelectorAll('.sim-univ-scroll-box .univ-select-btn').forEach((b, idx) => {
                if (idx === index) b.classList.add('active'); else b.classList.remove('active');
            });
        }
    }

    if (!fromScroll && window.innerWidth <= 768) {
        const container = document.getElementById('simDetailCard');
        if (container && container.children[index]) {
            const targetCard = container.children[index];
            container.scrollTo({ left: targetCard.offsetLeft - container.offsetLeft, behavior: 'smooth' });
        }
    } else if (window.innerWidth > 768) {
        renderDetailedSimCard(); 
    }
}

function renderDetailedSimCard() {
    const cardArea = document.getElementById('simDetailCard');
    const isMobile = window.innerWidth <= 768;

    if (!simDisplayList || simDisplayList.length === 0) { 
        cardArea.innerHTML = `<div class="empty-sim-state" style="width:100%;"><p>대학을 선택해주세요.</p></div>`; 
        return; 
    }

    // ==========================================
    // [1] 모바일 전용 로직: 대학 카드 및 과목 카드 가로 스와이프
    // ==========================================
    if (isMobile) {
        // 대학 카드 스와이프를 위한 인라인 스타일 (CSS 파일 대신 JS에서 제어하여 꼬임 방지)
        cardArea.style.display = 'flex';
        cardArea.style.overflowX = 'auto';
        cardArea.style.scrollSnapType = 'x mandatory';
        cardArea.style.gap = '15px';
        cardArea.style.scrollbarWidth = 'none';
        cardArea.style.paddingBottom = '10px';

        // 스와이프 시 상단 막대/꺾은선 그래프 연동
        cardArea.onscroll = () => {
            clearTimeout(window.simScrollTimeout);
            // 💡 100ms -> 40ms로 줄여 손을 떼자마자 즉각 반응하도록 수정
            window.simScrollTimeout = setTimeout(() => {
                const card = cardArea.querySelector('.swipe-univ-card');
                if (!card) return;
                
                // 💡 카드 너비에 gap(15px)을 더해야 정확한 스와이프 인덱스가 산출됨
                const itemWidth = card.offsetWidth + 15;
                const scrollLeft = cardArea.scrollLeft;
                const index = Math.round(scrollLeft / itemWidth);

                if (index !== selectedSimIndex && simDisplayList[index]) {
                    selectSimUniv(index, true);
                }
            }, 40); 
        };

        let html = '';
        simDisplayList.forEach((item, index) => {
            const choiceNum = item.originalIdx + 1;

            if (item.ineligible) {
                html += `
                <div class="sim-result-card swipe-univ-card" style="flex: 0 0 100%; scroll-snap-align: center; box-sizing: border-box; margin-top: 0;">
                    <div class="sim-card-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                        <div>
                            <span class="sim-univ-title" style="display:block; font-size:1.1rem; font-weight:800; color:#1e293b;">${escapeHtml(item.univ)}</span>
                            <span class="sim-univ-dept" style="display:block; font-size:0.85rem; color:#64748b;">${escapeHtml(item.major)}</span>
                        </div>
                        <div class="sim-score-change">
                            <span class="score-badge" style="background:#fee2e2; color:#ef4444;">${choiceNum}지망</span>
                        </div>
                    </div>
                    <div style="padding:15px; text-align:center; color:#ef4444; font-weight:600; font-size:0.9rem;">
                        <i class="fas fa-ban" style="font-size:1.2rem; margin-bottom:8px; display:block;"></i>지원 불가 대학입니다.
                    </div>
                </div>`;
                return;
            }

            const data = item;
            const currentScore = Math.round(data.base_ui_score);
            if (currentScore >= 250) { Object.keys(data.sim_data).forEach(key => { if (data.sim_data[key]) data.sim_data[key].uiDiff = 0; }); }
            const getStatusText = (s) => { if (s >= 150) return "안정권"; if (s >= 100) return "적정권"; if (s >= 50) return "소신지원"; return "위험"; };
            const currentStatus = getStatusText(currentScore);

            // 💡 과목 점수 상승폭 기준 내림차순 정렬
            let subjects = [{ key: 'kor', name: '국어' }, { key: 'math', name: '수학' }, { key: 'inq1', name: '탐구1' }, { key: 'inq2', name: '탐구2' }];
            subjects.sort((a, b) => {
                const diffA = (data.sim_data[a.key] && data.sim_data[a.key].uiDiff) || 0;
                const diffB = (data.sim_data[b.key] && data.sim_data[b.key].uiDiff) || 0;
                return diffB - diffA; 
            });

            let maxRise = (data.sim_data[subjects[0].key] && data.sim_data[subjects[0].key].uiDiff) || 0;
            let bestSubjectKey = maxRise > 0 ? subjects[0].key : '';

            let subjectsHTML = '';
            subjects.forEach(sub => {
                const info = data.sim_data[sub.key];
                if (!info) return;
                const diffVal = info.uiDiff.toFixed(1);
                const isBest = (sub.key === bestSubjectKey && maxRise > 0);
                let desc = '';
                // 1. 응시하지 않은 과목 처리
                if (info.msg && info.msg.includes("응시 안 함")) {
                    desc = `<span style="color:#94a3b8;">미응시 과목입니다.</span>`;
                } 
                // 2. 실제 환산 점수(diff)가 전혀 오르지 않은 경우 (만점이거나, 반영비율이 0인 경우)
                else if (Math.abs(info.diff) < 0.01) {
                    desc = `<span style="color:#ef4444;">점수 변화 없음</span>`;
                } 
                // 3. 점수가 미세하게라도 오른 경우
                else {
                    desc = isBest ? `<strong>가장 합격 상승에 유리합니다.</strong>` : `점수 상승으로 합격 가능성이 높아집니다.`;
                }

                // 부호 및 텍스트 렌더링 개선 (양수면 +, 음수면 - 출력)
                let subText = '';
                if (Math.abs(info.diff) >= 0.01) {
                     const sign = info.diff > 0 ? '+' : '';
                     subText = `(${sign}${info.diff.toFixed(2)}점)`;
                }
                
                subjectsHTML += `
                    <div class="sim-item swipe-subj-card ${isBest ? 'best-pick' : ''}">
                        <div class="sim-item-header" style="margin-bottom:6px;">
                            <span style="font-weight:700;">${escapeHtml(info.name || sub.name)} <span style="font-size:0.75rem; font-weight:normal;">(+1점)</span></span>
                            <span style="color:${info.uiDiff > 0 ? '#ef4444' : '#94a3b8'}; font-weight:800;">+${diffVal}점</span>
                        </div>
                        <div class="sim-item-body" style="font-size:0.85rem; line-height:1.4;">
                            <div style="margin-bottom:2px;">${desc}</div>
                            <div style="font-size:0.75rem; color:#94a3b8;">${subText}</div>
                        </div>
                    </div>`;
            });

            // 💡 Warning 박스를 세로 정렬(column)에 맞게 HTML 단순화
            let warningHTML = '';
            if (!['standard', 'pro'].includes(currentUserTier) && univChangeRemaining <= 5) {
                warningHTML = `
                    <div class="sim-warning upsell-warning">
                        <h4 style="color:#c2410c; margin:0; line-height:1.3; font-size:0.95rem;"><i class="fas fa-exclamation-triangle"></i> 공부 방향 설정이 필요합니다</h4>
                        <p style="margin:0; line-height:1.4; color:#475569; font-size:0.85rem;">어떤 과목이 중요한지는 확인됐지만 어떻게 올려야 하는지는 아직 정해지지 않은 상태입니다. 특히 학기 초에 방향이 잘못 잡히면 시간만 더 쓰게 되는 경우가 많습니다. 방향을 올바로 잡지 않은 상태에서의 노력은 결과로 이어지기 어렵습니다. 👉 지금 방향을 잡느냐에 따라 결과가 달라집니다.</p>
                        <button onclick="location.href='/payment'" style="width:100%; padding:12px; margin-top:5px; background:#ea580c; color:white; border:none; border-radius:8px; font-weight:bold; font-size:0.95rem; cursor:pointer;">공부 방향 설정하기</button>
                    </div>`;
            } else {
                if (currentScore < 10 && (currentScore + maxRise) < 25) {
                    warningHTML = `<div class="sim-warning" style="color:#c2410c;"><h4 style="color:#c2410c; margin:0; line-height:1.3; font-size:0.95rem;"><i class="fas fa-exclamation-circle"></i> 불합격권입니다</h4><p style="margin:0; line-height:1.4; color:#475569; font-size:0.85rem;">다른 전형이나 대학 고려를 권장합니다.</p></div>`;
                } else if (currentScore >= 225 || (currentScore + maxRise) >= 250) {
                    warningHTML = `<div class="sim-warning" style="background:#f0fdf4; border-color:#bbf7d0; color:#166534;"><h4 style="color:#166534; margin:0; line-height:1.3; font-size:0.95rem;"><i class="fas fa-check-circle"></i> 안정권입니다</h4><p style="margin:0; line-height:1.4; color:#475569; font-size:0.85rem;">상위 대학 도전을 고려해보세요.</p></div>`;
                }
            }
            
            // 💡 [추가] 대학 카드가 2개 이상일 때만 상단에 스와이프 안내 표시
            const univSwipeHint = simDisplayList.length > 1 
                ? `<div style="text-align:center; font-size:0.75rem; color:#64748b; background:#f1f5f9; border-radius:12px; padding:4px 0; margin-bottom:12px;">
                     <i class="fas fa-arrows-alt-h" style="opacity:0.6;"></i> 카드를 좌우로 스와이프하여 다른 대학 보기
                   </div>` 
                : '';

            // 💡 [추가] 과목 컨테이너 바로 위에 과목 스와이프 안내 표시
            const subjSwipeHint = `<div style="text-align:right; font-size:0.75rem; color:#94a3b8; margin-bottom:5px;">
                                     <i class="fas fa-hand-pointer"></i> 과목 좌우 스와이프
                                   </div>`;

            html += `
            <div class="sim-result-card swipe-univ-card" style="flex: 0 0 100%; scroll-snap-align: center; box-sizing: border-box; margin-top: 0; display: flex; flex-direction: column;">
                <div class="sim-card-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px; padding-bottom:12px; border-bottom:1px solid #f1f5f9;">
                    <div>
                        <span class="sim-univ-title" style="display:block; font-size:1.15rem; font-weight:800; color:#1e293b; margin-bottom:2px;">${escapeHtml(data.univ)}</span>
                        <span class="sim-univ-dept" style="display:block; font-size:0.9rem; color:#64748b;">${escapeHtml(data.major)}</span>
                    </div>
                    <div class="sim-score-change" style="text-align:right;">
                        <span class="score-badge" style="display:inline-block; background:#f1f5f9; padding:4px 8px; border-radius:6px; font-size:0.8rem; color:#64748b; margin-bottom:6px;">현재: ${currentStatus}</span>
                        <span class="score-diff" style="display:block; font-size:1.3rem; font-weight:800; color:#2563EB; margin:0;">${currentScore}점</span>
                    </div>
                </div>
                
                <div class="subj-scroll-container">
                    ${subjectsHTML}
                </div>
                
                ${warningHTML}
            </div>`;
        });
        cardArea.innerHTML = html;

    } else {
        // ==========================================
        // [2] PC 전용 로직: 기존의 단일 렌더링 유지
        // ==========================================
        cardArea.style.display = 'block';
        cardArea.style.overflowX = 'visible';
        
        if (selectedSimIndex === null || !simDisplayList[selectedSimIndex]) { 
            cardArea.innerHTML = `<div class="empty-sim-state" style="display:block; height:auto;"><p>대학을 선택해주세요.</p></div>`; 
            return; 
        }

        const item = simDisplayList[selectedSimIndex];
        if (item.ineligible) {
            const choiceNum = item.originalIdx + 1;
            cardArea.innerHTML = `
                <div class="sim-result-card" style="display: block; height: auto;">
                    <div class="sim-card-header">
                        <div style="flex:1 1 60%; min-width:200px;">
                            <span class="sim-univ-title">${escapeHtml(item.univ)}</span>
                            <span class="sim-univ-dept">${escapeHtml(item.major)}</span>
                        </div>
                        <div class="sim-score-change">
                            <span class="score-badge" style="background:#fee2e2; color:#ef4444;">${choiceNum}지망</span>
                        </div>
                    </div>
                    <div style="padding:20px; text-align:center; color:#ef4444; font-weight:600;">
                        <i class="fas fa-ban" style="font-size:1.5rem; margin-bottom:10px; display:block;"></i>지원 불가 대학입니다.
                        <div style="font-size:0.85rem; color:#94a3b8; font-weight:400; margin-top:8px;">필수 과목 미응시 또는 자격 미충족으로 인해<br>분석 데이터를 제공할 수 없습니다.</div>
                    </div>
                </div>`;
            return;
        }

        const data = item;
        const currentScore = Math.round(data.base_ui_score);
        if (currentScore >= 250) { Object.keys(data.sim_data).forEach(key => { if (data.sim_data[key]) data.sim_data[key].uiDiff = 0; }); }
        const getStatusText = (s) => { if (s >= 150) return "안정권"; if (s >= 100) return "적정권"; if (s >= 50) return "소신지원"; return "위험"; };
        const currentStatus = getStatusText(currentScore);

        let maxRise = 0; let bestSubjectKey = '';
        const subjects = [{ key: 'kor', name: '국어' }, { key: 'math', name: '수학' }, { key: 'inq1', name: '탐구1' }, { key: 'inq2', name: '탐구2' }];
        subjects.forEach(sub => { const info = data.sim_data[sub.key]; if (info && info.uiDiff > maxRise) { maxRise = info.uiDiff; bestSubjectKey = sub.key; } });

        let subjectsHTML = '';
        subjects.forEach(sub => {
            const info = data.sim_data[sub.key];
            if (!info) return;
            const diffVal = info.uiDiff.toFixed(1);
            const isBest = (sub.key === bestSubjectKey && maxRise > 0);
            let desc = '';
                // 1. 응시하지 않은 과목 처리
                if (info.msg && info.msg.includes("응시 안 함")) {
                    desc = `<span style="color:#94a3b8;">미응시 과목입니다.</span>`;
                } 
                // 2. 실제 환산 점수(diff)가 전혀 오르지 않은 경우 (만점이거나, 반영비율이 0인 경우)
                else if (Math.abs(info.diff) < 0.01) {
                    desc = `<span style="color:#ef4444;">점수 변화 없음</span>`;
                } 
                // 3. 점수가 미세하게라도 오른 경우
                else {
                    desc = isBest ? `<strong>가장 합격 상승에 유리합니다.</strong>` : `점수 상승으로 합격 가능성이 높아집니다.`;
                }

                // 부호 및 텍스트 렌더링 개선 (양수면 +, 음수면 - 출력)
                let subText = '';
                if (Math.abs(info.diff) >= 0.01) {
                     const sign = info.diff > 0 ? '+' : '';
                     subText = `(${sign}${info.diff.toFixed(2)}점)`;
                }
            
            subjectsHTML += `
                <div class="sim-item ${isBest ? 'best-pick' : ''}" style="display:flex; flex-direction:column; justify-content:flex-start; height:100%;">
                    <div class="sim-item-header" style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
                        <span style="flex:1; min-width:0; font-weight:700; color:#334155;">${escapeHtml(info.name || sub.name)} (+1점)</span>
                        <span style="flex-shrink:0; color:${info.uiDiff > 0 ? '#ef4444' : '#94a3b8'}; font-weight:700;">+${diffVal}점</span>
                    </div>
                    <div class="sim-item-body" style="flex:1;">
                        <div style="font-size:0.9rem; color:#475569; margin-bottom:4px;">${desc}</div>
                        <div style="font-size:0.75rem; color:#94a3b8;">${subText}</div>
                    </div>
                </div>
            `;
        });

        let warningHTML = '';
        if (!['standard', 'pro'].includes(currentUserTier) && univChangeRemaining <= 5) {
            warningHTML = `<div class="sim-warning upsell-warning"><h4><i class="fas fa-exclamation-triangle"></i> 지금 점수 구조에서는 특정 과목이 결과에 불리하게 작용하고 있습니다.</h4><button onclick="location.href='/payment'" style="width: 100%; padding: 12px; background: #ea580c; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer;">공부 방향 설정하기</button></div>`;
        } else {
            if (currentScore < 10 && (currentScore + maxRise) < 25) warningHTML = `<div class="sim-warning" style="background:#fff7ed; border-color:#fdba74; color:#c2410c;"><i class="fas fa-exclamation-circle"></i><div><strong>여전히 불합격권입니다.</strong></div></div>`; 
            else if (currentScore >= 225 || (currentScore + maxRise) >= 250) warningHTML = `<div class="sim-warning" style="background:#f0fdf4; border-color:#bbf7d0; color:#166534;"><i class="fas fa-check-circle"></i><div><strong>이미 상당히 안정권입니다.</strong></div></div>`;
        }

        cardArea.innerHTML = `
            <div class="sim-result-card" style="display:block; height:auto;">
                <div class="sim-card-header">
                    <div style="flex:1 1 60%; min-width:200px;">
                        <span class="sim-univ-title">${escapeHtml(data.univ)}</span>
                        <span class="sim-univ-dept">${escapeHtml(data.major)}</span>
                    </div>
                    <div class="sim-score-change">
                        <span class="score-badge">현재: ${currentStatus}</span>
                        <span class="score-diff">${currentScore}점</span>
                    </div>
                </div>
                <div class="sim-grid">${subjectsHTML}</div>
                ${warningHTML}
            </div>
        `;
    }
}

// ============================================================
// [기능 4] 코칭 & 주간 학습 점검
// ============================================================
function getWeekOfMonth(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const day = start.getDay() || 7; 
    const diff = date.getDate() - 1 + (day - 1); 
    return Math.floor(diff / 7) + 1;
}

function getWeekTitle(date) {
    const yearShort = date.getFullYear().toString().slice(2);
    const month = date.getMonth() + 1;
    const week = getWeekOfMonth(date);
    return `${yearShort}년 ${month}월 ${week}주차`;
}

// 백엔드 generateWeekId()와 동일한 로직 — DB weekId 일관성 유지
function generateWeekId(dateObj) {
    const year = dateObj.getFullYear().toString().slice(2);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const dayOfWeek = startOfMonth.getDay();
    const offsetDate = dateObj.getDate() + dayOfWeek - 1;
    const weekNum = String(Math.floor(offsetDate / 7) + 1).padStart(2, '0');
    return `${year}${month}${weekNum}`;
}

function applyCoachTierLock() {
    const container = document.querySelector('.coach-container');
    if (!container) return;

    if (['free', 'basic', 'trial'].includes(currentUserTier)) {
        container.classList.add('tier-locked');
        container.style.position = 'relative';
        container.style.minHeight = '400px'; // 💡 높이 강제 고정으로 모달 위치 통일
        if (container.querySelector('.coach-tier-lock-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'coach-tier-lock-overlay';
        overlay.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(6px); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 50; border-radius: 12px;";
        overlay.innerHTML = getStandardLockOverlayHTML('주간 학습 점검 및 피드백');
        container.appendChild(overlay);
    } else {
        container.classList.remove('tier-locked');
        container.style.minHeight = 'auto'; // 권한 있을 시 원상복구
        const existingOverlay = container.querySelector('.coach-tier-lock-overlay');
        if (existingOverlay) existingOverlay.remove();
    }
}

function switchWeeklyTab(step) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if(step === 'step1') document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
    else document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${step}`).classList.add('active');
}

function setWeeklyLoadingStatus(isLoading) {
    const msg = document.getElementById('weeklyDeadlineMsg');
    const badge = document.getElementById('weeklyStatusBadge');
    if (!msg || !badge) return;
    
    if (isLoading) {
        badge.innerText = '...'; badge.className = 'badge-status pending'; 
        msg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 로딩중...';
    } else {
        msg.innerText = '(매주 일요일 20:00 마감)';
        renderFeedbackList(); 
    }
}

// 💡 [수정] 분리된 weeklyDataHistory(배열)를 직접 순회
function checkWeeklyStatus() {
    const today = new Date();
    const currentWeekTitle = getWeekTitle(today); 
    const history = Array.isArray(weeklyDataHistory) ? weeklyDataHistory : [];
    
    const thisWeekData = history.find(w => { 
        if(!w.title) return false; 
        return w.title.replace(/\s+/g, '').includes(currentWeekTitle.replace(/\s+/g, '')); 
    });
    
    const badge = document.getElementById('weeklyStatusBadge');
    const box = document.getElementById('weeklyBox');
    if (!badge || !box) return;
    
    if (thisWeekData) { badge.className = 'badge-status submitted'; badge.innerText = '✅ 제출완료'; } 
    else { badge.className = 'badge-status pending'; badge.innerText = '미제출'; }
    
    const day = today.getDay(); const hour = today.getHours();
    if (day === 0 && hour >= 20) { 
        badge.className = 'badge-status locked'; badge.innerText = '⛔ 마감됨'; 
        box.classList.add('disabled'); box.onclick = null; 
    } else { 
        box.classList.remove('disabled'); box.onclick = openWeeklyCheckModal; 
    }
}

function renderFeedbackList() {
    const history = Array.isArray(weeklyDataHistory) ? weeklyDataHistory : [];
    const listContainer = document.getElementById('feedbackList');
    const select = document.getElementById('feedbackYearMonth');
    if(!listContainer || !select) return;

    const yearMonths = new Set();
    history.forEach(h => {
        const match = h.title && h.title.match(/(\d{2,4}년\s\d{1,2}월)/);
        if(match) yearMonths.add(match[1]);
    });

    const today = new Date();
    const currentYM = `${String(today.getFullYear()).slice(2)}년 ${today.getMonth()+1}월`;
    if(yearMonths.size === 0) yearMonths.add(currentYM);
    
    const prevValue = select.value;
    select.innerHTML = '';
    Array.from(yearMonths).sort().reverse().forEach(ym => {
        const option = document.createElement('option'); option.value = ym; option.innerText = ym; select.appendChild(option);
    });
    if (prevValue && yearMonths.has(prevValue)) select.value = prevValue; else select.selectedIndex = 0;
    const selectedYM = select.value;

    listContainer.innerHTML = '';
    const filtered = history.filter(h => h.title && h.title.includes(selectedYM)).sort((a,b) => new Date(b.date) - new Date(a.date));

    if(filtered.length === 0) {
        listContainer.innerHTML = '<div class="empty-feedback">제출된 기록이 없습니다.</div>';
        return;
    }

    const fragment = document.createDocumentFragment(); 
    filtered.forEach(h => {
        const fb = h.tutorFeedback || {};
        const hasFeedback = fb && (
            (fb.priorityCheck && String(fb.priorityCheck).trim() !== "") || 
            (fb.weakSubject && String(fb.weakSubject).trim() !== "") || 
            (fb.nextWeekTop3 && String(fb.nextWeekTop3).trim() !== "") || 
            (fb.planEvaluation && String(fb.planEvaluation).trim() !== "") ||
            (fb.extraQuestion && String(fb.extraQuestion).trim() !== "")
        );

        const div = document.createElement('div'); 
        div.className = 'feedback-tile';
        div.onclick = () => { openFeedbackModal(h); };

        const titleDiv = document.createElement('div');
        titleDiv.className = 'fb-title';
        titleDiv.textContent = h.title || "주간 리포트"; // 🔒 안전

        const statusDiv = document.createElement('div');
        statusDiv.className = 'fb-status';
        statusDiv.style.cssText = hasFeedback ? 'color:#15803d; font-weight:bold;' : 'color:#94a3b8;';
        statusDiv.textContent = hasFeedback ? '피드백 도착 ✅' : '피드백 대기중 ⏳'; // 🔒 안전

        div.appendChild(titleDiv);
        div.appendChild(statusDiv);
        fragment.appendChild(div);
    });
    listContainer.appendChild(fragment);
}

function openFeedbackModal(data) {
    const modal = document.getElementById('feedbackModal');
    const contentArea = document.querySelector('#feedbackModal .modal-body') || document.getElementById('modalContent'); 
    if (!contentArea) return;

    const fb = data.tutorFeedback || {};
    const hasFeedback = fb && (
        (fb.priorityCheck && String(fb.priorityCheck).trim() !== "") || 
        (fb.weakSubject && String(fb.weakSubject).trim() !== "") || 
        (fb.nextWeekTop3 && String(fb.nextWeekTop3).trim() !== "") || 
        (fb.planEvaluation && String(fb.planEvaluation).trim() !== "") ||
        (fb.extraQuestion && String(fb.extraQuestion).trim() !== "") ||
        (fb.tutorImage && String(fb.tutorImage).trim() !== "")
    );

    if (!hasFeedback) {
        contentArea.innerHTML = `
            <div class="pending-view" style="background:#fff; padding:100px 20px; border-radius:16px;">
                <div class="pending-icon" style="font-size:4rem; color:#cbd5e1; margin-bottom:20px;"><i class="fas fa-hourglass-half"></i></div>
                <h2 style="color:#1e293b; margin-bottom:10px; font-weight:800;">피드백 작성 대기중</h2>
                <p style="color:#64748b; margin-bottom:30px;">담당 컨설턴트가 학생의 리포트를 꼼꼼히 분석하고 있습니다.</p>
                <button onclick="document.getElementById('feedbackModal').style.display='none'" style="padding:12px 30px; background:#f1f5f9; border:none; border-radius:8px; font-weight:bold; color:#475569; cursor:pointer;">닫기</button>
            </div>`;
        modal.style.display = 'block';
        return;
    }

    const consultantName = escapeHtml(data.tutorName || currentTutorName);
    let detailRows = ''; let totalPlan = '0H', totalAct = '0H', totalRate = '0%';
    
    if (data.studyTime) {
        totalPlan = data.studyTime.totalPlan || '0H'; totalAct = data.studyTime.totalAct || '0H'; totalRate = data.studyTime.totalRate || '0%';
        if (data.studyTime.details && data.studyTime.details.length > 0) {
            data.studyTime.details.forEach(d => {
                const plan = parseFloat(d.plan) || 0; const act = parseFloat(d.act) || 0;
                const rate = plan > 0 ? Math.min((act / plan) * 100, 100).toFixed(0) : 0;
                const rateColor = rate >= 80 ? '#10b981' : (rate >= 50 ? '#f59e0b' : '#ef4444');
                
                let mainSub = d.subject; let detailSub = "-";
                const match = d.subject.match(/^(.*?)\s*\((.*?)\)$/);
                if(match) { mainSub = match[1]; detailSub = match[2]; }
                
                detailRows += `<tr><td style="text-align:left; font-weight:700; color:#334155;">${escapeHtml(mainSub)}</td><td style="color:#64748b; font-size:0.85rem; font-weight:600;">${escapeHtml(detailSub)}</td><td>${plan}H</td><td style="color:#2563eb; font-weight:bold;">${act}H</td><td style="color:${rateColor}; font-weight:800;">${rate}%</td></tr>`;
            });
        }
    }
    if (!detailRows) detailRows = `<tr><td colspan="5" style="color:#94a3b8; padding:20px;">상세 학습 기록이 없습니다.</td></tr>`;
	
	const CODE_MAP = { 'un': '언매', 'hj': '화작', 'mi': '미적', 'ki': '기하', 'hw': '확통' };
    const getOptName = (code) => CODE_MAP[code] || code || '-';
    
    let examHtml = '';
    if (data.mockExam && data.mockExam.type && data.mockExam.type !== 'none') {
        const typeMap = { 'school': '교내', 'edu': '평가원/교육청', 'private': '사설' };
        const typeName = typeMap[data.mockExam.type] || '기타';
        let scoreDetails = ''; const s = data.mockExam.scores || {};
        const rowStyle = "margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;";
        if(s.kor) scoreDetails += `<div style="${rowStyle}"><span style="color:#64748b; font-size:0.85rem;">국어 (${escapeHtml(getOptName(s.korOpt))})</span> <strong style="color:#1e293b;">${escapeHtml(s.kor)}</strong></div>`;
        if(s.math) scoreDetails += `<div style="${rowStyle}"><span style="color:#64748b; font-size:0.85rem;">수학 (${escapeHtml(getOptName(s.mathOpt))})</span> <strong style="color:#1e293b;">${escapeHtml(s.math)}</strong></div>`;
        if(s.eng) scoreDetails += `<div style="${rowStyle}"><span style="color:#64748b; font-size:0.85rem;">영어</span> <strong style="color:#1e293b;">${escapeHtml(s.eng)}</strong></div>`;
        if(s.inq1) scoreDetails += `<div style="${rowStyle}"><span style="color:#64748b; font-size:0.85rem;">${escapeHtml(s.inq1Name||'탐구1')}</span> <strong style="color:#1e293b;">${escapeHtml(s.inq1)}</strong></div>`;
        if(s.inq2) scoreDetails += `<div style="${rowStyle}"><span style="color:#64748b; font-size:0.85rem;">${escapeHtml(s.inq2Name||'탐구2')}</span> <strong style="color:#1e293b;">${escapeHtml(s.inq2)}</strong></div>`;
        examHtml = `<div style="font-weight:800; font-size:1.1rem; color:#1e293b; margin-bottom:15px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">${typeName} 모의고사</div><div style="text-align:left; padding:0 10px;">${scoreDetails || '<div style="color:#94a3b8; text-align:center;">상세 점수 미입력</div>'}</div>`;
    } else {
        examHtml = `<div style="color:#94a3b8; padding:30px 0; font-weight:600;"><i class="fas fa-ban" style="margin-bottom:10px; font-size:1.5rem;"></i><br>이번 주 응시 기록 없음</div>`;
    }

    let trendHtml = '-', trendReasonsHtml = '';
    if (data.trend) {
        const t = data.trend.status;
        if(t === 'up') trendHtml = '<span style="color:#10b981; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="fas fa-arrow-trend-up"></i> 상승세</span>';
        else if(t === 'down') trendHtml = '<span style="color:#ef4444; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="fas fa-arrow-trend-down"></i> 하락세</span>';
        else trendHtml = '<span style="color:#64748b; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="fas fa-minus"></i> 유지중</span>';
        
        if (data.trend.reasons && data.trend.reasons.length > 0) trendReasonsHtml = `<strong>하락 요인:</strong> ${data.trend.reasons.map(r => escapeHtml(r)).join(', ')}`;
        else trendReasonsHtml = '학생이 체크한 특이사항이 없습니다.';
    }

    let deepQnaHtml = '';
    const QUESTION_CATEGORIES = ['학습 계획 점검', '학습 방향성 설정', '취약 과목 솔루션', '기타 멘탈 관리'];
    if (data.deepAnswers && data.deepAnswers.some(ans => ans && ans.trim() !== "")) {
        data.deepAnswers.forEach((ans, idx) => {
            if (ans && ans.trim() !== "") {
                deepQnaHtml += `<div style="margin-bottom:15px; page-break-inside: avoid;"><strong style="color:#b91c1c; font-size:0.9rem; display:block; margin-bottom:4px;">Q${idx+1}. ${QUESTION_CATEGORIES[idx]}</strong><div style="color:#334155; font-size:0.95rem; padding-left:10px; border-left:3px solid #fecaca;">${escapeHtml(ans)}</div></div>`;
            }
        });
    } else {
        deepQnaHtml = '<div style="color:#94a3b8; padding:10px 0;">작성된 심층 질문이 없습니다.</div>';
    }
    
    let tutorFileBlockHtml = '';
    const uniqueContainerId = `pdf-render-${Date.now()}`; 
    let isPdfFile = false; let actualPdfUrl = "";

    if (fb.tutorImage && String(fb.tutorImage).trim() !== "") {
        isPdfFile = fb.tutorImage.toLowerCase().includes('.pdf');
        actualPdfUrl = fb.tutorImage;
        let fileDisplayHtml = '';
        
        if (isPdfFile) {
            fileDisplayHtml = `<div id="${uniqueContainerId}" style="width: 100%; display: block; text-align: center;"><div style="padding: 40px 0; color:#3b82f6; font-weight:bold;" class="pdf-loading-spinner"><i class="fas fa-spinner fa-spin fa-2x" style="margin-bottom:10px;"></i><br>튜터의 첨삭 PDF 문서를 불러오는 중입니다...</div></div>`;
        } else {
            const noCacheUrl = `${escapeHtml(fb.tutorImage)}?t=${new Date().getTime()}`;
            fileDisplayHtml = `<div style="text-align:center; padding: 10px 0;"><img src="${noCacheUrl}" crossorigin="anonymous" alt="튜터 플래너 코칭" style="max-width:100%; height:auto; border-radius:8px; border:1px solid #cbd5e1; display:block; margin: 0 auto;"></div>`;
        }
        
        tutorFileBlockHtml = `
            <div id="attachedPdfData" data-pdf-url="${actualPdfUrl}" style="display:none;"></div>
            <div class="doc-matched-box allow-page-break" style="margin-top: 30px;">
                <div class="doc-matched-header"><i class="fas fa-paperclip" style="color:#3b82f6;"></i> 5. 주간 플래너 코칭 & 첨삭</div>
                <div class="doc-matched-body allow-page-break-body" style="padding:25px;">${fileDisplayHtml}</div>
            </div>`;
    }

    const safeTitleForJs = escapeHtml(data.title || "주간 리포트").replace(/'/g, "\\'");
    
    const html = `
        <div class="modal-document" id="pdfTargetDocument">
            <div class="doc-controls" data-html2canvas-ignore="true">
                <button class="btn-pdf" onclick="downloadReportPDF('${safeTitleForJs}')"><i class="fas fa-file-pdf"></i> PDF 파일 다운로드</button>
                <button class="close-btn-doc" onclick="document.getElementById('feedbackModal').style.display='none'">&times;</button>
            </div>
            <div class="doc-header">
                <div><span class="doc-subtitle">PREMIUM STRATEGY</span><h2 class="doc-title">스터디크랙 주간 전략리포트</h2></div>
                <div class="doc-meta"><div>대상: <strong>${escapeHtml(data.title || "주간 리포트")}</strong></div><div>발행일: <strong>${new Date(data.date).toLocaleDateString()}</strong></div><div>분석: <strong>${consultantName}</strong></div></div>
            </div>
            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-clock"></i> 1. 학습 목표 이행 평가</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data"><span class="doc-badge">학생 리포트</span><table class="doc-table"><thead><tr><th>과목</th><th>세부 내용</th><th>계획</th><th>실제</th><th>달성률</th></tr></thead><tbody>${detailRows}</tbody></table><div style="margin-top:15px; text-align:right; font-size:0.9rem; color:#64748b; font-weight:700; background:#f8fafc; padding:8px; border-radius:6px;">총 달성률 <span style="color:#2563eb; font-size:1.1rem; margin-left:5px;">${totalRate}</span> <span style="font-weight:normal; font-size:0.8rem;">(${totalAct} / ${totalPlan})</span></div></div>
                    <div class="doc-tutor-feedback"><span class="doc-badge tutor-badge">Consultant 코멘트</span><h4 style="margin:0 0 10px 0; font-size:1rem; color:#1e293b;">이전 우선순위 점검 결과</h4><div class="doc-text">${escapeHtml(fb.priorityCheck) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div></div>
                </div>
            </div>
            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-bullseye"></i> 2. 실전 성취도 & 취약점 분석</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data"><span class="doc-badge">시험 성적</span><div style="padding:15px; background:#f8fafc; border-radius:12px; text-align:center; border:1px solid #e2e8f0; height:calc(100% - 50px); display:flex; flex-direction:column; justify-content:center;">${examHtml}</div></div>
                    <div class="doc-tutor-feedback"><span class="doc-badge tutor-badge">Consultant 코멘트</span><h4 style="margin:0 0 10px 0; font-size:1rem; color:#1e293b;">취약 과목 진단 및 개선 포인트</h4><div class="doc-text">${escapeHtml(fb.weakSubject) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div></div>
                </div>
            </div>
            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-route"></i> 3. 총평 및 Next Step</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data"><span class="doc-badge">학생 컨디션 평가</span><div style="margin-bottom:15px; font-weight:900; font-size:1.3rem; text-align:center; padding:15px; background:#f8fafc; border-radius:8px;">${trendHtml}</div><div style="font-size:0.85rem; color:#64748b; background:#fff1f2; border:1px solid #fecaca; padding:12px; border-radius:8px;">${trendReasonsHtml}</div></div>
                    <div class="doc-tutor-feedback"><span class="doc-badge tutor-badge">Consultant 코멘트</span><h4 style="margin:0 0 10px 0; font-size:1rem; color:#1e293b;">이번 주 플랜 종합 평가</h4><div class="doc-text" style="margin-bottom:20px; padding-bottom:20px; border-bottom:1px dashed #cbd5e1;">${escapeHtml(fb.planEvaluation) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div><h4 style="margin:0 0 10px 0; font-size:1rem; color:#2563eb;"><i class="fas fa-flag-checkered"></i> 다음 주 핵심 과제 TOP 3</h4><div class="doc-text">${escapeHtml(fb.nextWeekTop3) || '<span style="color:#94a3b8">관련 코멘트 없음</span>'}</div></div>
                </div>
            </div>
            <div class="doc-matched-box">
                <div class="doc-matched-header"><i class="fas fa-comments"></i> 4. 심층 Q&A 솔루션</div>
                <div class="doc-matched-body">
                    <div class="doc-student-data"><span class="doc-badge" style="background:#fef2f2; color:#ef4444; border-color:#fecaca;">학생의 심층 질문</span>${deepQnaHtml}</div>
                    <div class="doc-tutor-feedback"><span class="doc-badge tutor-badge" style="background:#f0fdf4; color:#16a34a; border-color:#bbf7d0;">Consultant 추가 코멘트</span><div class="doc-text">${escapeHtml(fb.extraQuestion) || '<span style="color:#94a3b8">추가 코멘트가 없습니다.</span>'}</div></div>
                </div>
            </div>
            ${tutorFileBlockHtml}
        </div>

        <div class="mobile-only-msg" style="display:none;">
            <i class="fas fa-file-pdf" style="font-size:3rem; color:#3b82f6; margin-bottom:15px;"></i>
            <h3 style="margin:0 0 10px 0; color:#1e293b; font-size:1.4rem;">주간 리포트 도착</h3>
            <p style="color:#64748b; font-size:0.95rem; margin-bottom:25px; line-height:1.5; word-break:keep-all;">
                모바일에서는 쾌적한 열람을 위해<br>PDF 변환 후 다운로드를 지원합니다.
            </p>
            <button onclick="downloadReportPDF('${safeTitleForJs}')" class="mobile-pdf-btn">
                <i class="fas fa-magic" style="color: #ffffff !important; font-size: 1.1rem !important; margin-bottom: 0 !important;"></i> 리포트 PDF 생성하기
            </button>
            <button class="mobile-close-btn" onclick="document.getElementById('feedbackModal').style.display='none'">
                닫기
            </button>
        </div>
    `;

    contentArea.innerHTML = html;
    modal.style.display = 'block';
    if (isPdfFile && typeof renderPdfToImages === 'function') setTimeout(() => { renderPdfToImages(actualPdfUrl, uniqueContainerId); }, 100);
}

async function downloadReportPDF(reportTitle) {
    const reportElement = document.getElementById('pdfTargetDocument');
    if (!reportElement) return alert('리포트 내용을 찾을 수 없습니다.');
    if (reportElement.querySelector('.pdf-loading-spinner')) return alert("첨부파일 렌더링 중입니다. 잠시 후 다시 클릭해주세요.");

    const attachedPdfEl = reportElement.querySelector('#attachedPdfData');
    const attachedPdfUrl = attachedPdfEl ? attachedPdfEl.getAttribute('data-pdf-url') : null;

    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'pdf-loading-overlay';
    loadingOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(255,255,255,0.98); z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center;';
    loadingOverlay.innerHTML = `<i class="fas fa-spinner fa-spin fa-3x" style="color:#2563eb; margin-bottom:20px;"></i><h2 style="color:#1e293b; font-weight:800; margin-bottom:10px;">프리미엄 PDF 리포트 생성 중...</h2><p style="color:#64748b;">서버에서 고화질 PDF를 렌더링하고 병합하고 있습니다. 잠시만 기다려주세요.</p>`;
    document.body.appendChild(loadingOverlay);

    let finalDownloadUrl = null;

    try {
        const clonedReport = reportElement.cloneNode(true);
        const attachedPdfDataEl = clonedReport.querySelector('#attachedPdfData');
        
        if (attachedPdfDataEl && attachedPdfUrl) {
            const section5Box = attachedPdfDataEl.nextElementSibling;
            if (section5Box && section5Box.classList.contains('doc-matched-box')) {
                section5Box.remove();
            }

            const noticeHtml = `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #cbd5e1; text-align: right; color: #2563eb; font-weight: 800; font-size: 1.1rem;">
                    <i class="fas fa-file-pdf" style="margin-right: 5px;"></i> 5. 튜터 플래너 첨삭은 다음 장에서 이어집니다 ▶
                </div>
            `;
            clonedReport.insertAdjacentHTML('beforeend', noticeHtml);
        }

        const rawHtml = `
            <!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><base href="https://studycrack.co.kr">
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Noto Sans KR', sans-serif; background: #fff; color: #333; margin: 0; padding: 0; zoom: 0.9; }
                .report-wrapper { width: 100%; max-width: 900px; margin: 0 auto; background: transparent; padding: 30px 10px; box-sizing: border-box; }
                .doc-controls, .mobile-only-msg { display: none !important; }
                .doc-header { border-bottom: 3px solid #1e293b; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
                .doc-subtitle { font-size: 0.85rem; font-weight: 800; color: #3b82f6; background: #eff6ff; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 5px; }
                .doc-title { font-size: 2.2rem; font-weight: 900; color: #0f172a; margin: 0; }
                .doc-meta { font-size: 0.95rem; color: #64748b; text-align: right; line-height: 1.6; }
                .doc-matched-box { border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 30px; background: #fff; page-break-inside: avoid; break-inside: avoid; }
                .doc-matched-header { background: #f8fafc; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 800; font-size: 1.1rem; color: #1e293b; border-radius: 12px 12px 0 0; }
                .doc-matched-body { display: table; width: 100%; box-sizing: border-box; table-layout: fixed; }
                .doc-student-data { display: table-cell; width: 40%; vertical-align: top; padding: 20px; border-right: 1px dashed #cbd5e1; word-break: break-word; overflow-wrap: break-word; }
                .doc-tutor-feedback { display: table-cell; width: 60%; vertical-align: top; padding: 20px; background: #fafafa; border-radius: 0 0 12px 0; word-break: break-word; overflow-wrap: break-word; }
                .doc-text { font-size: 0.95rem; line-height: 1.7; white-space: pre-wrap; color: #334155; word-break: break-word; overflow-wrap: break-word; }
                .doc-table th { padding: 8px 4px; border-bottom: 1px solid #e2e8f0; color: #94a3b8; vertical-align: middle; }
                .doc-table td { padding: 8px 4px; border-bottom: 1px solid #f1f5f9; text-align: center; vertical-align: middle; }
                .doc-badge { display: inline-block; padding: 4px 10px; background: #f1f5f9; color: #475569; border-radius: 6px; font-size: 0.8rem; font-weight: 800; margin-bottom: 15px; letter-spacing: -0.5px; border: 1px solid #e2e8f0; }
                .doc-badge.tutor-badge { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
                .qna-pair-container { display: block; margin-bottom: 15px; }
                .qna-student { background: #fff1f2; padding: 18px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 15px; }
                .qna-tutor { background: #f0fdf4; padding: 18px; border-radius: 8px; border: 1px solid #bbf7d0; }
                .allow-page-break { page-break-before: always !important; break-before: page !important; page-break-inside: auto !important; break-inside: auto !important; margin-top: 0 !important; }
                .allow-page-break-body { display: block !important; }
                img { page-break-inside: avoid !important; break-inside: avoid !important; max-width: 100% !important; max-height: 250mm !important; object-fit: contain !important; display: block !important; margin: 0 auto 15px auto !important; }
            </style></head>
            <body><img src="https://studycrack.co.kr/assets/backgrounds/bg_studycrack_logo.png" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:500px; opacity:0.08; z-index:9999; pointer-events:none; max-height:none !important;">
                <div class="report-wrapper">${clonedReport.innerHTML}</div>
            </body></html>
        `;

        const token = localStorage.getItem('idToken');
        
        const response = await fetch(PDF_API_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                title: reportTitle, 
                html: rawHtml,
                attachedPdfUrl: attachedPdfUrl 
            })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            finalDownloadUrl = data.downloadUrl;
        } else { throw new Error(data.error || "서버에서 PDF를 생성하지 못했습니다."); }
    } catch (error) { alert("PDF 생성 중 오류가 발생했습니다: " + error.message); } 
    finally { 
        if (loadingOverlay && loadingOverlay.parentNode) {
            loadingOverlay.parentNode.removeChild(loadingOverlay);
        }

        if (finalDownloadUrl) {
            const isMobile = window.innerWidth <= 768; 
            
            if (isMobile) {
                const contentArea = document.querySelector('#feedbackModal .modal-body') || document.getElementById('modalContent');
                if (contentArea) {
                    contentArea.innerHTML = `
                        <div class="mobile-only-msg" style="display:flex !important; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px 20px; background:#ffffff; border-radius:12px; margin:0 auto; width:100%; box-sizing:border-box;">
                            <i class="fas fa-file-pdf" style="font-size:3rem; color:#ef4444; margin-bottom:15px;"></i>
                            <h3 style="margin:0 0 10px 0; color:#1e293b; font-size:1.4rem;">PDF 준비 완료</h3>
                            <p style="color:#64748b; font-size:0.95rem; margin-bottom:25px; line-height:1.5; word-break:keep-all;">리포트 생성이 성공적으로 완료되었습니다.<br>아래 버튼을 눌러 기기에 저장하거나 확인해 주세요.</p>
                            <a href="${finalDownloadUrl}" download="스터디크랙_${reportTitle}.pdf" target="_blank" class="mobile-pdf-btn" style="width:100%; padding:14px 20px; font-size:1.05rem; background:#3b82f6; color:white; border:none; border-radius:8px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:10px; cursor:pointer; text-decoration:none;">리포트 열기 / 다운로드</a>
                            <button class="mobile-close-btn" onclick="document.getElementById('feedbackModal').style.display='none'" style="width:100%; padding:14px; font-size:1rem; background:#f1f5f9; border:none; border-radius:8px; color:#475569; font-weight:700; cursor:pointer;">닫기</button>
                        </div>
                    `;
                }
            } else {
                const link = document.createElement('a'); 
                link.href = finalDownloadUrl; 
                link.target = '_blank'; 
                link.download = `스터디크랙_${reportTitle}.pdf`; 
                document.body.appendChild(link); 
                link.click(); 
                document.body.removeChild(link);
            }
        }
    }
}

async function renderPdfToImages(url, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // html에 선언된 pdf.js 라이브러리의 worker 소스 설정 (버전 일치 필요)
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // S3에서 PDF 파일 다운로드 및 파싱
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        
        // 렌더링 시작 전 무한 로딩 스피너 제거
        container.innerHTML = ''; 

        // PDF의 모든 페이지를 순회하며 캔버스로 그려내기
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            // 고화질 렌더링을 위해 scale 값을 2.0으로 설정 (모바일/PC 모두 깔끔하게 보임)
            const scale = 2.0; 
            const viewport = page.getViewport({ scale: scale });

            // 캔버스 엘리먼트 생성
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // 스타일 적용 (반응형 100% 폭)
            canvas.style.cssText = 'width: 100%; max-width: 100%; margin-bottom: 15px; border-radius: 8px; border: 1px solid #e2e8f0; display: block; box-sizing: border-box;';

            // 화면에 캔버스 먼저 추가 후 렌더링 진행 (사용자가 진행 상황을 볼 수 있도록)
            container.appendChild(canvas); 
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
        }
    } catch (error) {
        console.error("PDF 렌더링 실패:", error);
        // 에러 발생 시 무한 로딩을 멈추고 직접 다운로드 링크 제공
        container.innerHTML = `
            <div style="padding: 30px; text-align: center; color: #ef4444; background: #fef2f2; border-radius: 8px;">
                <i class="fas fa-exclamation-triangle fa-2x" style="margin-bottom: 10px;"></i><br>
                PDF 문서를 화면에 불러오지 못했습니다.<br>
                <a href="${url}" target="_blank" style="color: #2563eb; text-decoration: underline; font-size: 0.95rem; display: inline-block; margin-top: 10px; font-weight: bold;">
                    직접 다운로드하여 확인하기 <i class="fas fa-external-link-alt" style="font-size:0.8rem;"></i>
                </a>
            </div>`;
    }
}

let currentMobileStep = 0; let wizardSteps = []; let wizardResizeHandler = null;

function openWeeklyCheckModal() {
    if (!['standard', 'pro'].includes(currentUserTier)) { alert("🔒 Standard 멤버십 이상 전용 기능입니다.\n멤버십 업그레이드 후 이용해주세요."); return; }
    const today = new Date();
    if (today.getDay() === 0 && today.getHours() >= 20) { alert("금주 학습 점검 제출이 마감되었습니다."); return; }
    
    const modal = document.getElementById('weeklyCheckModal'); const modalContent = modal.querySelector('.check-modal-content');
    const currentWeekTitle = getWeekTitle(today); const [yStr, mStr, wStr] = currentWeekTitle.split(' '); 
    document.getElementById('weeklyYear').innerText = yStr; document.getElementById('weeklyDateDetail').innerText = `${mStr} ${wStr}`;
    
    // weekId 기준 우선 탐색, 없으면 title로 fallback (구 데이터 호환)
    const currentWeekId = generateWeekId(today);
    const thisWeekData = weeklyDataHistory.find(w => w.weekId === currentWeekId)
        || weeklyDataHistory.find(w => w.title && w.title.replace(/\s/g, '') === currentWeekTitle.replace(/\s/g, ''));
    if (thisWeekData) loadWeeklyDataToForm(thisWeekData); else resetWeeklyForm();
    
    function applyModalLayout() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            modalContent.classList.add('mobile-wizard-mode'); wizardSteps = Array.from(modal.querySelectorAll('.check-section, .pro-input-card'));
            if(currentMobileStep >= wizardSteps.length) currentMobileStep = 0; 
            updateMobileWizardUI();
        } else {
            modalContent.classList.remove('mobile-wizard-mode'); document.getElementById('mobileWizardProgress').style.display = 'none';
            document.getElementById('wizardPrevBtn').style.display = 'none'; document.getElementById('wizardNextBtn').style.display = 'none';
            document.getElementById('wizardSubmitBtn').style.display = 'block'; document.getElementById('wizardSubmitBtn').style.width = '100%';
            switchWeeklyTab('step1'); 
        }
    }
    applyModalLayout();
    if (!wizardResizeHandler) { wizardResizeHandler = () => { if (modal.style.display === 'block') applyModalLayout(); }; window.addEventListener('resize', wizardResizeHandler); }
    modal.style.display = 'block'; document.body.style.overflow = 'hidden';
}

function updateMobileWizardUI() {
    wizardSteps.forEach((step, idx) => { if (idx === currentMobileStep) step.classList.add('active-step'); else step.classList.remove('active-step'); });
    const progressEl = document.getElementById('mobileWizardProgress'); progressEl.style.display = 'block'; progressEl.innerText = `${currentMobileStep + 1} / ${wizardSteps.length} 단계`;
    const prevBtn = document.getElementById('wizardPrevBtn'); const nextBtn = document.getElementById('wizardNextBtn'); const submitBtn = document.getElementById('wizardSubmitBtn');

    if (currentMobileStep === 0) { prevBtn.style.display = 'none'; nextBtn.style.display = 'block'; submitBtn.style.display = 'none'; } 
    else if (currentMobileStep === wizardSteps.length - 1) { prevBtn.style.display = 'block'; nextBtn.style.display = 'none'; submitBtn.style.display = 'block'; } 
    else { prevBtn.style.display = 'block'; nextBtn.style.display = 'block'; submitBtn.style.display = 'none'; }
    const modalBody = document.querySelector('.check-modal-content .modal-body.scrollable'); if (modalBody) modalBody.scrollTop = 0;
}
function nextMobileStep() { if (currentMobileStep < wizardSteps.length - 1) { currentMobileStep++; updateMobileWizardUI(); } }
function prevMobileStep() { if (currentMobileStep > 0) { currentMobileStep--; updateMobileWizardUI(); } }
function closeWeeklyModal() { document.getElementById('weeklyCheckModal').style.display = 'none'; document.body.style.overflow = 'auto'; }

function resetWeeklyForm() {
    // 1. 과목 리스트 초기화 (기본 과목 클리어 및 동적 카드 삭제)
    const list = document.getElementById('studyTimeList');
    if (list) {
        // 'addSubjectCard'로 추가되었던 커스텀 카드들만 선택해서 삭제
        const dynamicCards = list.querySelectorAll('.custom-added-card');
        dynamicCards.forEach(card => card.remove());
    }

    // 기본 과목(국어, 수학, 영어)의 입력값 및 달성률 텍스트 초기화
    document.querySelectorAll('.plan-time, .act-time, .sub-detail').forEach(input => {
        input.value = '';
    });
    document.querySelectorAll('.rate-txt').forEach(span => {
        span.innerText = '0%';
        span.style.color = '#334155'; // 기본 색상으로 복구
    });

    // 2. 총합 요약 영역 초기화
    const totalPlan = document.getElementById('totalPlan');
    const totalAct = document.getElementById('totalAct');
    const totalRate = document.getElementById('totalRate');
    
    if (totalPlan) totalPlan.innerText = '0H';
    if (totalAct) totalAct.innerText = '0H';
    if (totalRate) totalRate.innerText = '0%';

    // 3. 실전 모의고사 섹션 초기화
    // '미응시' 타일을 찾아 선택 상태로 강제 전환
    const noneMockTile = document.querySelector('.mock-tile[onclick*="\'none\'"]');
    if (noneMockTile) selectMockType('none', noneMockTile);

    const mockFieldIds = [
        'mockKorScore', 'mockKorOpt', 'mockMathScore', 'mockMathOpt', 
        'mockEngScore', 'mockInq1Score', 'mockInq1Name', 'mockInq2Score', 'mockInq2Name'
    ];
    mockFieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // 모의고사 파일 업로드 표시 초기화
    const mockFileDisplay = document.getElementById('mockFileNameDisplay');
    if (mockFileDisplay) {
        mockFileDisplay.innerText = '선택된 파일 없음';
        mockFileDisplay.style.color = '#94a3b8';
    }
    const mockFileInput = document.getElementById('mockExamProof');
    if (mockFileInput) mockFileInput.value = '';

    // 4. 학업 추이 및 하락 원인 섹션 초기화
    const trendRadios = document.getElementsByName('studyTrend');
    if (trendRadios.length >= 2) trendRadios[1].checked = true; // '유지' 인덱스 선택

    const slumpDetail = document.getElementById('slumpDetail');
    if (slumpDetail) slumpDetail.value = '';

    document.querySelectorAll('#slumpReasonBox input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    const slumpBox = document.getElementById('slumpReasonBox');
    if (slumpBox) slumpBox.style.display = 'none';

    // 5. 플래너 인증 파일 배열 및 뷰 초기화
    currentPlannerFiles = []; // 전역 파일 배열 비우기
    const plannerInput = document.getElementById('plannerUpload');
    if (plannerInput) plannerInput.value = '';
    renderPlannerFiles();

    // 6. 심층 질문(Step 2) 및 글자 수 카운터 초기화
    const deepQuestionIds = ['deepQ1', 'deepQ2', 'deepQ3', 'deepQ4'];
    deepQuestionIds.forEach(id => {
        const textarea = document.getElementById(id);
        if (textarea) {
            textarea.value = '';
            // 텍스트영역 다음에 오는 글자 수 카운트 span 업데이트
            const countSpan = textarea.parentElement.querySelector('.char-count span');
            if (countSpan) countSpan.innerText = '0';
        }
    });

    // 7. [핵심] 사용자가 버튼을 누르지 않아도 빈 과목 슬롯 1개를 자동으로 생성
    if (typeof addSubjectCard === 'function') {
        addSubjectCard();
    }
}

function selectMockType(type, element) { document.getElementById('mockExamType').value = type; document.querySelectorAll('.mock-tile').forEach(tile => tile.classList.remove('selected')); element.classList.add('selected'); toggleMockExamFields(); }
function toggleMockExamFields() { const type = document.getElementById('mockExamType').value; const fields = document.getElementById('mockExamFields'); if (type === 'none') fields.style.display = 'none'; else fields.style.display = 'block'; }

function calcStudyRates() {
    const cards = document.querySelectorAll('.subject-card'); let sumPlan = 0, sumAct = 0;
    cards.forEach(card => {
        const planInput = card.querySelector('.plan-time'); const actInput = card.querySelector('.act-time'); const rateTxt = card.querySelector('.rate-txt');
        if(!planInput || !actInput) return;
        const plan = parseFloat(planInput.value) || 0; const act = parseFloat(actInput.value) || 0;
        sumPlan += plan; sumAct += act;
        if (plan > 0) {
            const rate = Math.min((act / plan) * 100, 100).toFixed(0); rateTxt.innerText = `${rate}%`;
            if(rate >= 100) rateTxt.style.color = '#10b981'; else if(rate >= 80) rateTxt.style.color = '#3b82f6'; else rateTxt.style.color = '#ef4444';
        } else { rateTxt.innerText = '0%'; rateTxt.style.color = '#334155'; }
    });
    document.getElementById('totalPlan').innerText = sumPlan.toFixed(1) + 'H'; document.getElementById('totalAct').innerText = sumAct.toFixed(1) + 'H';
    const totalRate = sumPlan > 0 ? Math.min((sumAct / sumPlan) * 100, 100).toFixed(0) : 0; document.getElementById('totalRate').innerText = `${totalRate}%`;
}

function addSubjectCard() {
    const list = document.getElementById('studyTimeList');
    const newCard = document.createElement('div');
    newCard.className = 'subject-card custom-added-card';

    // 카드 헤더 생성 (입력창 + 삭제버튼)
    const header = document.createElement('div');
    header.className = 'card-header';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'custom-subj';
    nameInput.placeholder = '과목명 직접 입력 (예: 한국사)';
    
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-del-card';
    delBtn.innerHTML = '<i class="fas fa-times"></i> 삭제';
    delBtn.onclick = () => { newCard.remove(); calcStudyRates(); };

    header.appendChild(nameInput);
    header.appendChild(delBtn);

    // 카드 바디 생성 (세부과목 + 계획/실제/달성률)
    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = `
        <input type="text" class="sub-detail" placeholder="세부과목 (선택사항)">
        <div class="time-inputs">
            <div class="input-group"><label>계획(H)</label><input type="number" class="plan-time" oninput="calcStudyRates()"></div>
            <div class="input-group"><label>실제(H)</label><input type="number" class="act-time" oninput="calcStudyRates()"></div>
            <div class="rate-display"><label>달성률</label><span class="rate-txt">0%</span></div>
        </div>
    `;

    newCard.appendChild(header);
    newCard.appendChild(body);
    list.appendChild(newCard);
}

function handlePlannerFiles(input) {
    if (input.files) {
        const files = Array.from(input.files);
        if (currentPlannerFiles.length + files.length > 5) { alert("최대 5장까지만 업로드 가능합니다."); input.value = ''; return; }
        files.forEach(f => currentPlannerFiles.push(f)); renderPlannerFiles();
    }
}

function renderPlannerFiles() {
    const list = document.getElementById('plannerFileList'); if(!list) return; list.innerHTML = '';
    if (currentPlannerFiles.length === 0) { list.innerHTML = '<span class="placeholder-text">선택된 파일 없음</span>'; return; }
    currentPlannerFiles.forEach((file, idx) => {
        let fileName = ""; let fileLink = ""; 
        if (file instanceof File) { fileName = file.name; } 
        else if (typeof file === 'string') { try { const rawName = file.split('/').pop(); fileName = decodeURIComponent(rawName); fileName = fileName.replace(/^\d+_/, ''); fileLink = file; } catch (e) { fileName = file; } }
        const div = document.createElement('div'); div.className = 'file-item';
        let nameDisplay = `<span>📄 ${escapeHtml(fileName)}</span>`;
        if (fileLink) { nameDisplay = `<a href="${fileLink}" target="_blank" style="text-decoration:none; color:#334155; display:flex; align-items:center; gap:5px;"><span>📄 ${escapeHtml(fileName)}</span> <i class="fas fa-external-link-alt" style="font-size:0.7rem; color:#3b82f6;"></i></a>`; }
        div.innerHTML = `${nameDisplay}<span class="file-remove" onclick="removePlannerFile(${idx})">x</span>`; list.appendChild(div);
    });
}
function removePlannerFile(idx) { currentPlannerFiles.splice(idx, 1); renderPlannerFiles(); }
function toggleSlumpReason() { const trend = document.querySelector('input[name="studyTrend"]:checked')?.value; const box = document.getElementById('slumpReasonBox'); if(trend === 'down') box.style.display = 'block'; else box.style.display = 'none'; }

function loadWeeklyDataToForm(data) {
    if (data.studyTime && data.studyTime.details) {
        const cards = document.querySelectorAll('.subject-card');
        data.studyTime.details.forEach((detail, idx) => {
            if (cards[idx]) {
                const planInput = cards[idx].querySelector('.plan-time'); const actInput = cards[idx].querySelector('.act-time'); const detailInput = cards[idx].querySelector('.sub-detail'); const customInput = cards[idx].querySelector('.custom-subj');
                if (planInput) planInput.value = detail.plan; if (actInput) actInput.value = detail.act;
                if (detail.subject.includes('(') && detailInput) { const match = detail.subject.match(/\((.*?)\)/); if(match) detailInput.value = match[1]; } 
                else if (customInput) { customInput.value = detail.subject; }
            }
        });
        calcStudyRates(); 
    }
    if (data.mockExam) {
        const targetTile = document.querySelector(`.mock-tile[onclick*="'${data.mockExam.type}'"]`); if(targetTile) selectMockType(data.mockExam.type, targetTile);
        if (data.mockExam.scores) {
            const s = data.mockExam.scores; const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
            setVal('mockKorScore', s.kor); setVal('mockKorOpt', s.korOpt); setVal('mockMathScore', s.math); setVal('mockMathOpt', s.mathOpt); setVal('mockEngScore', s.eng); setVal('mockInq1Score', s.inq1); setVal('mockInq1Name', s.inq1Name); setVal('mockInq2Score', s.inq2); setVal('mockInq2Name', s.inq2Name);
        }
    }
    if (data.trend) {
        const radio = document.querySelector(`input[name="studyTrend"][value="${data.trend.status}"]`);
        if (radio) {
            radio.checked = true; toggleSlumpReason(); 
            if (data.trend.status === 'down' && data.trend.reasons) { data.trend.reasons.forEach(r => { const cb = document.querySelector(`#slumpReasonBox input[value="${r}"]`); if(cb) cb.checked = true; else document.getElementById('slumpDetail').value = r; }); }
        }
    }
    if (data.deepAnswers && Array.isArray(data.deepAnswers)) {
        ['deepQ1', 'deepQ2', 'deepQ3', 'deepQ4'].forEach((id, idx) => { const el = document.getElementById(id); if(el) { el.value = data.deepAnswers[idx] || ''; if(typeof updateCharCount === 'function') updateCharCount(el); } });
    }
    currentPlannerFiles = data.plannerFiles || []; originalPlannerFiles = [...currentPlannerFiles]; renderPlannerFiles();
}

function updateCharCount(el) { const countSpan = el.parentElement.querySelector('.char-count span'); if(countSpan) countSpan.innerText = el.value.length; }

// 모바일/PC 화면 전환을 통합으로 처리하는 헬퍼 함수
function forceMoveToStep(mobileIdx, tabId) {
    const modalContent = document.querySelector('.check-modal-content');
    if (modalContent && modalContent.classList.contains('mobile-wizard-mode')) {
        currentMobileStep = mobileIdx;
        if (typeof updateMobileWizardUI === 'function') updateMobileWizardUI();
    } else {
        if (typeof switchWeeklyTab === 'function') switchWeeklyTab(tabId);
    }
}

async function submitWeeklyCheck() {
    const submitBtn = document.querySelector('.save-btn'); 
    const originalBtnText = submitBtn ? submitBtn.innerText : "저장";

    try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "처리 중..."; }

        const totalPlanEl = document.getElementById('totalPlan'); 
        if (!totalPlanEl) {
            alert("시스템 오류: 학습 계획 시간 요소를 찾을 수 없습니다.");
            return;
        }

        const totalPlan = parseFloat(totalPlanEl.innerText); 
        if (isNaN(totalPlan) || totalPlan === 0) { 
            alert("학습 계획 시간을 1시간 이상 입력해주세요."); 
            forceMoveToStep(0, 'step1');
            return; 
        }

        const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : "";
        const q1 = getVal('deepQ1'), q2 = getVal('deepQ2'), q3 = getVal('deepQ3'), q4 = getVal('deepQ4');
        if (!q1 && !q2 && !q3 && !q4) { 
            alert("심층 코칭 질문을 최소 1개 이상 작성해주세요."); 
            forceMoveToStep(1, 'step2');
            return; 
        }

        // 요소가 존재하지 않을 때를 대비한 안전한 값 추출
        const mockExamTypeEl = document.getElementById('mockExamType');
        const mockType = mockExamTypeEl ? mockExamTypeEl.value : 'none';
        
        let mockData = { type: mockType, proofFile: null, scores: {} };
        if (mockType !== 'none') {
            const fileInput = document.getElementById('mockExamProof');
            mockData.proofFile = (fileInput && fileInput.files.length > 0) ? fileInput.files[0].name : "file_uploaded"; 
            mockData.scores = { 
                kor: getVal('mockKorScore'), korOpt: getVal('mockKorOpt'), 
                math: getVal('mockMathScore'), mathOpt: getVal('mockMathOpt'), 
                eng: getVal('mockEngScore'), 
                inq1: getVal('mockInq1Score'), inq1Name: getVal('mockInq1Name'), 
                inq2: getVal('mockInq2Score'), inq2Name: getVal('mockInq2Name') 
            };
        }

        const studyCards = document.querySelectorAll('.subject-card'); 
        let studyData = [];
        studyCards.forEach(card => {
            let subjName = ""; 
            const mainSub = card.querySelector('.main-sub'); 
            const detail = card.querySelector('.sub-detail'); 
            const custom = card.querySelector('.custom-subj');
            
            if (mainSub) { 
                subjName = mainSub.innerText.replace('↳', '').trim(); 
                if(detail) {
    				const detailVal = detail.value.trim();
    				// 값이 있으면 그 값을 쓰고, 없으면 기본값인 '공통'을 붙여줍니다.
    				subjName += `(${detailVal ? detailVal : '공통'})`;
				}
            } else if (custom) { 
                subjName = custom.value.trim() || "기타"; 
            }
            
            const planEl = card.querySelector('.plan-time'); 
            const actEl = card.querySelector('.act-time');
            const plan = planEl ? (parseFloat(planEl.value) || 0) : 0; 
            const act = actEl ? (parseFloat(actEl.value) || 0) : 0;
            
            if (plan > 0 || act > 0) studyData.push({ subject: subjName, plan, act });
        });

        const trendEl = document.querySelector('input[name="studyTrend"]:checked'); 
        const trend = trendEl ? trendEl.value : 'keep'; 
        let reasons = [];
        if (trend === 'down') { 
            document.querySelectorAll('#slumpReasonBox input:checked').forEach(cb => reasons.push(cb.value)); 
            const det = document.getElementById('slumpDetail');
            if(det && det.value) reasons.push(det.value); 
        }

        if (!confirm("제출하시겠습니까?")) return;

        const token = localStorage.getItem('idToken'); 

        const currentUrls = currentPlannerFiles.filter(f => typeof f === 'string'); 
        const filesToDelete = originalPlannerFiles.filter(url => !currentUrls.includes(url));
        
        if (filesToDelete.length > 0) { 
            await Promise.all(filesToDelete.map(url => fetch(FILE_API_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                body: JSON.stringify({ type: 'delete_s3_file', data: { fileUrl: url } }) 
            }))); 
        }
        
        let finalFileUrls = [...currentUrls]; 
        const newFiles = currentPlannerFiles.filter(f => typeof f !== 'string');
        
        if (newFiles.length > 0) {
            for (const file of newFiles) {
                // 🔒 [보안] 파일명 살균 (Sanitization) 처리 적용
                const secureFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;

                const res = await fetch(FILE_API_URL, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                    body: JSON.stringify({ type: 'get_presigned_url', data: { fileName: secureFileName, fileType: file.type, folder: 'planner' } }) 
                });
                
                if (!res.ok) throw new Error("플래너 업로드 URL 발급 실패");
                const { uploadUrl, fileUrl, fields } = await res.json();
                const formData = new FormData(); 
                
                Object.entries(fields || {}).forEach(([k, v]) => formData.append(k, v)); 
                formData.append('file', file);
                
                await fetch(uploadUrl, { method: 'POST', body: formData }); 
                finalFileUrls.push(fileUrl);
            }
        }
        
        if (mockData.type !== 'none') {
            const mockFileInput = document.getElementById('mockExamProof');
            if (mockFileInput && mockFileInput.files.length > 0) {
                const mFile = mockFileInput.files[0];
                // 🔒 [보안] 파일명 살균 (Sanitization) 처리 적용
                const secureMockName = `mock_${Date.now()}_${mFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;

                const mRes = await fetch(FILE_API_URL, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                    body: JSON.stringify({ type: 'get_presigned_url', data: { fileName: secureMockName, fileType: mFile.type, folder: 'mock_exams' } }) 
                });
                
                if (!mRes.ok) throw new Error("모의고사 성적표 업로드 URL 발급 실패");
                const { uploadUrl, fields, fileUrl } = await mRes.json();
                
                const formData = new FormData(); 
                Object.entries(fields || {}).forEach(([k, v]) => formData.append(k, v)); 
                formData.append('file', mFile); 
                
                const uploadRes = await fetch(uploadUrl, { method: 'POST', body: formData });
                if (!uploadRes.ok) throw new Error("모의고사 S3 업로드 실패");
                
                mockData.proofFile = fileUrl; 
            } else if (!mockData.proofFile || mockData.proofFile === "file_uploaded") {
                alert("모의고사 성적 인증 사진을 첨부해주세요."); 
                forceMoveToStep(0, 'step1'); 
                return;
            }
        }

        const today = new Date().toISOString();
        const title = (typeof getWeekTitle === 'function') ? getWeekTitle(new Date()) : "주간점검";
        const weekId = generateWeekId(new Date());
        
        const weeklyData = { 
            weekId, date: today, title: title, 
            studyTime: { 
                details: studyData, 
                totalPlan: document.getElementById('totalPlan') ? document.getElementById('totalPlan').innerText : '0H', 
                totalAct: document.getElementById('totalAct') ? document.getElementById('totalAct').innerText : '0H', 
                totalRate: document.getElementById('totalRate') ? document.getElementById('totalRate').innerText : '0%' 
            }, 
            mockExam: mockData, 
            trend: { status: trend, reasons: reasons }, 
            deepAnswers: [q1, q2, q3, q4], 
            plannerFiles: finalFileUrls 
        };

        const res = await fetch(REPORT_API_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
            body: JSON.stringify({ type: 'save_weekly_check', data: weeklyData }) 
        });
        
        if (res.ok) { 
            alert("제출이 완료되었습니다."); 
            closeWeeklyModal(); 
            location.reload(); 
        } else { 
            throw new Error("서버 응답 오류가 발생했습니다."); 
        }
        
    } catch(e) { 
        console.error("Submit Error:", e); 
        alert("처리 중 오류가 발생했습니다: " + e.message); 
    } finally { 
        if (submitBtn) { 
            submitBtn.disabled = false; 
            submitBtn.innerText = originalBtnText; 
        } 
    }
}

function updateMockFileName(input) {
    const display = document.getElementById('mockFileNameDisplay');
    if (input.files && input.files.length > 0) { display.textContent = input.files[0].name; display.style.color = "#2563eb"; display.style.fontWeight = "bold"; } 
    else { display.textContent = "선택된 파일 없음"; display.style.color = "#94a3b8"; display.style.fontWeight = "normal"; }
}

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
                    <h4 style="color:white; margin:0 0 15px 0; border-left:4px solid #3b82f6; padding-left:10px;">📑 분석 보고서 보관함</h4>
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
            const isReady = (rep.status === 'published' || rep.status === 'sent');
            const formattedName = formatReportKey(rep.key);

            const itemDiv = document.createElement('div');
            itemDiv.className = 'report-item';
            itemDiv.style.cssText = `cursor:${isReady ? 'pointer' : 'default'}; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 15px 12px;`;
            itemDiv.onclick = () => {
                if(isReady) window.open(rep.reportLink);
                else alert('튜터가 리포트를 최종 검수 중입니다. 잠시만 기다려주세요.');
            };

            const infoDiv = document.createElement('div');
            infoDiv.className = 'rep-info';
            infoDiv.style.cssText = 'flex: 1; min-width: 0;';

            const nameStrong = document.createElement('strong');
            nameStrong.style.cssText = 'display: block; color: #fff; font-size: 0.95rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
            nameStrong.textContent = formattedName; // 🔒 안전

            const statusSpan = document.createElement('span');
            statusSpan.style.cssText = isReady ? 'color:#4ade80; font-size:0.8rem;' : 'color:#fbbf24; font-size:0.8rem;';
            statusSpan.textContent = isReady ? '● 열람 가능' : '● 분석중'; // 🔒 안전

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
    
    const token = localStorage.getItem('idToken');
    try {
        const res = await fetch(REPORT_API_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
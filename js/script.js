// js/script.js

/* =========================================
   1. 전역 설정 및 유틸리티
   ========================================= */
const AUTH_API_URL = CONFIG.api.auth;
const NOTI_API_URL = CONFIG.api.noti;
const SCROLL_POS_KEY_PREFIX = 'studycrack_scroll_pos:';

function getScrollStorageKey() {
    return `${SCROLL_POS_KEY_PREFIX}${window.location.pathname}${window.location.search}`;
}

function saveCurrentScrollPosition() {
    try {
        sessionStorage.setItem(getScrollStorageKey(), String(window.scrollY || window.pageYOffset || 0));
    } catch (e) {
        console.warn('스크롤 위치 저장 실패:', e);
    }
}

function restoreSavedScrollPosition() {
    try {
        const savedY = sessionStorage.getItem(getScrollStorageKey());
        if (savedY == null) return;
        const y = Number(savedY);
        if (!Number.isFinite(y)) return;

        requestAnimationFrame(() => {
            window.scrollTo({ top: y, left: 0, behavior: 'auto' });
        });
    } catch (e) {
        console.warn('스크롤 위치 복원 실패:', e);
    }
}

function initScrollPersistence() {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    restoreSavedScrollPosition();
    window.addEventListener('beforeunload', saveCurrentScrollPosition);
    window.addEventListener('pagehide', saveCurrentScrollPosition);
    window.addEventListener('scroll', saveCurrentScrollPosition, { passive: true });

    // href="#" 기본 동작(페이지 맨 위로 이동) 차단
    document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a[href="#"]');
        if (!anchor) return;
        e.preventDefault();
    });
}

// 💡 공통 apiFetch 함수 (accessToken 기반 통합)
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    options.headers = { ...defaultHeaders, ...options.headers };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                alert("보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.");
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/login'; 
                return Promise.reject(new Error("Auth expired")); 
            }
            throw new Error(`서버 통신 오류 (상태 코드: ${response.status})`);
        }
        return response;
    } catch (error) {
        console.error("API 통신 실패:", error);
        throw error; 
    }
}

// 모달 열기
function openModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

// 모달 닫기
function closeModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// 모달 바깥 영역 클릭 시 닫기
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

/* =========================================
   2. 커리큘럼 탭 로직
   ========================================= */
   
const COURSE_DATA = {
    mbti: {
        title: "MBTI SOLUTION",
        price: "무료",
        desc: "탐구 MBTI 결과를 분석해 나의 학습 성향을 파악하고, 성적 상승을 위한 최적의 맞춤 공부법을 제안합니다.",
        list: [
            { text: "탐구 MBTI 기반 학습 성향 정밀 진단" },
            { text: "유형별 학습 강점 및 취약점 분석 리포트" },
            { text: "성향에 딱 맞는 과목별 맞춤 공부법 솔루션 제공" }
        ],
        bg: "assets/backgrounds/bg_mbti.png",
        themeColor: "#8B5CF6"
    },
    basic: {
        title: "BASIC PLAN",
        price: `<span class="original-price">49,000원</span> <span class="discount-price">특별 할인가 <strong class="highlight-price">25,000원</strong></span>`,        
        desc: "내 점수와 목표 대학 합격선 사이의 거리를 정밀하게 진단합니다.",
        list: [
            { text: "개인 성적 및 목표 대학 환산점수 계산 (최대 18개)" },
            { 
                text: "합격 컷 대비 거리 분석 (위험도 경고)", 
                action: "preview", 
                imgBase: "feat_basic_1" 
            },
            { text: "목표 대학별 '효자 과목' 발굴" }
        ],
        bg: "assets/backgrounds/bg_basic.png",
        themeColor: "#059669"
    },
    standard: {
        title: "STANDARD PLAN",
        price: "월 149,000원",
        desc: "어떤 과목을 공부해야 점수가 가장 빨리 오르는지 분석하고 관리합니다.",
        list: [
            { text: "목표 대학 무제한" },
            { 
                text: "과목별 1점당 환산 기울기(효율) 계산", 
                action: "preview", 
                imgBase: "feat_standard_1" 
            },
            { 
                text: "점수 상승 시뮬레이션 제공", 
                action: "preview", 
                imgBase: "feat_standard_2" 
            },
            { 
                text: "주 1회 전략 실행 학습 플래너 코칭 및 플래너 제공", 
                action: "preview", 
                imgBase: "feat_standard_3" 
            }
        ],
        bg: "assets/backgrounds/bg_standard.png",
        themeColor: "#2563EB"
    },
    pro: {
        title: "PRO PLAN",
        price: "월 299,000원",
        desc: "최소한의 공부량으로 합격하기 위한 최적의 조합을 설계합니다.",
        list: [
            { text: "STANDARD 포함" },
            { text: "최소 점수 상승 조합 최적화 알고리즘" },
            { text: "내 점수에 가장 유리한 대학 역추적" },
            { text: "주 1회 심층 전략 코칭 및 플래너 제공" },
            { 
                text: "PRO 전용 보고서 미리보기 📄", 
                action: "download", 
                file: "assets/features/feat_pro_report.pdf" 
            }
        ],
        bg: "assets/backgrounds/bg_pro.png",
        themeColor: "#E11D48"
    }
};

// 프로그램 모바일 아코디언 DOM 초기화 함수
function initMobileCourses() {
    document.querySelectorAll('.course-tab-btn').forEach(btn => {
        const tier = btn.getAttribute('data-tier');
        const data = COURSE_DATA[tier];
        if (!data) return;

        // 1. 기존 내용(아이콘, 텍스트) 추출
        const iconHtml = btn.querySelector('.tab-icon').outerHTML;
        const infoHtml = btn.querySelector('.tab-info').outerHTML;

        // 2. 상세 리스트 HTML 생성
        const listHtml = data.list.map(item => {
            const checkColor = data.themeColor;
            if (item.action) {
                let clickHandler = "";
                if (item.action === "preview") {
                    clickHandler = `onclick="event.stopPropagation(); openFeaturePreview('${item.imgBase}', '${item.text}')"`;
                } else if (item.action === "download") {
                    clickHandler = `onclick="event.stopPropagation(); downloadProReport('${item.file}')"`;
                }
                return `
                    <li class="clickable-item" ${clickHandler} title="클릭하여 확인하기" style="display:flex; align-items:flex-start; gap:8px;">
                        <i class="fas fa-check-circle" style="color:${checkColor}; margin-top:3px;"></i>
                        <span style="flex:1; word-break:keep-all;">${item.text}</span>
                        <i class="fas fa-external-link-alt" style="font-size: 0.7em; margin-left: 5px; opacity: 0.7; margin-top:5px;"></i>
                    </li>
                `;
            } else {
                return `
                    <li style="display:flex; align-items:flex-start; gap:8px;">
                        <i class="fas fa-check-circle" style="color:${checkColor}; margin-top:3px;"></i>
                        <span style="flex:1; word-break:keep-all;">${item.text}</span>
                    </li>
                `;
            }
        }).join('');

        // 비회원에게도 노출되도록 조건 개선
        let extraBtnHtml = "";
        if (tier === 'mbti') {
            const isLoggedIn = !!localStorage.getItem('accessToken');
            
            if (isLoggedIn) {
                extraBtnHtml = `
                    <div style="margin-top: 25px; padding: 15px; background: #f5f3ff; border: 1px dashed #8b5cf6; border-radius: 8px; text-align: center;">
                        <p style="margin: 0 0 10px 0; color: #6d28d9; font-weight: bold; font-size: 0.9rem;">🎁 회원 전용 혜택</p>
                        <a href="/download/mbti" onclick="event.stopPropagation();" style="display: inline-block; background: #8b5cf6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; transition: 0.2s;">
                            나만의 맞춤 공부법 PDF 무제한 다운로드
                        </a>
                    </div>
                `;
            } else {
                extraBtnHtml = `
                    <div style="margin-top: 25px; padding: 15px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center;">
                        <p style="margin: 0 0 10px 0; color: #475569; font-weight: bold; font-size: 0.9rem;">🎁 무료 혜택</p>
                        <a href="/login" onclick="event.stopPropagation(); alert('로그인 후 이용할 수 있는 혜택입니다.');" style="display: inline-block; background: #94a3b8; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; transition: 0.2s;">
                            🔒 로그인하고 맞춤 공부법 PDF 받기
                        </a>
                    </div>
                `;
            }
        }

        // 3. 버튼 내부 HTML 재구성 (요약부 + 숨겨진 확장부)
        btn.innerHTML = `
            <div class="tab-summary-wrap">
                ${iconHtml}
                ${infoHtml}
                <div class="tab-price-mobile">${data.price}</div>
            </div>
            <div class="mobile-detail-box">
                <p class="detail-desc">${data.desc}</p>
                <ul class="detail-list">${listHtml}</ul>
                ${extraBtnHtml} </div>
        `;
    });
}

function selectCourse(tier) {
    const data = COURSE_DATA[tier];
    if (!data) return;

    const isMobile = window.innerWidth <= 900;
    const activeBtn = document.querySelector(`.course-tab-btn[data-tier="${tier}"]`);

    // 배경 업데이트 (공통)
    const overlay = document.querySelector('.curriculum-bg-overlay');
    if (overlay) {
        overlay.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url('${data.bg}')`;
    }
    closeFeaturePreview();

    if (isMobile) {
        // [모바일] Planner 스타일 아코디언 토글
        if (activeBtn.classList.contains('active-expand')) {
            activeBtn.classList.remove('active-expand', 'active');
        } else {
            document.querySelectorAll('.course-tab-btn').forEach(btn => {
                btn.classList.remove('active-expand', 'active');
            });
            activeBtn.classList.add('active-expand', 'active');
        }
    } else {
        // [데스크탑] 탭 활성화 및 우측 디테일 뷰 렌더링
        document.querySelectorAll('.course-tab-btn').forEach(btn => {
            btn.classList.remove('active', 'active-expand');
        });
        if(activeBtn) activeBtn.classList.add('active', 'active-expand');

        const detailView = document.getElementById('courseDetailView');
        if (detailView) {
            const listHtml = data.list.map(item => {
                const checkColor = data.themeColor;
                if (item.action) {
                    let clickHandler = "";
                    if (item.action === "preview") {
                        clickHandler = `onclick="openFeaturePreview('${item.imgBase}', '${item.text}')"`;
                    } else if (item.action === "download") {
                        clickHandler = `onclick="downloadProReport('${item.file}')"`;
                    }
                    return `
                        <li class="clickable-item" ${clickHandler} title="클릭하여 확인하기">
                            <i class="fas fa-check-circle" style="color:${checkColor}"></i>
                            <span>${item.text}</span>
                            <i class="fas fa-external-link-alt" style="font-size: 0.7em; margin-left: 5px; opacity: 0.7;"></i>
                        </li>
                    `;
                } else {
                    return `
                        <li>
                            <i class="fas fa-check-circle" style="color:${checkColor}"></i>
                            <span>${item.text}</span>
                        </li>
                    `;
                }
            }).join('');

        // 💡 [수정] 비회원에게도 노출되도록 조건 개선
        let extraBtnHtml = "";
        if (tier === 'mbti') {
            const isLoggedIn = !!localStorage.getItem('accessToken');
            const userPromo = localStorage.getItem('promoCode') || ''; 
            const hasUsedPromo = /^[0-9A-F]{4}-[0-9A-F]{4}-STC$/.test(userPromo);
            
            if (!hasUsedPromo) {
                if (isLoggedIn) {
                    extraBtnHtml = `
                        <div style="margin-top: 25px; padding: 15px; background: #f5f3ff; border: 1px dashed #8b5cf6; border-radius: 8px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #6d28d9; font-weight: bold; font-size: 0.9rem;">🎁 회원 전용 혜택</p>
                            <a href="/download/mbti" onclick="event.stopPropagation();" style="display: inline-block; background: #8b5cf6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; transition: 0.2s;">
                                나만의 맞춤 공부법 PDF 무료 다운로드(1회)
                            </a>
                        </div>
                    `;
                } else {
                    extraBtnHtml = `
                        <div style="margin-top: 25px; padding: 15px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #475569; font-weight: bold; font-size: 0.9rem;">🎁 1회성 무료 혜택</p>
                            <a href="/login" onclick="event.stopPropagation(); alert('로그인 후 이용할 수 있는 혜택입니다.');" style="display: inline-block; background: #94a3b8; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; transition: 0.2s;">
                                🔒 로그인하고 맞춤 공부법 PDF 받기
                            </a>
                        </div>
                    `;
                }
            }
        }

        detailView.innerHTML = `
            <span class="detail-badge" style="color:${data.themeColor}; background:#fff; border: 1px solid ${data.themeColor};">
                ${tier.toUpperCase()}
            </span>
            <h3 class="detail-title">${data.title}</h3>
            <div class="detail-price">${data.price}</div>
            <p class="detail-desc">${data.desc}</p>
            <ul class="detail-list">${listHtml}</ul>
            ${extraBtnHtml} `;
        }
    }
}

function openFeaturePreview(imgBase, title) {
    const panel = document.getElementById('featurePreviewPanel');
    const previewTitle = document.getElementById('previewTitle');
    const imgWrapper = document.querySelector('.preview-img-wrapper');

    if (!panel || !imgWrapper) return;

    imgWrapper.innerHTML = '<img id="previewImage" src="" alt="기능 예시 이미지" style="width:100%; height:100%; object-fit:contain;">';
    const previewImg = document.getElementById('previewImage');

    const isMobile = window.innerWidth <= 900;
    
    let imgPath = "";
    if (isMobile) {
        const parts = imgBase.split('_');
        const number = parts.pop(); 
        const base = parts.join('_'); 
        imgPath = `assets/features/${base}_mobile_${number}.png`;
    } else {
        imgPath = `assets/features/${imgBase}.png`;
    }

    if(previewTitle) previewTitle.innerText = title;

    previewImg.onerror = function() {
        imgWrapper.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:rgba(255,255,255,0.5); gap:15px;">
                <i class="fas fa-image" style="font-size:3rem;"></i>
                <span style="font-size:0.95rem;">이미지를 준비 중입니다.</span>
            </div>
        `;
    };

    previewImg.src = imgPath;
    panel.classList.add('active');
}

function closeFeaturePreview() {
    const panel = document.getElementById('featurePreviewPanel');
    if (panel) {
        panel.classList.remove('active');
    }
}

function downloadProReport(filePath) {
    const confirmDownload = confirm("PRO 전용 분석 보고서 샘플을 다운로드 하시겠습니까?");
    
    if (confirmDownload) {
        const link = document.createElement('a');
        link.href = filePath;
        link.download = 'StudyCrack_Pro_Report_Sample.pdf'; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}


/* =========================================
   3. 후기 데이터 로직
   ========================================= */
async function getUserReviews() {
    try {
        const response = await apiFetch(AUTH_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user_reviews' })
        });

        const data = await response.json();
        
        if (Array.isArray(data)) {
            return data;
        } 
        
        if (data.body) {
            const parsedBody = JSON.parse(data.body);
            if (Array.isArray(parsedBody)) {
                return parsedBody;
            }
        }

        console.warn("⚠️ 서버 응답 형식이 올바르지 않습니다:", data);
        return [];

    } catch (error) {
        if (error.message !== "Auth expired") console.error("❌ 후기 데이터 로드 실패:", error);
        return []; 
    }
}

async function renderReviews() {
    const container = document.getElementById('reviewContainer');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center;">후기를 불러오는 중...</p>';

    const reviews = await getUserReviews();
    
    if (reviews.length === 0) {
        container.innerHTML = '<p style="text-align:center;">등록된 후기가 없습니다.</p>';
        return;
    }

    container.innerHTML = reviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <span class="review-badge">${escapeHtml(review.univ)}</span>
                <span class="review-score">⭐️⭐️⭐️⭐️⭐️</span>
            </div>
            <p class="review-text">"${escapeHtml(review.content)}"</p>
            <div class="review-author">
                <div class="review-avatar">${escapeHtml(review.name).charAt(0)}</div>
                <div class="review-info">
                    <div>${escapeHtml(review.name)}</div>
                </div>
            </div>
        </div>
    `).join('');
}

/* =========================================
   4. 인터랙티브 데모 로직
   ========================================= */
window.nextDemoStep = function(stepNumber) {
    document.querySelectorAll('.demo-step').forEach(el => el.classList.remove('active'));
    
    const nextStep = document.getElementById('demoStep' + stepNumber);
    if (nextStep) {
        nextStep.classList.add('active');
        nextStep.style.animation = 'none';
        nextStep.offsetHeight; 
        nextStep.style.animation = 'slideUp 0.4s ease-out';
    }
};

window.cycleResultView = function() {
    const activeSlide = document.querySelector('.result-slide.active');
    let currentId = 1;
    
    if (activeSlide) {
        currentId = parseInt(activeSlide.id.replace('resultView', ''));
        activeSlide.classList.remove('active');
    }
    
    let nextId = currentId + 1;
    if (nextId > 3) nextId = 1;
    
    const nextSlide = document.getElementById('resultView' + nextId);
    if (nextSlide) {
        nextSlide.classList.add('active');
    }
};

/* =========================================
   5. 페이지 초기화 및 이벤트 리스너
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    initScrollPersistence();
    
    // 1. 권한 체크 (accessToken으로 통일)
    const token = localStorage.getItem('accessToken');
    const userRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName') || '회원';

    if (token && userRole) {
        if (userRole === 'tutor') {
            alert(`${userName} 선생님 페이지로 이동합니다.`);
            window.location.href = '/mypage/tutor';
            return;
        } else if (userRole === 'admin') {
            alert("관리자 페이지로 이동합니다.");
            window.location.href = '/admin';
            return;
        }
    }

    // 2. UI 업데이트
    updateNavUI();
    renderReviews();
    initMobileCourses();
    selectCourse('mbti');

    // 3. 버튼 이벤트 연결
    const myPageBtn = document.getElementById('myPageBtn');
    if (myPageBtn) {
        myPageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const userId = localStorage.getItem('userId');
            if (!userId) {
                alert("로그인이 필요합니다.");
                window.location.href = '/login';
            } else {
                window.location.href = '/mypage';
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            sessionStorage.clear(); // 세션스토리지도 안전하게 클리어
            alert("로그아웃 되었습니다.");
            window.location.href = '/';
        });
    }

    // 4. 스크롤 애니메이션
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));

    // 💡 [수정됨] 5. 튜토리얼 통합 제어 (자동 팝업 로직 삭제)
    const pendingTutorial = localStorage.getItem('pending_tutorial');
    const isLoggedIn = !!localStorage.getItem('accessToken');
    
    // 이미 튜토리얼을 수락해서 진행 중인 경우 (화면 깜빡임 방지용 즉시 락)
    if (pendingTutorial === 'true') {
        runTutorialLock(pendingTutorial);
    } 
    // 💡 동기적으로 팝업을 띄우던 부분을 완전히 삭제하고 함수 호출만 남깁니다.
    else if (isLoggedIn) {
        checkTutorialStatus();
    }
});

// 💡 튜토리얼 제안 수락 핸들러
window.acceptTutorialOffer = function() {
    document.getElementById('tutorialOffer-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
    localStorage.setItem('pending_tutorial', 'true');
    runTutorialLock('true');
};

// 💡 튜토리얼 제안 거절 (오늘 하루 보지 않기 처리) 핸들러
window.declineTutorialOffer = function() {
    const chk = document.getElementById('chkDoNotShowToday');
    if (chk && chk.checked) {
        const todayStr = new Date().toLocaleDateString();
        localStorage.setItem('hide_tutorial_today', todayStr);
    }
    document.getElementById('tutorialOffer-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
};

// 💡 튜토리얼 락 & 실행 함수
function runTutorialLock(stepState) {
    document.body.classList.add('tutorial-lock');

    const warnTutorialExit = (e) => {
        if (localStorage.getItem('pending_tutorial')) {
            e.preventDefault();
            e.returnValue = '정말 튜토리얼을 종료하시겠습니까?'; 
        }
    };
    window.addEventListener('beforeunload', warnTutorialExit);

    document.querySelectorAll('.logo-link, .nav-btn').forEach(link => {
        link.addEventListener('click', (e) => {
            if (localStorage.getItem('pending_tutorial')) {
                if (!confirm('현재 튜토리얼이 진행 중입니다.\n정말 튜토리얼을 종료하고 이동하시겠습니까?')) {
                    e.preventDefault(); 
                } else {
                    localStorage.removeItem('pending_tutorial');
                    window.removeEventListener('beforeunload', warnTutorialExit);
                    document.body.classList.remove('tutorial-lock');
                }
            }
        });
    });

    setTimeout(() => {
        const overlay = document.getElementById('tutorialOverlay');
        const tooltipMsg = document.querySelector('#tutorialTooltip p');
        const progressBar = document.querySelector('.tutorial-progress-bar');
        const skipBtn = document.getElementById('skipTutorialBtn');
        
        let targetBtn, targetUrl;

        if (stepState === 'true') {
            targetBtn = document.getElementById('myPageBtn');
            targetUrl = '/mypage';
            if(tooltipMsg) tooltipMsg.innerText = '1. 마이페이지를 눌러 정보를 입력하실 수 있습니다.';
            if(progressBar) progressBar.style.width = '33%';
        }

        if (targetBtn && !targetBtn.classList.contains('hidden')) {
            overlay.classList.remove('hidden');
            
            const rect = targetBtn.getBoundingClientRect();
            const cloneBtn = document.createElement('div');
            cloneBtn.className = 'tutorial-clone-btn';
            cloneBtn.innerText = targetBtn.innerText;
            
            cloneBtn.style.top = `${rect.top + (rect.height / 2)}px`; 
            cloneBtn.style.left = `${rect.left + (rect.width / 2)}px`; 
            cloneBtn.style.transform = 'translate(-50%, -50%)';
            cloneBtn.style.padding = '8px 16px'; 
            
            overlay.appendChild(cloneBtn);

            const tooltip = document.getElementById('tutorialTooltip');
            tooltip.style.top = `${rect.bottom + 15}px`;
            tooltip.style.left = `${Math.max(10, rect.left - 40)}px`;

            cloneBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.removeEventListener('beforeunload', warnTutorialExit); 
                document.body.classList.remove('tutorial-lock'); 
                window.location.href = targetUrl; 
            });

            skipBtn.addEventListener('click', () => {
                if (!confirm("정말로 그만두시겠습니까?\n튜토리얼 완료 시 제공되는 무료 대학 분석 기회를 받지 못할 수 있습니다.")) return;

                localStorage.removeItem('pending_tutorial'); 
                const todayStr = new Date().toLocaleDateString();
                localStorage.setItem('hide_tutorial_today', todayStr);
                
                overlay.classList.add('hidden');
                cloneBtn.remove();
                window.removeEventListener('beforeunload', warnTutorialExit);
                document.body.classList.remove('tutorial-lock'); 
            });
        }
    }, 150); 
}

// 💡 [수정됨] 튜토리얼 상태 확인 및 팝업 제어
async function checkTutorialStatus() {
    const isLoggedIn = !!localStorage.getItem('accessToken');
    const idToken = localStorage.getItem('idToken'); 
    const userId = localStorage.getItem('userId');
    
    if (!isLoggedIn || !idToken || !userId) return;

    if (localStorage.getItem('tutorial_completed') === 'true') {
        return;
    }

    try {
        const response = await fetch(CONFIG.api.user, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && (data.tutorialRewardClaimed === true || data.computedTier === 'standard' || data.computedTier === 'pro')) {
                localStorage.setItem('tutorial_completed', 'true');
                localStorage.removeItem('pending_tutorial');
                return; 
            }
        }
    } catch (e) {
        console.error("Tutorial sync error:", e);
        return; 
    }

    const pendingTutorial = localStorage.getItem('pending_tutorial');
    
    if (pendingTutorial === 'true') {
        runTutorialLock(pendingTutorial);
    } 
    else {
        const todayStr = new Date().toLocaleDateString();
        const hideToday = localStorage.getItem('hide_tutorial_today');
        
        if (hideToday !== todayStr) {
            const offerModal = document.getElementById('tutorialOffer-modal');
            if (offerModal) {
                offerModal.classList.remove('hidden');
                offerModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        }
    }
}

function updateNavUI() {
    // 💡 accessToken 기준으로 로그인 여부 판단
    const isLoggedIn = !!localStorage.getItem('accessToken');
    const userRole = localStorage.getItem('userRole');
    
    const btnAnalysis = document.getElementById('navAnalysis');
    const btnQna = document.getElementById('navQna');
    const btnLogin = document.getElementById('loginBtn');
    const btnMyPage = document.getElementById('myPageBtn');
    const btnLogout = document.getElementById('logoutBtn');
    const btnNoti = document.getElementById('studentNotiFab');

    if (isLoggedIn) {
        if (btnAnalysis) btnAnalysis.classList.remove('hidden');
        if (btnQna) btnQna.classList.remove('hidden');
        if (btnMyPage) btnMyPage.classList.remove('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');
        if (btnLogin) btnLogin.classList.add('hidden');
        if (userRole !== 'admin' && userRole !== 'tutor') {
            if (btnNoti) {
                btnNoti.classList.remove('hidden');
                fetchStudentNotifications();
            }
        }
    } else {
        if (btnAnalysis) btnAnalysis.classList.add('hidden');
        if (btnQna) btnQna.classList.add('hidden');
        if (btnMyPage) btnMyPage.classList.add('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
        if (btnLogin) btnLogin.classList.remove('hidden');
        if (btnNoti) btnNoti.classList.add('hidden');
    }
}

// ============================================================
// 학생 알림 시스템 및 액션 라우팅
// ============================================================
window.toggleStudentNotiPanel = function() {
    const panel = document.getElementById('studentNotiPanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        fetchStudentNotifications();
    }
}

// 알림 중복 호출 방지를 위한 Lock 변수 추가
let isFetchingNoti = false; 

window.fetchStudentNotifications = async function() {
    // 이미 요청 중이면 무시 (API 연타 방어)
    if (isFetchingNoti) return; 
    isFetchingNoti = true;

    try {
        const response = await apiFetch(NOTI_API_URL, { 
            method: 'POST',
            body: JSON.stringify({ type: 'student_get_notifications' }) 
        });
        
        const data = await response.json();
        const notis = data.notifications || [];
        
        const unreadCount = notis.filter(n => !n.isRead).length;
        const badge = document.getElementById('studentNotiBadge');
        if (badge) {
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
            badge.innerText = unreadCount;
        }

        const listArea = document.getElementById('studentNotiList');
        listArea.innerHTML = '';
        
        if (notis.length === 0) {
            listArea.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 250px; color: #94a3b8;">
                    <i class="far fa-bell-slash" style="font-size: 2.5rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <span style="font-size: 0.95rem;">새로운 알림이 없습니다.</span>
                </div>
            `;
            return;
        }

        notis.forEach(n => {
            const div = document.createElement('div');
            div.className = `student-noti-item ${n.isRead ? '' : 'unread'}`;
            div.onclick = async () => {
                if (!n.isRead) await markStudentNotiRead(n.id); // 💡 새 구조의 id도 정상 호환됨
                handleNotiAction(n);
            };
            // 💡 [보안] XSS 방어를 위해 escapeHtml 필수 유지
            div.innerHTML = `
                <div class="student-noti-title">${escapeHtml(n.message)}</div>
                <div class="student-noti-time">${new Date(n.createdAt).toLocaleString()}</div>
            `;
            listArea.appendChild(div);
        });
    } catch (e) { 
        if (e.message !== "Auth expired") console.error("Noti Fetch Error:", e); 
    } finally {
        // 💡 통신이 끝나면 Lock 해제
        isFetchingNoti = false;
    }
}

// 알림 타입에 따른 화면 이동 / 모달 띄우기 처리
function handleNotiAction(noti) {
    toggleStudentNotiPanel(); // 알림창 닫기

    if (noti.actionType === 'weekly_report') {
        window.location.href = '/analysis?tab=coach'; 
    } 
    else if (noti.actionType === 'pro_report') {
        window.location.href = '/analysis?tab=pro'; 
    } 
    else if (noti.actionType === 'qna_reply') {
        window.location.href = '/qna';
    }
    else if (noti.actionType === 'admin_notice') {
        document.getElementById('noticeModalTitle').innerText = escapeHtml(noti.title) || "공지사항";
        document.getElementById('noticeModalDate').innerText = new Date(noti.createdAt).toLocaleDateString();
        document.getElementById('noticeModalContent').innerText = escapeHtml(noti.detail) || "내용이 없습니다.";
        
        const modal = document.getElementById('noticeDetail-modal');
        if(modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }
}

async function markStudentNotiRead(notiId) {
    try {
        await apiFetch(NOTI_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'student_read_notification', data: { notiId: notiId } })
        });
        fetchStudentNotifications(); 
    } catch(e) {
        if (e.message !== "Auth expired") console.error("Noti Read Update Error");
    }
}

window.markAllStudentNotiRead = async function() {
    if(!confirm("모든 알림을 읽음 처리하시겠습니까?")) return;
    await markStudentNotiRead('all');
}

// ============================================================
// [유틸리티] 특수문자 변환 (해킹 방지)
// ============================================================
// 한층 더 강력해진 escapeHtml 적용
function escapeHtml(text) {
    if (text === null || text === undefined) return ""; 
    return String(text) 
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 플래너 섹션 호버 인터랙션
function hoverMockup(index) {
    const targetBlock = document.getElementById('mock-' + index);
    if(targetBlock) {
        targetBlock.classList.add('active');
    }
}

function leaveMockup(index) {
    const targetBlock = document.getElementById('mock-' + index);
    if(targetBlock) {
        targetBlock.classList.remove('active');
    }
}

window.toggleMockupMobile = function(index) {
    if (window.innerWidth > 768) return; // PC 화면에서는 작동 안 함
    
    const blocks = document.querySelectorAll('.mockup-block');
    blocks.forEach((block, i) => {
        if (i + 1 === index) {
            block.classList.toggle('active-expand');
        } else {
            block.classList.remove('active-expand'); // 다른 항목은 닫힘
        }
    });
};

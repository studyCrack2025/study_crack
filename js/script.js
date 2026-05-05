// js/script.js

/* =========================================
   1. 전역 설정 및 유틸리티
   ========================================= */
const AUTH_API_URL = CONFIG.api.auth;
const NOTI_API_URL = CONFIG.api.noti;

// 공통 apiFetch 함수
async function apiFetch(url, options = {}) {
    const token = getAccessToken();
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    options.headers = { ...defaultHeaders, ...options.headers };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                const refreshed = await tryRefreshToken();
                if (refreshed) {
                    const newToken = getAccessToken();
                    options.headers['Authorization'] = `Bearer ${newToken}`;
                    const retryRes = await fetch(url, options);
                    if (retryRes.ok) return retryRes;
                    if (!retryRes.ok && retryRes.status !== 401 && retryRes.status !== 403) {
                        throw new Error(`서버 통신 오류 (상태 코드: ${retryRes.status})`);
                    }
                }
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

function openModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

/* =========================================
   2. 커리큘럼 탭 로직 (기존 코드 유지)
   ========================================= */
const COURSE_DATA = { /* ... (이전과 동일한 데이터 객체이므로 생략) ... */ 
    mbti: { title: "MBTI SOLUTION", price: "무료", desc: "탐구 MBTI 결과를 분석해 나의 학습 성향을 파악하고, 성적 상승을 위한 최적의 맞춤 공부법을 제안합니다.", list: [ { text: "탐구 MBTI 기반 학습 성향 정밀 진단" }, { text: "유형별 학습 강점 및 취약점 분석 리포트" }, { text: "성향에 딱 맞는 과목별 맞춤 공부법 솔루션 제공" } ], bg: "assets/backgrounds/bg_mbti.png", themeColor: "#8B5CF6" },
    basic: { title: "BASIC PLAN", price: `<span class="original-price">49,000원</span> <span class="discount-price">특별 할인가 <strong class="highlight-price">25,000원</strong></span>`, desc: "내 점수와 목표 대학 합격선 사이의 거리를 정밀하게 진단합니다.", list: [ { text: "개인 성적 및 목표 대학 환산점수 계산 (최대 18개)" }, { text: "합격 컷 대비 거리 분석 (위험도 경고)", action: "preview", imgBase: "feat_basic_1" }, { text: "목표 대학별 '효자 과목' 발굴" } ], bg: "assets/backgrounds/bg_basic.png", themeColor: "#059669" },
    standard: { title: "STANDARD PLAN", price: "월 149,000원", desc: "어떤 과목을 공부해야 점수가 가장 빨리 오르는지 분석하고 관리합니다.", list: [ { text: "목표 대학 무제한" }, { text: "과목별 1점당 환산 기울기(효율) 계산", action: "preview", imgBase: "feat_standard_1" }, { text: "점수 상승 시뮬레이션 제공", action: "preview", imgBase: "feat_standard_2" }, { text: "주 1회 전략 실행 학습 플래너 코칭 및 플래너 제공", action: "preview", imgBase: "feat_standard_3" } ], bg: "assets/backgrounds/bg_standard.png", themeColor: "#2563EB" },
    pro: { title: "PRO PLAN", price: "월 299,000원", desc: "최소한의 공부량으로 합격하기 위한 최적의 조합을 설계합니다.", list: [ { text: "STANDARD 포함" }, { text: "최소 점수 상승 조합 최적화 알고리즘" }, { text: "내 점수에 가장 유리한 대학 역추적" }, { text: "주 1회 심층 전략 코칭 및 플래너 제공" }, { text: "PRO 전용 보고서 미리보기 📄", action: "download", file: "assets/features/feat_pro_report.pdf" } ], bg: "assets/backgrounds/bg_pro.png", themeColor: "#E11D48" }
};

function initMobileCourses() {
    document.querySelectorAll('.course-tab-btn').forEach(btn => {
        const tier = btn.getAttribute('data-tier');
        const data = COURSE_DATA[tier];
        if (!data) return;

        const iconHtml = btn.querySelector('.tab-icon').outerHTML;
        const infoHtml = btn.querySelector('.tab-info').outerHTML;
        const listHtml = data.list.map(item => {
            const checkColor = data.themeColor;
            if (item.action) {
                let clickHandler = "";
                if (item.action === "preview") clickHandler = `onclick="event.stopPropagation(); openFeaturePreview('${item.imgBase}', '${item.text}')"`;
                else if (item.action === "download") clickHandler = `onclick="event.stopPropagation(); downloadProReport('${item.file}')"`;
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

        let extraBtnHtml = "";
        if (tier === 'mbti') {
            const isLoggedIn = !!getAccessToken();
            if (isLoggedIn) {
                extraBtnHtml = `
                    <div style="margin-top: 25px; padding: 15px; background: #f5f3ff; border: 1px dashed #8b5cf6; border-radius: 8px; text-align: center;">
                        <p style="margin: 0 0 10px 0; color: #6d28d9; font-weight: bold; font-size: 0.9rem;">🎁 회원 전용 혜택</p>
                        <a href="/mbti/download" onclick="event.stopPropagation();" style="display: inline-block; background: #8b5cf6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; transition: 0.2s;">
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

        btn.innerHTML = `
            <div class="tab-summary-wrap">
                ${iconHtml}
                ${infoHtml}
                <div class="tab-price-mobile">${data.price}</div>
            </div>
            <div class="mobile-detail-box">
                <p class="detail-desc">${data.desc}</p>
                <ul class="detail-list">${listHtml}</ul>
                ${extraBtnHtml}
            </div>
        `;
    });
}

function selectCourse(tier) {
    const data = COURSE_DATA[tier];
    if (!data) return;

    const isMobile = window.innerWidth <= 900;
    const activeBtn = document.querySelector(`.course-tab-btn[data-tier="${tier}"]`);

    const overlay = document.querySelector('.curriculum-bg-overlay');
    if (overlay) overlay.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url('${data.bg}')`;
    closeFeaturePreview();

    if (isMobile) {
        if (activeBtn.classList.contains('active-expand')) {
            activeBtn.classList.remove('active-expand', 'active');
        } else {
            document.querySelectorAll('.course-tab-btn').forEach(btn => btn.classList.remove('active-expand', 'active'));
            activeBtn.classList.add('active-expand', 'active');
        }
    } else {
        document.querySelectorAll('.course-tab-btn').forEach(btn => btn.classList.remove('active', 'active-expand'));
        if(activeBtn) activeBtn.classList.add('active', 'active-expand');

        const detailView = document.getElementById('courseDetailView');
        if (detailView) {
            const listHtml = data.list.map(item => {
                const checkColor = data.themeColor;
                if (item.action) {
                    let clickHandler = "";
                    if (item.action === "preview") clickHandler = `onclick="openFeaturePreview('${item.imgBase}', '${item.text}')"`;
                    else if (item.action === "download") clickHandler = `onclick="downloadProReport('${item.file}')"`;
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

            let extraBtnHtml = "";
            if (tier === 'mbti') {
                const isLoggedIn = !!getAccessToken();
                const userPromo = localStorage.getItem('promoCode') || ''; 
                const hasUsedPromo = /^[0-9A-F]{4}-[0-9A-F]{4}-STC$/.test(userPromo);
                
                if (!hasUsedPromo) {
                    if (isLoggedIn) {
                        extraBtnHtml = `
                            <div style="margin-top: 25px; padding: 15px; background: #f5f3ff; border: 1px dashed #8b5cf6; border-radius: 8px; text-align: center;">
                                <p style="margin: 0 0 10px 0; color: #6d28d9; font-weight: bold; font-size: 0.9rem;">🎁 회원 전용 혜택</p>
                                <a href="/mbti/download" onclick="event.stopPropagation();" style="display: inline-block; background: #8b5cf6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; transition: 0.2s;">
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
                <span class="detail-badge" style="color:${data.themeColor}; background:#fff; border: 1px solid ${data.themeColor};">${tier.toUpperCase()}</span>
                <h3 class="detail-title">${data.title}</h3>
                <div class="detail-price">${data.price}</div>
                <p class="detail-desc">${data.desc}</p>
                <ul class="detail-list">${listHtml}</ul>
                ${extraBtnHtml}
            `;
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
    if (panel) panel.classList.remove('active');
}

function downloadProReport(filePath) {
    if (confirm("PRO 전용 분석 보고서 샘플을 다운로드 하시겠습니까?")) {
        const link = document.createElement('a');
        link.href = filePath;
        link.download = 'StudyCrack_Pro_Report_Sample.pdf'; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

/* =========================================
   3. 후기 데이터 로직 (기존 유지)
   ========================================= */
async function getUserReviews() {
    try {
        const response = await apiFetch(AUTH_API_URL, { method: 'POST', body: JSON.stringify({ type: 'get_user_reviews' }) });
        const data = await response.json();
        if (Array.isArray(data)) return data; 
        if (data.body) {
            const parsedBody = JSON.parse(data.body);
            if (Array.isArray(parsedBody)) return parsedBody;
        }
        return [];
    } catch (error) {
        return []; 
    }
}

async function renderReviews() {
    const container = document.getElementById('reviewContainer');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center;">후기를 불러오는 중...</p>';
    const fallbackReviews = [
        { univ: '광운대 자율전공학부', name: '구*우', content: '기존에는 진학사를 보면서 감으로 기준을 잡았습니다. 컨설팅 후에는 제 점수가 어디에 유리한지 구조적으로 이해하게 됐습니다.' },
        { univ: '경희대, 건국대, 한국외대', name: '구*우', content: '막연한 안정 지원이 아니라, 왜 안정인지 설명할 수 있는 지원을 하게 됐습니다.' },
        { univ: '고려대, 중앙대', name: '구*우', content: '컨설팅을 통해 감정이 아닌 구조로 기준을 다시 세우고, 확신을 가지고 지원했습니다.' },
        { univ: '광운대 자율전공학부', name: '구*우', content: '학과 정보와 실제 예상 합격률을 분석받은 순간, 불안이 확신으로 바뀌었습니다.' },
        { univ: '광운대 자율전공학부', name: '구*우', content: '왜 이 선택이 유리한지 구조적으로 설명해주셔서 납득하고 지원할 수 있었습니다.' },
        { univ: '광운대 자율전공학부', name: '구*우', content: '제 점수가 어디에 유리한지 구조적으로 이해하게 됐고, 대학 라인이 달라졌습니다.' }
    ];
    const fetchedReviews = await getUserReviews();
    const reviews = fetchedReviews.length > 0 ? fetchedReviews : fallbackReviews;

    const reviewAvatars = [
        '/assets/figma/figma-asset-14.svg',
        '/assets/figma/figma-asset-12.png',
        '/assets/figma/figma-asset-20.png',
        '/assets/figma/figma-asset-13.png',
        '/assets/figma/figma-asset-03.png',
        '/assets/figma/figma-asset-02.png'
    ];

    container.innerHTML = reviews.map((review, index) => `
        <div class="review-card${index === 0 ? ' featured' : ''}">
            <div class="review-header">
                <span class="review-badge">${escapeHtml(review.univ)}</span>
                <span class="review-score">${index === 0 ? '★★★★☆' : '★★★★★'}</span>
            </div>
            <p class="review-text">"${escapeHtml(review.content)}"</p>
            <div class="review-author">
                <div class="review-avatar">
                    <img src="${reviewAvatars[index % reviewAvatars.length]}" alt="${escapeHtml(review.name)}">
                </div>
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
    if (nextSlide) nextSlide.classList.add('active');
};

/* =========================================
   5. 페이지 초기화 및 이벤트 리스너
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    // 권한 체크
    const token = getAccessToken();
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

    updateNavUI();
    renderReviews();
    initMobileCourses();
    selectCourse('mbti');

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
            clearClientSession();
            alert("로그아웃 되었습니다.");
            window.location.href = '/';
        });
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));

    // [핵심] 튜토리얼 완료 여부 엄격한 체크 시작
    if (getAccessToken() && userRole !== 'tutor' && userRole !== 'admin') {
        checkTutorialStatus();
    }
});

// 💡 튜토리얼 검증 후 강제 리다이렉트 (문지기 함수)
async function checkTutorialStatus() {
    if (window.location.pathname.startsWith('/tutorial')) return;
    if (localStorage.getItem('tutorial_completed') === 'true') return;

    if (localStorage.getItem('tutorialStatus') !== null) {
        alert('진행 중인 튜토리얼이 있습니다. 전략 분석을 위해 먼저 완료해주세요!');
        window.location.replace('/tutorial');
        return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) return;

    try {
        const response = await fetch(CONFIG.api.user, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({ type: 'get_user' })
        });

        if (response.ok) {
            const data = await response.json();
            if (data && (data.tutorialRewardClaimed === true || data.computedTier === 'standard' || data.computedTier === 'pro' || data.computedTier === 'trial')) {
                localStorage.setItem('tutorial_completed', 'true');
                return;
            } else {
                alert('진행 중인 튜토리얼로 바로 넘어갑니다!');
                window.location.replace('/tutorial');
            }
        }
        // API 에러 시 조용히 처리 (인증 문제일 수 있으므로 강제 이동하지 않음)
    } catch (e) {
        console.error("Tutorial sync error:", e);
    }
}

function updateNavUI() {
    const isLoggedIn = !!(getAccessToken() || getIdToken() || localStorage.getItem('userId'));
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
    if (!panel.classList.contains('hidden')) fetchStudentNotifications();
}

let isFetchingNoti = false; 

window.fetchStudentNotifications = async function() {
    if (isFetchingNoti) return;
    isFetchingNoti = true;

    try {
        // 페이지 최초 로드 시 메모리 토큰이 없으면 rt 쿠키로 먼저 복원
        // (updateNavUI가 userId 힌트로 먼저 UI를 그린 뒤 이 함수를 호출하므로)
        if (!getAccessToken()) {
            const refreshed = await tryRefreshToken();
            if (!refreshed) return; // 실제 미로그인 상태 → 조용히 종료
        }

        const response = await apiFetch(NOTI_API_URL, {
            method: 'POST', body: JSON.stringify({ type: 'student_get_notifications' })
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
                if (!n.isRead) await markStudentNotiRead(n.id);
                handleNotiAction(n);
            };
            div.innerHTML = `
                <div class="student-noti-title">${escapeHtml(n.message)}</div>
                <div class="student-noti-time">${new Date(n.createdAt).toLocaleString()}</div>
            `;
            listArea.appendChild(div);
        });
    } catch (e) { 
        if (e.message !== "Auth expired") console.error("Noti Fetch Error:", e); 
    } finally {
        isFetchingNoti = false;
    }
}

function handleNotiAction(noti) {
    toggleStudentNotiPanel();

    if (noti.actionType === 'weekly_report') window.location.href = '/analysis?tab=coach'; 
    else if (noti.actionType === 'pro_report') window.location.href = '/analysis?tab=pro'; 
    else if (noti.actionType === 'qna_reply') window.location.href = '/qna';
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
            method: 'POST', body: JSON.stringify({ type: 'student_read_notification', data: { notiId: notiId } })
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

// 특수문자 변환 (해킹 방지)
function escapeHtml(text) {
    if (text === null || text === undefined) return ""; 
    return String(text) 
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function hoverMockup(index) {
    const targetBlock = document.getElementById('mock-' + index);
    if(targetBlock) targetBlock.classList.add('active');
}

function leaveMockup(index) {
    const targetBlock = document.getElementById('mock-' + index);
    if(targetBlock) targetBlock.classList.remove('active');
}

window.toggleMockupMobile = function(index) {
    if (window.innerWidth > 768) return;
    
    const blocks = document.querySelectorAll('.mockup-block');
    blocks.forEach((block, i) => {
        if (i + 1 === index) block.classList.toggle('active-expand');
        else block.classList.remove('active-expand');
    });
};

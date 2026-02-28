// js/script.js

/* =========================================
   [기존 기능] 전역 함수 (모달 등)
   ========================================= */

// 모달 열기
function openModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // 배경 스크롤 막기
    }
}

// 모달 닫기
function closeModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // 배경 스크롤 허용
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
   [NEW] 추가된 기능 데이터 및 함수
   ========================================= */

// 코스 데이터
const COURSE_DATA = {
    mbti: {
        title: "MBTI SOLUTION",
        price: "무료",
        desc: "탐구 MBTI 결과를 분석해 나의 학습 성향을 파악하고, 성적 상승을 위한 최적의 맞춤 공부법을 제안합니다.",
        list: ["탐구 MBTI 기반 학습 성향 정밀 진단", "유형별 학습 강점 및 취약점 분석 리포트", "성향에 딱 맞는 과목별 맞춤 공부법 솔루션 제공"],
        bg: "assets/backgrounds/bg_mbti.png",
        themeColor: "#8B5CF6"
    },
    basic: {
        title: "BASIC PLAN",
        price: "49,000원",
        desc: "내 점수와 목표 대학 합격선 사이의 거리를 정밀하게 진단합니다.",
        list: ["개인 성적 및 목표 대학 환산점수 계산", "합격 컷 대비 거리 분석 (위험도 경고)", "목표 대학별 '효자 과목' 발굴"],
        bg: "assets/backgrounds/bg_basic.png", 
        themeColor: "#059669"
    },
    standard: {
        title: "STANDARD PLAN",
        price: "월 149,000원",
        desc: "어떤 과목을 공부해야 점수가 가장 빨리 오르는지 분석하고 관리합니다.",
        list: ["BASIC 포함 + 목표 대학 3곳 확장", "과목별 1점당 환산 기울기(효율) 계산", "점수 상승 시뮬레이션 제공", "주 1회 전략 실행 학습 플래너 코칭"],
        bg: "assets/backgrounds/bg_standard.png", 
        themeColor: "#2563EB"
    },
    pro: {
        title: "PRO PLAN",
        price: "월 299,000원",
        desc: "최소한의 공부량으로 합격하기 위한 최적의 조합을 설계합니다.",
        list: ["STANDARD 포함 + 목표 대학 6곳 확장", "최소 점수 상승 조합 최적화 알고리즘", "내 점수에 가장 유리한 대학 역추적", "주 1회 심층 전략 코칭"],
        bg: "assets/backgrounds/bg_pro.png", 
        themeColor: "#E11D48"
    }
};

// 탭 선택 함수
function selectCourse(tier) {
    const data = COURSE_DATA[tier];
    if (!data) return;

    // 1. 버튼 활성화
    document.querySelectorAll('.course-tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.course-tab-btn[data-tier="${tier}"]`);
    if(activeBtn) activeBtn.classList.add('active');

    // 2. 배경 이미지 변경
    const overlay = document.querySelector('.curriculum-bg-overlay');
    if (overlay) {
        overlay.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url('${data.bg}')`;
    }

    // 3. 상세 내용 렌더링
    const detailView = document.getElementById('courseDetailView');
    if (detailView) {
        const listHtml = data.list.map(item => `
            <li><i class="fas fa-check-circle" style="color:${tier === 'black' ? '#d4af37' : '#4ade80'}"></i><span>${item}</span></li>
        `).join('');

        detailView.innerHTML = `
            <span class="detail-badge" style="color:${data.themeColor}; background:#fff; border: 1px solid ${data.themeColor};">
                ${tier.toUpperCase()}
            </span>
            <h3 class="detail-title">${data.title}</h3>
            <div class="detail-price">${data.price}</div>
            <p class="detail-desc">${data.desc}</p>
            <ul class="detail-list">${listHtml}</ul>
        `;
    }
}

// 후기 데이터 API 호출
async function getUserReviews() {
    const token = localStorage.getItem('idToken');
    
    try {
        const response = await fetch(CONFIG.api.auth, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                type: 'get_user_reviews' // Lambda 등 서버에서 이 type으로 분기 처리
            })
        });

        if (!response.ok) {
            throw new Error(`API 호출 실패: ${response.status}`);
        }

        const data = await response.json();
        
        // 데이터가 배열인지 확인 후 반환
        if (Array.isArray(data)) {
            return data;
        } else if (data.body && Array.isArray(JSON.parse(data.body))) {
             // AWS Lambda Proxy Integration 응답인 경우 (body가 문자열일 때)
            return JSON.parse(data.body);
        } else {
            console.warn("⚠️ 서버 응답 형식이 배열이 아닙니다:", data);
            return [];
        }

    } catch (error) {
        console.error("❌ 후기 로드 중 오류 발생:", error);
        // 에러 발생 시 화면이 깨지지 않도록 빈 배열 반환 (또는 Fallback 데이터)
        return [];
    }
}

// 후기 렌더링
async function renderReviews() {
    const container = document.getElementById('reviewContainer');
    if (!container) return;
    try {
        const reviews = await getUserReviews();
        container.innerHTML = reviews.map(review => `
            <div class="review-card">
                <div class="review-header">
                    <span class="review-badge">${review.univ}</span>
                    <span class="review-score">⭐️⭐️⭐️⭐️⭐️</span>
                </div>
                <p class="review-text">"${review.content}"</p>
                <div class="review-author">
                    <div class="review-avatar">${review.name.charAt(0)}</div>
                    <div class="review-info"><div>${review.name}</div><div>${review.score}</div></div>
                </div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = '<p>후기를 불러오지 못했습니다.</p>'; }
}

/* =========================================
   [DOM 로드]
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    
    // 🔥 [핵심 수정] 권한 체크 및 리다이렉트
    // 학생(Student) 및 비로그인 유저만 메인 페이지에 머물 수 있습니다.
    const token = localStorage.getItem('idToken');
    const userRole = localStorage.getItem('userRole');
    
    // 로컬 스토리지에서 이름 가져오기 (userName이 없으면 name, 그것도 없으면 '튜터'로 대체)
    const userName = localStorage.getItem('userName') || localStorage.getItem('name') || '스터디크랙';

    if (token && userRole) {
        if (userRole === 'tutor') {
            alert(`${userName} 선생님 페이지로 이동합니다.`);
            window.location.href = '/mypage/tutor';
            return; // 이후 스크립트 실행 중단
        } else if (userRole === 'admin') {
            alert("관리자 페이지로 이동합니다.");
            window.location.href = '/admin';
            return; // 이후 스크립트 실행 중단
        }
    }

    // --- 아래는 Student 또는 비로그인 상태일 때만 실행됨 ---

    // [1] 네비게이션 버튼 상태 업데이트 (로그인 여부 체크)
    updateNavUI();

    // 기존 checkLoginStatus가 있다면 실행 (토큰 만료 체크 등 보조 역할)
    if (typeof checkLoginStatus === 'function') {
        checkLoginStatus();
    }

    // [2] 마이페이지 버튼 이벤트
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

    // [3] 로그아웃 버튼 이벤트
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 로그아웃 처리
            localStorage.clear(); // 토큰 삭제
            
            if (typeof handleSignOut === 'function') {
                handleSignOut(); // AWS Cognito 등이 있다면 호출
            } else {
                alert("로그아웃 되었습니다.");
                window.location.href = '/index';
            }
            
            // UI 즉시 갱신 (새로고침 전 깜빡임 방지)
            updateNavUI(); 
        });
    }

    // [4] 기타 기존 기능 (BLACK 버튼, 스크롤 애니메이션 등)
    if (typeof showBlackButtonIfEligible === 'function') {
        showBlackButtonIfEligible();
        setTimeout(showBlackButtonIfEligible, 500);
    }
    
    // 스크롤 애니메이션
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
    
    // 후기 로드
    if (typeof renderReviews === 'function') {
        renderReviews();
    }
});


/* =========================================
   [함수] 네비게이션 UI 업데이트 (핵심 기능)
   ========================================= */
function updateNavUI() {
    // 로그인 여부 판단 (토큰 존재 여부)
    const isLoggedIn = !!localStorage.getItem('idToken');

    // DOM 요소 가져오기
    const btnAnalysis = document.getElementById('navAnalysis'); // 솔루션
    const btnQna = document.getElementById('navQna');           // 문의
    const btnLogin = document.getElementById('loginBtn');       // 로그인
    const btnMyPage = document.getElementById('myPageBtn');     // 마이페이지
    const btnLogout = document.getElementById('logoutBtn');     // 로그아웃

    if (isLoggedIn) {
        // [로그인 상태] -> 솔루션, 문의, 마이페이지, 로그아웃 보임 / 로그인 버튼 숨김
        if (btnAnalysis) btnAnalysis.classList.remove('hidden');
        if (btnQna) btnQna.classList.remove('hidden');
        if (btnMyPage) btnMyPage.classList.remove('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');
        if (btnLogin) btnLogin.classList.add('hidden');
    } else {
        // [비로그인 상태] -> 솔루션, 문의, 마이페이지, 로그아웃 숨김 / 로그인 버튼 보임
        if (btnAnalysis) btnAnalysis.classList.add('hidden');
        if (btnQna) btnQna.classList.add('hidden');
        if (btnMyPage) btnMyPage.classList.add('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
        if (btnLogin) btnLogin.classList.remove('hidden');
    }
}

/* =========================================
   [New] Interactive Demo Logic
   ========================================= */

// 데모 단계 이동 함수
function nextDemoStep(stepNumber) {
    // 모든 스텝 숨기기
    document.querySelectorAll('.demo-step').forEach(el => el.classList.remove('active'));
    
    // 해당 스텝 보이기
    const nextStep = document.getElementById('demoStep' + stepNumber);
    if (nextStep) {
        nextStep.classList.add('active');
    }
}

// 결과 뷰 순환 함수 (Step 4 내부에서 동작)
let currentResultView = 1;
function cycleResultView() {
    // 현재 뷰 숨기기
    document.getElementById('resultView' + currentResultView).classList.remove('active');
    
    // 다음 뷰 번호 계산 (1 -> 2 -> 3 -> 1)
    currentResultView++;
    if (currentResultView > 3) currentResultView = 1;
    
    // 다음 뷰 보이기
    document.getElementById('resultView' + currentResultView).classList.add('active');
}

// -------------------------------------------
// [기존 함수들] BLACK 버튼 로직 유지
// -------------------------------------------
function showBlackButtonIfEligible() {
    const token = localStorage.getItem('accessToken'); 
    const tier = localStorage.getItem('userTier'); 

    const btn = document.getElementById('blackThemeBtn');
    if (!btn) return;

    if (token && tier === 'black') {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

function checkBlackAccess() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        alert("로그인이 필요한 서비스입니다.");
        window.location.href = '/login';
        return;
    }

    const tier = localStorage.getItem('userTier');
    if (tier === 'black') {
        window.location.href = '/black';
    } else {
        alert("BLACK 회원 전용 공간입니다.");
    }
}
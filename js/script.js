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
    },
    black: {
        title: "BLACK CLUB",
        price: "가격 비공개 (문의)",
        desc: "상위 1%를 위한 프라이빗 컨설팅. 컨설턴트가 직접 전략에 개입합니다.",
        list: ["PRO 기능 전부 포함", "컨설턴트 직접 관리 및 입시 전략 수립", "시기별 우선 대응 및 시크릿 리포트", "BLACK 전용 라운지 접근 권한"],
        bg: "assets/backgrounds/bg_black.png", 
        themeColor: "#000000"
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
   [DOM 로드] 기존 기능 유지 + 신규 기능 추가
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkLoginStatus === 'function') {
        checkLoginStatus();
    }

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
            if (typeof handleSignOut === 'function') {
                handleSignOut();
            } else {
                localStorage.clear();
                window.location.href = '/index';
            }
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            if (!this.classList.contains('nav-btn') && !this.classList.contains('floating-qna-btn')) {
                const href = this.getAttribute('href');
                if (href.length > 1) {
                    const targetId = href.substring(1);
                    const targetElement = document.getElementById(targetId);
                    if (targetElement) {
                        e.preventDefault();
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }
        });
    });

    showBlackButtonIfEligible();
    setTimeout(showBlackButtonIfEligible, 500);
    
    // (1) 스크롤 애니메이션
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));

    // (2) 초기 코스 탭 설정 (Basic)
    selectCourse('basic');

    // (3) 후기 로드
    renderReviews();
});


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
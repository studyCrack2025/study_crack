// js/script.js

/* =========================================
   1. 전역 설정 및 유틸리티
   ========================================= */
const AUTH_API_URL = CONFIG.api.auth;
const NOTI_API_URL = CONFIG.api.noti;

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

function selectCourse(tier) {
    const data = COURSE_DATA[tier];
    if (!data) return;

    document.querySelectorAll('.course-tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.course-tab-btn[data-tier="${tier}"]`);
    if(activeBtn) activeBtn.classList.add('active');

    const overlay = document.querySelector('.curriculum-bg-overlay');
    if (overlay) {
        overlay.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url('${data.bg}')`;
    }

    closeFeaturePreview();

    const detailView = document.getElementById('courseDetailView');
    if (detailView) {
        const listHtml = data.list.map(item => {
            const checkColor = tier === 'black' ? '#d4af37' : '#4ade80';
            
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

    // 5. BLACK 버튼 로직
    if (typeof showBlackButtonIfEligible === 'function') {
        showBlackButtonIfEligible();
    }
});

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

window.fetchStudentNotifications = async function() {
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

// 🔥 알림 타입에 따른 화면 이동 / 모달 띄우기 처리
function handleNotiAction(noti) {
    toggleStudentNotiPanel(); // 알림창 닫기

    if (noti.actionType === 'weekly_report') {
        window.location.href = '/analysis?tab=coach'; 
    } 
    else if (noti.actionType === 'pro_report') {
        window.location.href = '/analysis?tab=pro'; 
    } 
    else if (noti.actionType === 'qna_reply') {
        document.getElementById('noticeModalTitle').innerText = noti.title || "답변 완료";
        document.getElementById('noticeModalDate').innerText = new Date(noti.createdAt).toLocaleDateString();
        document.getElementById('noticeModalContent').innerText = noti.detail || "마이페이지 Q&A에서 확인해주세요.";
        
        const modal = document.getElementById('noticeDetail-modal');
        if(modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }
    else if (noti.actionType === 'admin_notice') {
        document.getElementById('noticeModalTitle').innerText = noti.title || "공지사항";
        document.getElementById('noticeModalDate').innerText = new Date(noti.createdAt).toLocaleDateString();
        document.getElementById('noticeModalContent').innerText = noti.detail || "내용이 없습니다.";
        
        const modal = document.getElementById('noticeDetail-modal');
        if(modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }
}

// ============================================================
// [유틸리티] 특수문자 변환 (해킹 방지)
// ============================================================
// 💡 한층 더 강력해진 escapeHtml 적용
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
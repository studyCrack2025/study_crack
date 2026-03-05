/* =========================================
   1. 전역 설정 및 유틸리티
   ========================================= */

// API 설정 (config.js가 없을 경우를 대비한 기본값 포함)
const API_CONFIG = (typeof CONFIG !== 'undefined' && CONFIG.api) ? CONFIG.api : {
    auth: 'YOUR_API_ENDPOINT_HERE' // 실제 API 주소가 없다면 빈 문자열
};

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
        // MBTI는 클릭 기능 없음 (기존 유지)
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
        price: "49,000원",
        desc: "내 점수와 목표 대학 합격선 사이의 거리를 정밀하게 진단합니다.",
        list: [
            { text: "개인 성적 및 목표 대학 환산점수 계산" },
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
            { text: "BASIC 포함 + 목표 대학 3곳 확장" },
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
                text: "주 1회 전략 실행 학습 플래너 코칭", 
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
            { text: "STANDARD 포함 + 목표 대학 6곳 확장" },
            { text: "최소 점수 상승 조합 최적화 알고리즘" },
            { text: "내 점수에 가장 유리한 대학 역추적" },
            { text: "주 1회 심층 전략 코칭" },
            // PRO 전용 추가 링크 (다운로드 기능)
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

    // 탭 활성화 처리
    document.querySelectorAll('.course-tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.course-tab-btn[data-tier="${tier}"]`);
    if(activeBtn) activeBtn.classList.add('active');

    // 배경 이미지 변경
    const overlay = document.querySelector('.curriculum-bg-overlay');
    if (overlay) {
        overlay.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url('${data.bg}')`;
    }

    // 프리뷰 패널 닫기 (탭 변경 시 초기화)
    closeFeaturePreview();

    // 상세 내용 렌더링
    const detailView = document.getElementById('courseDetailView');
    if (detailView) {
        // 리스트 아이템 HTML 생성
        const listHtml = data.list.map(item => {
            const checkColor = tier === 'black' ? '#d4af37' : '#4ade80';
            
            // 액션이 있는 경우 (Preview 또는 Download)
            if (item.action) {
                // onclick 핸들러 생성
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
                // 일반 항목
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
    
    // 이미지 감싸는 부모 요소 선택
    const imgWrapper = document.querySelector('.preview-img-wrapper');

    if (!panel || !imgWrapper) return;

    // [중요] 매번 클릭할 때마다 이미지 태그를 새로 리셋합니다.
    // (이전에 에러가 나서 텍스트로 바뀌어 있을 수 있기 때문입니다)
    imgWrapper.innerHTML = '<img id="previewImage" src="" alt="기능 예시 이미지" style="width:100%; height:100%; object-fit:contain;">';
    
    // 리셋된 이미지 태그 다시 선택
    const previewImg = document.getElementById('previewImage');

    // 모바일 감지 (화면 너비 900px 이하)
    const isMobile = window.innerWidth <= 900;
    
    // 이미지 경로 생성 로직
    let imgPath = "";
    if (isMobile) {
        // 예: feat_basic_1 -> feat_basic_mobile_1.png
        const parts = imgBase.split('_');
        const number = parts.pop(); 
        const base = parts.join('_'); 
        imgPath = `assets/features/${base}_mobile_${number}.png`;
    } else {
        // 예: feat_basic_1.png
        imgPath = `assets/features/${imgBase}.png`;
    }

    // 제목 설정
    if(previewTitle) previewTitle.innerText = title;

    // [핵심] 이미지 로드 실패 시 alert 대신 UI 변경
    previewImg.onerror = function() {
        // 콘솔에만 에러 로그 남김 (사용자 방해 X)
        console.log("이미지 로드 실패, 대체 화면 표시: " + imgPath);
        
        // 이미지 태그를 안내 문구로 교체
        imgWrapper.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:rgba(255,255,255,0.5); gap:15px;">
                <i class="fas fa-image" style="font-size:3rem;"></i>
                <span style="font-size:0.95rem;">이미지를 준비 중입니다.</span>
            </div>
        `;
    };

    // 이미지 경로 할당 (이 시점에 로딩 시작)
    previewImg.src = imgPath;

    // 패널 열기 애니메이션
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
        // 가상의 링크를 생성하여 다운로드 트리거
        const link = document.createElement('a');
        link.href = filePath;
        link.download = 'StudyCrack_Pro_Report_Sample.pdf'; // 다운로드될 파일명
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}


/* =========================================
   3. 후기 데이터 로직 (에러 처리 강화)
   ========================================= */
async function getUserReviews() {
    // 1. API 설정 확인 (설정 없으면 빈 배열 반환)
    if (!API_CONFIG.auth || API_CONFIG.auth.includes('YOUR_API')) {
        console.error("❌ API 설정 오류: 유효한 API 주소가 없습니다.");
        return []; // 가짜 데이터 대신 빈 배열 반환
    }

    const token = localStorage.getItem('idToken');

    try {
        const response = await fetch(API_CONFIG.auth, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type: 'get_user_reviews' })
        });

        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }

        const data = await response.json();
        
        // 2. 데이터 형식 확인 및 반환
        // Case A: 바로 배열이 오는 경우
        if (Array.isArray(data)) {
            return data;
        } 
        // Case B: AWS Lambda Proxy 응답 (body 안에 문자열로 들어있는 경우)
        if (data.body) {
            const parsedBody = JSON.parse(data.body);
            if (Array.isArray(parsedBody)) {
                return parsedBody;
            }
        }

        // 형식이 맞지 않는 경우
        console.warn("⚠️ 서버 응답 형식이 올바르지 않습니다:", data);
        return [];

    } catch (error) {
        // 3. 에러 발생 시 처리
        console.error("❌ 후기 데이터 로드 실패 (실제 서버 에러):", error);
        return []; // 에러 발생 시 MOCK_REVIEWS 대신 빈 배열 반환
    }
}

async function renderReviews() {
    const container = document.getElementById('reviewContainer');
    if (!container) return;
    
    // 로딩 표시
    container.innerHTML = '<p style="text-align:center;">후기를 불러오는 중...</p>';

    const reviews = await getUserReviews();
    
    if (reviews.length === 0) {
        container.innerHTML = '<p style="text-align:center;">등록된 후기가 없습니다.</p>';
        return;
    }

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
}

/* =========================================
   4. 인터랙티브 데모 로직 (ReferenceError 해결)
   ========================================= */

// 전역 스코프에 함수 정의 (HTML onclick에서 접근 가능하도록)
window.nextDemoStep = function(stepNumber) {
    // 모든 스텝 숨기기
    document.querySelectorAll('.demo-step').forEach(el => el.classList.remove('active'));
    
    // 해당 스텝 보이기
    const nextStep = document.getElementById('demoStep' + stepNumber);
    if (nextStep) {
        nextStep.classList.add('active');
        nextStep.style.animation = 'none'; // 애니메이션 리셋
        nextStep.offsetHeight; /* trigger reflow */
        nextStep.style.animation = 'slideUp 0.4s ease-out';
    }
};

window.cycleResultView = function() {
    // 현재 활성화된 뷰 찾기
    const activeSlide = document.querySelector('.result-slide.active');
    let currentId = 1;
    
    if (activeSlide) {
        currentId = parseInt(activeSlide.id.replace('resultView', ''));
        activeSlide.classList.remove('active');
    }
    
    // 다음 뷰 번호 계산
    let nextId = currentId + 1;
    if (nextId > 3) nextId = 1;
    
    // 다음 뷰 보이기
    const nextSlide = document.getElementById('resultView' + nextId);
    if (nextSlide) {
        nextSlide.classList.add('active');
    }
};

/* =========================================
   5. 페이지 초기화 및 이벤트 리스너
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. 권한 체크
    const token = localStorage.getItem('idToken');
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
    const isLoggedIn = !!localStorage.getItem('idToken');
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
// [NEW] 학생 알림 시스템 및 액션 라우팅
// ============================================================
window.toggleStudentNotiPanel = function() {
    const panel = document.getElementById('studentNotiPanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        fetchStudentNotifications();
    }
}

window.fetchStudentNotifications = async function() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    if (!userId || !token) return;

    try {
        // API_CONFIG.auth가 아니라 base URL을 사용해야 함
        const response = await fetch(API_CONFIG.auth, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'student_get_notifications', userId: userId })
        });
        const data = await response.json();
        const notis = data.notifications || [];
        
        // 뱃지 갱신
        const unreadCount = notis.filter(n => !n.isRead).length;
        const badge = document.getElementById('studentNotiBadge');
        if (badge) {
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
            badge.innerText = unreadCount;
        }

        // 목록 렌더링
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
            
            // 알림 클릭 시: 1. 읽음 처리 -> 2. 해당 페이지/모달 띄우기
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

    } catch (e) { console.error("Noti Fetch Error:", e); }
}

async function markStudentNotiRead(notiId) {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    try {
        await fetch(API_CONFIG.auth, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'student_read_notification', userId: userId, data: { notiId: notiId } })
        });
        fetchStudentNotifications(); // 읽음 처리 후 뱃지/목록 갱신
    } catch(e) {}
}

window.markAllStudentNotiRead = async function() {
    if(!confirm("모든 알림을 읽음 처리하시겠습니까?")) return;
    await markStudentNotiRead('all');
}

// 🔥 알림 타입에 따른 화면 이동 / 모달 띄우기 처리
function handleNotiAction(noti) {
    toggleStudentNotiPanel(); // 알림창 닫기

    if (noti.actionType === 'weekly_report') {
        // 주간 리포트 도착 -> Analysis 페이지의 플래너 탭으로 이동
        // (Analysis 페이지 내부의 탭 변수명에 맞게 tab=weekly 또는 tab=planner로 지정)
        window.location.href = '/analysis?tab=weekly'; 
    } 
    else if (noti.actionType === 'pro_report') {
        // PRO 리포트 도착 -> Analysis 페이지의 PRO 탭으로 이동
        window.location.href = '/analysis?tab=special'; 
    } 
    else if (noti.actionType === 'admin_notice') {
        // 관리자 전체 공지 -> 모달 띄우기
        document.getElementById('noticeModalTitle').innerText = noti.title || "공지사항";
        document.getElementById('noticeModalDate').innerText = new Date(noti.createdAt).toLocaleDateString();
        document.getElementById('noticeModalContent').innerText = noti.detail || "내용이 없습니다.";
        
        const modal = document.getElementById('noticeDetailModal');
        if(modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }
}

// function showBlackButtonIfEligible() {
//     const token = localStorage.getItem('accessToken'); 
//     const tier = localStorage.getItem('userTier'); 
//     const btn = document.getElementById('blackThemeBtn');
//     if (!btn) return;
// 
//     if (token && tier === 'black') {
//         btn.classList.remove('hidden');
//     } else {
//         btn.classList.add('hidden');
//     }
// }
// 
// function checkBlackAccess() {
//     const token = localStorage.getItem('accessToken');
//     if (!token) {
//         alert("로그인이 필요한 서비스입니다.");
//         window.location.href = '/login';
//         return;
//     }
//     const tier = localStorage.getItem('userTier');
//     if (tier === 'black') {
//         window.location.href = '/black';
//     } else {
//         alert("BLACK 회원 전용 공간입니다.");
//     }
// }
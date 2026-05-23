// js/admin_ui.js
// 전역 설정, 공유 변수, 초기화(DOMContentLoaded), 네비게이션 제어
// 기능별 로직은 js/admin/ 하위 모듈에 분리됨

// promoCode(예: 4953-4446-STC)를 MBTI 문자열로 역변환
function decodePromoCodeToMbti(promoCode) {
    if (!promoCode || !promoCode.endsWith('-STC')) return null;
    const hex = promoCode.replace('-STC', '').replace(/-/g, '');
    if (hex.length !== 8) return null;
    let mbti = '';
    for (let i = 0; i < hex.length; i += 2) {
        const charCode = parseInt(hex.substring(i, i + 2), 16);
        if (isNaN(charCode)) return null;
        mbti += String.fromCharCode(charCode);
    }
    return mbti.toUpperCase();
}

// 1. 차트 플러그인 등록
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// 2. 전역 변수 및 설정
const ADMIN_API_URL = CONFIG.api.admin;
const NOTI_API_URL = CONFIG.api.noti;
const QNA_API_URL = CONFIG.api.qna;

// 차트 관련 변수
let salesChart = null;
let periodChart = null;
let rawPaymentData = [];

// 학생 목록 현재 검색 결과 (CSV 내보내기용)
let currentStudentList = [];

// Q&A 관련 변수
let allQnaData = [];
let currentQnaFilter = 'waiting';
let currentReplyTarget = null;

// 3. 초기화 (진입점)
document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');

    // 보안: 관리자 권한 체크
    if (!userId || role !== 'admin') {
        alert("관리자 권한이 없습니다.");
        window.location.href = '/';
        return;
    }

    // 페이지 리로드 시 at 쿠키 갱신 후 초기화
    tryRefreshToken().then(ok => {
        if (!ok && !localStorage.getItem('userId')) {
            alert("세션이 만료되었습니다. 다시 로그인해주세요.");
            localStorage.clear();
            window.location.href = '/admin/login';
            return;
        }
        initAdminPage(userId);
    });
});

function initAdminPage(userId) {
    // 초기 데이터 로드
    loadAdminStats(userId);
    populateTutorFilter();

    // 상세 페이지에서 돌아온 경우 이전 검색 상태 복원
    const savedSearch = Store.get('lastSearch');
    if (savedSearch) {
        const typeEl = document.getElementById('searchType');
        const inputEl = document.getElementById('searchInput');
        const tierEl  = document.getElementById('filterTier');
        if (typeEl)  typeEl.value  = savedSearch.type  || 'name';
        if (inputEl) inputEl.value = savedSearch.keyword || '';
        if (tierEl)  tierEl.value  = savedSearch.filterTier || 'all';
        // filterTutor는 populateTutorFilter() 비동기 완료 후 적용
        if (savedSearch.filterTutor && savedSearch.filterTutor !== 'all') {
            setTimeout(() => {
                const tutorEl = document.getElementById('filterTutor');
                if (tutorEl) tutorEl.value = savedSearch.filterTutor;
            }, 1000);
        }
    }
    searchStudents();
    fetchUnreadNotiCount();

    fetchQnaBadgeCount();

    // 검색창에서 엔터키 누르면 검색 실행
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') searchStudents();
        });
    }

    setTimeout(() => loadMatchingData(true), 1500);

    // CUSTOM 템플릿 선택 시 공지 내용 textarea와 미리보기 실시간 연동
    const noticeContentEl = document.getElementById('noticeContent');
    if (noticeContentEl) {
        noticeContentEl.addEventListener('input', () => {
            const selectedType = document.getElementById('alimtalkTemplateType')?.value;
            if (selectedType === 'CUSTOM') updateTemplatePreview();
        });
    }
}

// ============================================================
// [A] 네비게이션 및 UI 제어
// ============================================================
function toggleSubmenu(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
}

function showSection(sectionName) {
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.menu-item > a').forEach(el => { el.style.backgroundColor = ''; el.style.color = '#cbd5e1'; });
    document.querySelectorAll('.submenu li a').forEach(el => { el.style.color = '#94a3b8'; });

    const clickedLink = document.querySelector(`a[onclick*="showSection('${sectionName}')"]`) ||
                        document.querySelector(`a[onclick*="showQnaSection"]`) ||
                        document.querySelector(`a[onclick*="showNotiMenu"]`);

    if (clickedLink) {
        if (clickedLink.closest('.submenu')) {
            clickedLink.style.color = '#60a5fa';
            const parentMenu = clickedLink.closest('.has-submenu').querySelector('a');
            if(parentMenu) parentMenu.style.color = '#60a5fa';
        } else {
            clickedLink.style.backgroundColor = '#334155'; clickedLink.style.color = 'white';
        }
    }

    const secMap = {
        'students': 'section-students', 'dashboard': 'section-dashboard', 'advanced-stats': 'section-advanced-stats',
        'tutors': 'section-tutors', 'notifications': 'section-notifications', 'qna': 'section-qna', 'matching': 'section-matching'
    };

    if (secMap[sectionName]) {
        document.getElementById(secMap[sectionName]).classList.add('active');
        if (sectionName !== 'sales-chart') window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (sectionName === 'sales-chart') {
        document.getElementById('section-dashboard').classList.add('active');
        const anchor = document.getElementById('chart-section-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
    } else if (sectionName === 'tutors') loadTutorStats();
    else if (sectionName === 'notifications') { loadNotifications(); loadTutorListForNotice(); }
    else if (sectionName === 'matching') loadMatchingData();
}

window.showQnaSection = function(status) {
    showSection('qna');
    currentQnaFilter = status;
    const titleMap = { 'done': '✅ 응답 완료', 'read': '👁️ 읽음 (미응답)', 'waiting': '🔴 읽지 않음' };
    document.getElementById('qnaStatusTitle').innerText = `- ${titleMap[status]}`;
    loadAllQna();
};

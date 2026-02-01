// js/black_community.js

//const API_URL = CONFIG.api.base;
let allPosts = [];
let currentPage = 1;
const itemsPerPage = 15;
let currentTab = 'all'; // all, free, info, qna

document.addEventListener('DOMContentLoaded', () => {
    // 1. 더미 데이터 생성 (백엔드 연동 전)
    allPosts = generateDummyPosts();
    
    // 2. 게시판 렌더링
    renderBoard();
});

// 게시판 렌더링 함수
function renderBoard() {
    const tbody = document.getElementById('boardListBody');
    tbody.innerHTML = '';

    // 1. 필터링 (탭 & 검색)
    const searchVal = document.getElementById('searchInput').value.toLowerCase();
    
    let filtered = allPosts.filter(p => {
        // 탭 필터 (공지사항은 항상 표시 or 탭에 맞게)
        // 여기서는 '전체'일 땐 공지+일반, 그 외엔 해당 카테고리만
        const tabMatch = (currentTab === 'all') || (p.category === currentTab) || p.isNotice;
        
        // 검색 필터
        const searchMatch = p.title.toLowerCase().includes(searchVal) || p.author.toLowerCase().includes(searchVal);
        
        return tabMatch && searchMatch;
    });

    // 2. 공지사항 상단 고정 정렬
    // (더미 생성 시 이미 공지를 앞에 뒀지만, 안전하게 재정렬)
    filtered.sort((a, b) => {
        if (a.isNotice && !b.isNotice) return -1;
        if (!a.isNotice && b.isNotice) return 1;
        return b.id - a.id; // 최신순 (ID 역순)
    });

    // 3. 페이지네이션 계산
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageItems = filtered.slice(startIdx, endIdx);

    // 4. HTML 생성
    if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">게시글이 없습니다.</td></tr>';
        renderPagination(0);
        return;
    }

    pageItems.forEach(post => {
        const tr = document.createElement('tr');
        if (post.isNotice) tr.className = 'row-notice';

        // 공지사항 아이콘 처리
        const numHtml = post.isNotice 
            ? '<i class="fas fa-bullhorn"></i> 공지' 
            : post.id;
        
        // 댓글 수 (0이면 숨김)
        const commentHtml = post.comments > 0 
            ? `<span class="comment-count">[${post.comments}]</span>` 
            : '';

        // 카테고리 뱃지 (일반글만)
        const catBadge = !post.isNotice && currentTab === 'all' 
            ? `<span style="color:#64748b; font-size:0.8rem; margin-right:5px;">[${getCatName(post.category)}]</span>` 
            : '';

        tr.innerHTML = `
            <td class="td-num">${numHtml}</td>
            <td class="td-title" onclick="viewPost(${post.id})">
                ${catBadge}${post.title} ${commentHtml}
                ${post.isNew ? '<span style="color:#ef4444; font-size:0.7rem; vertical-align:top;">N</span>' : ''}
            </td>
            <td class="td-author" data-date="${post.date}">${post.author}</td>
            <td class="td-date">${post.date}</td>
            <td class="td-views">${formatViews(post.views)}</td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(totalPages);
}

// 페이지네이션 렌더링
function renderPagination(totalPages) {
    const container = document.getElementById('pagination');
    container.innerHTML = '';
    
    if (totalPages <= 1) return;

    // 이전 버튼
    if (currentPage > 1) {
        container.innerHTML += `<a class="page-link" onclick="changePage(${currentPage - 1})">&lt;</a>`;
    }

    // 페이지 번호 (최대 5개 표시 로직은 생략하고 단순하게)
    for (let i = 1; i <= totalPages; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        container.innerHTML += `<a class="page-link ${activeClass}" onclick="changePage(${i})">${i}</a>`;
    }

    // 다음 버튼
    if (currentPage < totalPages) {
        container.innerHTML += `<a class="page-link" onclick="changePage(${currentPage + 1})">&gt;</a>`;
    }
}

// 이벤트 핸들러
function changePage(page) {
    currentPage = page;
    renderBoard();
}

function filterBoard(tab) {
    currentTab = tab;
    currentPage = 1; // 탭 변경 시 1페이지로
    
    // 버튼 스타일 변경
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active'); // event 객체 활용
    
    renderBoard();
}

function searchPosts() {
    currentPage = 1;
    renderBoard();
}

function openWriteModal() {
    alert("현재 읽기 전용 모드입니다. (글쓰기 기능 준비 중)");
}

function viewPost(id) {
    alert(`게시글 #${id} 상세 보기\n\n(상세 페이지 연결 준비 중입니다)`);
}

// 유틸리티
function getCatName(cat) {
    if (cat === 'free') return '자유';
    if (cat === 'info') return '정보';
    if (cat === 'qna') return '질문';
    return '기타';
}

function formatViews(num) {
    return num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num;
}

// 더미 데이터 생성기
function generateDummyPosts() {
    const data = [];
    
    // 1. 공지사항 (고정)
    data.push({ id: 9999, isNotice: true, category: 'notice', title: '[중요] 시스템 정기 점검 안내 (2026.02.05)', author: '관리자', date: '2026.02.01', views: 1200, comments: 0 });
    data.push({ id: 9998, isNotice: true, category: 'notice', title: '이등우 선생님 신규 입성 기념 이벤트', author: '관리자', date: '2026.01.28', views: 980, comments: 0 });

    // 2. 일반 게시글 (랜덤)
    const authors = ['김수현', '박지성', '최유리', 'Medical_K', 'SkyWannabe', '재수성공'];
    const titles = [
        { t: '2027학년도 프리미엄 데이터 관련 질문있습니다.', c: 'qna' },
        { t: '수능 국어 공부법 공유합니다 (장문주의)', c: 'info' },
        { t: 'BLACK 멤버십 혜택 문의드려요.', c: 'qna' },
        { t: '오늘 공부 인증합니다. (순공 12시간)', c: 'free' },
        { t: '대치동 현강 자료 구합니다.', c: 'free' },
        { t: '의대 면접 후기 (MMI)', c: 'info' },
        { t: '3월 모의고사 대비 수학 전략', c: 'info' },
        { t: '재수생 멘탈 관리 어떻게 하시나요?', c: 'free' }
    ];

    for (let i = 115; i >= 1; i--) {
        const tObj = titles[Math.floor(Math.random() * titles.length)];
        data.push({
            id: i,
            isNotice: false,
            category: tObj.c,
            title: tObj.t,
            author: authors[Math.floor(Math.random() * authors.length)],
            date: `2026.01.${String(Math.floor(Math.random() * 30) + 1).padStart(2, '0')}`,
            views: Math.floor(Math.random() * 500) + 10,
            comments: Math.floor(Math.random() * 15),
            isNew: i > 110 // 최근 5개는 NEW 표시
        });
    }

    return data;
}
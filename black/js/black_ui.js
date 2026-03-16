// js/black_ui.js

//const API_URL = CONFIG.api.base;
let allColumns = [];
let userPickedConsultants = [];

// [보안] XSS 방지 함수
function escapeHtml(text) {
    if (!text) return text;
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', () => {
    loadBlackData();
});

// [1] 데이터 로드
// js/black_ui.js 수정

async function loadBlackData() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');

    // [진단 1] 데이터가 진짜 있는지 눈으로 확인
    console.log("=== [Debug] 데이터 확인 ===");
    console.log("UserID:", userId); 
    console.log("Token:", token ? token.substring(0, 10) + "..." : "없음");

    if (!token) {
        alert("로그인이 필요합니다. (토큰 없음)");
        location.href = '/login';
        return;
    }

    // [진단 2] UserID가 없으면 멈춤 (401 원인 차단)
    if (!userId) {
        console.error("치명적 오류: UserID가 없습니다. 재로그인 필요.");
        alert("회원 정보가 만료되었습니다. 다시 로그인해주세요.");
        localStorage.clear(); // 꼬인 데이터 초기화
        location.href = '/login';
        return;
    }

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_black_columns', userId: userId })
        });

        if (!res.ok) {
            // [진단 3] 서버가 뭐라면서 거절했는지 확인
            const errText = await res.text();
            console.error(`서버 응답 에러 (${res.status}):`, errText);
            throw new Error("데이터 로드 실패");
        }
        
        const data = await res.json();
        allColumns = data.columns || [];
        userPickedConsultants = data.pickedConsultants || [];

        renderColumns();

    } catch (e) {
        console.error(e);
        // 401이면 백엔드 배포 문제일 가능성이 높음
        if (e.message.includes('401')) {
            alert("서버 연결 오류: 잠시 후 다시 시도하거나, 관리자에게 문의하세요. (Backend Deploy 확인 필요)");
        }
    }
}

function renderColumns() {
    // 1. 데이터 분류 (히어로 vs 일반)
    const heroCols = allColumns.filter(c => c.isHero).slice(0, 2); // 상단 2개
    let listCols = allColumns.filter(c => !c.isHero);
    
    // 2. 히어로 섹션 렌더링 (★ 추가된 부분)
    const heroGrid = document.getElementById('heroGrid');
    if (heroGrid && heroCols.length > 0) {
        heroGrid.innerHTML = ''; // 로딩 스켈레톤 삭제
        
        heroCols.forEach(col => {
            const safeTitle = escapeHtml(col.title);
            const safeAuthor = escapeHtml(col.author);
            const safeDate = escapeHtml(col.date);
            const safeId = escapeHtml(col.id); // 진짜 ID 사용
            
            const card = document.createElement('div');
            card.className = 'hero-col-card';
            // ★ 진짜 ID를 넘겨줌
            card.onclick = () => openColumnPage(safeId); 
            
            card.innerHTML = `
                <div class="badge-overlay">FOR BLACK ONLY</div>
                <div class="col-content">
                    <h4>${safeTitle}</h4>
                    <div class="col-meta">
                        <span class="author">${safeAuthor}</span>
                        <span class="date">${safeDate}</span>
                    </div>
                </div>
            `;
            heroGrid.appendChild(card);
        });
    }

    // 3. 리스트 섹션 렌더링 (기존 로직 보강)
    listCols.sort((a, b) => b.likes - a.likes); // 좋아요 순 정렬
    listCols = listCols.slice(0, 6); // 최대 6개 노출

    const grid = document.getElementById('columnGrid');
    if (!grid) return;
    grid.innerHTML = '';

    listCols.forEach((col, index) => {
        const rankClass = index < 2 ? 'top-rank' : '';
        const likeClass = col.isLiked ? 'liked' : '';
        const saveClass = col.isSaved ? 'fas' : 'far';
        const badgeImg = col.badge === 'master' ? '🏅' : (col.badge === 'platinum' ? '💠' : '🎖️');

        const safeAuthor = escapeHtml(col.author);
        const safeTitle = escapeHtml(col.title);
        const safeId = escapeHtml(col.id);

        const card = document.createElement('div');
        card.className = `col-card ${rankClass}`;
        
        card.innerHTML = `
            <div class="col-img-area" onclick="openColumnPage('${safeId}')">
                <img src="https://placehold.co/300x200/1a1a1a/FFF?text=${encodeURIComponent(col.author)}" alt="썸네일">
                <div class="consultant-badge">${badgeImg} ${safeAuthor}</div>
                <div class="save-btn-overlay" onclick="toggleSave(event, '${safeId}')">
                    <i class="${saveClass} fa-bookmark"></i>
                </div>
            </div>
            <div class="col-text-area">
                <h4 class="col-title" onclick="openColumnPage('${safeId}')">${safeTitle}</h4>
                <div class="col-info">
                    <span class="c-name" onclick="togglePickConsultant(event, '${safeAuthor}')">
                        ${safeAuthor} 
                        ${userPickedConsultants.includes(col.author) ? '<i class="fas fa-check-circle" style="color:#d4af37"></i>' : '<i class="far fa-plus-square"></i>'}
                    </span>
                    <span class="like-btn ${likeClass}" onclick="toggleLike(event, '${safeId}')">
                        <i class="${col.isLiked ? 'fas' : 'far'} fa-heart"></i> <span>${col.likes}</span>
                    </span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// [3] 좋아요 토글
async function toggleLike(e, colId) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const icon = btn.querySelector('i');
    const countSpan = btn.querySelector('span');
    let count = parseInt(countSpan.innerText);

    if (btn.classList.contains('liked')) {
        btn.classList.remove('liked');
        icon.classList.replace('fas', 'far');
        count--;
    } else {
        btn.classList.add('liked');
        icon.classList.replace('far', 'fas');
        count++;
    }
    countSpan.innerText = count;

    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'toggle_column_like', userId, data: { columnId: colId } })
        });
    } catch(err) { console.error(err); }
}

// [4] 저장 토글
async function toggleSave(e, colId) {
    e.stopPropagation();
    const btn = e.currentTarget.querySelector('i');
    
    if (btn.classList.contains('fas')) {
        btn.classList.replace('fas', 'far');
        alert("보관함에서 삭제되었습니다.");
    } else {
        btn.classList.replace('far', 'fas');
        alert("칼럼 아카이브에 저장되었습니다.");
    }

    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'toggle_column_save', userId, data: { columnId: colId } })
        });
    } catch(err) { console.error(err); }
}

// [5] 컨설턴트 선택
async function togglePickConsultant(e, name) {
    e.stopPropagation();
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'pick_consultant', userId, data: { consultantName: name } })
        });
        
        if(!res.ok) {
            const err = await res.json();
            if(err.error) alert("컨설턴트는 최대 3명까지만 선택 가능합니다.");
            return;
        }

        const data = await res.json();
        userPickedConsultants = data.currentPicked || [];
        renderColumns(); 
        
    } catch(err) { console.error(err); }
}

// [6] 모달 관련
function openColumnPage(id) {
    // id가 없으면 무시
    if (!id) return;
    
    // 상세 페이지로 이동 (ID를 쿼리 파라미터로 전달)
    window.location.href = `/black/column?id=${id}`;
}

window.onclick = function(event) {
    const modal = document.getElementById('column-modal');
    if (event.target == modal) closeColumnModal();
}
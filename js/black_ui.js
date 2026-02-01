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
async function loadBlackData() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');

    if (!token) {
        alert("로그인이 필요합니다.");
        location.href = 'login.html';
        return;
    }

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_black_columns', userId: userId })
        });

        if (!res.ok) throw new Error("데이터 로드 실패");
        
        const data = await res.json();
        allColumns = data.columns || [];
        userPickedConsultants = data.pickedConsultants || [];

        renderColumns();

    } catch (e) {
        console.error(e);
    }
}

// [2] 렌더링
function renderColumns() {
    const heroCols = allColumns.filter(c => c.isHero).slice(0, 2);
    let listCols = allColumns.filter(c => !c.isHero);
    listCols.sort((a, b) => b.likes - a.likes); 
    listCols = listCols.slice(0, 6); 

    const grid = document.getElementById('columnGrid');
    if (!grid) return;
    grid.innerHTML = '';

    listCols.forEach((col, index) => {
        const rankClass = index < 2 ? 'top-rank' : '';
        const likeClass = col.isLiked ? 'liked' : '';
        const saveClass = col.isSaved ? 'fas' : 'far';
        
        const badgeImg = col.badge === 'master' ? '🏅' : (col.badge === 'platinum' ? '💠' : '🎖️');

        const card = document.createElement('div');
        card.className = `col-card ${rankClass}`;
        
        // [보안] 데이터 출력 시 escapeHtml 사용
        // author, title 등 사용자 입력 가능성이 있는 모든 데이터 처리
        const safeAuthor = escapeHtml(col.author);
        const safeTitle = escapeHtml(col.title);
        const safeId = escapeHtml(col.id);

        card.innerHTML = `
            <div class="col-img-area" onclick="openColumnModal('${safeId}')">
                <img src="https://placehold.co/300x200/1a1a1a/FFF?text=${encodeURIComponent(col.author)}" alt="썸네일">
                <div class="consultant-badge">${badgeImg} ${safeAuthor}</div>
                <div class="save-btn-overlay" onclick="toggleSave(event, '${safeId}')">
                    <i class="${saveClass} fa-bookmark"></i>
                </div>
            </div>
            <div class="col-text-area">
                <h4 class="col-title" onclick="openColumnModal('${safeId}')">${safeTitle}</h4>
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
function openColumnModal(id) {
    const col = allColumns.find(c => c.id === id);
    if (!col) return;

    const modal = document.getElementById('column-modal');
    const content = document.getElementById('modal-body-content');
    
    // [보안] 상세 내용도 escapeHtml 적용 (단, content가 HTML 태그를 포함해야 한다면 별도의 Sanitizer 필요)
    // 여기서는 텍스트 기반이라 가정하고 escapeHtml 적용. 
    // 줄바꿈 처리를 위해 replace(/\n/g, '<br>') 정도만 허용
    const safeContent = escapeHtml(col.content).replace(/\n/g, '<br>');

    content.innerHTML = `
        <div style="margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:15px;">
            <span style="color:#d4af37; font-size:0.9rem; font-weight:bold;">
                ${col.badge === 'master' ? '🏅 MASTER CLASS' : '🎓 COLUMN'}
            </span>
            <h2 style="color:#fff; margin:10px 0;">${escapeHtml(col.title)}</h2>
            <div style="display:flex; justify-content:space-between; color:#666; font-size:0.9rem;">
                <span>Written by ${escapeHtml(col.author)}</span>
                <span>${escapeHtml(col.date)}</span>
            </div>
        </div>
        <div style="line-height:1.8; color:#ccc; font-size:1.05rem;">
            ${safeContent}
        </div>
    `;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeColumnModal() {
    document.getElementById('column-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.onclick = function(event) {
    const modal = document.getElementById('column-modal');
    if (event.target == modal) closeColumnModal();
}
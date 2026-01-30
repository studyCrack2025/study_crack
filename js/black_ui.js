// js/black_ui.js

const API_URL = CONFIG.api.base;
let allColumns = [];
let userPickedConsultants = [];

document.addEventListener('DOMContentLoaded', () => {
    loadBlackData();
});

// [1] 데이터 로드 (칼럼 + 내 정보)
async function loadBlackData() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken'); // BLACK은 idToken 권장

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
        // alert("데이터를 불러오지 못했습니다."); 
        // (에러 시 조용히 넘어가거나 더미를 보여주는 전략)
    }
}

// [2] 렌더링 (Hero 섹션 / List 섹션 분리)
function renderColumns() {
    // 1. Hero Columns (isHero: true 인 것 중 최신 2개 or 특정 ID)
    // 요청하신 대로 "2026 입결", "의치한약수" 등 제목 매칭 혹은 flag 사용
    const heroCols = allColumns.filter(c => c.isHero).slice(0, 2);
    
    // 2. List Columns (isHero: false, 좋아요 순 정렬, 상위 6개)
    let listCols = allColumns.filter(c => !c.isHero);
    listCols.sort((a, b) => b.likes - a.likes); // 좋아요 내림차순
    listCols = listCols.slice(0, 6); // 6개만

    // HTML 주입 - Hero (이미 하드코딩된 HTML이 있지만, 데이터를 입히려면 아래처럼)
    // 현재는 index.html에 하드코딩 되어 있으므로, List 부분만 동적으로 채우겠습니다.
    // 만약 Hero도 동적으로 하고 싶다면 id="heroGrid"를 만들어서 innerHTML 해야 함.
    
    // List 렌더링
    const grid = document.getElementById('columnGrid');
    if (!grid) return;
    grid.innerHTML = '';

    listCols.forEach((col, index) => {
        // Top 2 강조 클래스
        const rankClass = index < 2 ? 'top-rank' : '';
        const likeClass = col.isLiked ? 'liked' : '';
        const saveClass = col.isSaved ? 'fas' : 'far'; // 북마크 아이콘
        
        // 뱃지 이미지 매핑 (임시)
        const badgeImg = col.badge === 'master' ? '🏅' : (col.badge === 'platinum' ? '💠' : '🎖️');

        const card = document.createElement('div');
        card.className = `col-card ${rankClass}`;
        card.innerHTML = `
            <div class="col-img-area" onclick="openColumnModal('${col.id}')">
                <img src="https://placehold.co/300x200/1a1a1a/FFF?text=${encodeURIComponent(col.author)}" alt="썸네일">
                <div class="consultant-badge">${badgeImg} ${col.author}</div>
                <div class="save-btn-overlay" onclick="toggleSave(event, '${col.id}')">
                    <i class="${saveClass} fa-bookmark"></i>
                </div>
            </div>
            <div class="col-text-area">
                <h4 class="col-title" onclick="openColumnModal('${col.id}')">${col.title}</h4>
                <div class="col-info">
                    <span class="c-name" onclick="togglePickConsultant(event, '${col.author}')">
                        ${col.author} 
                        ${userPickedConsultants.includes(col.author) ? '<i class="fas fa-check-circle" style="color:#d4af37"></i>' : '<i class="far fa-plus-square"></i>'}
                    </span>
                    <span class="like-btn ${likeClass}" onclick="toggleLike(event, '${col.id}')">
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

    // 낙관적 UI 업데이트 (서버 응답 기다리지 않고 바로 변경)
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

    // API 호출
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

// [4] 저장(북마크) 토글
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

// [5] 컨설턴트 선택 (Pick)
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
        renderColumns(); // UI 갱신 (체크 표시 반영)
        
    } catch(err) { console.error(err); }
}

// [6] 모달 관련
function openColumnModal(id) {
    const col = allColumns.find(c => c.id === id);
    if (!col) return;

    const modal = document.getElementById('column-modal');
    const content = document.getElementById('modal-body-content');
    
    content.innerHTML = `
        <div style="margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:15px;">
            <span style="color:#d4af37; font-size:0.9rem; font-weight:bold;">${col.badge === 'master' ? '🏅 MASTER CLASS' : '🎓 COLUMN'}</span>
            <h2 style="color:#fff; margin:10px 0;">${col.title}</h2>
            <div style="display:flex; justify-content:space-between; color:#666; font-size:0.9rem;">
                <span>Written by ${col.author}</span>
                <span>${col.date}</span>
            </div>
        </div>
        <div style="line-height:1.8; color:#ccc; font-size:1.05rem;">
            ${col.content}
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
// js/black_archive.js

const API_URL = CONFIG.api.base;

// [상태 변수]
let allColumnsData = []; 
let currentColumnPage = 1;
const COLUMN_PER_PAGE = 8;
let allNewsData = []; 

document.addEventListener('DOMContentLoaded', () => {
    loadArchiveData(); 
});

// [1] 통합 데이터 로드
async function loadArchiveData() {
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
            body: JSON.stringify({ type: 'get_black_archive', userId: userId })
        });

        if (!res.ok) throw new Error("데이터 로드 실패");
        
        const data = await res.json();
        
        renderMyConsultants(data.myConsultants || []);
        
        allColumnsData = data.columns || [];
        renderColumnArchive(); 
        
        allNewsData = data.news || [];
        if (allNewsData.length === 0) {
            allNewsData = getDummyNews(); 
        }
        loadUnivNews(); 

    } catch (e) {
        console.error(e);
        alert("데이터를 불러오는 중 오류가 발생했습니다.");
    }
}

// -------------------------------------------------------------
// 2. 나만의 컨설턴트 렌더링 (보안 적용)
// -------------------------------------------------------------
function renderMyConsultants(consultants) {
    const container = document.getElementById('myConsultantList');
    container.innerHTML = '';

    for (let i = 0; i < 3; i++) {
        if (i < consultants.length) {
            const data = consultants[i];
            const div = document.createElement('div');
            div.className = 'consultant-card';
            div.onclick = () => location.href = 'black_consult.html';
            
            // [보안] 데이터 출력 시 escapeHtml 적용
            div.innerHTML = `
                <button class="btn-remove-consultant" onclick="removeConsultant(event, '${escapeHtml(data.name)}')" title="설정 해제">
                    <i class="fas fa-times"></i>
                </button>
                <img src="${escapeHtml(data.img)}" class="c-profile-img" alt="${escapeHtml(data.name)}" onerror="this.src='https://placehold.co/100x100?text=User'">
                <div class="c-info">
                    <h4>${escapeHtml(data.name)}</h4>
                    <span>${escapeHtml(data.title || '전문 컨설턴트')}</span>
                </div>
                <div class="c-tags">
                    ${(data.tags || ['입시']).map(t => `<span class="c-tag">${escapeHtml(t)}</span>`).join('')}
                </div>
            `;
            container.appendChild(div);
        } else {
            const div = document.createElement('div');
            div.className = 'empty-slot';
            div.onclick = () => alert("컨설턴트 목록 페이지(Community 등)에서 추가할 수 있습니다."); 
            div.innerHTML = `<i class="fas fa-plus plus-icon"></i>`;
            container.appendChild(div);
        }
    }
}

async function removeConsultant(e, name) {
    e.stopPropagation();
    if(!confirm(`'${name}' 컨설턴트를 해제하시겠습니까?`)) return;

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'pick_consultant', userId, data: { consultantName: name } })
        });
        alert("해제되었습니다.");
        loadArchiveData(); 
    } catch(err) { console.error(err); }
}

// -------------------------------------------------------------
// 3. 칼럼 아카이브 렌더링 (보안 적용)
// -------------------------------------------------------------
function renderColumnArchive() {
    const container = document.getElementById('columnArchiveGrid');
    if (currentColumnPage === 1) container.innerHTML = '';

    const start = (currentColumnPage - 1) * COLUMN_PER_PAGE;
    const end = start + COLUMN_PER_PAGE;
    const itemsToShow = allColumnsData.slice(start, end);

    itemsToShow.forEach(col => {
        const div = document.createElement('div');
        div.className = 'archive-col-card';
        div.onclick = () => alert(`[${col.title}] 상세 내용은 메인(Lounge)에서 확인 가능합니다.`);
        
        // 이미지 URL은 DB에 있는 것이므로 XSS 위험이 적지만, 그래도 안전하게 처리
        const imgUrl = col.img ? escapeHtml(col.img) : `https://placehold.co/300x150/222/FFF?text=Column`;

        // [보안] escapeHtml 적용
        div.innerHTML = `
            <div class="ac-img">
                <img src="${imgUrl}" alt="thumbnail">
            </div>
            <div class="ac-body">
                <h4 class="ac-title">${escapeHtml(col.title)}</h4>
                <div class="ac-meta">
                    <span>${escapeHtml(col.author)}</span>
                    <span>${escapeHtml(col.date || col.createdAt.substring(0,10))}</span>
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    const btn = document.getElementById('btnLoadMoreCol');
    if (end >= allColumnsData.length) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'inline-block';
    }
}

function loadMoreColumns() {
    currentColumnPage++;
    renderColumnArchive();
}

// [5] 보안 유틸리티 함수 (XSS 방지)
function escapeHtml(text) {
    if (!text) return text;
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
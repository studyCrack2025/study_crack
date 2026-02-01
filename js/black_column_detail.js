// js/black_column_detail.js

const urlParams = new URLSearchParams(window.location.search);
const colId = urlParams.get('id');
let currentData = null; 

document.addEventListener('DOMContentLoaded', async () => {
    // 1. ID 체크
    if(!colId) { 
        alert("잘못된 접근입니다."); 
        history.back(); 
        return; 
    }
    
    // 2. CONFIG 로드 체크
    if (typeof CONFIG === 'undefined' || !CONFIG.api) {
        alert("일시적인 시스템 오류입니다. 페이지를 새로고침 해주세요.");
        return;
    }

    await loadColumnDetail();
});

async function loadColumnDetail() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken') || localStorage.getItem('idToken');
    const API_URL = CONFIG.api.base;

    // 인증 체크
    if (!token || !userId) {
        alert("로그인이 필요한 콘텐츠입니다.");
        location.href = 'login.html';
        return;
    }

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
                type: 'get_column_detail', 
                userId: userId, 
                data: { columnId: colId } 
            })
        });
        
        if(!res.ok) {
            throw new Error(`Server Error: ${res.status}`);
        }
        
        const data = await res.json();
        
        // 데이터 유효성 검사
        if (!data.column) {
            throw new Error("Column data is empty");
        }

        currentData = data;
        renderPage(data);

    } catch(e) {
        // [수정] 에러 발생 시 붉은색 글씨 대신 깔끔한 안내 UI 표시
        renderDetailErrorState();
    }
}

// [신규] 상세 페이지 에러 UI
function renderDetailErrorState() {
    const contentArea = document.getElementById('colContent');
    if (contentArea) {
        contentArea.innerHTML = `
            <div style="text-align:center; padding:80px 0; color: #888;">
                <i class="fas fa-exclamation-triangle" style="font-size: 40px; margin-bottom: 20px; color: #d4af37;"></i>
                <h3 style="color: #fff; margin-bottom: 10px;">내용을 불러올 수 없습니다.</h3>
                <p>삭제된 칼럼이거나 일시적인 네트워크 오류일 수 있습니다.</p>
                <button onclick="history.back()" style="margin-top: 20px; padding: 10px 25px; background: #333; color: #fff; border: 1px solid #555; cursor: pointer; border-radius: 4px;">
                    목록으로 돌아가기
                </button>
            </div>
        `;
    }
    // 제목 등 다른 요소도 비우거나 기본값 처리
    document.getElementById('colTitle').innerText = "로드 실패";
}

function renderPage(data) {
    const col = data.column;
    const con = data.consultant || {}; 

    // 헤더 정보
    const badgeElem = document.getElementById('colBadge');
    if(badgeElem) badgeElem.innerText = col.badge === 'master' ? '🏅 MASTER CLASS' : '🎓 PREMIUM COLUMN';
    
    document.getElementById('colTitle').innerText = col.title || "제목 없음";
    document.getElementById('colAuthor').innerText = col.author || "익명";
    document.getElementById('colDate').innerText = col.date || "-";
    document.getElementById('colViews').innerText = col.views || '0';
    document.getElementById('colContent').innerHTML = col.content || "";

    // 좋아요 버튼 상태
    const likeBtn = document.getElementById('btnLike');
    const likeCountElem = document.getElementById('likeCount');
    if(likeCountElem) likeCountElem.innerText = col.likes || 0;
    
    if(col.isLiked && likeBtn) {
        likeBtn.classList.add('active');
        likeBtn.querySelector('i').className = 'fas fa-heart';
    }

    // 저장 버튼 상태
    const saveBtn = document.getElementById('btnSave');
    if(col.isSaved && saveBtn) {
        saveBtn.classList.add('active');
        saveBtn.querySelector('i').className = 'fas fa-bookmark';
        saveBtn.innerHTML = `<i class="fas fa-bookmark"></i> 저장됨`;
    }

    // 컨설턴트 프로필
    if(document.getElementById('cpImg')) document.getElementById('cpImg').src = con.img || "https://placehold.co/100x100";
    if(document.getElementById('cpName')) document.getElementById('cpName').innerText = con.name || col.author;
    if(document.getElementById('cpBadge')) document.getElementById('cpBadge').innerText = (con.badge || "EXPERT").toUpperCase();
    if(document.getElementById('cpIntro')) document.getElementById('cpIntro').innerText = con.intro || "";
    
    if(con.history && con.history.length > 0 && document.getElementById('cpHistory')) {
        document.getElementById('cpHistory').innerHTML = con.history.map(h => `<li>${h}</li>`).join('');
    }
}

async function toggleLikeDetail() {
    await sendToggleRequest('toggle_column_like', 'btnLike', 'likeCount');
}

async function toggleSaveDetail() {
    await sendToggleRequest('toggle_column_save', 'btnSave');
}

// 중복 로직 통합 함수
async function sendToggleRequest(type, btnId, countId = null) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    const icon = btn.querySelector('i');
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken') || localStorage.getItem('idToken');
    const API_URL = CONFIG.api.base;

    // UI 낙관적 업데이트 (Optimistic UI)
    const isActive = btn.classList.contains('active');
    
    if (isActive) {
        btn.classList.remove('active');
        if(type.includes('like')) icon.className = 'far fa-heart';
        else {
            icon.className = 'far fa-bookmark';
            btn.innerHTML = `<i class="far fa-bookmark"></i> 저장하기`;
        }
        
        if (countId) {
            const span = document.getElementById(countId);
            span.innerText = Math.max(0, parseInt(span.innerText) - 1);
        }
    } else {
        btn.classList.add('active');
        if(type.includes('like')) icon.className = 'fas fa-heart';
        else {
            icon.className = 'fas fa-bookmark';
            btn.innerHTML = `<i class="fas fa-bookmark"></i> 저장됨`;
        }

        if (countId) {
            const span = document.getElementById(countId);
            span.innerText = parseInt(span.innerText) + 1;
        }
    }

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type, userId, data: { columnId: colId } })
        });
    } catch(e) {
        // 기능 실패 시 조용히 처리 (사용자 경험 유지)
        // 필요하다면 UI를 롤백하는 로직을 추가할 수 있음
    }
}

function goToConsultantPage() {
    alert("준비 중인 기능입니다.");
}
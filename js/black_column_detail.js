// js/black_column_detail.js

const urlParams = new URLSearchParams(window.location.search);
const colId = urlParams.get('id');
let currentData = null; 

document.addEventListener('DOMContentLoaded', async () => {
    // 1. ID 체크
    if(!colId) { 
        alert("잘못된 접근입니다. (ID 누락)"); 
        history.back(); 
        return; 
    }
    
    // 2. CONFIG 로드 체크
    if (typeof CONFIG === 'undefined' || !CONFIG.api) {
        console.error("Critical: config.js not loaded.");
        alert("시스템 설정 로드 실패. 관리자에게 문의하세요.");
        return;
    }

    await loadColumnDetail();
});

async function loadColumnDetail() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken') || localStorage.getItem('idToken');
    const API_URL = CONFIG.api.base;

    try {
        console.log(`[Debug] Requesting Column ID: ${colId}`);

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
        
        // 에러 처리 강화
        if(!res.ok) {
            let errorMsg = "데이터 로드 실패";
            try {
                const errJson = await res.json();
                errorMsg = errJson.error || errJson.message || errorMsg;
            } catch (jsonErr) {
                errorMsg = await res.text(); // JSON이 아닐 경우 텍스트로 읽음
            }
            throw new Error(`${res.status} Error: ${errorMsg}`);
        }
        
        const data = await res.json();
        currentData = data;
        renderPage(data);

    } catch(e) {
        console.error("Load Error:", e);
        // 화면에 에러 내용을 표시해서 원인을 바로 알 수 있게 함
        document.getElementById('colContent').innerHTML = 
            `<div style="text-align:center; padding:50px; color: #ff6b6b;">
                <h3>데이터를 불러올 수 없습니다.</h3>
                <p>${e.message}</p>
            </div>`;
    }
}

function renderPage(data) {
    if (!data.column) {
        alert("칼럼 데이터가 비어있습니다.");
        return;
    }

    const col = data.column;
    const con = data.consultant || {}; // 컨설턴트 정보가 없어도 깨지지 않게 빈 객체 처리

    // 헤더
    const badgeElem = document.getElementById('colBadge');
    if(badgeElem) badgeElem.innerText = col.badge === 'master' ? '🏅 MASTER CLASS' : '🎓 PREMIUM COLUMN';
    
    document.getElementById('colTitle').innerText = col.title || "제목 없음";
    document.getElementById('colAuthor').innerText = col.author || "익명";
    document.getElementById('colDate').innerText = col.date || "-";
    document.getElementById('colViews').innerText = col.views || '0';
    document.getElementById('colContent').innerHTML = col.content || "";

    // 좋아요 버튼
    const likeBtn = document.getElementById('btnLike');
    const likeCountElem = document.getElementById('likeCount');
    if(likeCountElem) likeCountElem.innerText = col.likes || 0;
    
    if(col.isLiked && likeBtn) {
        likeBtn.classList.add('active');
        likeBtn.querySelector('i').className = 'fas fa-heart';
    }

    // 저장 버튼
    const saveBtn = document.getElementById('btnSave');
    if(col.isSaved && saveBtn) {
        saveBtn.classList.add('active');
        saveBtn.querySelector('i').className = 'fas fa-bookmark';
        saveBtn.innerHTML = `<i class="fas fa-bookmark"></i> 저장됨`;
    }

    // 컨설턴트 프로필 (DOM 요소가 있는지 확인 후 넣기)
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
    const icon = btn.querySelector('i');
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken') || localStorage.getItem('idToken');
    const API_URL = CONFIG.api.base;

    // UI 낙관적 업데이트
    const isActive = btn.classList.contains('active');
    
    if (isActive) {
        btn.classList.remove('active');
        // 아이콘 클래스 교체 (fa-heart/bookmark 등 상황에 맞게)
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
        console.error("Toggle Error:", e);
    }
}

function goToConsultantPage() {
    alert("준비 중입니다.");
}
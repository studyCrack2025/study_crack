// js/black_column_detail.js

const urlParams = new URLSearchParams(window.location.search);
const colId = urlParams.get('id');
let currentData = null; // 현재 데이터 보관용

document.addEventListener('DOMContentLoaded', async () => {
    if(!colId) { 
        alert("잘못된 접근입니다."); 
        history.back(); 
        return; 
    }
    await loadColumnDetail();
});

// [1] 상세 정보 로드
async function loadColumnDetail() {
    const userId = localStorage.getItem('userId');
    // 토큰이 없으면 idToken이라도 쓰도록 처리 (Access Token 우선)
    const token = localStorage.getItem('accessToken') || localStorage.getItem('idToken');
    
    const API_URL = CONFIG.api.base;

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'get_column_detail', 
                userId: userId, 
                data: { columnId: colId } 
            })
        });
        
        if(!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "데이터 로드 실패");
        }
        
        const data = await res.json();
        currentData = data;
        
        renderPage(data);

    } catch(e) {
        console.error(e);
        document.getElementById('colContent').innerHTML = 
            '<div style="text-align:center; padding:50px;">칼럼을 불러올 수 없습니다.<br>잠시 후 다시 시도해주세요.</div>';
    }
}

// [2] 화면 렌더링
function renderPage(data) {
    const col = data.column;
    const con = data.consultant;

    // 헤더 정보
    document.getElementById('colBadge').innerText = 
        col.badge === 'master' ? '🏅 MASTER CLASS' : '🎓 PREMIUM COLUMN';
    document.getElementById('colTitle').innerText = col.title;
    document.getElementById('colAuthor').innerText = col.author;
    document.getElementById('colDate').innerText = col.date;
    document.getElementById('colViews').innerText = col.views || '0';
    
    // 본문 (HTML)
    document.getElementById('colContent').innerHTML = col.content;

    // 좋아요 버튼 초기 상태
    const likeBtn = document.getElementById('btnLike');
    document.getElementById('likeCount').innerText = col.likes;
    if(col.isLiked) {
        likeBtn.classList.add('active');
        likeBtn.querySelector('i').classList.replace('far', 'fas');
    }

    // 저장 버튼 초기 상태
    const saveBtn = document.getElementById('btnSave');
    if(col.isSaved) {
        saveBtn.classList.add('active');
        saveBtn.querySelector('i').classList.replace('far', 'fas');
        saveBtn.innerHTML = `<i class="fas fa-bookmark"></i> 저장됨`;
    }

    // 컨설턴트 프로필
    document.getElementById('cpImg').src = con.img;
    document.getElementById('cpName').innerText = con.name;
    document.getElementById('cpBadge').innerText = con.badge.toUpperCase();
    document.getElementById('cpIntro').innerText = con.intro;
    
    if(con.history && con.history.length > 0) {
        const historyHtml = con.history.map(h => `<li>${h}</li>`).join('');
        document.getElementById('cpHistory').innerHTML = historyHtml;
    }
}

// [3] 좋아요 토글 (API 연동 포함)
async function toggleLikeDetail() {
    const btn = document.getElementById('btnLike');
    const icon = btn.querySelector('i');
    const countSpan = document.getElementById('likeCount');
    let count = parseInt(countSpan.innerText);
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken') || localStorage.getItem('idToken');

    // 낙관적 UI 업데이트 (먼저 화면부터 바꿈)
    let isLikedNow = false;
    if(btn.classList.contains('active')) {
        btn.classList.remove('active');
        icon.classList.replace('fas', 'far');
        count--;
    } else {
        btn.classList.add('active');
        icon.classList.replace('far', 'fas');
        count++;
        isLikedNow = true;
    }
    countSpan.innerText = count;

    // 서버 요청
    try {
        await fetch(CONFIG.api.base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'toggle_column_like', 
                userId: userId, 
                data: { columnId: colId } 
            })
        });
    } catch(e) {
        console.error("좋아요 실패:", e);
        // 실패 시 롤백 로직이 필요하지만 여기선 생략
    }
}

// [4] 저장 토글 (API 연동 포함)
async function toggleSaveDetail() {
    const btn = document.getElementById('btnSave');
    const icon = btn.querySelector('i');
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken') || localStorage.getItem('idToken');
    
    // 낙관적 UI 업데이트
    if(btn.classList.contains('active')) {
        btn.classList.remove('active');
        icon.classList.replace('fas', 'far');
        btn.innerHTML = `<i class="far fa-bookmark"></i> 저장하기`;
        alert("보관함에서 삭제되었습니다.");
    } else {
        btn.classList.add('active');
        icon.classList.replace('far', 'fas');
        btn.innerHTML = `<i class="fas fa-bookmark"></i> 저장됨`;
        alert("보관함에 저장되었습니다.");
    }

    // 서버 요청
    try {
        await fetch(CONFIG.api.base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'toggle_column_save', 
                userId: userId, 
                data: { columnId: colId } 
            })
        });
    } catch(e) {
        console.error("저장 실패:", e);
    }
}

// [5] 컨설턴트 페이지 이동
function goToConsultantPage() {
    if(!currentData || !currentData.consultant) return;
    alert(`${currentData.consultant.name} 컨설턴트의 상세 페이지는 준비 중입니다.`);
}
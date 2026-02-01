// js/black_column_detail.js

const urlParams = new URLSearchParams(window.location.search);
const colId = urlParams.get('id');
let currentData = null; // 현재 칼럼 및 컨설턴트 데이터

document.addEventListener('DOMContentLoaded', async () => {
    // ID가 없으면 뒤로가기
    if(!colId) { 
        alert("잘못된 접근입니다."); 
        history.back(); 
        return; 
    }
    
    await loadColumnDetail();
});

async function loadColumnDetail() {
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    
    // API_URL은 config.js에서 가져옴
    const API_URL = CONFIG.api.base;

    try {
        // 백엔드에 'get_column_detail' 요청 (구현된 람다)
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'get_column_detail', 
                userId: userId, 
                data: { columnId: colId } 
            })
        });
        
        if(!res.ok) throw new Error("데이터 로드 실패");
        
        const data = await res.json();
        currentData = data;
        
        renderPage(data);

    } catch(e) {
        console.error(e);
        document.getElementById('colContent').innerHTML = 
            '<div style="text-align:center; padding:50px;">칼럼을 불러올 수 없습니다.<br>잠시 후 다시 시도해주세요.</div>';
    }
}

function renderPage(data) {
    const col = data.column;
    const con = data.consultant;

    // 1. 헤더 렌더링
    document.getElementById('colBadge').innerText = 
        col.badge === 'master' ? '🏅 MASTER CLASS' : '🎓 PREMIUM COLUMN';
    
    document.getElementById('colTitle').innerText = col.title;
    document.getElementById('colAuthor').innerText = col.author;
    document.getElementById('colDate').innerText = col.date;
    document.getElementById('colViews').innerText = col.views || '0';
    
    // 2. 본문 렌더링 (HTML 허용)
    document.getElementById('colContent').innerHTML = col.content;

    // 3. 좋아요 버튼 상태
    const likeBtn = document.getElementById('btnLike');
    document.getElementById('likeCount').innerText = col.likes;
    if(col.isLiked) {
        likeBtn.classList.add('active');
        likeBtn.querySelector('i').classList.replace('far', 'fas');
    }

    // 4. 컨설턴트 프로필 렌더링
    document.getElementById('cpImg').src = con.img;
    document.getElementById('cpName').innerText = con.name;
    document.getElementById('cpBadge').innerText = con.badge.toUpperCase();
    document.getElementById('cpIntro').innerText = con.intro;
    
    if(con.history && con.history.length > 0) {
        const historyHtml = con.history.map(h => `<li>${h}</li>`).join('');
        document.getElementById('cpHistory').innerHTML = historyHtml;
    }
}

// 좋아요 토글 (UI만 반영, 실제 API 호출은 추후 연결)
function toggleLikeDetail() {
    const btn = document.getElementById('btnLike');
    const icon = btn.querySelector('i');
    const countSpan = document.getElementById('likeCount');
    let count = parseInt(countSpan.innerText);

    if(btn.classList.contains('active')) {
        btn.classList.remove('active');
        icon.classList.replace('fas', 'far');
        count--;
    } else {
        btn.classList.add('active');
        icon.classList.replace('far', 'fas');
        count++;
    }
    countSpan.innerText = count;
}

// 저장 토글
function toggleSaveDetail() {
    const btn = document.getElementById('btnSave');
    const icon = btn.querySelector('i');
    
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
}

// 컨설턴트 페이지 이동
function goToConsultantPage() {
    if(!currentData || !currentData.consultant) return;
    
    // 추후 컨설턴트 상세 페이지가 생기면 여기를 활성화
    alert(`${currentData.consultant.name} 컨설턴트의 상세 페이지는 준비 중입니다.`);
    
    // 예시: location.href = `black_consultant.html?name=${encodeURIComponent(currentData.consultant.name)}`;
}
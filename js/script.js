/* =========================================
   1. 모달(Modal) 관련 로직 (기존 코드 유지)
   ========================================= */
function openModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'block';
        // 모달 열릴 때 스크롤 방지
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'none';
        // 모달 닫힐 때 스크롤 허용
        document.body.style.overflow = 'auto';
    }
}

// 모달 바깥 영역 클릭 시 닫기
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

/* =========================================
   2. 페이지 네비게이션 및 버튼 동작 연결
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    
    // (1) 로그인 상태 확인 (auth.js에 있는 함수 실행)
    // 페이지가 로드되자마자 로그인/로그아웃 버튼 상태를 결정합니다.
    if (typeof checkLoginStatus === 'function') {
        checkLoginStatus();
    }

    // (2) 마이페이지 버튼 클릭 이벤트
    const myPageBtn = document.getElementById('myPageBtn');
    if (myPageBtn) {
        myPageBtn.addEventListener('click', (e) => {
            e.preventDefault(); // #으로 이동하는 것 막기
            // 마이페이지로 실제 이동
            window.location.href = 'mypage.html';
        });
    }

    // (3) 로그아웃 버튼 클릭 이벤트
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault(); // #으로 이동하는 것 막기
            // auth.js에 정의된 로그아웃 함수 실행
            if (typeof handleSignOut === 'function') {
                handleSignOut();
            } else {
                alert("로그아웃 기능이 로드되지 않았습니다.");
            }
        });
    }

    // (4) 스무스 스크롤 (메뉴 클릭 시 부드럽게 이동)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            // 모달이나 특수 기능이 아닌 일반 섹션 링크인 경우에만 스크롤
            if (targetElement && !this.classList.contains('nav-btn')) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
/* =========================================
   1. 전역 함수 (HTML에서 직접 호출하는 함수들)
   ========================================= */

// 모달 열기
function openModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // 배경 스크롤 막기
    }
}

// 모달 닫기
function closeModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // 배경 스크롤 허용
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
   2. DOM 로드 후 실행되는 로직
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    
    // (1) 커리큘럼 아코디언 기능 (클릭 시 상세내용 펼치기/접기)
    const expandableItems = document.querySelectorAll('.course-item.expandable');
    
    expandableItems.forEach(item => {
        item.addEventListener('click', function() {
            // 클릭된 아이템 내부의 상세 내용 찾기
            const details = this.querySelector('.course-details');
            
            if (details) {
                // 이미 열려있는지 확인
                const isHidden = details.classList.contains('hidden-details');
                
                if (isHidden) {
                    // 열기
                    details.classList.remove('hidden-details');
                    this.classList.add('active'); // 화살표 회전을 위한 클래스 추가
                } else {
                    // 닫기
                    details.classList.add('hidden-details');
                    this.classList.remove('active');
                }
            }
        });
    });

    // (2) 로그인 상태 확인 (auth.js의 함수가 존재할 경우 실행)
    if (typeof checkLoginStatus === 'function') {
        checkLoginStatus();
    } else {
        console.warn('auth.js가 로드되지 않았거나 checkLoginStatus 함수가 없습니다.');
    }

    // (3) 마이페이지 버튼 클릭 이벤트
    const myPageBtn = document.getElementById('myPageBtn');
    if (myPageBtn) {
        myPageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'mypage.html';
        });
    }

    // (4) 로그아웃 버튼 클릭 이벤트
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof handleSignOut === 'function') {
                handleSignOut();
            } else {
                alert("로그아웃 기능을 불러올 수 없습니다.");
            }
        });
    }

    // (5) 스무스 스크롤 (네비게이션 메뉴 클릭 시 부드럽게 이동)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            // nav-btn 클래스(로그인 등)가 아닌 경우에만 스크롤 작동
            if (!this.classList.contains('nav-btn')) {
                const targetId = this.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
});
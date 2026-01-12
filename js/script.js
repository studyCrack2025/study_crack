// =========================================
//  1. 모달(Modal) 관련 로직
// =========================================
function openModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // 스크롤 방지
    }
}

function closeModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // 스크롤 허용
    }
}

// 모달 바깥 영역 클릭 시 닫기
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// =========================================
//  2. 페이지 로드 후 실행 로직
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // (1) 커리큘럼 클릭 시 상세내용 펼치기/접기 (추가된 기능)
    const expandableItems = document.querySelectorAll('.course-item.expandable');
    
    expandableItems.forEach(item => {
        item.addEventListener('click', function() {
            // 클릭된 아이템 내부의 상세 내용 찾기
            const details = this.querySelector('.course-details');
            
            if (details) {
                // hidden-details 클래스를 토글(있으면 제거, 없으면 추가)
                if (details.classList.contains('hidden-details')) {
                    details.classList.remove('hidden-details');
                } else {
                    details.classList.add('hidden-details');
                }
            }
        });
    });

    // (2) 로그인 상태 확인 (auth.js 필요)
    if (typeof checkLoginStatus === 'function') {
        checkLoginStatus();
    }

    // (3) 마이페이지 버튼 클릭
    const myPageBtn = document.getElementById('myPageBtn');
    if (myPageBtn) {
        myPageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'mypage.html';
        });
    }

    // (4) 로그아웃 버튼 클릭
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof handleSignOut === 'function') {
                handleSignOut();
            } else {
                alert("로그아웃 기능이 로드되지 않았습니다.");
            }
        });
    }

    // (5) 스무스 스크롤 (메뉴 이동)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            // 일반 네비게이션 링크인 경우에만 작동
            if (targetElement && !this.classList.contains('nav-btn')) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
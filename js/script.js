// js/script.js

/* =========================================
   1. 전역 함수 (HTML에서 직접 호출하는 함수들 - 모달)
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
                const isHidden = details.classList.contains('hidden-details');
                
                if (isHidden) {
                    // 열기
                    details.classList.remove('hidden-details');
                    this.classList.add('active'); // 화살표 회전 등 스타일용
                } else {
                    // 닫기
                    details.classList.add('hidden-details');
                    this.classList.remove('active');
                }
            }
        });
    });

    // (2) 로그인 상태 확인 및 초기화
    // auth.js가 먼저 로드되어 있어야 합니다.
    if (typeof checkLoginStatus === 'function') {
        checkLoginStatus();
    } else {
        // auth.js가 없을 경우를 대비한 로그 (개발용)
        // console.warn('auth.js가 로드되지 않았습니다.'); 
    }

    // (3) 마이페이지 버튼 클릭 이벤트
    const myPageBtn = document.getElementById('myPageBtn');
    if (myPageBtn) {
        myPageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const userId = localStorage.getItem('userId');
            // 로그인 안 된 상태면 로그인 페이지로 (이중 안전장치)
            if (!userId) {
                alert("로그인이 필요합니다.");
                window.location.href = 'login.html';
            } else {
                window.location.href = 'mypage.html';
            }
        });
    }

    // (4) 로그아웃 버튼 클릭 이벤트
    // 주의: HTML에서 onclick="handleSignOut()"을 쓰고 있다면 이 코드는 중복일 수 있으나,
    // JS에서 제어하는 것이 더 안전하므로 유지합니다.
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof handleSignOut === 'function') {
                handleSignOut();
            } else {
                // 비상시 수동 로그아웃 처리
                localStorage.clear();
                window.location.href = 'index.html';
            }
        });
    }

    // (5) 스무스 스크롤 (네비게이션 메뉴 클릭 시 부드럽게 이동)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            // nav-btn 클래스(로그인 버튼 등)가 아닌 경우에만 스크롤 작동
            if (!this.classList.contains('nav-btn')) {
                const href = this.getAttribute('href');
                if (href.length > 1) { // 단순 '#' 링크 제외
                    const targetId = href.substring(1);
                    const targetElement = document.getElementById(targetId);
                    
                    if (targetElement) {
                        e.preventDefault();
                        targetElement.scrollIntoView({
                            behavior: 'smooth'
                        });
                    }
                }
            }
        });
    });
});
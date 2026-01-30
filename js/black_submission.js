// js/black_submission.js

document.addEventListener('DOMContentLoaded', () => {
    // 텍스트 글자수 세기
    const textarea = document.getElementById('userNote');
    if (textarea) {
        textarea.addEventListener('input', function() {
            document.getElementById('currLen').innerText = this.value.length;
        });
    }

    // 폼 제출 핸들링
    const form = document.getElementById('blackForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // 1. 학년 선택 확인
            const grade = document.querySelector('input[name="grade"]:checked');
            if (!grade) {
                alert("현재 학년을 선택해주세요.");
                return;
            }

            // 2. 신청 사유 확인 (최소 1개)
            const reasons = document.querySelectorAll('input[name="reason"]:checked');
            if (reasons.length === 0) {
                alert("신청 사유를 최소 1개 이상 선택해주세요.");
                return;
            }

            // 3. (선택사항) 데이터를 서버에 저장하는 로직이 들어갈 자리
            // 지금은 바로 성공 페이지로 이동
            
            // [중요] 파라미터 tier=black 전달 -> success.html에서 블랙 테마 적용됨
            window.location.href = 'success.html?tier=black';
        });
    }
});
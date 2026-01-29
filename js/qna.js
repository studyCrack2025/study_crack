// js/qna.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. FAQ 아코디언 로직
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        item.addEventListener('click', () => {
            const answer = item.querySelector('.faq-answer');
            const isActive = item.classList.contains('active');
            
            // 기존 열린 것 닫기 (원하면 주석 해제)
            // faqItems.forEach(i => { i.classList.remove('active'); i.querySelector('.faq-answer').style.maxHeight = null; });

            if (!isActive) {
                item.classList.add('active');
                answer.style.maxHeight = answer.scrollHeight + "px";
            } else {
                item.classList.remove('active');
                answer.style.maxHeight = null;
            }
        });
    });

    // 2. 질문 내역 불러오기
    loadQnaHistory();

    // 3. 폼 제출 핸들링
    const form = document.getElementById('qnaForm');
    if (form) {
        form.addEventListener('submit', handleQnaSubmit);
    }
});

// 모달 제어 함수
function openQnaModal() {
    const modal = document.getElementById('qna-modal');
    if(modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeQnaModal() {
    const modal = document.getElementById('qna-modal');
    if(modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// 질문 목록 조회 (Lambda 연동)
async function loadQnaHistory() {
    const grid = document.getElementById('qna-grid');
    const idToken = localStorage.getItem('idToken');

    if (!idToken) {
        grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:40px;">로그인 후 질문 내역을 확인할 수 있습니다.</p>';
        return;
    }

    try {
        const response = await fetch(CONFIG.api.base, {
            method: 'POST', // Lambda가 type에 따라 분기하므로 POST 사용
            headers: {
                'Authorization': idToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: 'get_qna_list' })
        });

        const data = await response.json();
        const history = data.qnaHistory || [];

        grid.innerHTML = ''; // 스켈레톤 제거

        if (history.length === 0) {
            grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:40px;">등록된 질문이 없습니다.</p>';
            return;
        }

        // 최대 6개만 표시 (2x3)
        history.slice(0, 6).forEach(item => {
            const dateStr = new Date(item.createdAt).toLocaleDateString();
            const statusText = item.status === 'done' ? '답변완료' : '대기중';
            const statusClass = item.status === 'done' ? 'status-done' : 'status-waiting';
            const badgeClass = `badge-${item.category}`;
            const categoryName = getCategoryName(item.category);

            const card = document.createElement('div');
            card.className = 'qna-card';
            card.innerHTML = `
                <div>
                    <span class="qna-badge ${badgeClass}">${categoryName}</span>
                    <h3 class="qna-card-title">${item.title}</h3>
                </div>
                <div class="qna-meta">
                    <span>${dateStr}</span>
                    <span class="${statusClass}">${statusText}</span>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("QnA Load Error:", error);
        grid.innerHTML = '<p style="grid-column:1/-1; text-align:center;">데이터를 불러오는 중 오류가 발생했습니다.</p>';
    }
}

// 질문 제출 (Lambda 연동)
async function handleQnaSubmit(e) {
    e.preventDefault();
    const idToken = localStorage.getItem('idToken');
    if (!idToken) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    const title = document.getElementById('qTitle').value;
    const category = document.getElementById('qCategory').value;
    const content = document.getElementById('qContent').value;

    try {
        const response = await fetch(CONFIG.api.base, {
            method: 'POST',
            headers: {
                'Authorization': idToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'save_qna',
                data: {
                    title: title,
                    category: category,
                    content: content
                }
            })
        });

        if (response.ok) {
            alert("질문이 등록되었습니다.");
            closeQnaModal();
            document.getElementById('qnaForm').reset();
            loadQnaHistory(); // 목록 새로고침
        } else {
            alert("등록 실패. 다시 시도해주세요.");
        }
    } catch (error) {
        console.error("Submit Error:", error);
        alert("오류가 발생했습니다.");
    }
}

function getCategoryName(key) {
    const map = { 'consulting': '입시전략', 'payment': '결제/환불', 'system': '시스템', 'etc': '기타' };
    return map[key] || key;
}

// 모달 바깥 클릭 시 닫기
window.onclick = function(event) {
    const modal = document.getElementById('qna-modal');
    if (event.target === modal) {
        closeQnaModal();
    }
}
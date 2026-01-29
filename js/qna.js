// js/qna.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. FAQ 아코디언 로직
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        item.addEventListener('click', () => {
            const answer = item.querySelector('.faq-answer');
            const isActive = item.classList.contains('active');
            
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

// 질문하기 모달 열기
function openQnaModal() {
    openModal('qna'); // script.js의 공통 함수 활용
}

// 질문하기 모달 닫기
function closeQnaModal() {
    closeModal('qna');
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
            method: 'POST', 
            headers: {
                'Authorization': idToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                type: 'get_qna_list',
                userId: userId
            })
        });

        const data = await response.json();
        const history = data.qnaHistory || [];

        grid.innerHTML = ''; // 스켈레톤 제거

        if (history.length === 0) {
            grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:40px;">등록된 질문이 없습니다.</p>';
            return;
        }

        // 최신순 정렬
        history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // 카드 생성
        history.forEach(item => {
            const dateStr = new Date(item.createdAt).toLocaleDateString();
            const statusText = item.status === 'done' ? '답변완료' : '대기중';
            const statusClass = item.status === 'done' ? 'status-done' : 'status-waiting';
            const badgeClass = `badge-${item.category}`;
            const categoryName = getCategoryName(item.category);

            const card = document.createElement('div');
            card.className = 'qna-card';
            // 커서 포인터 추가하여 클릭 가능함을 표시
            card.style.cursor = 'pointer'; 
            
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
            
            // [NEW] 클릭 시 상세 모달 띄우기 (item 전체 데이터를 넘김)
            card.addEventListener('click', () => openDetailModal(item));
            
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("QnA Load Error:", error);
        grid.innerHTML = '<p style="grid-column:1/-1; text-align:center;">데이터를 불러오는 중 오류가 발생했습니다.</p>';
    }
}

// 상세 보기 모달 열기 및 데이터 바인딩
function openDetailModal(item) {
    const modal = document.getElementById('qna-detail-modal');
    if(!modal) return;

    // 1. 카테고리 & 날짜
    const catBadge = document.getElementById('detail-category');
    catBadge.className = `qna-badge badge-${item.category}`;
    catBadge.textContent = getCategoryName(item.category);
    
    document.getElementById('detail-date').textContent = new Date(item.createdAt).toLocaleString();

    // 2. 제목 & 질문 내용
    document.getElementById('detail-title').textContent = item.title;
    document.getElementById('detail-content').textContent = item.content;

    // 3. 답변 영역 처리
    const answerArea = document.getElementById('detail-answer-area');
    if (item.status === 'done' && item.answer) {
        // 답변이 있는 경우
        answerArea.innerHTML = `
            <div style="background:#eff6ff; padding:15px; border-radius:8px; border:1px solid #bfdbfe; color:#1e3a8a; white-space: pre-wrap;">
                ${item.answer}
                <div style="margin-top:10px; font-size:0.8rem; color:#60a5fa; text-align:right;">
                    답변일: ${item.answeredAt ? new Date(item.answeredAt).toLocaleDateString() : '-'}
                </div>
            </div>
        `;
    } else {
        // 답변이 없는 경우
        answerArea.innerHTML = `
            <div style="padding:20px; text-align:center; color:#94a3b8; background:#f1f5f9; border-radius:8px;">
                ⏳ 현재 담당 컨설턴트가 내용을 확인하고 있습니다.<br>빠른 시일 내에 답변 드리겠습니다.
            </div>
        `;
    }

    // 모달 띄우기 (script.js의 openModal 활용 가능하지만 ID가 다르므로 직접 제어 or 공통함수 사용)
    openModal('qna-detail');
}


// 질문 제출
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
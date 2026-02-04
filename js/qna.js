// js/qna.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. FAQ 아코디언
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        item.addEventListener('click', () => {
            item.classList.toggle('active');
        });
    });

    // 2. 질문 내역 불러오기
    loadQnaHistory();

    // 3. 질문 폼 제출
    const form = document.getElementById('qnaForm');
    if (form) form.addEventListener('submit', handleQnaSubmit);
    
    // 4. 모달 외부 클릭 시 닫기
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
            document.body.style.overflow = 'auto'; // 스크롤 복구
        }
    };
});

// [최적화] 모달 열기/닫기 (ID를 명확하게 받도록 수정)
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
    } else {
        console.error(`Modal not found: ${id}`);
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// 래퍼 함수 (HTML onclick과 연결)
function openQnaModal() { openModal('qna-modal'); } // ID 명시
function closeQnaModal() { closeModal('qna-modal'); }

// [최적화] 질문 목록 불러오기 (DocumentFragment 사용으로 렉 제거)
async function loadQnaHistory() {
    const grid = document.getElementById('qna-grid');
    const idToken = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');

    if (!idToken) {
        grid.innerHTML = '<div class="empty-state">로그인 후 이용해주세요.</div>';
        return;
    }

    try {
        const response = await fetch(CONFIG.api.base, {
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'get_qna_list', userId: userId })
        });

        if (!response.ok) throw new Error("Network response was not ok");

        const data = await response.json();
        const history = data.qnaHistory || [];

        grid.innerHTML = ''; // 초기화

        if (history.length === 0) {
            grid.innerHTML = '<div class="empty-state">등록된 질문이 없습니다.</div>';
            return;
        }

        // [성능 개선] 가상의 돔(Fragment)에 먼저 다 붙이고 한 번에 렌더링
        const fragment = document.createDocumentFragment();

        history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        history.forEach(item => {
            const card = document.createElement('div');
            card.className = 'qna-card';
            
            const statusClass = item.status === 'done' ? 'done' : 'waiting';
            const statusText = item.status === 'done' ? '답변완료' : '대기중';
            const dateStr = new Date(item.createdAt).toLocaleDateString();

            card.innerHTML = `
                <div class="card-header">
                    <span class="badge ${item.category}">${getCategoryName(item.category)}</span>
                    <span class="status ${statusClass}">${statusText}</span>
                </div>
                <h3 class="card-title">${escapeHtml(item.title)}</h3>
                <div class="card-date">${dateStr}</div>
            `;
            
            card.addEventListener('click', () => openDetailModal(item));
            fragment.appendChild(card);
        });

        grid.appendChild(fragment); // DOM 조작 1회로 단축

    } catch (error) {
        console.error("Load Error:", error);
        grid.innerHTML = '<div class="empty-state">불러오기 실패</div>';
    }
}

// 상세 모달 열기
function openDetailModal(item) {
    const titleEl = document.getElementById('detail-title');
    const contentEl = document.getElementById('detail-content');
    const catEl = document.getElementById('detail-category');
    const dateEl = document.getElementById('detail-date');
    const answerArea = document.getElementById('detail-answer-area');

    // 데이터 주입
    titleEl.textContent = item.title;
    contentEl.textContent = item.content; // escapeHtml 불필요 (textContent는 안전함)
    catEl.textContent = getCategoryName(item.category);
    catEl.className = `qna-badge badge-${item.category}`;
    dateEl.textContent = new Date(item.createdAt).toLocaleString();

    // 답변 영역 처리
    if (item.status === 'done' && item.answer) {
        answerArea.innerHTML = `
            <div class="answer-box">
                <p>${escapeHtml(item.answer)}</p>
                <span class="answer-date">답변일: ${new Date(item.answeredAt).toLocaleDateString()}</span>
            </div>
        `;
    } else {
        answerArea.innerHTML = `<div class="no-answer">⏳ 담당 컨설턴트가 확인 중입니다.</div>`;
    }

    openModal('qna-detail-modal'); // 명확한 ID 호출
}

// 질문 제출 처리
async function handleQnaSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; // [렉 방지] 중복 클릭 방지
    btn.textContent = "처리 중...";

    const idToken = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    const title = document.getElementById('qTitle').value;
    const category = document.getElementById('qCategory').value;
    const content = document.getElementById('qContent').value;

    try {
        const response = await fetch(CONFIG.api.base, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'save_qna',
                userId: userId, 
                data: { title, category, content }
            })
        });

        if (response.ok) {
            alert("등록되었습니다.");
            closeQnaModal();
            document.getElementById('qnaForm').reset();
            loadQnaHistory();
        } else {
            alert("등록 실패");
        }
    } catch (e) {
        console.error(e);
        alert("에러가 발생했습니다.");
    } finally {
        btn.disabled = false; // 버튼 복구
        btn.textContent = "문의 접수하기";
    }
}

function getCategoryName(key) {
    const map = { 'consulting': '입시', 'payment': '결제', 'system': '오류', 'etc': '기타' };
    return map[key] || key;
}

// [보안] XSS 방지 함수 추가
function escapeHtml(text) {
    if (!text) return text;
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 모달 바깥 클릭 시 닫기
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}
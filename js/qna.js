// js/qna.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. FAQ 아코디언 로직
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        item.addEventListener('click', () => {
            // 다른 열린 항목 닫기 (선택사항 - 하나만 열리게 하려면 주석 해제)
            // faqItems.forEach(i => { if(i !== item) i.classList.remove('active'); i.querySelector('.faq-answer').style.maxHeight = null; });
            
            item.classList.toggle('active');
            const answer = item.querySelector('.faq-answer');
            if (item.classList.contains('active')) {
                answer.style.maxHeight = answer.scrollHeight + "px";
            } else {
                answer.style.maxHeight = null;
            }
        });
    });

    // 2. 질문 내역 불러오기
    loadQnaHistory();

    // 3. 질문 폼 제출 핸들러
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

/* =========================================
   [모달 제어 함수]
   CSS에서 .modal이 display: none 상태이므로,
   JS에서 display: flex로 변경하여 중앙 정렬 활성화
   ========================================= */
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex'; // flex로 켜야 중앙 정렬됨
        document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
    } else {
        console.error(`Modal ID '${id}' not found.`);
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// 편의용 래퍼 함수
function openQnaModal() { openModal('qna-modal'); }
function closeQnaModal() { closeModal('qna-modal'); }
function closeDetailModal() { closeModal('qna-detail-modal'); }


/* =========================================
   [API] 질문 목록 불러오기
   DocumentFragment 사용하여 렌더링 성능 최적화
   ========================================= */
async function loadQnaHistory() {
    const grid = document.getElementById('qna-grid');
    const idToken = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');

    if (!idToken) {
        grid.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;">로그인 후 이용 가능한 서비스입니다.</div>';
        return;
    }

    try {
        const response = await fetch(CONFIG.api.base, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'get_qna_list', userId: userId })
        });

        if (!response.ok) throw new Error("API Response Error");

        const data = await response.json();
        const history = data.qnaHistory || [];

        grid.innerHTML = ''; // 초기화

        if (history.length === 0) {
            grid.innerHTML = `
                <div style="text-align:center; padding:40px; color:#64748b; grid-column:1/-1;">
                    <i class="far fa-folder-open" style="font-size:2rem; margin-bottom:10px;"></i><br>
                    등록된 질문이 없습니다.
                </div>`;
            return;
        }

        // [최적화] 가상 DOM(Fragment)에 먼저 담기
        const fragment = document.createDocumentFragment();

        // 최신순 정렬
        history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        history.forEach(item => {
            const card = document.createElement('div');
            card.className = 'qna-card';
            
            const isDone = item.status === 'done';
            const statusHtml = isDone 
                ? `<span class="status-done"><i class="fas fa-check-circle"></i> 답변완료</span>`
                : `<span class="status-waiting"><i class="fas fa-clock"></i> 대기중</span>`;
            
            const dateStr = new Date(item.createdAt).toLocaleDateString();
            const badgeClass = `badge-${item.category || 'etc'}`;
            const catName = getCategoryName(item.category);

            card.innerHTML = `
                <div class="card-top">
                    <span class="badge ${badgeClass}">${catName}</span>
                    ${statusHtml}
                </div>
                <h3 class="qna-title">${escapeHtml(item.title)}</h3>
                <div class="qna-date">${dateStr}</div>
            `;
            
            card.addEventListener('click', () => openDetailModal(item));
            fragment.appendChild(card);
        });

        grid.appendChild(fragment); // 한 번에 DOM에 그리기 (렉 방지)

    } catch (error) {
        console.error("Load Error:", error);
        grid.innerHTML = '<div style="text-align:center; padding:20px;">불러오기 실패</div>';
    }
}

/* =========================================
   [상세] 질문 상세 보기 모달
   ========================================= */
function openDetailModal(item) {
    const titleEl = document.getElementById('detail-title');
    const contentEl = document.getElementById('detail-content');
    const catEl = document.getElementById('detail-category');
    const dateEl = document.getElementById('detail-date');
    const answerArea = document.getElementById('detail-answer-area');

    // 데이터 주입
    titleEl.textContent = item.title;
    contentEl.textContent = item.content; // escapeHtml 필요 없음 (textContent가 안전)
    catEl.textContent = getCategoryName(item.category);
    catEl.className = `badge badge-${item.category}`;
    dateEl.textContent = new Date(item.createdAt).toLocaleString();

    // 답변 상태 처리
    if (item.status === 'done' && item.answer) {
        answerArea.innerHTML = `
            <div class="answer-box">
                <div class="answer-text">${escapeHtml(item.answer)}</div>
                <span class="answer-date">
                    <i class="fas fa-pencil-alt"></i> 답변일: ${new Date(item.answeredAt).toLocaleDateString()}
                </span>
            </div>`;
    } else {
        answerArea.innerHTML = `
            <div class="no-answer">
                <i class="fas fa-spinner fa-spin"></i><br>
                현재 담당 컨설턴트가 내용을 확인하고 있습니다.
            </div>`;
    }

    openModal('qna-detail-modal');
}

/* =========================================
   [API] 질문 등록
   ========================================= */
async function handleQnaSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    
    // 중복 클릭 방지
    if (btn.disabled) return;
    btn.disabled = true;
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
            alert("질문이 성공적으로 등록되었습니다.");
            closeQnaModal();
            document.getElementById('qnaForm').reset();
            loadQnaHistory(); // 목록 갱신
        } else {
            alert("등록에 실패했습니다. 다시 시도해주세요.");
        }
    } catch (error) {
        console.error("Submit Error:", error);
        alert("네트워크 오류가 발생했습니다.");
    } finally {
        btn.disabled = false;
        btn.textContent = "문의 접수하기";
    }
}

// [유틸] 카테고리 한글 변환
function getCategoryName(key) {
    const map = { 
        'consulting': '입시 컨설팅', 
        'payment': '결제/환불', 
        'system': '시스템 오류', 
        'etc': '기타' 
    };
    return map[key] || '기타';
}

// [유틸] XSS 방지
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
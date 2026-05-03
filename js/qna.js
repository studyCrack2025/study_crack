// js/qna.js

const QNA_API_URL = CONFIG.api.qna; 

// 💡 공통 apiFetch 함수 (accessToken 기반 통합 및 401 예외 처리)
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    options.headers = { ...defaultHeaders, ...options.headers };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                const refreshed = await tryRefreshToken();
                if (refreshed) {
                    const newToken = localStorage.getItem('accessToken');
                    options.headers['Authorization'] = `Bearer ${newToken}`;
                    const retryRes = await fetch(url, options);
                    if (retryRes.ok) return retryRes;
                    if (!retryRes.ok && retryRes.status !== 401 && retryRes.status !== 403) {
                        throw new Error(`서버 통신 오류 (상태 코드: ${retryRes.status})`);
                    }
                }
                const currentPath = window.location.pathname;
                if (!['/login', '/signup', '/'].includes(currentPath)) {
                    alert("보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.");
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/login';
                }
                return Promise.reject(new Error("Auth expired"));
            }
            throw new Error(`서버 통신 오류 (상태 코드: ${response.status})`);
        }
        return response;
    } catch (error) {
        console.error("API 통신 실패:", error);
        throw error; 
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. FAQ 아코디언 로직
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        item.addEventListener('click', () => {
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

    // window.onclick 덮어쓰기 방지 -> addEventListener 사용
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
            document.body.style.overflow = 'auto'; // 스크롤 복구
        }
    });
});

function openLocalModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex'; // QnA 모달은 flex로 켜야 중앙 정렬됨
        document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
    } else {
        console.error(`Modal ID '${id}' not found.`);
    }
}

function closeLocalModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// 편의용 래퍼 함수
function openQnaModal() { openLocalModal('qna-modal'); }
function closeQnaModal() { closeLocalModal('qna-modal'); }
function closeDetailModal() { closeLocalModal('qna-detail-modal'); }

/* =========================================
   [API] 질문 목록 불러오기
   ========================================= */
async function loadQnaHistory() {
    const grid = document.getElementById('qna-grid');

    if (!localStorage.getItem('accessToken') && !localStorage.getItem('refreshToken')) {
        const refreshed = await tryRefreshToken();
        if (!refreshed) {
            clearClientSession();
            grid.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;">로그인 후 이용 가능한 서비스입니다.</div>';
            checkLoginStatus();
            return;
        }
        checkLoginStatus();
    }

    try {
        const response = await apiFetch(QNA_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_qna_list' }) 
        });

        const data = await response.json();
        const history = data.qnaHistory || [];

        grid.innerHTML = ''; 

        if (history.length === 0) {
            grid.innerHTML = `
                <div style="text-align:center; padding:40px; color:#64748b; grid-column:1/-1;">
                    <i class="far fa-folder-open" style="font-size:2rem; margin-bottom:10px;"></i><br>
                    등록된 질문이 없습니다.
                </div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
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
            
            // 클릭 시 상세 모달 열기
            card.addEventListener('click', () => openDetailModal(item));
            fragment.appendChild(card);
        });

        grid.appendChild(fragment);

    } catch (error) {
        if (error.message !== "Auth expired") {
            console.error("Q&A Load Error:", error);
            grid.innerHTML = '<div style="text-align:center; padding:20px;">질문 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
        }
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

    titleEl.textContent = item.title;
    contentEl.textContent = item.content;
    catEl.textContent = getCategoryName(item.category);
    catEl.className = `badge badge-${item.category}`;
    dateEl.textContent = new Date(item.createdAt).toLocaleString();

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

    openLocalModal('qna-detail-modal');
}

/* =========================================
   [API] 질문 등록
   ========================================= */
async function handleQnaSubmit(e) {
    e.preventDefault();
    const btn = document.querySelector('button[form="qnaForm"]');
    
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = "처리 중...";

    const title = document.getElementById('qTitle').value;
    const category = document.getElementById('qCategory').value;
    const content = document.getElementById('qContent').value;

    try {
        await apiFetch(QNA_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'save_qna',
                data: { title, category, content }
            })
        });

        alert("질문이 성공적으로 등록되었습니다.");
        
        closeQnaModal();
        document.getElementById('qnaForm').reset();
        loadQnaHistory(); 
        
    } catch (error) {
        if (error.message !== "Auth expired") {
            console.error("Submit Error:", error);
            alert("등록에 실패했습니다. 통신 상태를 확인하고 다시 시도해주세요.");
        }
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

// [유틸] 💡 한층 강력해진 XSS 방어
function escapeHtml(text) {
    if (text === null || text === undefined) return ""; 
    return String(text) 
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
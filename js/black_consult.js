// js/black_consult.js

// API 주소 변경
const API_URL = CONFIG.api.base;
const userId = localStorage.getItem('userId');

document.addEventListener('DOMContentLoaded', () => {
    if (!userId) { 
        alert("로그인이 필요합니다."); 
        window.location.href = 'login.html'; 
        return; 
    }
    loadUserData();
    loadConsultHistory();
});

// 유저 정보 로드 (좌측 사이드바)
async function loadUserData() {
    const token = localStorage.getItem('accessToken');
    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // ★ 토큰 추가
            },
            body: JSON.stringify({ type: 'get_user' }) 
        });
        const data = await res.json();
        
        document.getElementById('userName').innerText = data.name || 'User';
        
        // 기초조사서 정보 매핑
        if (data.qualitative) {
            document.getElementById('userStatus').innerText = data.qualitative.status || '미입력';
            document.getElementById('userStream').innerText = data.qualitative.stream || '미입력';
        }
        
        // 목표 대학
        const targetList = document.getElementById('userTargets');
        targetList.innerHTML = '';
        if (data.targetUnivs && data.targetUnivs.length > 0) {
            data.targetUnivs.forEach((u, i) => {
                if (u && u.univ && i < 2) { // 1-2지망만 표시
                    const li = document.createElement('li');
                    li.innerText = `${i+1}지망: ${u.univ} ${u.major}`;
                    targetList.appendChild(li);
                }
            });
        } else {
            targetList.innerHTML = '<li>설정된 목표 대학이 없습니다.</li>';
        }
    } catch(e) { console.error(e); }
}

// 상담 리스트 로드
async function loadConsultHistory() {
    const list = document.getElementById('qnaList');
    const token = localStorage.getItem('accessToken');
    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // ★ 토큰 추가
            },
            body: JSON.stringify({ type: 'get_user' }) 
        });
        const data = await res.json();
        
        const history = data.consultHistory || []; 
        list.innerHTML = '';

        if (history.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:40px; color:#555;">상담 내역이 없습니다.<br>첫 상담을 신청해보세요.</div>';
            return;
        }

        // 최신순 정렬
        history.sort((a,b) => new Date(b.date) - new Date(a.date));

        history.forEach(item => {
            const date = new Date(item.date).toLocaleDateString();
            const statusClass = item.reply ? 'replied' : 'pending';
            const statusText = item.reply ? '답변 완료' : '답변 대기중';
            
            // XSS 방지 처리 (간단 버전)
            const safeTitle = (item.title || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const safeContent = (item.content || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const safeReply = item.reply ? item.reply.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "아직 답변이 등록되지 않았습니다.";

            const div = document.createElement('div');
            div.className = 'qna-item';
            
            // 클릭 시 답변 확인 (간이 모달 역할)
            div.onclick = () => {
                const replyMsg = item.reply 
                    ? `[담당 컨설턴트 답변]\n${safeReply}` 
                    : `[상태: 접수 완료]\n담당 컨설턴트가 내용을 확인 중입니다.`;
                alert(`Q. ${safeTitle}\n\n${safeContent}\n\n------------------------\n${replyMsg}`);
            };

            div.innerHTML = `
                <div class="qna-header">
                    <span>[${item.category}] ${date}</span>
                    <span class="qna-status ${statusClass}">${statusText}</span>
                </div>
                <div class="qna-title">${safeTitle}</div>
                <div class="qna-snippet">${safeContent}</div>
            `;
            list.appendChild(div);
        });

    } catch(e) { 
        console.error(e);
        list.innerHTML = '<p style="text-align:center; color:red;">내역을 불러오지 못했습니다.</p>';
    }
}

// 모달 제어
function openConsultModal() { document.getElementById('consultModal').style.display = 'block'; }
function closeConsultModal() { document.getElementById('consultModal').style.display = 'none'; }

// 상담 제출
async function submitConsult() {
    const category = document.getElementById('consultCategory').value;
    const title = document.getElementById('consultTitle').value;
    const content = document.getElementById('consultContent').value;
    const token = localStorage.getItem('accessToken');

    if(!title || !content) return alert("제목과 내용을 모두 입력해주세요.");
    if(!confirm("상담을 신청하시겠습니까?")) return;

    const reqData = {
        date: new Date().toISOString(),
        category, title, content,
        reply: null 
    };

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // ★ 토큰 추가
            },
            body: JSON.stringify({ type: 'save_consult_qna', userId, data: reqData })
        });
        
        if(res.ok) {
            alert("신청되었습니다. 담당 컨설턴트가 곧 답변을 드릴 예정입니다.");
            closeConsultModal();
            loadConsultHistory(); // 리스트 갱신
        } else {
            throw new Error("저장 실패");
        }
    } catch(e) { alert("전송 실패: " + e.message); }
}
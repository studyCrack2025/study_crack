/* js/black_consult.js */
const API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/"; 
const userId = localStorage.getItem('userId');

document.addEventListener('DOMContentLoaded', () => {
    if (!userId) { alert("로그인이 필요합니다."); window.location.href = 'login.html'; return; }
    loadUserData();
    loadConsultHistory();
});

// 유저 정보 로드 (좌측 사이드바)
async function loadUserData() {
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ type: 'get_user', userId }) });
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
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ type: 'get_user', userId }) });
        const data = await res.json();
        
        const history = data.consultHistory || []; // DB에 저장될 키 이름
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
            
            const div = document.createElement('div');
            div.className = 'qna-item';
            div.onclick = () => alert("상세 보기 기능은 준비중입니다.\n(내용: " + item.content + ")"); // 추후 상세 모달 연결
            div.innerHTML = `
                <div class="qna-header">
                    <span>[${item.category}] ${date}</span>
                    <span class="qna-status ${statusClass}">${statusText}</span>
                </div>
                <div class="qna-title">${item.title}</div>
                <div class="qna-snippet">${item.content}</div>
            `;
            list.appendChild(div);
        });

    } catch(e) { 
        list.innerHTML = '로드 실패';
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

    if(!title || !content) return alert("제목과 내용을 모두 입력해주세요.");
    if(!confirm("상담을 신청하시겠습니까?")) return;

    const reqData = {
        date: new Date().toISOString(),
        category, title, content,
        reply: null // 답변은 아직 없음
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'save_consult_qna', userId, data: reqData })
        });
        alert("신청되었습니다. 담당 컨설턴트가 곧 답변을 드릴 예정입니다.");
        closeConsultModal();
        loadConsultHistory(); // 리스트 갱신
    } catch(e) { alert("전송 실패"); }
}
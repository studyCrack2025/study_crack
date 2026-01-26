// js/admin_detail.js

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('uid');
const adminId = localStorage.getItem('userId');
// API URL
const ADMIN_API_URL = CONFIG.api.base;

// 데이터 전역 저장 (필터링 및 탭 전환 시 재사용)
let currentStudentData = null;
let currentTier = 'free';

document.addEventListener('DOMContentLoaded', () => {
    if (!targetUserId || !adminId) {
        alert("잘못된 접근입니다.");
        window.location.href = 'admin.html';
        return;
    }
    loadStudentDetail();
    
    // 주간 점검 필터 초기화 (현재 날짜 기준)
    const today = new Date();
    initDateFilter(today.getFullYear(), today.getMonth() + 1);
});

// 날짜 필터 초기화
function initDateFilter(year, month) {
    const yearSel = document.getElementById('filterYear');
    const monthSel = document.getElementById('filterMonth');
    yearSel.innerHTML = ''; monthSel.innerHTML = '';

    const currentYear = new Date().getFullYear();
    for(let y = currentYear; y >= currentYear - 2; y--) {
        yearSel.innerHTML += `<option value="${y}" ${y===year?'selected':''}>${y}년</option>`;
    }
    for(let m = 1; m <= 12; m++) {
        monthSel.innerHTML += `<option value="${m}" ${m===month?'selected':''}>${m}월</option>`;
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById('tab_' + tabName);
    if(target) target.classList.add('active');
    
    // 이벤트 타겟을 찾아서 active 처리
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(`switchTab('${tabName}')`));
    if(btn) btn.classList.add('active');

    // 탭 전환 시 데이터가 있다면 렌더링 함수 호출
    if (currentStudentData) {
        if (tabName === 'weekly') renderWeeklyTab();
        if (tabName === 'special') renderSpecialTab();
    }
}

// [NEW] 특별 상담 탭 접근 제어
function trySwitchSpecialTab() {
    if (['basic', 'free', 'standard'].includes(currentTier)) {
        alert("PRO 또는 BLACK 등급 회원만 이용 가능한 메뉴입니다.");
        return;
    }
    switchTab('special');
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadStudentDetail() {
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                type: 'admin_get_user_detail',
                userId: adminId,
                data: { targetUserId: targetUserId }
            })
        });

        if (!response.ok) throw new Error("Server Error");
        const data = await response.json();
        
        currentStudentData = data; // 전역 저장
        renderData(data);
    } catch (e) {
        console.error(e);
        alert("데이터 로드 실패");
    }
}

function renderData(s) {
    if (!s) return;

    document.getElementById('viewName').innerText = s.name || '미입력';
    document.getElementById('viewEmail').innerText = s.email || '-';
    document.getElementById('viewSchool').innerText = s.school || '-';
    document.getElementById('viewPhone').innerText = s.phone || '-';
    document.getElementById('viewEmailFull').innerText = s.email || '-';
    document.getElementById('viewJoinDate').innerText = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-';

    // 티어 렌더링 및 저장
    currentTier = calcTier(s.payments || []);
    renderTierBadge(currentTier);
    
    // 특별 상담 버튼 스타일 처리
    const specialBtn = document.getElementById('btnSpecialTab');
    if (['basic', 'free', 'standard'].includes(currentTier)) {
        specialBtn.classList.add('disabled-tab');
        specialBtn.innerHTML = '🔒 특별 상담';
    } else {
        specialBtn.classList.remove('disabled-tab');
        specialBtn.innerHTML = '👑 특별 상담';
    }

    updateAnalysisBadge(s.analysisStatus);
    document.getElementById('analysisEditor').value = s.analysisContent || '';
    document.getElementById('adminMemoInput').value = s.adminMemo || '';

    renderTargetUnivs(s.targetUnivs || []);
    renderQualitativeDetail(s.qualitative);
    renderQuantitativeDetail(s.quantitative);
    renderPayments(s.payments || []);
    
    // 초기 렌더링 시 주간/특별 탭 데이터 준비 (화면에 보이진 않아도)
    // 실제 렌더링은 탭 클릭 시 수행됨
}

// 티어 계산 함수 분리
function calcTier(payments) {
    if (!payments || payments.length === 0) return 'free';
    const paid = payments.filter(p => p.status === 'paid');
    if (paid.length === 0) return 'free';
    
    paid.sort((a, b) => new Date(b.date) - new Date(a.date));
    const last = (paid[0].product || "").toLowerCase();
    
    if (last.includes('black')) return 'black';
    if (last.includes('pro')) return 'pro';
    if (last.includes('standard')) return 'standard';
    return 'basic';
}

function renderTierBadge(tier) {
    const area = document.getElementById('tierBadgeArea');
    let html = '';
    if (tier === 'black') html = '<span class="tier-badge" style="background: linear-gradient(to bottom right, #ffffff, #f8fafc); border: 2px solid #171717; color: #171717; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">BLACK TIER</span>';
    else if (tier === 'pro') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #F59E0B, #FCD34D); border: 2px solid #F59E0B; color: #78350f;">PRO TIER</span>';
    else if (tier === 'standard') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #94A3B8, #CBD5E1); border: 2px solid #64748B; color: #0F172A;">STANDARD TIER</span>';
    else if (tier === 'basic') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #3B82F6, #60A5FA); border: 2px solid #3B82F6; color: white;">BASIC TIER</span>';
    else html = '<span class="tier-badge" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;">FREE USER</span>';
    
    area.innerHTML = html;
}

// 주간 점검 렌더링 (연/월 필터 적용)
function renderWeeklyTab() {
    const container = document.getElementById('weeklyListContainer');
    container.innerHTML = '';
    
    // 데이터 가져오기 (전역변수 활용)
    const weeklyHistory = currentStudentData.weeklyHistory || [];
    const selYear = document.getElementById('filterYear').value;
    const selMonth = document.getElementById('filterMonth').value;

    // 필터링: 해당 연/월에 해당하는 데이터만
    const filtered = weeklyHistory.filter(w => {
        const d = new Date(w.date);
        return d.getFullYear() == selYear && (d.getMonth() + 1) == selMonth;
    });

    // 날짜 오름차순 정렬 (1주차 -> 4주차)
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-msg" style="text-align:center; padding:30px; color:#cbd5e1;">해당 월의 리포트가 없습니다.</div>';
        return;
    }

    filtered.forEach((d, idx) => {
        const dateStr = new Date(d.date).toLocaleDateString();
        const safeComment = escapeHtml(d.comment);
        
        // 1. 학습 시간 상세 테이블 생성
        let detailsHtml = '';
        if (d.studyTime && Array.isArray(d.studyTime.details)) {
            detailsHtml = `<table style="width:100%; font-size:0.85rem; border-collapse: collapse; margin-top:8px; margin-bottom:8px;">
                <tr style="background:#eef2ff; border-bottom:1px solid #dbeafe;">
                    <th style="padding:4px; text-align:left;">과목</th>
                    <th style="padding:4px; text-align:center;">계획</th>
                    <th style="padding:4px; text-align:center;">실제</th>
                    <th style="padding:4px; text-align:center;">달성</th>
                </tr>`;
            
            d.studyTime.details.forEach(sub => {
                const rate = sub.plan > 0 ? Math.min((sub.act / sub.plan) * 100, 100).toFixed(0) : 0;
                const color = rate >= 100 ? '#166534' : (rate >= 80 ? '#1e40af' : '#b91c1c');
                detailsHtml += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:4px;">${escapeHtml(sub.subject)}</td>
                    <td style="padding:4px; text-align:center;">${sub.plan}H</td>
                    <td style="padding:4px; text-align:center;">${sub.act}H</td>
                    <td style="padding:4px; text-align:center; font-weight:bold; color:${color};">${rate}%</td>
                </tr>`;
            });
            detailsHtml += `</table>`;
        }

        // 2. 플래너 파일 목록 HTML 생성
        let plannerHtml = '';
        if (d.plannerFiles && d.plannerFiles.length > 0) {
            // 파일이 S3 URL이면 링크로, 아니면 텍스트로 표시
            const fileList = d.plannerFiles.map(f => {
                let fileName = f;
                // URL이면 파일명만 추출
                if (typeof f === 'string' && f.startsWith('http')) {
                    try {
                        fileName = decodeURIComponent(f.split('/').pop());
                        fileName = fileName.replace(/^\d+_/, '');
                    } catch(e) {}
                    
                    return `<div>
                        📄 <a href="${f}" target="_blank" style="color:#2563eb; text-decoration:underline;">
                            ${escapeHtml(fileName)}
                        </a>
                    </div>`;
                } else {
                    return `<div>📄 ${escapeHtml(f)} <small style="color:#94a3b8;">(미연동)</small></div>`;
                }
            }).join('');

            plannerHtml = `
            <div style="margin-top:10px; padding:10px; background:#fff; border-radius:6px; border:1px solid #e2e8f0;">
                <strong style="display:block; margin-bottom:5px; font-size:0.9rem; color:#1e293b;">📸 플래너 인증 (${d.plannerFiles.length}장)</strong>
                <div style="font-size:0.85rem; color:#475569; display:flex; flex-direction:column; gap:4px;">
                    ${fileList}
                </div>
            </div>`;
        }

        // 3. 카드 전체 조립
        const card = document.createElement('div');
        card.className = 'timeline-card weekly';
        card.innerHTML = `
            <div class="card-top">
                <span class="card-tag weekly">WEEKLY REPORT</span>
                <span class="card-date">${dateStr}</span>
            </div>
            <div class="card-title">${d.title || (idx+1)+'주차 점검'}</div>
            <div class="card-body">
                <div style="margin-bottom:8px;">
                    <span style="font-weight:bold; color:#2563eb;">총 달성률: ${d.studyTime?.totalRate || '0%'}</span> 
                    <span style="color:#64748b; font-size:0.9rem;">(총 ${d.studyTime?.totalAct || 0}H 학습)</span>
                </div>
                ${detailsHtml}
                ${plannerHtml}
                <div style="margin-top:10px; padding:10px; background:#fff; border-radius:6px; border:1px solid #e2e8f0;">
                    <strong>💬 코멘트:</strong> ${safeComment}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// [NEW] 특별 상담 렌더링 (Pro/Black)
function renderSpecialTab() {
    const container = document.getElementById('specialListContainer');
    container.innerHTML = '';
    
    // BLACK 회원이면 채팅 인터페이스 로드
    if (currentTier === 'black') {
        container.innerHTML = `
            <div class="admin-chat-wrapper">
                <div class="chat-window" id="adminChatWindow">
                    </div>
                <div class="chat-input-box">
                    <textarea id="adminChatInput" placeholder="답변을 입력하세요..."></textarea>
                    <button onclick="sendAdminChat()" class="chat-send-btn">전송</button>
                </div>
            </div>
        `;
        renderAdminChat(); // 채팅 로드 및 읽음 처리
        return;
    }

    // ★ DB 변수명 수정: proCoachingHistory, blackConsultHistory
    const proHistory = currentStudentData.proCoachingHistory || [];
    const blackHistory = currentStudentData.blackConsultHistory || [];

    let items = [];

    // ★ Black은 Black Consulting만, Pro는 Pro Coaching만 표시
    if (currentTier === 'black') {
        blackHistory.forEach(b => {
            items.push({ type: 'black', date: b.date, title: b.title || '1:1 시크릿 컨설팅', data: b });
        });
    } else if (currentTier === 'pro') {
        proHistory.forEach(d => {
            items.push({ type: 'deep', date: d.date, title: '심층 코칭 요청', data: d });
        });
    }

    // 최신순 정렬
    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (items.length === 0) {
        container.innerHTML = '<div class="empty-msg" style="grid-column: 1/-1; text-align:center; padding:30px; color:#cbd5e1;">상담 내역이 없습니다.</div>';
        return;
    }

    items.forEach(item => {
        const dateStr = new Date(item.date).toLocaleDateString();
        const isDeep = item.type === 'deep';
        const tagClass = isDeep ? 'deep' : 'black';
        const tagName = isDeep ? 'PRO COACHING' : 'BLACK CONSULT'; // 이름 변경
        
        // 미리보기 생성
        let preview = '';
        if (isDeep) preview = item.data.plan || '내용 없음';
        else preview = item.data.content || '내용 없음';

        const div = document.createElement('div');
        div.className = `special-item ${tagClass}`;
        div.onclick = () => showModal(item);
        div.innerHTML = `
            <span class="sp-tag ${tagClass}">${tagName}</span>
            <span class="sp-date">${dateStr}</span>
            <div class="sp-title">${item.title}</div>
            <div class="sp-preview">${escapeHtml(preview)}</div>
        `;
        container.appendChild(div);
    });
}

// 관리자 채팅 렌더링 및 읽음 처리
async function renderAdminChat() {
    const chatWindow = document.getElementById('adminChatWindow');
    const chats = currentStudentData.consultChat || [];
    const token = localStorage.getItem('accessToken');

    let unreadExists = false;

    chats.forEach(msg => {
        const isMe = msg.sender === 'admin';
        const typeClass = isMe ? 'me' : 'other'; // CSS 클래스: me(오른쪽), other(왼쪽)
        const timeStr = new Date(msg.date).toLocaleString();
        
        let content = escapeHtml(msg.text).replace(/\n/g, '<br>');
        if(msg.file) content += `<br><a href="${msg.file}" target="_blank">📄 첨부파일</a>`;

        const div = document.createElement('div');
        div.className = `chat-bubble ${typeClass}`;
        div.innerHTML = `<div class="msg-text">${content}</div><div class="msg-info">${timeStr} ${isMe && msg.isRead ? '(읽음)' : ''}</div>`;
        chatWindow.appendChild(div);

        if (msg.sender === 'user' && !msg.isRead) unreadExists = true;
    });

    chatWindow.scrollTop = chatWindow.scrollHeight;

    // 읽지 않은 메시지가 있으면 읽음 처리 요청
    if (unreadExists) {
        await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'mark_chat_read', 
                userId: adminId, 
                data: { targetUserId: targetUserId, sender: 'user' } 
            })
        });
    }
}

// 관리자 메시지 전송
async function sendAdminChat() {
    const input = document.getElementById('adminChatInput');
    const text = input.value.trim();
    if (!text) return;

    const token = localStorage.getItem('accessToken');
    const msgData = {
        id: Date.now().toString(),
        sender: 'admin',
        text: text,
        file: null, // 관리자 파일 첨부는 추후 구현
        date: new Date().toISOString(),
        isRead: false
    };

    try {
        await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'save_chat_message', 
                userId: adminId, 
                data: { targetUserId: targetUserId, message: msgData } 
            })
        });
        
        input.value = '';
        loadStudentDetail(); // 데이터 갱신 (화면 리로드)
    } catch(e) { alert("전송 실패"); }
}

// 모달 보기
function showModal(item) {
    const modal = document.getElementById('detailModal');
    const titleEl = document.getElementById('modalTitle');
    const contentEl = document.getElementById('modalContent');
    const d = item.data;

    titleEl.innerText = item.title;
    
    let html = '';
    if (item.type === 'deep') {
        html = `
            <p><strong>📅 일시:</strong> ${new Date(item.date).toLocaleString()}</p>
            <hr style="border:0; border-top:1px dashed #e2e8f0; margin:15px 0;">
            <p><strong>1. 계획 점검:</strong><br>${escapeHtml(d.plan)}</p>
            <p><strong>2. 방향성:</strong><br>${escapeHtml(d.direction)}</p>
            <p><strong>3. 취약 과목:</strong><br>${escapeHtml(d.subject)}</p>
            <p><strong>4. 기타/멘탈:</strong><br>${escapeHtml(d.etc)}</p>
        `;
    } else {
        // Black Consult
        html = `
            <p><strong>📅 일시:</strong> ${new Date(item.date).toLocaleString()}</p>
            <p><strong>📂 카테고리:</strong> ${d.category || '일반'}</p>
            <hr style="border:0; border-top:1px dashed #e2e8f0; margin:15px 0;">
            <p><strong>Q. 질문 내용:</strong><br>${escapeHtml(d.content)}</p>
            <br>
            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                <strong>A. 답변:</strong><br>
                ${d.reply ? escapeHtml(d.reply) : '<span style="color:#94a3b8;">(아직 답변이 등록되지 않았습니다)</span>'}
            </div>
        `;
    }
    
    contentEl.innerHTML = html;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// 기존 렌더링 함수들 유지 (renderTargetUnivs, renderQualitativeDetail 등...)
// (이전 코드에 있던 함수들 그대로 사용하시면 됩니다. 위에 renderData에서 호출 중)

function renderTargetUnivs(list) {
    const container = document.getElementById('viewTargetUnivList');
    container.innerHTML = '';
    const validList = list.filter(u => u && u.univ);
    if (validList.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8;">설정된 목표 대학이 없습니다.</p>';
        return;
    }
    validList.forEach((u, idx) => {
        const div = document.createElement('div');
        div.className = 'target-univ-item';
        const dateStr = u.date ? new Date(u.date).toLocaleDateString() + ' 선택' : '날짜 정보 없음';
        div.innerHTML = `<div><strong>${idx+1}. ${escapeHtml(u.univ)}</strong><div class="major">${escapeHtml(u.major)}</div></div><div class="date">${dateStr}</div>`;
        container.appendChild(div);
    });
}

function renderQualitativeDetail(q) {
    const area = document.getElementById('qualContentArea');
    if (!q) { area.innerHTML = '<p style="text-align:center; color:#94a3b8;">데이터가 없습니다.</p>'; return; }
    const v = (val) => val ? escapeHtml(val) : '-';
    let html = `<div class="qual-section"><div class="qual-head">📍 현재 상황</div><div class="qual-grid">
        <div class="qual-item"><span class="detail-label">신분</span><div>${v(q.status)}</div></div>
        <div class="qual-item"><span class="detail-label">계열</span><div>${v(q.stream)}</div></div>
        <div class="qual-item"><span class="detail-label">진로</span><div>${v(q.career)}</div></div></div></div>`;
    area.innerHTML = html;
}

function renderQuantitativeDetail(q) {
    const area = document.getElementById('viewScoreTable');
    if (!q || Object.keys(q).length === 0) { area.innerHTML = '<p style="text-align:center; color:#94a3b8;">성적 데이터 없음</p>'; return; }
    const examNames = { 'mar':'3월 학평', 'jun':'6월 모평', 'sep':'9월 모평', 'csat':'수능' };
    const subjects = [{k:'kor',n:'국어'}, {k:'math',n:'수학'}, {k:'eng',n:'영어'}, {k:'inq1',n:'탐1'}, {k:'inq2',n:'탐2'}];
    let html = '';
    ['csat','sep','jun','mar'].forEach(key => {
        if(!q[key]) return;
        const d = q[key];
        html += `<div class="score-exam-block"><div style="font-weight:bold; margin-bottom:10px;">${examNames[key]||key}</div><table class="score-table"><thead><tr><th>과목</th><th>표점</th><th>등급</th></tr></thead><tbody>`;
        subjects.forEach(sub => {
            if(d[sub.k]) html += `<tr><td>${sub.n}</td><td>${d[sub.k].std||'-'}</td><td>${d[sub.k].grd||'-'}</td></tr>`;
        });
        html += `</tbody></table></div><br>`;
    });
    area.innerHTML = html;
}

function updateAnalysisBadge(status) {
    const badge = document.getElementById('analysisStatusBadge');
    if(!badge) return;
    if (status === 'completed') { badge.className = 'analysis-badge completed'; badge.innerHTML = '✅ 분석 리포트 발송 완료'; }
    else { badge.className = 'analysis-badge pending'; badge.innerHTML = '⏳ 분석 대기중'; }
}

function renderPayments(p) {
    const listBody = document.getElementById('viewPaymentList');
    const totalEl = document.getElementById('payTotalAmount');
    const lastDateEl = document.getElementById('payLastDate');
    listBody.innerHTML = "";
    if (p && p.length > 0) {
        const sortedP = [...p].sort((a,b) => new Date(b.date) - new Date(a.date));
        let total = 0;
        sortedP.forEach(item => total += parseInt(item.amount || 0));
        totalEl.innerText = total.toLocaleString() + "원";
        lastDateEl.innerText = new Date(sortedP[0].date).toLocaleDateString();
        sortedP.forEach(pay => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${escapeHtml(pay.product)}</td><td>${new Date(pay.date).toLocaleString()}</td><td style="text-align:right;">${parseInt(pay.amount).toLocaleString()}원</td>`;
            listBody.appendChild(tr);
        });
    } else {
        totalEl.innerText = "0원"; lastDateEl.innerText = "-";
        listBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px;">결제 내역 없음</td></tr>`;
    }
}

async function saveAnalysis() {
    const content = document.getElementById('analysisEditor').value;
    const token = localStorage.getItem('accessToken');
    if(!content.trim()) return alert("내용을 입력하세요");
    if(!confirm("저장하시겠습니까?")) return;
    try {
        await fetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type:'admin_save_analysis', userId:adminId, data:{targetUserId, content, status:'completed'} })
        });
        alert("저장 완료"); updateAnalysisBadge('completed');
    } catch(e) { alert("저장 실패"); }
}

async function saveAdminMemo() {
    const memo = document.getElementById('adminMemoInput').value;
    const token = localStorage.getItem('accessToken');
    try {
        await fetch(ADMIN_API_URL, {
            method:'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:JSON.stringify({ type:'admin_update_memo', userId:adminId, data:{targetUserId, memo} })
        });
        alert("메모 저장 완료");
    } catch(e) { alert("저장 실패"); }
}
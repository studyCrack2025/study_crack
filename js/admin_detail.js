// js/admin_detail.js

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('uid');
const adminId = localStorage.getItem('userId');
const ADMIN_API_URL = CONFIG.api.base;

let currentStudentData = null;
let currentTier = 'free';
let currentAdminFile = null; // 관리자 첨부파일

document.addEventListener('DOMContentLoaded', () => {
    if (!targetUserId || !adminId) {
        alert("잘못된 접근입니다.");
        window.location.href = 'admin.html';
        return;
    }
    loadStudentDetail();
    
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
    
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(`switchTab('${tabName}')`));
    if(btn) btn.classList.add('active');

    if (currentStudentData) {
        if (tabName === 'weekly') renderWeeklyTab();
        if (tabName === 'special') renderSpecialTab();
    }
}

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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'admin_get_user_detail',
                userId: adminId,
                data: { targetUserId: targetUserId }
            })
        });

        if (!response.ok) throw new Error("Server Error");
        const data = await response.json();
        
        currentStudentData = data;
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

    currentTier = calcTier(s.payments || []);
    renderTierBadge(currentTier);
    
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
}

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

// 주간 점검 렌더링
function renderWeeklyTab() {
    const container = document.getElementById('weeklyListContainer');
    container.innerHTML = '';
    
    const weeklyHistory = currentStudentData.weeklyHistory || [];
    const selYear = document.getElementById('filterYear').value;
    const selMonth = document.getElementById('filterMonth').value;

    const filtered = weeklyHistory.filter(w => {
        const d = new Date(w.date);
        return d.getFullYear() == selYear && (d.getMonth() + 1) == selMonth;
    });

    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-msg" style="text-align:center; padding:30px; color:#cbd5e1;">해당 월의 리포트가 없습니다.</div>';
        return;
    }

    filtered.forEach((d, idx) => {
        const dateStr = new Date(d.date).toLocaleDateString();
        const safeComment = escapeHtml(d.comment);
        
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

        let plannerHtml = '';
        if (d.plannerFiles && d.plannerFiles.length > 0) {
            const fileList = d.plannerFiles.map(f => {
                let fileName = f;
                if (typeof f === 'string' && f.startsWith('http')) {
                    try {
                        fileName = decodeURIComponent(f.split('/').pop());
                        fileName = fileName.replace(/^\d+_/, '');
                    } catch(e) {}
                    return `<div>📄 <a href="${f}" target="_blank" style="color:#2563eb; text-decoration:underline;">${escapeHtml(fileName)}</a></div>`;
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

// [수정] 특별 상담 탭 렌더링
function renderSpecialTab() {
    const container = document.getElementById('specialListContainer');
    container.innerHTML = '';

    // BLACK 회원은 채팅창 로드
    if (currentTier === 'black') {
        container.innerHTML = `
            <div class="admin-chat-wrapper">
                <div class="admin-chat-header">
                    <span>1:1 BLACK CONSULTING</span>
                    <span class="chat-badge">LIVE</span>
                </div>
                <div class="chat-window" id="adminChatWindow">
                    </div>
                <div class="chat-input-box">
                    <div id="adminFilePreviewArea" style="display:none; margin-bottom:5px;"></div>
                    <div class="input-row">
                        <label for="adminFileInput" class="admin-file-btn"><i class="fas fa-paperclip"></i></label>
                        <input type="file" id="adminFileInput" style="display:none;" onchange="handleAdminFile(this)">
                        
                        <textarea id="adminChatInput" placeholder="메시지를 입력하세요 (Enter: 전송, Shift+Enter: 줄바꿈)"></textarea>
                        <button onclick="sendAdminChat()" id="btnAdminSend" class="chat-send-btn">전송</button>
                    </div>
                </div>
            </div>
        `;
        
        // ★ [핵심] 한글 중복 전송 방지 이벤트 리스너 추가
        const input = document.getElementById('adminChatInput');
        input.addEventListener('keydown', (e) => {
            // 한글 조합 중이면 함수 종료 (전송 막음)
            if (e.isComposing) return;

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAdminChat();
            }
        });

        renderAdminChat();
        return;
    }

    // PRO 회원은 기존 Deep Coaching 리스트
    const proHistory = currentStudentData.proCoachingHistory || [];
    renderProHistory(proHistory, container);
}

// PRO 회원 리스트 렌더링 함수 (기존 로직 분리)
function renderProHistory(history, container) {
    if (history.length === 0) {
        container.innerHTML = '<div class="empty-msg" style="text-align:center; padding:30px; color:#cbd5e1;">상담 내역이 없습니다.</div>';
        return;
    }
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    history.forEach(d => {
        const dateStr = new Date(d.date).toLocaleDateString();
        const div = document.createElement('div');
        div.className = `special-item deep`;
        div.onclick = () => showModal({ type: 'deep', title: '심층 코칭 요청', data: d, date: d.date });
        div.innerHTML = `
            <span class="sp-tag deep">PRO COACHING</span>
            <span class="sp-date">${dateStr}</span>
            <div class="sp-title">심층 코칭 요청</div>
            <div class="sp-preview">${escapeHtml(d.plan || '내용 없음')}</div>
        `;
        container.appendChild(div);
    });
}

// 관리자 채팅 렌더링
async function renderAdminChat() {
    const chatWindow = document.getElementById('adminChatWindow');
    const chats = currentStudentData.consultChat || [];
    const token = localStorage.getItem('accessToken');

    chatWindow.innerHTML = '';
    let unreadExists = false;

    if (chats.length === 0) {
        chatWindow.innerHTML = '<div style="text-align:center; color:#94a3b8; margin-top:50px;">대화 내역이 없습니다.</div>';
    }

    chats.forEach(msg => {
        const isMe = msg.sender === 'admin';
        const typeClass = isMe ? 'me' : 'other'; 
        const timeStr = new Date(msg.date).toLocaleString();
        
        let content = escapeHtml(msg.text).replace(/\n/g, '<br>');
        
        if (msg.file) {
            const isImg = msg.file.match(/\.(jpg|jpeg|png|gif|webp)$/i);
            if (isImg) {
                content += `<br><img src="${msg.file}" class="admin-chat-img" onclick="window.open('${msg.file}')">`;
            } else {
                const fileName = decodeURIComponent(msg.file.split('/').pop().split('_').slice(1).join('_'));
                content += `<br><a href="${msg.file}" target="_blank" class="admin-file-link">
                    <i class="fas fa-file-download"></i> ${fileName || '첨부파일'}
                </a>`;
            }
        }

        const div = document.createElement('div');
        div.className = `chat-bubble ${typeClass}`;
        div.innerHTML = `<div class="msg-text">${content}</div><div class="msg-info">${timeStr}</div>`;
        chatWindow.appendChild(div);

        if (msg.sender === 'user' && !msg.isRead) unreadExists = true;
    });

    chatWindow.scrollTop = chatWindow.scrollHeight;

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

// 관리자 파일 선택
function handleAdminFile(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 10 * 1024 * 1024) return alert("10MB 이하만 가능합니다.");
        currentAdminFile = file;
        
        const preview = document.getElementById('adminFilePreviewArea');
        preview.style.display = 'block';
        preview.innerHTML = `<span class="admin-file-preview">${file.name} <i class="fas fa-times" onclick="clearAdminFile()" style="cursor:pointer; margin-left:5px;"></i></span>`;
    }
}

function clearAdminFile() {
    currentAdminFile = null;
    document.getElementById('adminFileInput').value = '';
    document.getElementById('adminFilePreviewArea').style.display = 'none';
}

// 관리자 메시지 전송
async function sendAdminChat() {
    const input = document.getElementById('adminChatInput');
    const text = input.value.trim();
    if (!text && !currentAdminFile) return;

    const btn = document.getElementById('btnAdminSend');
    btn.disabled = true;
    btn.innerText = '...';

    const token = localStorage.getItem('accessToken');
    let fileUrl = null;

    try {
        if (currentAdminFile) {
            const presignRes = await fetch(ADMIN_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    type: 'get_presigned_url', 
                    userId: adminId, 
                    data: { fileName: currentAdminFile.name, fileType: currentAdminFile.type, folder: 'chat' } 
                })
            });
            const { uploadUrl, fileUrl: s3Url } = await presignRes.json();
            await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': currentAdminFile.type }, body: currentAdminFile });
            fileUrl = s3Url;
        }

        const msgData = {
            id: Date.now().toString(),
            sender: 'admin',
            text: text,
            file: fileUrl,
            date: new Date().toISOString(),
            isRead: false
        };

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
        clearAdminFile();
        
        await loadStudentDetail(); // 데이터 갱신
        renderAdminChat(); // 채팅창 다시 그리기

    } catch(e) { 
        console.error(e);
        alert("전송 실패"); 
    } finally {
        btn.disabled = false;
        btn.innerText = '전송';
        input.focus();
    }
}

// 모달 로직
function showModal(item) {
    const modal = document.getElementById('detailModal');
    const titleEl = document.getElementById('modalTitle');
    const contentEl = document.getElementById('modalContent');
    const d = item.data;

    titleEl.innerText = item.title;
    
    let html = '';
    // Deep Coaching Modal Content
    html = `
        <p><strong>📅 일시:</strong> ${new Date(item.date).toLocaleString()}</p>
        <hr style="border:0; border-top:1px dashed #e2e8f0; margin:15px 0;">
        <p><strong>1. 계획 점검:</strong><br>${escapeHtml(d.plan)}</p>
        <p><strong>2. 방향성:</strong><br>${escapeHtml(d.direction)}</p>
        <p><strong>3. 취약 과목:</strong><br>${escapeHtml(d.subject)}</p>
        <p><strong>4. 기타/멘탈:</strong><br>${escapeHtml(d.etc)}</p>
    `;
    
    contentEl.innerHTML = html;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// 기타 렌더링 함수들 (renderTargetUnivs, renderQualitativeDetail 등)은 기존 코드 유지
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
    area.innerHTML = `<div class="qual-section"><div class="qual-head">📍 현재 상황</div><div class="qual-grid"><div class="qual-item"><span class="detail-label">신분</span><div>${v(q.status)}</div></div><div class="qual-item"><span class="detail-label">계열</span><div>${v(q.stream)}</div></div><div class="qual-item"><span class="detail-label">진로</span><div>${v(q.career)}</div></div></div></div>`;
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

function updateAnalysisBadge(status) {
    const badge = document.getElementById('analysisStatusBadge');
    if(!badge) return;
    if (status === 'completed') { badge.className = 'analysis-badge completed'; badge.innerHTML = '✅ 분석 리포트 발송 완료'; }
    else { badge.className = 'analysis-badge pending'; badge.innerHTML = '⏳ 분석 대기중'; }
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
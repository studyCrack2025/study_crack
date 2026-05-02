// js/admin/notices.js
// 공지 발송 스마트 타겟팅 로직
// ADMIN_API_URL, NOTI_API_URL, apiFetch, escapeHtml, getTierBadgeHTML, Store 는
// admin_ui.js / students.js / auth.js 에서 제공

function switchNotiTab(tabName) {
    document.querySelectorAll('.noti-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tabBtn-' + tabName).classList.add('active');
    document.getElementById('notiTab-inbox').style.display = (tabName === 'inbox') ? 'block' : 'none';
    document.getElementById('notiTab-send').style.display = (tabName === 'send') ? 'block' : 'none';
}

async function fetchUnreadNotiCount() {
    try {
        const response = await apiFetch(NOTI_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_notifications' }) });
        const data = await response.json();
        const unreadCount = (data.notifications || []).filter(n => !n.isRead).length;
        const badge = document.getElementById('notiBadge');
        if (unreadCount > 0) { badge.style.display = 'inline-block'; badge.innerText = unreadCount; } else { badge.style.display = 'none'; }
    } catch(e) { }
}

async function loadNotifications() {
    const container = document.getElementById('notiListBody'); container.innerHTML = '<p style="text-align:center;">알림을 불러오는 중...</p>';
    try {
        const response = await apiFetch(NOTI_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_notifications' }) });
        const data = await response.json();
        container.innerHTML = '';
        if (!data.notifications || data.notifications.length === 0) { container.innerHTML = '<p style="text-align:center; color:#94a3b8;">최근 알림이 없습니다.</p>'; return; }
        data.notifications.forEach(n => {
            const card = document.createElement('div'); card.className = `noti-item ${n.isRead ? '' : 'unread'}`;
            card.innerHTML = `
    <div style="width: 100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
            <div class="noti-time" style="font-size: 0.85rem; color: #94a3b8;">${new Date(n.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>
            ${!n.isRead ? `<button class="noti-btn" onclick="markAsReadNoti('${n.id}')" style="background:#f59e0b; color:white; border:none; padding:4px 10px; border-radius:4px; font-size:0.8rem; cursor:pointer;">확인</button>` : '<span style="color:#10b981; font-size:0.8rem; font-weight:bold;">읽음</span>'}
        </div>
        <div style="font-weight:bold; color:#1e293b; font-size:1.05rem; margin-bottom:4px;">${escapeHtml(n.title || n.message)}</div>
        ${n.detail ? `<div class="noti-text" style="color:#475569; font-size:0.95rem; line-height:1.4;">${escapeHtml(n.detail)}</div>` : ''}
    </div>
            `;
            container.appendChild(card);
        });
        fetchUnreadNotiCount();
    } catch(e) { if (e.message !== "Auth expired") container.innerHTML = '<p style="text-align:center; color:red;">오류 발생</p>'; }
}

async function markAsReadNoti(notiId) {
    try {
        await apiFetch(NOTI_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_read_notification', data: { notiId } }) });
        loadNotifications();
    } catch(e) { if (e.message !== "Auth expired") alert('처리 실패'); }
}

async function markAllNotiAsRead() {
    if(!confirm("모든 알림을 읽음 처리하시겠습니까?")) return;
    await markAsReadNoti('all');
}

window.showNotiMenu = function(tabName) {
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    document.getElementById('section-notifications').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.getElementById('notiTab-inbox').style.display = 'none';
    document.getElementById('notiTab-send').style.display = 'none';
    document.getElementById('notiTab-sent').style.display = 'none';
    const titleEl = document.getElementById('notiPageTitle');

    if (tabName === 'inbox') { document.getElementById('notiTab-inbox').style.display = 'block'; titleEl.innerText = '📥 알림 수신함'; loadNotifications(); }
    else if (tabName === 'send') { document.getElementById('notiTab-send').style.display = 'block'; titleEl.innerText = '📢 새 공지 발송'; loadTutorListForNotice(); }
    else if (tabName === 'sent') { document.getElementById('notiTab-sent').style.display = 'block'; titleEl.innerText = '📤 보낸 공지함'; loadSentNotices(); }
};

window.loadSentNotices = async function() {
    const container = document.getElementById('sentNotiListBody'); container.innerHTML = '<p class="empty-msg">보낸 공지를 불러오는 중...</p>';
    try {
        const response = await apiFetch(NOTI_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_notifications' }) });
        const data = await response.json();
        container.innerHTML = '';
        const sentList = data.sentNotices || []; sentList.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (sentList.length === 0) { container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding: 30px;">보낸 공지가 없습니다.</p>'; return; }
        sentList.forEach(n => {
            const card = document.createElement('div'); card.className = `noti-item`; const targetText = n.targetNames ? n.targetNames : `${n.targetCount}명`;
            card.innerHTML = `<div style="width: 100%;"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="noti-time">${new Date(n.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div><div class="noti-tags"><span class="tag-tutor" style="background:#f1f5f9; color:#475569;">👥 수신: ${escapeHtml(targetText)} (총 ${n.targetCount}명)</span></div></div><div style="font-weight:bold; margin-top:8px; color:#1e293b; font-size:1.1rem;">${escapeHtml(n.title)}</div><div class="noti-text" style="margin-top:10px; white-space:pre-wrap; background:#f8fafc; padding:15px; border-radius:8px; font-size:0.95rem; border:1px solid #e2e8f0;">${escapeHtml(n.detail)}</div></div>`;
            container.appendChild(card);
        });
    } catch(e) { if (e.message !== "Auth expired") container.innerHTML = '<p style="text-align:center; color:red;">오류 발생</p>'; }
};

let globalStudentsCache = [];
let globalTutorsCache = [];
let selectedTargetMap = new Map(); // 선택된 유저 정보 저장 { userId: { name, reason } }

async function loadTutorListForNotice() {
    const adminId = localStorage.getItem('userId');
    try {
        const [tutorRes, studentRes] = await Promise.all([
            apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_tutor_stats' }) }),
            apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_search', userId: adminId, data: {} }) })
        ]);

        const tutorData = await tutorRes.json();
        const studentData = await studentRes.json();

        globalTutorsCache = tutorData.tutors || [];
        let students = Array.isArray(studentData) ? studentData : (studentData.students || studentData.Items || []);

        globalStudentsCache = students.filter(s => {
            if (s.role === 'admin' || s.role === 'tutor') return false;
            if ((s.userid.startsWith("TEMP") || s.userid.startsWith("VERIFIED")) && !s.createdAt) return false;
            return true;
        }).map(s => {
            const tierBadge = getTierBadgeHTML(s);
            const tier = (tierBadge.match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
            return { ...s, parsedTier: tier };
        });

        clearAllTargets();

        const pendingTargets = Store.get('pendingNoticeTargets');
        Store.clear('pendingNoticeTargets');
        if (pendingTargets && pendingTargets.length > 0) {
            pendingTargets.forEach(student => {
                selectedTargetMap.set(student.userId, { name: student.userName, tag: "선택명단" });
            });
            document.getElementById('targetGroupSelect').value = 'INDIVIDUAL';
        } else {
            document.getElementById('targetGroupSelect').value = '';
        }

        updateTargetSubSelect();
        renderTargetTags();

    } catch(e) { console.error("Notice User Load Error:", e); }
}

window.updateTargetSubSelect = function() {
    const groupVal = document.getElementById('targetGroupSelect').value;
    const subSelect = document.getElementById('targetSubSelect');
    subSelect.innerHTML = '';

    if (groupVal === 'TUTOR') {
        subSelect.style.display = 'block';
        globalTutorsCache.forEach(t => {
            subSelect.innerHTML += `<option value="${escapeHtml(t.nickname)}">${escapeHtml(t.nickname)} 선생님 담당</option>`;
        });
    } else if (groupVal === 'INDIVIDUAL') {
        subSelect.style.display = 'block';
        globalStudentsCache.forEach(s => {
            subSelect.innerHTML += `<option value="${escapeHtml(s.userid)}">${escapeHtml(s.name)} (${s.parsedTier})</option>`;
        });
    } else {
        subSelect.style.display = 'none';
    }
};

window.addTargetUsers = function() {
    const groupVal = document.getElementById('targetGroupSelect').value;
    const subVal = document.getElementById('targetSubSelect').value;

    if (!groupVal) return alert("발송 대상을 먼저 선택해주세요.");

    let targetPool = [];
    let groupLabel = "";

    if (groupVal === 'ALL') {
        targetPool = globalStudentsCache;
        groupLabel = "전체";
    } else if (groupVal.startsWith('TIER_')) {
        const targetTier = groupVal.split('_')[1];
        targetPool = globalStudentsCache.filter(s => s.parsedTier.toUpperCase() === targetTier);
        groupLabel = targetTier;
    } else if (groupVal === 'TUTOR') {
        if (!subVal) return;
        targetPool = globalStudentsCache.filter(s => s.tutorName === subVal);
        groupLabel = subVal;
    } else if (groupVal === 'INDIVIDUAL') {
        if (!subVal) return;
        targetPool = globalStudentsCache.filter(s => s.userid === subVal);
        groupLabel = "개별추가";
    }

    if (targetPool.length === 0) {
        return alert("해당 조건에 맞는 학생이 없습니다.");
    }

    let addedCount = 0;
    targetPool.forEach(user => {
        if (!selectedTargetMap.has(user.userid)) {
            selectedTargetMap.set(user.userid, { name: user.name, tag: groupLabel });
            addedCount++;
        }
    });

    if (addedCount > 0) renderTargetTags();
    else alert("이미 명단에 모두 추가된 학생들입니다.");
};

window.removeTarget = function(userId) {
    selectedTargetMap.delete(userId);
    renderTargetTags();
};

window.clearAllTargets = function() {
    selectedTargetMap.clear();
    renderTargetTags();
};

function renderTargetTags() {
    const container = document.getElementById('selectedTargetTags');
    const countEl = document.getElementById('targetCountText');

    countEl.innerText = selectedTargetMap.size;
    container.innerHTML = '';

    if (selectedTargetMap.size === 0) {
        container.innerHTML = '<span class="empty-msg" style="padding:0; font-size:0.9rem;">위에서 그룹이나 학생을 선택한 후 [추가]를 눌러주세요.</span>';
        return;
    }

    selectedTargetMap.forEach((info, uid) => {
        const safeName = escapeHtml(info.name || '이름없음');
        container.innerHTML += `
            <div class="target-tag">
                <span style="color:#93c5fd; font-size:0.75rem; margin-right:4px;">[${info.tag}]</span> ${safeName}
                <span class="remove-tag" onclick="removeTarget('${uid}')">&times;</span>
            </div>
        `;
    });
}

let globalAlimtalkTemplates = [];

async function fetchAlimtalkTemplates() {
    try {
        const response = await apiFetch(NOTI_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_get_alimtalk_templates' })
        });
        const data = await response.json();
        globalAlimtalkTemplates = data.templates || [];

        const selectEl = document.getElementById('alimtalkTemplateType');
        if (selectEl) {
            selectEl.innerHTML = '';
            globalAlimtalkTemplates.forEach(tpl => {
                selectEl.innerHTML += `<option value="${tpl.type}">${tpl.name}</option>`;
            });
            updateTemplatePreview();
        }
    } catch(e) {
        console.error("템플릿 목록 로드 실패:", e);
        const selectEl = document.getElementById('alimtalkTemplateType');
        if (selectEl) selectEl.innerHTML = '<option value="">불러오기 실패</option>';
    }
}

window.updateTemplatePreview = function() {
    const selectedType = document.getElementById('alimtalkTemplateType').value;
    const previewBox = document.getElementById('templatePreviewBox');
    if (!previewBox) return;

    if (selectedType === 'CUSTOM') {
        const content = (document.getElementById('noticeContent')?.value || '').trim();
        previewBox.innerText = content || '✏️ [공지 내용] 란에 내용을 입력하면 그대로 카카오톡으로 발송됩니다.\n#{이름} 입력 시 학생 이름으로 자동 치환됩니다.';
    } else {
        const matchedTemplate = globalAlimtalkTemplates.find(t => t.type === selectedType);
        previewBox.innerText = matchedTemplate ? matchedTemplate.preview : "템플릿 형식을 불러올 수 없습니다.";
    }
};

window.toggleAlimtalkOptions = function() {
    const isChecked = document.getElementById('useAlimtalk').checked;
    document.getElementById('alimtalkTemplateArea').style.display = isChecked ? 'block' : 'none';
    document.getElementById('marketingOnlyLabel').style.display = isChecked ? 'inline-block' : 'none';

    if (isChecked) {
        if (globalAlimtalkTemplates.length === 0) {
            fetchAlimtalkTemplates();
        } else {
            updateTemplatePreview();
        }
    }
};

async function sendAdminNotice() {
    if (selectedTargetMap.size === 0) return alert("발송할 대상을 한 명 이상 명단에 추가해주세요.");

    const useAlimtalkElement = document.getElementById('useAlimtalk');
    const templateTypeElement = document.getElementById('alimtalkTemplateType');

    const useAlimtalk = useAlimtalkElement ? useAlimtalkElement.checked : false;
    const templateType = templateTypeElement ? templateTypeElement.value : 'REMIND';
    const isMarketing = true;

    const targetUserIds = Array.from(selectedTargetMap.keys());
    const title = document.getElementById('noticeTitle').value.trim();
    const content = document.getElementById('noticeContent').value.trim();
    const adminName = localStorage.getItem('userName') || '관리자';

    if (!title || !content) return alert("제목과 내용을 모두 입력해주세요.");

    const confirmMsg = `총 ${targetUserIds.length}명에게 공지를 발송합니다.\n${useAlimtalk ? '📱 카카오 알림톡 동시 발송 (마케팅 동의자 한정)\n' : ''}진행하시겠습니까?`;
    if (!confirm(confirmMsg)) return;

    const targetNamesList = Array.from(selectedTargetMap.values()).map(info => info.name);
    let targetNamesDisplay = targetNamesList.slice(0, 5).join(', ');
    if (targetNamesList.length > 5) targetNamesDisplay += ` 외 ${targetNamesList.length - 5}명`;

    try {
        const response = await apiFetch(NOTI_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_manual_notice',
                data: {
                    targetUserIds: targetUserIds,
                    title: title,
                    content: content,
                    targetNamesDisplay: targetNamesDisplay,
                    senderName: adminName,
                    useAlimtalk: useAlimtalk,
                    templateType: templateType,
                    isMarketing: isMarketing
                }
            })
        });

        const result = await response.json();

        let alertMessage = "✅ 앱 내 공지 발송이 완료되었습니다.";

        if (useAlimtalk && result.solapiReport) {
            const report = result.solapiReport;
            alertMessage += `\n\n📱 카카오 알림톡/친구톡 발송 결과\n- 성공: ${report.successCount}건\n- 실패: ${report.failCount}건`;

            if (report.failCount > 0 && report.errors && report.errors.length > 0) {
                alertMessage += `\n\n🚨 주요 실패 사유:\n${report.errors.slice(0, 3).join('\n')}`;
                if (report.errors.length > 3) alertMessage += `\n... 외 ${report.errors.length - 3}건`;
            }
        }

        alert(alertMessage);

        document.getElementById('noticeTitle').value = '';
        document.getElementById('noticeContent').value = '';
        if (useAlimtalkElement) useAlimtalkElement.checked = false;

        if (typeof toggleAlimtalkOptions === 'function') toggleAlimtalkOptions();
        if (typeof clearAllTargets === 'function') clearAllTargets();

        showNotiMenu('sent');
    } catch(e) {
        if (e.message !== "Auth expired") alert("서버 통신 중 오류가 발생했습니다.");
        console.error("Notice Send Error:", e);
    }
}

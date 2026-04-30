// js/admin/qna.js
// Q&A 질의 관리 로직
// QNA_API_URL, NOTI_API_URL, apiFetch, escapeHtml 은 admin_ui.js / auth.js 에서 제공

async function fetchQnaBadgeCount() {
    try {
        const response = await apiFetch(QNA_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_get_all_qna' })
        });
        const data = await response.json();
        const qnaList = data.qnaList || [];

        const waitingCount = qnaList.filter(q => q.status === 'waiting').length;

        const badge = document.getElementById('qnaBadge');
        if (badge) {
            if (waitingCount > 0) {
                badge.style.display = 'inline-block';
                badge.innerText = waitingCount;
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) {
        console.error("QNA Badge Fetch Error:", e);
    }
}

async function loadAllQna() {
    const tbody = document.getElementById('qnaListBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">데이터를 불러오는 중...</td></tr>';

    try {
        const response = await apiFetch(QNA_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_all_qna' }) });
        const data = await response.json();
        allQnaData = data.qnaList || [];
        renderQnaList();

        updateQnaBadgeFromData();
    } catch (e) { if (e.message !== "Auth expired") alert("질의 목록을 불러오는데 실패했습니다."); }
}

function updateQnaBadgeFromData() {
    const waitingCount = allQnaData.filter(q => q.status === 'waiting').length;
    const badge = document.getElementById('qnaBadge');
    if (badge) {
        badge.style.display = waitingCount > 0 ? 'inline-block' : 'none';
        badge.innerText = waitingCount;
    }
}

async function markAsRead(targetUserId, qnaId) {
    if(!confirm("이 문의를 '읽음' 상태로 변경하시겠습니까?")) return;
    try {
        await apiFetch(QNA_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_mark_qna_read', data: { targetUserId, qnaId } }) });
        const item = allQnaData.find(q => q.qnaId === qnaId);
        if(item) item.status = 'read';

        renderQnaList();
        updateQnaBadgeFromData();
    } catch(e) {
        if (e.message !== "Auth expired") alert("상태 업데이트에 실패했습니다.");
    }
}

function renderQnaList() {
    const tbody = document.getElementById('qnaListBody'); if (!tbody) return;
    tbody.innerHTML = '';
    const filtered = allQnaData.filter(q => q.status === currentQnaFilter);

    if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty-msg" style="text-align:center; padding:30px;">해당 상태의 문의가 없습니다.</td></tr>'; return; }

    filtered.forEach(q => {
        const tr = document.createElement('tr'); const dateStr = new Date(q.createdAt).toLocaleDateString();
        let actionBtn = '';
        if (q.status === 'waiting') actionBtn = `<button onclick="markAsRead('${escapeHtml(q.userid)}', '${q.qnaId}')" style="background:#f59e0b; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">읽음 처리</button>`;
        else if (q.status === 'read') actionBtn = `<button onclick="openReplyModal('${escapeHtml(q.userid)}', '${q.qnaId}')" style="background:#3b82f6; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">답변하기</button>`;
        else actionBtn = `<span style="color:#10b981; font-weight:bold;">완료됨</span>`;

        let phoneStr = '-';
        if (q.userPhone && q.userPhone.length >= 4) phoneStr = q.userPhone.slice(-4);

        tr.innerHTML = `
            <td data-label="상태">${getQnaStatusBadge(q.status)}</td>
            <td data-label="학생명">
                <div style="display:flex; align-items:center; gap:6px;">
                    <strong>${escapeHtml(q.userName)}</strong>
                    <button onclick="goToStudentDetail('${escapeHtml(q.userid)}')(event)" style="background:none; border:none; color:#3b82f6; cursor:pointer; padding:0; font-size:0.9rem;" title="학생 상세 정보 보기"><i class="fas fa-search-plus"></i></button>
                </div>
                <span style="font-size:0.8rem; color:#94a3b8;">(뒷자리: ${escapeHtml(phoneStr)})</span>
            </td>
            <td data-label="제목" style="cursor:pointer;" onclick="openReplyModal('${escapeHtml(q.userid)}', '${q.qnaId}', true)">
                <strong>${escapeHtml(q.title)}</strong>
                <div style="font-size:0.85rem; color:#64748b; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:300px;">${escapeHtml(q.content)}</div>
            </td>
            <td data-label="등록일">${dateStr}</td>
            <td data-label="관리">${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function getQnaStatusBadge(status) {
    if (status === 'waiting') return '<span style="background:#fef2f2; color:#ef4444; padding:3px 8px; border-radius:10px; font-size:0.8rem; font-weight:bold;">안읽음</span>';
    if (status === 'read') return '<span style="background:#fff7ed; color:#f97316; padding:3px 8px; border-radius:10px; font-size:0.8rem; font-weight:bold;">미응답</span>';
    return '<span style="background:#ecfdf5; color:#10b981; padding:3px 8px; border-radius:10px; font-size:0.8rem; font-weight:bold;">완료</span>';
}

function openReplyModal(targetUserId, qnaId, isViewOnly = false) {
    const item = allQnaData.find(q => q.qnaId === qnaId);
    if (!item) return;

    currentReplyTarget = { targetUserId, qnaId };

    document.getElementById('replyModalTitle').innerText = item.title;
    document.getElementById('replyModalContent').innerText = item.content;

    const detailLinkBtn = document.getElementById('replyModalStudentLink');
    if (detailLinkBtn) {
        detailLinkBtn.onclick = function() {
            window.open(`/admin/detail?uid=${targetUserId}`, '_blank');
        };
    }

    const replyInput = document.getElementById('replyInput');
    const submitBtn = document.getElementById('replySubmitBtn');
    const macroWrapper = document.getElementById('macroWrapper');

    if (item.status === 'done' || isViewOnly) {
        replyInput.value = item.answer || "(답변 내용 없음)";
        replyInput.disabled = true;
        if (submitBtn) submitBtn.style.display = 'none';
        if (macroWrapper) macroWrapper.style.display = 'none';
    } else {
        replyInput.value = '';
        replyInput.disabled = false;
        if (submitBtn) submitBtn.style.display = 'block';
        if (macroWrapper) macroWrapper.style.display = 'block';
    }

    const modal = document.getElementById('reply-modal');
    if (modal) modal.classList.remove('hidden');
}

async function submitReply() {
    const answer = document.getElementById('replyInput').value.trim();
    if (!answer) { alert("답변 내용을 입력해주세요."); return; }
    if (!currentReplyTarget || !confirm("답변을 전송하시겠습니까?\n전송 후에는 수정할 수 없으며 학생에게 노출됩니다.")) return;

    try {
        await apiFetch(QNA_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_reply_qna', data: { targetUserId: currentReplyTarget.targetUserId, qnaId: currentReplyTarget.qnaId, answer: answer } })
        });

        const qnaTitle = document.getElementById('replyModalTitle').innerText;
        await apiFetch(NOTI_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_notify_qna_reply', data: { targetUserId: currentReplyTarget.targetUserId, qnaTitle: qnaTitle } })
        }).catch(e => {});

        alert("답변이 전송되었습니다.");

        const item = allQnaData.find(q => q.qnaId === currentReplyTarget.qnaId);
        if(item) {
            item.status = 'done';
            item.answer = answer;
        }

        closeReplyModal();
        renderQnaList();
    } catch(e) {
        if (e.message !== "Auth expired") alert("답변 전송 중 문제가 발생했습니다. 작성하신 내용을 복사한 뒤 창을 새로고침 해주세요.");
    }
}

function closeReplyModal() { const modal = document.getElementById('reply-modal'); if (modal) modal.classList.add('hidden'); currentReplyTarget = null; }

const QNA_MACROS = {
    'tutor_delay': "안녕하세요, 학생님.\n현재 요청하신 과목과 성향에 가장 적합한 튜터님을 꼼꼼히 매칭하는 중이라 배정이 조금 지연되고 있습니다.\n최대 1~2일 내로 최적의 튜터님을 배정해 드릴 예정이니 조금만 양해 부탁드립니다.",
    'report_guide': "안녕하세요! 주간 보고서 작성법 안내드립니다.\n매주 정해진 요일 자정까지 [마이페이지] > [보고서 작성] 탭에서 이번 주 학습 내용과 튜터님께 바라는 피드백을 50자 이상으로 남겨주시면 됩니다.",
    'refund': "안녕하세요. 환불 규정에 대해 안내해 드립니다.\n결제 후 7일 이내이며, 실제 서비스(튜터 매칭 및 상담) 이용 이력이 없는 경우에 한해 전액 환불이 가능합니다.\n자세한 사항은 이용약관을 참고해 주시거나 추가 문의 남겨주세요.",
    'polite_wait': "안녕하세요! 문의하신 내용 확인하였습니다.\n해당 건은 튜터님 및 내부 운영진과 내용 확인 후 정확한 안내를 드리기 위해 시간이 조금 소요될 수 있습니다.\n확인되는 대로 빠르게 다시 답변드리겠습니다."
};

window.applyMacro = function(type) {
    const replyInput = document.getElementById('replyInput');
    if (!replyInput || !QNA_MACROS[type]) return;

    if (replyInput.value.trim() !== "") {
        if (!confirm("작성 중인 내용이 지워지고 매크로 답변으로 교체됩니다. 계속하시겠습니까?")) {
            return;
        }
    }

    replyInput.value = QNA_MACROS[type];
    replyInput.focus();
};

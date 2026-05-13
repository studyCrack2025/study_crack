// js/admin/tutors.js
// 튜터 관리 — 통계 조회, 탈퇴 승인, 학생 목록 렌더링
// ADMIN_API_URL, NOTI_API_URL, apiFetch, escapeHtml, getTierBadgeHTML 은
// admin_ui.js / students.js / auth.js 에서 제공

async function loadTutorStats() {
    const container = document.getElementById('tutorListBody');
    container.innerHTML = '<p style="text-align:center;">데이터를 불러오는 중...</p>';

    try {
        const response = await apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_tutor_stats' }) });
        const data = await response.json();

        container.innerHTML = '';
        if (data.tutors.length === 0) { container.innerHTML = '<p style="text-align:center;">등록된 튜터가 없습니다.</p>'; return; }

        data.tutors.forEach(t => {
            const card = document.createElement('div'); card.className = 'tutor-card';

            // 탈퇴 요청 상태 UI
            let withdrawalUI = '';
            if (t.withdrawalStatus === 'pending') {
                withdrawalUI = `<div style="margin-top:15px; padding:12px; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; display:flex; justify-content:space-between; align-items:center;"><span style="color:#991b1b; font-size:0.9rem;"><strong>⚠️ 파트너십 해지(탈퇴) 요청 대기 중</strong></span><button onclick="approveTutorWithdrawal('${t.userid}')" style="padding:6px 12px; background:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer; font-size:0.85rem; font-weight:bold;">요청 승인하기</button></div>`;
            } else if (t.withdrawalStatus === 'approved') {
                withdrawalUI = `<div style="margin-top:15px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;"><span style="color:#475569; font-size:0.9rem;"><strong>✅ 탈퇴 승인 완료</strong> (튜터의 최종 확인 및 탈퇴 대기 중)</span></div>`;
            }

            // 정산(Settlement) 내역 — 금액은 백엔드(admin_get_tutor_stats)에서 계산하여 반환
            const PAY_STATUS_COLORS = { '미지급': '#ef4444', '지급대기': '#f59e0b', '지급완료': '#10b981' };
            const MONTH_MAP = { "Jan":"1월", "Feb":"2월", "Mar":"3월", "Apr":"4월", "May":"5월", "Jun":"6월", "Jul":"7월", "Aug":"8월", "Sep":"9월", "Oct":"10월", "Nov":"11월", "Dec":"12월" };

            let settlementUI = '';
            if (t.settlements && Object.keys(t.settlements).length > 0) {
                const months = Object.keys(t.settlements).sort((a, b) => b.localeCompare(a)).slice(0, 3);

                const listItems = months.map(month => {
                    const sData = t.settlements[month];
                    const weeklyCount = Number(sData.weeklyCount ?? (Array.isArray(sData.weekly) ? sData.weekly.length : 0));
                    const proCount    = Number(sData.proCount    ?? (Array.isArray(sData.pro)    ? sData.pro.length    : 0));
                    const weeklyAmt   = Number(sData.weeklyAmount || 0).toLocaleString();
                    const proAmt      = Number(sData.proAmount    || 0).toLocaleString();
                    const totalAmt    = Number(sData.totalAmount  || 0).toLocaleString();
                    const payStatus   = sData.payStatus || '미지급';
                    const statusColor = PAY_STATUS_COLORS[payStatus] || '#64748b';

                    const yy = "20" + month.substring(0, 2);
                    const mStr = month.substring(2);
                    const readableMonth = `${yy}년 ${MONTH_MAP[mStr] || mStr}`;

                    return `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed #e2e8f0; font-size:0.85rem; gap:8px; flex-wrap:wrap;">
                        <span style="color:#475569; font-weight:bold; min-width:80px;">${readableMonth}</span>
                        <span style="color:#2563eb;">주간 ${weeklyCount}건(${weeklyAmt}원) + PRO ${proCount}건(${proAmt}원) = <strong>${totalAmt}원</strong></span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="color:${statusColor}; font-weight:bold; font-size:0.8rem;">${payStatus}</span>
                            <select onchange="setTutorPayStatus('${escapeHtml(t.userid)}', '${month}', this.value, this)"
                                style="font-size:0.78rem; padding:3px 6px; border:1px solid #e2e8f0; border-radius:4px; cursor:pointer;">
                                <option value="미지급"  ${payStatus === '미지급'  ? 'selected' : ''}>미지급</option>
                                <option value="지급대기" ${payStatus === '지급대기' ? 'selected' : ''}>지급대기</option>
                                <option value="지급완료" ${payStatus === '지급완료' ? 'selected' : ''}>지급완료</option>
                            </select>
                        </div>
                    </div>`;
                }).join('');

                settlementUI = `
                    <div style="margin-top:15px; padding:15px; background:white; border:1px solid #e2e8f0; border-radius:8px;">
                        <p style="margin:0 0 10px 0; font-weight:bold; color:#1e293b; font-size:0.9rem;">💰 급여 명세 (최근 3개월)</p>
                        ${listItems}
                    </div>
                `;
            } else {
                settlementUI = `
                    <div style="margin-top:15px; padding:15px; background:white; border:1px solid #e2e8f0; border-radius:8px; text-align:center;">
                        <p style="margin:0; font-size:0.85rem; color:#94a3b8;">아직 기록된 보고서 작성 실적이 없습니다.</p>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="tutor-header" onclick="toggleTutorDetail(this)">
                    <div class="tutor-info-main"><span class="tutor-badge">Tutor</span><span class="tutor-name">${escapeHtml(t.nickname)}</span><span style="font-size:0.85rem; color:#94a3b8; margin-left:8px;">(총 ${t.totalStudents}명)</span>${t.withdrawalStatus === 'pending' ? '<span style="color:#ef4444; font-size:0.8rem; font-weight:bold; margin-left:5px;">[탈퇴요청]</span>' : ''}</div>
                    <div class="tutor-arrow"><i class="fas fa-chevron-down"></i></div>
                </div>
                <div class="tutor-details">
                    <div class="tutor-grid" style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px dashed #e2e8f0;">
                        <div><p><strong>본명:</strong> ${escapeHtml(t.name) || '-'}</p><p><strong>학교:</strong> ${escapeHtml(t.school) || '-'}</p><p><strong>계약시작일:</strong> ${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</p></div>
                        <div><p><strong>최대 학생 수:</strong> <span style="color:#2563eb; font-weight:bold;">${t.maxStudents ? t.maxStudents + '명' : '미설정'}</span></p><p><strong>주 최대 시간:</strong> <span style="color:#2563eb; font-weight:bold;">${t.maxHours ? t.maxHours + '시간' : '미설정'}</span></p><p><strong>입금 계좌:</strong> ${escapeHtml(t.accountNumber) || '<span style="color:#94a3b8">미등록</span>'}</p></div>
                    </div>

                    ${settlementUI}

                    ${withdrawalUI}

                    <div class="tutor-tier-accordions" style="${t.withdrawalStatus ? 'margin-top:20px;' : ''}">
                        <div class="tier-acc-group"><div class="tier-acc-header pro" onclick="toggleTierList(this)"><span>🔥 PRO 학생</span><strong>${t.proCount}명 <i class="fas fa-chevron-down"></i></strong></div><div class="tier-acc-content">${generateStudentListHtml(t.proStudents, '현재 담당 중인 PRO 학생이 없습니다.', 'pro')}</div></div>
                        <div class="tier-acc-group"><div class="tier-acc-header std" onclick="toggleTierList(this)"><span>📘 STANDARD 학생</span><strong>${t.stdCount}명 <i class="fas fa-chevron-down"></i></strong></div><div class="tier-acc-content">${generateStudentListHtml(t.stdStudents, '현재 담당 중인 STANDARD 학생이 없습니다.', 'standard')}</div></div>
                        <div class="tier-acc-group"><div class="tier-acc-header exp" onclick="toggleTierList(this)"><span>⏳ 구독 만료 / 대기 학생</span><strong>${t.freeCount}명 <i class="fas fa-chevron-down"></i></strong></div><div class="tier-acc-content">${generateStudentListHtml(t.freeStudents, '만료되거나 대기 중인 학생이 없습니다.', 'free')}</div></div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch(e) {
        if (e.message !== "Auth expired") container.innerHTML = '<p style="text-align:center; color:red;">오류 발생</p>';
    }
}

window.approveTutorWithdrawal = async function(tutorId) {
    if (event) event.stopPropagation();
    if (!confirm("이 튜터의 파트너십 해지(탈퇴)를 승인하시겠습니까?\n승인 시 튜터에게 알림이 전송되며, 튜터가 직접 최종 탈퇴 처리를 진행하게 됩니다.")) return;

    try {
        await apiFetch(NOTI_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_approve_withdrawal', data: { tutorId: tutorId } }) });
        alert("탈퇴 승인이 완료되었습니다. 해당 튜터에게 알림이 발송되었습니다.");
        loadTutorStats();
    } catch (e) { if (e.message !== "Auth expired") alert("서버 통신 중 오류가 발생했습니다."); }
};

function reportBadge(status) {
    if (!status) return '<span class="report-badge none">-</span>';
    if (status.tutorSubmitted) return '<span class="report-badge done">✅ 완료</span>';
    if (status.studentSubmitted) return '<span class="report-badge pending">🕐 피드백 대기</span>';
    return '<span class="report-badge missing">❌ 미작성</span>';
}

function generateStudentListHtml(students, emptyMsg, tier = 'free') {
    if (!students || students.length === 0) return `<div class="tier-student-empty">${emptyMsg}</div>`;
    const showWeekly = tier === 'standard' || tier === 'pro';
    const showPro = tier === 'pro';

    let headers = '<th>이름</th><th>특이사항 여부</th><th>최초 가입일</th><th>마지막 결제일</th>';
    if (showWeekly) headers += '<th>주간 보고서 (이번 주)</th>';
    if (showPro)    headers += '<th>PRO 보고서 (2주 이내)</th>';
    headers += '<th>누적 결제 이력</th>';

    let html = `<div class="table-responsive"><table class="tier-student-table"><thead><tr>${headers}</tr></thead><tbody>`;

    students.forEach(s => {
        const jDate = s.joinDate ? new Date(s.joinDate).toLocaleDateString() : '-';
        const lDate = s.lastPayDate ? new Date(s.lastPayDate).toLocaleDateString() : '<span style="color:#ef4444;">결제 없음</span>';
        const pays = Object.entries(s.payCounts || {}).map(([prod, cnt]) => `<span class="pay-badge">${prod} ${cnt}회</span>`).join(' ') || '-';

        let urgentHtml = '<span style="color:#cbd5e1;">-</span>';
        let rowClass = '';

        if (s.urgentStatus && s.urgentStatus.type) {
            if (s.urgentStatus.type === 'report') {
                urgentHtml = '<span class="urgent-badge report">보고서 작성 불가</span>';
                rowClass = 'urgent-row-report';
            } else if (s.urgentStatus.type === 'transfer') {
                urgentHtml = '<span class="urgent-badge transfer">소속 이동 요청</span>';
                rowClass = 'urgent-row-transfer';
            } else if (s.urgentStatus.type === 'etc') {
                const safeText = escapeHtml(s.urgentStatus.text || '');
                urgentHtml = `<span class="urgent-badge etc">기타 긴급</span> <span class="urgent-etc-text" onclick="toggleUrgentText(this, '${safeText}')">...</span>`;
                rowClass = 'urgent-row-etc';
            }
        }

        let row = `<tr class="${rowClass}">
            <td data-label="이름"><strong>${escapeHtml(s.name)}</strong></td>
            <td data-label="특이사항 여부">${urgentHtml}</td>
            <td data-label="최초 가입일">${jDate}</td>
            <td data-label="마지막 결제일">${lDate}</td>`;

        if (showWeekly) row += `<td data-label="주간 보고서">${reportBadge(s.weeklyStatus)}</td>`;
        if (showPro)    row += `<td data-label="PRO 보고서">${reportBadge(s.proStatus)}</td>`;

        row += `<td data-label="결제 이력">${pays}</td></tr>`;
        html += row;
    });

    html += `</tbody></table></div>`;
    return html;
}

window.toggleUrgentText = function(el, fullText) {
    if (el.innerText === '...') {
        el.innerText = fullText;
        el.style.backgroundColor = '#fff';
        el.style.border = '1px solid #eab308';
    } else {
        el.innerText = '...';
        el.style.backgroundColor = '#e2e8f0';
        el.style.border = 'none';
    }
};

window.toggleTutorDetail = function(el) {
    el.classList.toggle('active'); const details = el.nextElementSibling; details.classList.toggle('open');
    if(details.classList.contains('open')) details.style.maxHeight = 'none'; else details.style.maxHeight = null;
};

window.toggleTierList = function(headerEl) {
    if (event) event.stopPropagation();
    headerEl.classList.toggle('active'); const content = headerEl.nextElementSibling;
    if (content.style.maxHeight) content.style.maxHeight = null; else content.style.maxHeight = content.scrollHeight + "px";
};

window.toggleNoticeTree = function(iconEl) {
    const childrenBlock = iconEl.closest('.tree-group').querySelector('.tree-children');
    if (childrenBlock.style.display === 'none') { childrenBlock.style.display = 'grid'; iconEl.style.transform = 'rotate(180deg)'; }
    else { childrenBlock.style.display = 'none'; iconEl.style.transform = 'rotate(0deg)'; }
};

window.setTutorPayStatus = async function(tutorId, month, payStatus, selectEl) {
    if (event) event.stopPropagation();
    const originalValue = selectEl.dataset.original || selectEl.value;
    selectEl.disabled = true;
    try {
        const res = await apiFetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_set_tutor_pay_status', tutorId, month, payStatus })
        });
        if (!res.ok) throw new Error('서버 오류');
        selectEl.dataset.original = payStatus;
        const statusSpan = selectEl.previousElementSibling;
        const PAY_STATUS_COLORS = { '미지급': '#ef4444', '지급대기': '#f59e0b', '지급완료': '#10b981' };
        if (statusSpan) { statusSpan.textContent = payStatus; statusSpan.style.color = PAY_STATUS_COLORS[payStatus] || '#64748b'; }
    } catch(e) {
        if (e.message !== 'Auth expired') alert('지급 상태 저장 중 오류가 발생했습니다.');
        selectEl.value = originalValue;
    } finally {
        selectEl.disabled = false;
    }
};

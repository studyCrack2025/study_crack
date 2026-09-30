// js/admin/matching.js
// 튜터 매칭 시스템 로직
// ADMIN_API_URL, apiFetch, escapeHtml, getTierBadgeHTML 은
// admin_ui.js / students.js / auth.js 에서 제공

let globalUnmatchedStudents = [];
let globalTutorsForMatch = [];
let globalAllStudentsForMatch = [];

function switchMatchingTab(tabName) {
    document.getElementById('matchTab_new').style.display = tabName === 'new' ? 'block' : 'none';
    document.getElementById('matchTab_change').style.display = tabName === 'change' ? 'block' : 'none';
    document.getElementById('btn-match-new').classList.toggle('active', tabName === 'new');
    document.getElementById('btn-match-change').classList.toggle('active', tabName === 'change');
}

async function loadMatchingData(isSilent = false) {
    const adminId = localStorage.getItem('userId');
    if (!isSilent) document.getElementById('newMatchList').innerHTML = '<p>데이터를 불러오는 중...</p>';

    try {
        const [tutorRes, studentRes] = await Promise.all([
            apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_tutor_list' }) }),
            apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_search_list', userId: adminId, data: {} }) })
        ]);

        const tutorData = await tutorRes.json(); const studentData = await studentRes.json();
        if (!tutorRes.ok || !studentRes.ok) throw new Error('목록을 불러오지 못했습니다. 다시 시도해주세요.');
        globalTutorsForMatch = (tutorData.tutors || []).filter(t => t.tutorId);
        let allUsers = Array.isArray(studentData) ? studentData : (studentData.students || studentData.Items || []);
        globalAllStudentsForMatch = allUsers.filter(u => u.role !== 'admin' && u.role !== 'tutor');

        globalUnmatchedStudents = globalAllStudentsForMatch.filter(s => {
            if (s.assignedTutorId) return false;
            if (s.tutorName) return true;
            const tier = (getTierBadgeHTML(s).match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
            const tierLower = tier.toLowerCase();
            return tierLower === 'standard' || tierLower === 'pro';
        });

        const badge = document.getElementById('matchingBadge'); const countText = document.getElementById('newMatchCount');
        if (badge && countText) {
            countText.innerText = `(${globalUnmatchedStudents.length})`;
            if (globalUnmatchedStudents.length > 0) { badge.style.display = 'inline-block'; badge.innerText = globalUnmatchedStudents.length; }
            else { badge.style.display = 'none'; }
        }

        if (!isSilent) { renderNewMatchingList(); initTutorChangeSelects(); }
    } catch (e) { console.error("Matching Data Load Error:", e); }
}

function renderNewMatchingList() {
    const container = document.getElementById('newMatchList');
    container.innerHTML = '';

    if (globalUnmatchedStudents.length === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #94a3b8; background: #f8fafc; border-radius: 8px;">현재 신규 매칭 대기 중인 학생이 없습니다.</div>';
        return;
    }

    const tutorOptions = globalTutorsForMatch.map(t => `<option value="${escapeHtml(t.tutorId)}">${escapeHtml(t.nickname)} (${escapeHtml(t.name)}) - 배정 ${Number(t.totalStudents) || 0}명</option>`).join('');

    globalUnmatchedStudents.forEach(s => {
        const tierBadge = getTierBadgeHTML(s);
        const card = document.createElement('div');
        card.className = 'match-card';
        card.style.cssText = "background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 15px;";

        card.innerHTML = `
            <div class="match-card-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                <div>
                    <h4 class="match-card-name" style="margin:0 0 5px 0; font-size:1.1rem; color:#1e293b;">${escapeHtml(s.name)}</h4>
                    <div class="match-card-date" style="font-size:0.85rem; color:#94a3b8;">가입일: ${new Date(s.createdAt).toLocaleDateString()}</div>
                    ${s.tutorName ? `<p>기존 표시명: ${escapeHtml(s.tutorName)} · 실제 담당자를 확인 후 배정해주세요.</p>` : ''}
                </div>
                <div>${tierBadge}</div>
            </div>
            <div class="match-select-box" style="display:flex; gap:10px;">
                <select id="select_tutor_${s.userid}" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:4px; font-size:0.9rem;">
                    <option value="">튜터 선택...</option>
                    ${tutorOptions}
                </select>
                <button class="match-btn" onclick="executeMatching('${s.userid}', false)" style="background:#3b82f6; color:white; border:none; padding:8px 15px; border-radius:4px; font-weight:bold; cursor:pointer;">배정하기</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function initTutorChangeSelects() {
    const oldSel = document.getElementById('changeOldTutor'); const newSel = document.getElementById('changeNewTutor');
    let options = '<option value="">선택하세요</option>';
    globalTutorsForMatch.forEach(t => { options += `<option value="${escapeHtml(t.tutorId)}">${escapeHtml(t.nickname)} (${escapeHtml(t.name)})</option>`; });
    oldSel.innerHTML = options; newSel.innerHTML = options;
}

function updateChangeStudentList() {
    const oldTutorName = document.getElementById('changeOldTutor').value; const stuSel = document.getElementById('changeStudent');
    if (!oldTutorName) { stuSel.innerHTML = '<option value="">먼저 튜터를 선택하세요</option>'; return; }
    const myStus = globalAllStudentsForMatch.filter(s => s.assignedTutorId === oldTutorName);
    if (myStus.length === 0) { stuSel.innerHTML = '<option value="">배정된 학생이 없습니다.</option>'; return; }

    let stuOptions = '<option value="">학생을 선택하세요</option>';
    myStus.forEach(s => {
        const tier = (getTierBadgeHTML(s).match(/>(.*?)<\/span>/) || [])[1] || 'FREE';
        stuOptions += `<option value="${s.userid}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)} (${tier})</option>`;
    });
    stuSel.innerHTML = stuOptions;
}

function confirmTutorChange() {
    const oldTutor = document.getElementById('changeOldTutor').value; const stuSel = document.getElementById('changeStudent');
    const studentId = stuSel.value; const studentName = stuSel.options[stuSel.selectedIndex]?.text || ''; const newTutor = document.getElementById('changeNewTutor').value;

    if (!oldTutor || !studentId || !newTutor) return alert("모든 항목을 선택해 주세요.");
    if (oldTutor === newTutor) return alert("현재 튜터와 변경할 튜터가 동일합니다.");

    const oldLabel = document.getElementById('changeOldTutor').selectedOptions[0]?.text || '';
    const newLabel = document.getElementById('changeNewTutor').selectedOptions[0]?.text || '';
    if (confirm(`🚨 [튜터 변경 최종 확인]\n\n학생: ${studentName}\n기존 튜터: ${oldLabel}\n변경 튜터: ${newLabel}\n\n정말로 튜터를 변경하시겠습니까? 이 작업은 즉시 반영됩니다.`)) {
        executeMatching(studentId, true, newTutor, oldTutor);
    }
}

async function executeMatching(studentId, isChange, newTutorArg = null, oldTutorArg = null) {
    const newTutorId = isChange ? newTutorArg : document.getElementById(`select_tutor_${studentId}`).value;
    if (!newTutorId) return alert("튜터를 선택해주세요.");
    const student = globalAllStudentsForMatch.find(s => s.userid === studentId);
    if (!student) return alert('학생 목록을 새로고침해주세요.');
    const expectedRevision = student.tutorAssignmentRevision ?? 0;
    const adminId = localStorage.getItem('userId');

    try {
        const response = await apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_assign_tutor', userId: adminId, data: { targetUserId: studentId, newTutorId, expectedRevision } }) });
        if (!response.ok) { alert(response.status === 409 ? '담당 정보가 변경되었습니다. 새 목록에서 다시 확인해주세요.' : '배정하지 못했습니다. 계정 상태와 선택 항목을 확인해주세요.'); await loadMatchingData(); return; }
        alert(isChange ? "튜터가 성공적으로 변경되었습니다." : "튜터 배정이 완료되었습니다.");
        if (isChange) { document.getElementById('changeOldTutor').value = ''; document.getElementById('changeStudent').innerHTML = '<option value="">먼저 튜터를 선택하세요</option>'; document.getElementById('changeNewTutor').value = ''; }
        await loadMatchingData();
    } catch(e) { console.error(e); if (e.message !== "Auth expired") alert("통신 오류 발생"); }
}

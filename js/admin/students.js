// js/admin/students.js
// 학생 관리 — 검색, 필터링, CSV 내보내기, 일괄 선택 로직
// ADMIN_API_URL, apiFetch, escapeHtml, getTierBadgeHTML, decodePromoCodeToMbti,
// currentStudentList, Store 는 admin_ui.js 또는 shared/utils.js 에서 제공

async function populateTutorFilter() {
    try {
        const response = await apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_get_tutor_stats' }) });
        const data = await response.json();
        const filterEl = document.getElementById('filterTutor');
        if(filterEl && data.tutors) {
            data.tutors.forEach(t => {
                filterEl.innerHTML += `<option value="${escapeHtml(t.nickname)}">${escapeHtml(t.nickname)} 선생님</option>`;
            });
        }
    } catch(e) { console.error("Tutor filter load failed", e); }
}

async function searchStudents() {
    const adminId = localStorage.getItem('userId');
    const type = document.getElementById('searchType').value;
    const keyword = document.getElementById('searchInput').value || "";
    const filterTier = document.getElementById('filterTier').value;
    const filterTutor = document.getElementById('filterTutor').value;
    const tbody = document.getElementById('studentListBody');

    tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>안전하게 데이터를 조회 중입니다...</td></tr>";

    try {
        // MBTI 검색은 백엔드에 전체 조회 요청 후 클라이언트에서 필터링
        const apiSearchType = type === 'mbti' ? 'name' : type;
        const apiKeyword    = type === 'mbti' ? '' : keyword;
        const response = await apiFetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_search', userId: adminId, data: { searchType: apiSearchType, keyword: apiKeyword } })
        });

        const rawData = await response.json();
        let students = Array.isArray(rawData) ? rawData : (rawData.students || []);

        // 유령 계정 및 관리자 제외
        students = students.filter(s => {
            if (s.role === 'admin' || s.role === 'tutor') return false;
            const uid = s.userid || "";
            if ((uid.startsWith("TEMP") || uid.startsWith("VERIFIED")) && (!s.createdAt || String(s.createdAt).trim() === "")) return false;
            return true;
        });

        if (keyword.trim() === "") {
            const totalStudentsEl = document.getElementById('totalStudents');
            if (totalStudentsEl) totalStudentsEl.innerText = `${students.length}명`;
        }

        // 다중 필터링 적용 (안전한 프론트엔드 필터링)
        if (students.length > 0) {
            // 1. 등급 필터
            if (filterTier !== 'all') {
                students = students.filter(s => {
                    const tierBadgeHTML = getTierBadgeHTML(s);
                    return tierBadgeHTML.includes(filterTier);
                });
            }
            // 2. 튜터 필터
            if (filterTutor !== 'all') {
                students = students.filter(s => s.tutorName === filterTutor);
            }
            // 3. MBTI 필터 (클라이언트 측 역변환 후 비교)
            if (type === 'mbti' && keyword.trim()) {
                const mbtiQuery = keyword.trim().toUpperCase();
                students = students.filter(s => {
                    const mbti = decodePromoCodeToMbti(s.promoCode);
                    return mbti && mbti.includes(mbtiQuery);
                });
            }
        }

        currentStudentList = students;
        Store.set('lastSearch', { type, keyword, filterTier, filterTutor });

        tbody.innerHTML = "";

        if (students.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>조건에 맞는 학생이 없습니다.</td></tr>";
            return;
        }

        students.forEach(s => {
            let statusBadge = getTierBadgeHTML(s);
            let tutorNameDisplay = s.tutorName ? `<span class="tutor-tag">👨‍🏫 ${escapeHtml(s.tutorName)}</span>` : '<span style="color:#94a3b8; font-size:0.8rem;">미배정</span>';
            let lastActive = s.lastPayDate ? new Date(s.lastPayDate).toLocaleDateString() : '-';

            const isChecked = (typeof persistedSelections !== 'undefined' && persistedSelections.has(s.userid)) ? 'checked' : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="selection-col" data-label="선택">
                    <input type="checkbox" class="student-checkbox" value="${escapeHtml(s.userid)}" data-name="${escapeHtml(s.name)}" onchange="handleStudentCheck(this)" ${isChecked}>
                </td>
                <td data-label="학생 정보">
                    <div class="student-info-cell">
                        <span class="student-name-text">${escapeHtml(s.name) || '(이름없음)'}</span>
                        <span class="student-meta-text">✉️ ${escapeHtml(s.email) || '-'}</span>
                        <span class="student-meta-text">🧠 ${escapeHtml(decodePromoCodeToMbti(s.promoCode) || '-')}</span>
                    </div>
                </td>
                <td data-label="담당 튜터">${tutorNameDisplay}</td>
                <td data-label="상태/등급">${statusBadge}</td>
                <td data-label="최근 활동"><span class="student-meta-text">결제: ${lastActive}</span></td>
                <td data-label="관리 액션">
                    <div class="action-buttons">
                        <button class="btn-detail" onclick="goToStudentDetail('${escapeHtml(s.userid)}')"><i class="fas fa-user-cog"></i> 상세관리</button>
                        <button class="btn-up" onclick="openGrantTierModal('${escapeHtml(s.userid)}', '${escapeHtml(s.name)}')">등급UP</button>
                        <button class="btn-del" onclick="openForceDeleteModal('${escapeHtml(s.userid)}', '${escapeHtml(s.name)}')">탈퇴</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        if (error.message !== "Auth expired") tbody.innerHTML = "<tr><td colspan='5' class='empty-msg'>데이터를 불러오는 중 오류가 발생했습니다.</td></tr>";
    }
}

function goToStudentDetail(targetUserId) {
    window.location.href = `/admin/detail?uid=${targetUserId}`;
}

// 학생 등급을 텍스트로 반환 (CSV용)
function getStudentTierText(s) {
    if (!s || !s.currentSubscription || s.currentSubscription.status !== 'active') return 'FREE';
    return (s.currentSubscription.tier || 'FREE').toUpperCase();
}

// 현재 검색 결과를 CSV로 내보내기
function exportStudentsToCSV() {
    if (!currentStudentList || currentStudentList.length === 0) {
        alert("내보낼 학생 데이터가 없습니다. 먼저 검색을 실행해 주세요.");
        return;
    }

    const EXAM_NAMES = { mar: '3월학평', apr: '4월학평', may: '5월학평', jun: '6월모평', jul: '7월학평', sep: '9월모평', oct: '10월학평', csat: '수능' };
    const EXAM_ORDER = ['mar', 'apr', 'may', 'jun', 'jul', 'sep', 'oct', 'csat'];

    const activeExams = EXAM_ORDER.filter(k => currentStudentList.some(s => s.quantitative && s.quantitative[k]));

    const headers = ['이름', '이메일', '전화번호', '유료등급', 'MBTI'];

    for (const examKey of activeExams) {
        const p = EXAM_NAMES[examKey] || examKey;
        headers.push(
            `${p}_국어_선택과목`, `${p}_국어_표준점수`, `${p}_국어_등급`,
            `${p}_수학_선택과목`, `${p}_수학_표준점수`, `${p}_수학_등급`,
            `${p}_영어_등급`, `${p}_한국사_등급`,
            `${p}_탐구1_과목명`, `${p}_탐구1_표준점수`, `${p}_탐구1_등급`,
            `${p}_탐구2_과목명`, `${p}_탐구2_표준점수`, `${p}_탐구2_등급`
        );
    }

    const rows = currentStudentList.map(s => {
        const base = [
            s.name  || '',
            s.email || '',
            s.phone || '',
            getStudentTierText(s),
            decodePromoCodeToMbti(s.promoCode) || ''
        ];

        const examCols = [];
        for (const examKey of activeExams) {
            const d = s.quantitative?.[examKey];
            if (!d) {
                for (let i = 0; i < 14; i++) examCols.push('');
            } else {
                examCols.push(
                    d.kor?.opt  || '', d.kor?.std  || '', d.kor?.grd  || '',
                    d.math?.opt || '', d.math?.std || '', d.math?.grd || '',
                    d.eng?.grd  || '',
                    d.hist?.grd || '',
                    d.inq1?.name || '', d.inq1?.std || '', d.inq1?.grd || '',
                    d.inq2?.name || '', d.inq2?.std || '', d.inq2?.grd || ''
                );
            }
        }

        return [...base, ...examCols];
    });

    const csvEscape = val => `"${String(val).replace(/"/g, '""')}"`;
    const csvContent = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const now  = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    a.href     = url;
    a.download = `studycrack_students_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// 새로운 구독 스키마 기반 등급 뱃지 함수
function getTierBadgeHTML(studentItem) {
    if (!studentItem || !studentItem.currentSubscription || studentItem.currentSubscription.status !== 'active') {
        return '<span style="color:#64748b; background:#f1f5f9; padding:4px 8px; border-radius:12px; font-size:0.8rem;">FREE</span>';
    }

    const tier = (studentItem.currentSubscription.tier || "").toUpperCase();

    if (tier.includes('BLACK')) return '<span style="color:#FFD700; background:#171717; padding:4px 8px; border-radius:12px; font-size:0.8rem; border:1px solid #333; font-weight:bold;">BLACK</span>';
    else if (tier.includes('PRO')) return '<span style="color:#92400e; background:#fef3c7; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">PRO</span>';
    else if (tier.includes('STANDARD')) return '<span style="color:#334155; background:#e2e8f0; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">STANDARD</span>';
    else return '<span style="color:#1e40af; background:#dbeafe; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">BASIC</span>';
}

// ============================================================
// 학생 일괄 선택 및 공지 발송 연동 로직 (상태 유지 기능 포함)
// ============================================================
let isSelectionMode = false;
let persistedSelections = new Map(); // 상태 유지를 위한 보이지 않는 장바구니 { userId: userName }

window.toggleStudentSelection = function() {
    const table = document.querySelector('#section-students .student-table');
    const toggleBtn = document.getElementById('btnToggleSelection');
    const sendBtn = document.getElementById('btnSendNoticeToSelected');

    isSelectionMode = !isSelectionMode;

    if (isSelectionMode) {
        table.classList.add('selection-mode');
        toggleBtn.style.backgroundColor = '#ef4444';
        toggleBtn.innerHTML = '<i class="fas fa-times"></i> 선택 취소';
        updateSelectionUI();
    } else {
        table.classList.remove('selection-mode');
        toggleBtn.style.backgroundColor = '#64748b';
        toggleBtn.innerHTML = '<i class="fas fa-check-square"></i> 학생 선택하기';
        sendBtn.style.display = 'none';

        persistedSelections.clear();
        document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = false);
        const checkAll = document.getElementById('checkAllStudents');
        if (checkAll) checkAll.checked = false;
    }
};

window.toggleAllStudents = function(source) {
    const checkboxes = document.querySelectorAll('.student-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = source.checked;
        if (cb.checked) {
            persistedSelections.set(cb.value, cb.getAttribute('data-name'));
        } else {
            persistedSelections.delete(cb.value);
        }
    });
    updateSelectionUI();
};

window.handleStudentCheck = function(cb) {
    if (!isSelectionMode) return;

    if (cb.checked) {
        persistedSelections.set(cb.value, cb.getAttribute('data-name'));
    } else {
        persistedSelections.delete(cb.value);
    }

    updateSelectionUI();
};

window.updateSelectionUI = function() {
    if (!isSelectionMode) return;
    const sendBtn = document.getElementById('btnSendNoticeToSelected');
    const countSpan = document.getElementById('selectedStudentCount');

    countSpan.innerText = persistedSelections.size;

    if (persistedSelections.size > 0) {
        sendBtn.style.display = 'inline-block';
    } else {
        sendBtn.style.display = 'none';
    }
};

window.sendNoticeToSelectedStudents = function() {
    if (persistedSelections.size === 0) {
        alert("선택된 학생이 없습니다.");
        return;
    }

    Store.set('pendingNoticeTargets', Array.from(persistedSelections.entries()).map(([userId, userName]) => ({
        userId, userName
    })));

    toggleStudentSelection();
    showNotiMenu('send');
};

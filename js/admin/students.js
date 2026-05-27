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

// CSV 컬럼 선택 모달 열기
function exportStudentsToCSV() {
    if (!currentStudentList || currentStudentList.length === 0) {
        alert("내보낼 학생 데이터가 없습니다. 먼저 검색을 실행해 주세요.");
        return;
    }
    const countEl = document.getElementById('csvExportTargetCount');
    if (countEl) countEl.innerText = currentStudentList.length;
    document.getElementById('csvExport-modal')?.classList.remove('hidden');
}

function closeCsvExportModal() {
    document.getElementById('csvExport-modal')?.classList.add('hidden');
}

function toggleAllCsvCols(checked) {
    document.querySelectorAll('#csvColCheckboxList input.csv-col, #csvColCheckboxList input.csv-exam, #csvColCheckboxList input.csv-subj')
        .forEach(el => { el.checked = checked; });
}

function formatCreatedAtDateOnly(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatMarketingAgreed(v) {
    if (v === true || v === 'true' || v === 1 || v === '1') return 'Y';
    if (v === false || v === 'false' || v === 0 || v === '0') return 'N';
    return '';
}

// qualitative.targets 같은 배열 필드 → "값1 | 값2 | 값3" 형태로 조인 (빈 문자열은 제외)
function joinQualList(arr) {
    if (!Array.isArray(arr)) return '';
    return arr.map(v => String(v ?? '').trim()).filter(v => v.length > 0).join(' | ');
}

// 체크박스 선택 결과로 실제 CSV 생성
function executeExportStudentsToCSV() {
    if (!currentStudentList || currentStudentList.length === 0) {
        alert("내보낼 학생 데이터가 없습니다.");
        closeCsvExportModal();
        return;
    }

    const selected = new Set(
        Array.from(document.querySelectorAll('#csvColCheckboxList input.csv-col:checked')).map(el => el.value)
    );
    if (selected.size === 0) {
        alert("최소 1개 이상의 항목을 선택해주세요.");
        return;
    }

    const SIMPLE_COLS = [
        { key: 'name',             header: '이름',            get: s => s.name  || '' },
        { key: 'email',            header: '이메일',          get: s => s.email || '' },
        { key: 'phone',            header: '전화번호',        get: s => s.phone || '' },
        { key: 'createdAt',        header: '가입일자',        get: s => formatCreatedAtDateOnly(s.createdAt) },
        { key: 'grade',            header: '학년',            get: s => s.grade || '' },
        { key: 'school',           header: '학교',            get: s => s.school || '' },
        { key: 'major',            header: '희망 전공',       get: s => s.major || '' },
        { key: 'tier',             header: '유료등급',        get: s => getStudentTierText(s) },
        { key: 'mbti',             header: 'MBTI',            get: s => decodePromoCodeToMbti(s.promoCode) || '' },
        { key: 'marketingAgreed',  header: '마케팅 수신동의', get: s => formatMarketingAgreed(s.marketingAgreed) },
        { key: 'qual_status',      header: '설문_학년상태',   get: s => s.qualitative?.status   || '' },
        { key: 'qual_school',      header: '설문_출신학교',   get: s => s.qualitative?.school   || '' },
        { key: 'qual_stream',      header: '설문_희망계열',   get: s => s.qualitative?.stream   || '' },
        { key: 'qual_benefits',    header: '설문_얻고싶은점', get: s => s.qualitative?.benefits || '' },
        { key: 'qual_questions',   header: '설문_입시고민',   get: s => s.qualitative?.questions|| '' },
    ];

    // 구버전 qualitative (2026-05 이전 가입자) — 한 체크박스(qual_legacy_all)로 18컬럼 일괄 출력
    const LEGACY_QUAL_COLS = [
        { header: '설문_희망진로',         get: s => s.qualitative?.career || '' },
        { header: '설문_목표대학리스트',   get: s => joinQualList(s.qualitative?.targets) },
        { header: '설문_후보_가군',        get: s => s.qualitative?.candidates?.ga    || '' },
        { header: '설문_후보_나군',        get: s => s.qualitative?.candidates?.na    || '' },
        { header: '설문_후보_다군',        get: s => s.qualitative?.candidates?.da    || '' },
        { header: '설문_가장가고싶은대학', get: s => s.qualitative?.candidates?.most  || '' },
        { header: '설문_덜가고싶은대학',   get: s => s.qualitative?.candidates?.least || '' },
        { header: '설문_본인결정대학',     get: s => s.qualitative?.candidates?.self  || '' },
        { header: '설문_부모님영향',       get: s => s.qualitative?.parents?.influence|| '' },
        { header: '설문_부모님의견',       get: s => s.qualitative?.parents?.opinion  || '' },
        { header: '설문_편입의향',         get: s => s.qualitative?.special?.transfer || '' },
        { header: '설문_교직이수',         get: s => s.qualitative?.special?.teaching || '' },
        { header: '설문_특이사항기타',     get: s => s.qualitative?.special?.etc      || '' },
        { header: '가치관_우선순위',       get: s => s.qualitative?.values?.priority  || '' },
        { header: '가치관_희망지역',       get: s => s.qualitative?.values?.region    || '' },
        { header: '가치관_반드시',         get: s => s.qualitative?.values?.mustGo    || '' },
        { header: '가치관_전략',           get: s => s.qualitative?.values?.strategy  || '' },
        { header: '가치관_교차지원',       get: s => s.qualitative?.values?.cross     || '' },
        { header: '가치관_최악시나리오',   get: s => s.qualitative?.values?.worst     || '' },
    ];

    const headers = [];
    const rowGetters = [];

    SIMPLE_COLS.forEach(col => {
        if (selected.has(col.key)) {
            headers.push(col.header);
            rowGetters.push(col.get);
        }
    });

    // 구버전 설문 전체 — 단일 체크박스로 18컬럼 일괄 추가
    if (selected.has('qual_legacy_all')) {
        LEGACY_QUAL_COLS.forEach(col => {
            headers.push(col.header);
            rowGetters.push(col.get);
        });
    }

    // 시험 / 과목 선택 (성적 영역) — 둘 다 1개 이상 체크되어야 성적 컬럼이 들어감
    const EXAM_NAMES = { mar: '3월학평', apr: '4월학평', may: '5월학평', jun: '6월모평', jul: '7월학평', sep: '9월모평', oct: '10월학평', csat: '수능' };
    const EXAM_ORDER = ['mar', 'apr', 'may', 'jun', 'jul', 'sep', 'oct', 'csat'];

    // 과목별 컬럼 정의: subjKey → [컬럼 라벨, 값 추출 함수] 배열
    const SUBJECT_COLS = {
        kor:  [['국어_선택과목',  d => d.kor?.opt  || ''], ['국어_표준점수',  d => d.kor?.std  || ''], ['국어_등급',  d => d.kor?.grd  || '']],
        math: [['수학_선택과목',  d => d.math?.opt || ''], ['수학_표준점수',  d => d.math?.std || ''], ['수학_등급',  d => d.math?.grd || '']],
        eng:  [['영어_등급',      d => d.eng?.grd  || '']],
        hist: [['한국사_등급',    d => d.hist?.grd || '']],
        inq1: [['탐구1_과목명',   d => d.inq1?.name|| ''], ['탐구1_표준점수', d => d.inq1?.std || ''], ['탐구1_등급', d => d.inq1?.grd || '']],
        inq2: [['탐구2_과목명',   d => d.inq2?.name|| ''], ['탐구2_표준점수', d => d.inq2?.std || ''], ['탐구2_등급', d => d.inq2?.grd || '']],
    };
    const SUBJECT_ORDER = ['kor', 'math', 'eng', 'hist', 'inq1', 'inq2'];

    const selectedExams = new Set(
        Array.from(document.querySelectorAll('#csvColCheckboxList input.csv-exam:checked')).map(el => el.value)
    );
    const selectedSubjects = new Set(
        Array.from(document.querySelectorAll('#csvColCheckboxList input.csv-subj:checked')).map(el => el.value)
    );

    // 실제 데이터가 있는 시험만 추리되, 선택된 시험에 한해서만
    const activeExams = EXAM_ORDER.filter(k =>
        selectedExams.has(k) && currentStudentList.some(s => s.quantitative && s.quantitative[k])
    );
    const activeSubjects = SUBJECT_ORDER.filter(k => selectedSubjects.has(k));

    // 시험 × 과목 조합으로 헤더/getter 생성
    const examColGetters = []; // [(student) => value, ...] 순서대로
    for (const examKey of activeExams) {
        const examName = EXAM_NAMES[examKey] || examKey;
        for (const subjKey of activeSubjects) {
            for (const [label, valueFn] of SUBJECT_COLS[subjKey]) {
                headers.push(`${examName}_${label}`);
                examColGetters.push(s => {
                    const d = s.quantitative?.[examKey];
                    return d ? valueFn(d) : '';
                });
            }
        }
    }

    if (headers.length === 0) {
        alert("최소 1개 이상의 항목을 선택해주세요.");
        return;
    }

    const rows = currentStudentList.map(s => {
        const row = rowGetters.map(fn => fn(s));
        for (const fn of examColGetters) row.push(fn(s));
        return row;
    });

    const csvEscape = val => `"${String(val ?? '').replace(/"/g, '""')}"`;
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

    closeCsvExportModal();
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

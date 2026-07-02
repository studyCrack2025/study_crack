// js/admin/detail-core.js
// 학생 상세 페이지 — 공통 초기화 · 데이터 로딩 · 기본 렌더링
// URL 상수 및 apiFetch, escapeHtml, formatReportKey는 shared/api.js + shared/utils.js 에서 제공

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('uid');
const adminId = localStorage.getItem('userId');
const userRole = String(localStorage.getItem('userRole') || '').toLowerCase();
const isTutorView = userRole === 'tutor';

let currentStudentData = null;
let currentTier = 'free';
let currentPaymentsData = [];
let currentWeeklyData = [];
const EXAM_NAME_MAP = {
    mar: '3월 학평',
    apr: '4월 학평',
    may: '5월 학평',
    jun: '6월 모평',
    jul: '7월 학평',
    sep: '9월 모평',
    oct: '10월 학평',
    csat: '수능'
};
const EXAM_KEY_ORDER = ['mar', 'apr', 'may', 'jun', 'jul', 'sep', 'oct', 'csat'];
let selectedTargetExamKey = 'mar';

function forceAdminRelogin(message) {
    if (message) alert(message);
    if (typeof clearClientSession === 'function') {
        clearClientSession();
    } else {
        ['refreshToken','userId','userEmail','userRole','userName','userTier','authProvider','accessToken','token']
            .forEach((k) => localStorage.removeItem(k));
        sessionStorage.clear();
    }
    window.location.href = '/admin/login';
}

document.addEventListener('DOMContentLoaded', () => {
    if (!targetUserId || !adminId) {
        alert("잘못된 접근입니다.");
        window.location.href = '/admin/login';
        return;
    }

    // 페이지 이동 후 세션 복원.
    tryRefreshToken().then((ok) => {
        if (!ok) {
            forceAdminRelogin("세션이 만료되었습니다. 다시 로그인해주세요.");
            return;
        }
        initDetailPage();
    }).catch(() => {
        forceAdminRelogin("세션 확인 중 오류가 발생했습니다. 다시 로그인해주세요.");
    });
});

function initDetailPage() {
    const backBtn = document.querySelector('.back-btn');

    if (backBtn) {
        if (isTutorView) {
            backBtn.href = '/mypage/tutor?tab=students';
            backBtn.innerText = '← 내 학생 목록으로';
        } else {
            backBtn.href = '/admin';
            backBtn.innerText = '← 목록으로 돌아가기';
        }
    }

    initRoleBasedView();
    loadAllStudentData();

    const today = new Date();
    initDateFilter(today.getFullYear(), today.getMonth() + 1);
    initProDateFilter(today.getFullYear(), today.getMonth() + 1);

    const filterYear = document.getElementById('filterYear');
    const filterMonth = document.getElementById('filterMonth');
    if (filterYear) filterYear.addEventListener('change', renderWeeklyTab);
    if (filterMonth) filterMonth.addEventListener('change', renderWeeklyTab);

    const proFilterYear = document.getElementById('proFilterYear');
    const proFilterMonth = document.getElementById('proFilterMonth');
    if (proFilterYear) proFilterYear.addEventListener('change', renderProTab);
    if (proFilterMonth) proFilterMonth.addEventListener('change', renderProTab);
}

function initRoleBasedView() {
    if (isTutorView) {
        const btnPay = document.getElementById('btn-pay');
        if (btnPay) btnPay.style.display = 'none';

        // 튜터에게는 사이드바의 이메일/전화/가입일 PII를 노출하지 않는다.
        const sidebarEmail = document.getElementById('viewEmail');
        if (sidebarEmail) sidebarEmail.style.display = 'none';

        ['viewPhoneSide', 'viewEmailFullSide', 'viewJoinDateSide'].forEach((id) => {
            const el = document.getElementById(id);
            const row = el ? el.closest('.profile-meta-row') : null;
            if (row) row.style.display = 'none';
        });
    }
}

function initDateFilter(year, month) {
    const yearSel = document.getElementById('filterYear');
    const monthSel = document.getElementById('filterMonth');
    if(!yearSel || !monthSel) return;

    yearSel.innerHTML = ''; monthSel.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for(let y = currentYear; y >= currentYear - 2; y--) {
        yearSel.innerHTML += `<option value="${y}" ${y===year?'selected':''}>${y}년</option>`;
    }
    for(let m = 1; m <= 12; m++) {
        monthSel.innerHTML += `<option value="${m}" ${m===month?'selected':''}>${m}월</option>`;
    }
}

function initProDateFilter(year, month) {
    const yearSel = document.getElementById('proFilterYear');
    const monthSel = document.getElementById('proFilterMonth');
    if(!yearSel || !monthSel) return;

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

    const btnId = (tabName === 'special') ? 'btn-special' : 'btn-' + tabName;
    const btn = document.getElementById(btnId);
    if(btn) btn.classList.add('active');

    if (currentStudentData) {
        if (tabName === 'weekly') renderWeeklyTab();
        if (tabName === 'special') renderProTab();
    }
}


function parseDynamoItem(item) {
    if (item === undefined || item === null) return null;
    if (typeof item !== 'object') return item;
    if (Array.isArray(item)) return item.map(parseDynamoItem);

    if (item.S !== undefined) return item.S;
    if (item.N !== undefined) return Number(item.N);
    if (item.BOOL !== undefined) return item.BOOL;
    if (item.NULL === true) return null;

    if (item.L !== undefined) {
        if (Array.isArray(item.L)) return item.L.map(parseDynamoItem);
        return [];
    }
    if (item.M !== undefined) {
        const obj = {};
        for (const key in item.M) obj[key] = parseDynamoItem(item.M[key]);
        return obj;
    }
    const obj = {};
    for (const key in item) obj[key] = parseDynamoItem(item[key]);
    return obj;
}

async function loadAllStudentData() {
    const cacheKey = `studentDetail_${isTutorView ? 'tutor' : 'admin'}_${targetUserId}`;

    // 캐시 확인 (2분 TTL) — 자주 돌아오는 튜터/관리자 UX 개선
    const cached = Store.get(cacheKey);
    if (cached) {
        currentStudentData  = cached.detail;
        currentWeeklyData   = cached.weekly;
        currentPaymentsData = cached.payments;
        renderData(currentStudentData);
        return;
    }

    try {
        const detailType = isTutorView ? 'tutor_get_student_detail' : 'admin_get_user_detail';
        const detailPromise = apiFetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: detailType,
                userId: adminId,
                data: { targetUserId }
            })
        }).then(res => res.json());

        const weeklyPromise = apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'get_weekly_reports', data: { targetUserId: targetUserId }
            })
        }).then(res => res.json()).catch(() => ({ weeklyReports: [] }));

        const paymentPromise = isTutorView
            ? Promise.resolve({ payments: [] })
            : apiFetch(ADMIN_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'admin_get_payments',
                    data: { targetUserId }
                })
            }).then(res => res.json()).catch(() => ({ payments: [] }));

        const [detailData, weeklyData, paymentData] = await Promise.all([detailPromise, weeklyPromise, paymentPromise]);

        currentStudentData  = parseDynamoItem(detailData);
        currentWeeklyData   = parseDynamoItem(weeklyData.weeklyReports || []);
        currentPaymentsData = parseDynamoItem(paymentData.payments || []);

        // 결과를 Store에 캐싱 (2분)
        Store.set(cacheKey, {
            detail:   currentStudentData,
            weekly:   currentWeeklyData,
            payments: currentPaymentsData
        }, 120);

        renderData(currentStudentData);
    } catch (e) {
        if (e.message !== "Auth expired") {
            console.error("[admin/detail] loadAllStudentData failed:", e);

            if (String(e.message || '').includes('Forbidden')) {
                if (isTutorView) {
                    alert("해당 학생 정보에 접근할 권한이 없습니다.");
                    return;
                }
                forceAdminRelogin("세션이 만료되었거나 권한이 유효하지 않습니다. 다시 로그인해주세요.");
                return;
            }

            alert(`학생 상세 데이터를 불러오지 못했습니다.\n사유: ${e.message || '알 수 없는 오류'}`);
        }
    }
}

async function loadProReportsForAdmin() {
    try {
        const response = await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'get_pro_reports',
                data: { targetUserId: targetUserId, requesterRole: userRole || 'unknown' }
            })
        });

        const data = await response.json();
        currentStudentData.proReportsList = parseDynamoItem(data.reports || []);

        const specialTab = document.getElementById('tab_special');
        if (specialTab && specialTab.classList.contains('active')) {
            renderProTab();
        }
    } catch (e) {
        if (e.message !== "Auth expired") console.error("Pro Reports Load Error:", e);
    }
}

// -----------------------------------------------------------
// UI 렌더링 함수들
// -----------------------------------------------------------
function renderData(s) {
    if (!s) return;

    const gradeText = s.grade || s.qualitative?.status || '-';

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };

    setText('viewName', s.name || '미입력');
    setText('viewEmail', s.email || '-');
    // 학교는 정성조사 출신학교(qualitative.school)를 정식 값으로 사용.
    const resolvedSchool = (s.qualitative && s.qualitative.school) || '-';
    setText('viewSchoolSide', resolvedSchool);
    setText('viewGradeSide', gradeText);
    // 인적사항을 사이드바로 이전 (목표대학 탭 본문에는 더 이상 표시하지 않음)
    setText('viewPhoneSide', s.phone || '-');
    setText('viewEmailFullSide', s.email || '-');
    setText('viewJoinDateSide', s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-');

    const profileImg = document.getElementById('studentProfileImg');
    if(s.profileImage) profileImg.src = s.profileImage;

    currentTier = 'free';
    if (s.currentSubscription && s.currentSubscription.status === 'active') {
        currentTier = (s.currentSubscription.tier || "free").toLowerCase();
    } else {
        currentTier = calcTierFromLegacy(currentPaymentsData || []);
    }

    renderTierBadge(currentTier);

    const specialBtn = document.getElementById('btn-special');
    if (['pro'].includes(currentTier)) specialBtn.style.display = 'inline-block';
    else specialBtn.style.display = 'none';

    const memoInput = document.getElementById('adminMemoInput');
    if (memoInput) memoInput.value = s.adminMemo || '';

    renderQualitativeDetail(s.qualitative);

    initQuantitativeData(s.quantitative);
    renderTargetUnivsByExam();

    renderPayments(currentPaymentsData);

    loadProReportsForAdmin();
}

function calcTierFromLegacy(payments) {
    if (!payments || payments.length === 0) return 'free';
    const paid = payments.filter(p => p.status === 'paid');
    if (paid.length === 0) return 'free';
    paid.sort((a, b) => new Date(b.date) - new Date(a.date));
    const last = (paid[0].product || "").toLowerCase();
    if (last.includes('pro')) return 'pro';
    if (last.includes('standard')) return 'standard';
    return 'basic';
}

function renderTierBadge(tier) {
    const area = document.getElementById('tierBadgeArea');
    let html = '';
    if (tier === 'pro') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #F59E0B, #FCD34D); border: 2px solid #F59E0B; color: #78350f;">PRO TIER</span>';
    else if (tier === 'standard') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #94A3B8, #CBD5E1); border: 2px solid #64748B; color: #0F172A;">STANDARD TIER</span>';
    else if (tier === 'starter') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #8B5CF6, #A78BFA); border: 2px solid #8B5CF6; color: white;">STARTER TIER</span>';
    else if (tier === 'basic') html = '<span class="tier-badge" style="background: linear-gradient(135deg, #059669, #34D399); border: 2px solid #059669; color: white;">BASIC TIER</span>';
    else html = '<span class="tier-badge" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;">FREE USER</span>';
    area.innerHTML = html;
}

function initQuantitativeData(q) {
    const selector = document.getElementById('scoreExamFilter');
    const container = document.getElementById('viewScoreTable');
    const targetExamSelector = document.getElementById('targetUnivExamFilter');

    if (!q || Object.keys(q).length === 0) {
        selector.innerHTML = '<option value="">데이터 없음</option>';
        if (targetExamSelector) targetExamSelector.innerHTML = '<option value="">데이터 없음</option>';
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:20px;">입력된 성적이 없습니다.</p>';
        return;
    }

    const rawKeys = Object.keys(q).filter(k => q[k]);
    const keySet = new Set(rawKeys);
    const orderedKeys = EXAM_KEY_ORDER.filter((k) => keySet.has(k));
    rawKeys.forEach((k) => {
        if (!orderedKeys.includes(k)) orderedKeys.push(k);
    });
    const availableKeys = orderedKeys;

    selector.innerHTML = '';
    availableKeys.forEach(key => {
        const label = EXAM_NAME_MAP[key] || key;
        selector.innerHTML += `<option value="${key}">${label}</option>`;
    });

    if (targetExamSelector) {
        targetExamSelector.innerHTML = '';
        availableKeys.forEach((key) => {
            const label = EXAM_NAME_MAP[key] || key;
            targetExamSelector.innerHTML += `<option value="${key}">${label}</option>`;
        });
    }

    if (availableKeys.length > 0) {
        if (!availableKeys.includes(selectedTargetExamKey)) selectedTargetExamKey = availableKeys[0];
        if (targetExamSelector) targetExamSelector.value = selectedTargetExamKey;
        renderSelectedScore();
    }
}

function renderSelectedScore() {
    const key = document.getElementById('scoreExamFilter').value;
    const container = document.getElementById('viewScoreTable');
    const q = currentStudentData.quantitative;

    if (!key || !q[key]) { container.innerHTML = ''; return; }

    const d = q[key];
    const subjects = [{k:'kor',n:'국어'}, {k:'math',n:'수학'}, {k:'eng',n:'영어'}, {k:'inq1',n:'탐1'}, {k:'inq2',n:'탐2'}];

    let html = `<div class="score-exam-block" style="margin-top:15px;"><table class="score-table"><thead><tr><th style="text-align: center;">과목</th><th style="text-align: center;">표점</th><th style="text-align: center;">등급</th></tr></thead><tbody>`;
    subjects.forEach(sub => {
        if(d[sub.k]) {
            html += `<tr><td data-label="과목" style="text-align: center;">${sub.n}</td><td data-label="표점" style="text-align: center;">${d[sub.k].std||'-'}</td><td data-label="등급" style="text-align: center;">${d[sub.k].grd||'-'}</td></tr>`;
        }
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// ============================================================
// [목표대학] 표 기반 렌더 — 환산점수/상태/과목별 효율/역추적 통합
// ============================================================

const TARGET_SUBJECT_KEYS = ['kor', 'math', 'inq1', 'inq2'];

// 합격선(100점) 이하면 역추적 호출. 안정선(150점)을 넘는 경우는 굳이 +N점 계획이 의미 없음.
function shouldRequestBacktrace(analyzeRes, simRes) {
    const base = Number(simRes?.base_ui_score);
    if (Number.isFinite(base) && base >= 100) return false;
    // analyze 결과의 converted_score를 우선 신뢰
    const conv = Number(analyzeRes?.converted_score);
    if (Number.isFinite(conv) && conv >= 100) return false;
    return true;
}

function subjectLabel(simRes, key) {
    if (key === 'kor') return '국어';
    if (key === 'math') return '수학';
    if (key === 'inq1') return simRes?.sim_data?.inq1?.name || '탐구1';
    if (key === 'inq2') return simRes?.sim_data?.inq2?.name || '탐구2';
    return key;
}

function renderTargetEmptyState(container, msg) {
    container.innerHTML = `<div class="target-univ-empty"><i class="fas fa-exclamation-circle"></i> ${msg}</div>`;
}

async function renderTargetUnivs(list, quantData) {
    const examMode = selectedTargetExamKey;
    const examLabel = EXAM_NAME_MAP[examMode] || examMode;
    const container = document.getElementById('viewTargetUnivTable');
    if (!container) return;

    const validList = [];
    list.forEach((u, originalIdx) => { if (u && u.univ) validList.push({ ...u, originalIdx }); });

    if (validList.length === 0) {
        renderTargetEmptyState(container, '설정된 목표 대학이 없습니다.');
        return;
    }

    const scoreData = quantData && quantData[examMode] ? quantData[examMode] : null;
    const hasScore = scoreData && (scoreData.kor || scoreData.math || scoreData.eng);

    if (!hasScore) {
        // 점수 데이터가 없으면 univ 헤더만 나열
        container.innerHTML = validList.map((u) => `
            <section class="target-univ-block target-univ-block--noscore">
                <header class="univ-block-head">
                    <div class="univ-block-rank">${u.originalIdx + 1}지망</div>
                    <div class="univ-block-title">
                        <strong>${escapeHtml(u.univ)}</strong>
                        <span class="univ-block-major">${escapeHtml(u.major || '')}</span>
                    </div>
                    <span class="univ-status-badge univ-status-badge--muted">${escapeHtml(examLabel)} 성적 데이터 없음</span>
                </header>
            </section>
        `).join('');
        return;
    }

    // 로딩 스켈레톤
    container.innerHTML = validList.map((u) => `
        <section class="target-univ-block" data-univ-idx="${u.originalIdx}">
            <header class="univ-block-head">
                <div class="univ-block-rank">${u.originalIdx + 1}지망</div>
                <div class="univ-block-title">
                    <strong>${escapeHtml(u.univ)}</strong>
                    <span class="univ-block-major">${escapeHtml(u.major || '')}</span>
                </div>
                <span class="univ-status-badge univ-status-badge--loading"><i class="fas fa-spinner fa-spin"></i> 분석 중</span>
            </header>
            <div class="univ-block-body" id="univ-block-body-${u.originalIdx}">
                <div class="univ-block-loading"><i class="fas fa-spinner fa-spin"></i> ${escapeHtml(examLabel)} 기준 분석 중...</div>
            </div>
        </section>
    `).join('');

    try {
        // 1) analyze + simulate 병렬 호출
        const [analyzeRaw, simRaw] = await Promise.all([
            apiFetch(CONFIG.api.analysis, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'analyze_my_targets',
                    userId: targetUserId,
                    targetUnivs: validList,
                    userScores: scoreData,
                    examMode
                })
            }).then(r => r.ok ? r.json() : null).catch(() => null),
            apiFetch(CONFIG.api.analysis, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'simulate_score_rise',
                    userId: targetUserId,
                    targetUnivs: validList,
                    userScores: scoreData,
                    examMode
                })
            }).then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        const analyzeArr = Array.isArray(analyzeRaw) ? analyzeRaw : (analyzeRaw?.results || analyzeRaw?.data || []);
        const simArr = Array.isArray(simRaw) ? simRaw : [];

        const findAnalyze = (u) => analyzeArr.find(d => d && d.univ === u.univ && d.major === u.major);
        const findSim = (u) => simArr.find(d => d && d.univ === u.univ && d.major === u.major);

        // 2) 역추적 후보(합격선 미만)만 골라 병렬 호출
        const backtraceCandidates = validList
            .map(u => ({ u, sim: findSim(u), analyze: findAnalyze(u) }))
            .filter(({ u, sim, analyze }) => sim && !sim.ineligible && shouldRequestBacktrace(analyze, sim));

        const backtraceMap = new Map();
        await Promise.all(backtraceCandidates.map(async ({ u }) => {
            try {
                const res = await apiFetch(CONFIG.api.analysis, {
                    method: 'POST',
                    body: JSON.stringify({
                        type: 'backtrace_required_raw',
                        userId: targetUserId,
                        targetUniv: { univ: u.univ, major: u.major },
                        userScores: scoreData,
                        examMode,
                        targetUiMin: 100,
                        targetUiMax: 150,
                        maxTotalRaw: 20
                    })
                });
                if (!res.ok) return;
                const payload = await res.json();
                const plan = payload?.result || payload?.backtrace_plan || null;
                if (plan) backtraceMap.set(`${u.univ}||${u.major}`, plan);
            } catch (_) { /* 역추적 실패는 카드별로 무시 */ }
        }));

        // 3) 최종 렌더
        validList.forEach((u) => {
            const block = container.querySelector(`.target-univ-block[data-univ-idx="${u.originalIdx}"]`);
            if (!block) return;

            const analyze = findAnalyze(u);
            const sim = findSim(u);
            const plan = backtraceMap.get(`${u.univ}||${u.major}`) || null;

            renderUnivBlock(block, u, analyze, sim, plan, scoreData, examLabel);
        });
    } catch (e) {
        console.error("[admin/detail] target univ render error:", e);
        container.querySelectorAll('.univ-block-body').forEach(el => {
            el.innerHTML = `<div class="univ-block-error"><i class="fas fa-exclamation-triangle"></i> 분석 서버 오류</div>`;
        });
        container.querySelectorAll('.univ-status-badge--loading').forEach(el => {
            el.outerHTML = `<span class="univ-status-badge univ-status-badge--error">분석 실패</span>`;
        });
    }
}

function renderUnivBlock(block, u, analyze, sim, plan, scoreData, examLabel) {
    // 헤더의 상태 배지 교체
    const headerBadge = block.querySelector('.univ-status-badge');
    if (headerBadge) {
        if (sim && sim.ineligible) {
            headerBadge.outerHTML = `<span class="univ-status-badge univ-status-badge--muted"><i class="fas fa-ban"></i> 지원 불가</span>`;
        } else if (analyze && analyze.status) {
            const color = analyze.color || '#64748b';
            headerBadge.outerHTML = `<span class="univ-status-badge" style="background:${color};">${escapeHtml(analyze.status)}</span>`;
        } else {
            headerBadge.outerHTML = `<span class="univ-status-badge univ-status-badge--muted">데이터 부족</span>`;
        }
    }

    const body = block.querySelector('.univ-block-body');
    if (!body) return;

    if (sim && sim.ineligible) {
        body.innerHTML = `<div class="univ-block-msg"><i class="fas fa-ban"></i> ${escapeHtml(examLabel)} 기준으로 지원 가능 조건을 만족하지 못합니다.</div>`;
        return;
    }
    if (!sim || typeof sim.base_ui_score === 'undefined') {
        body.innerHTML = `<div class="univ-block-msg"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(analyze?.msg || '분석 데이터가 없습니다.')}</div>`;
        return;
    }

    // 환산 점수 요약
    const baseUi = Number(sim.base_ui_score).toFixed(1);
    const convertedScore = analyze && Number.isFinite(Number(analyze.converted_score))
        ? Number(analyze.converted_score).toFixed(1)
        : baseUi;
    const convColor = analyze && analyze.color ? analyze.color : '#3b82f6';
    const advice = analyze && analyze.msg ? escapeHtml(analyze.msg) : '';

    const cutGap = (100 - Number(convertedScore)).toFixed(1);
    const safeGap = (150 - Number(convertedScore)).toFixed(1);
    const gapBadge = (n, label, hitColor) => {
        const num = Number(n);
        if (!Number.isFinite(num)) return '';
        if (num <= 0) return `<span class="univ-gap-badge univ-gap-badge--hit">${label} 도달 (${Math.abs(num).toFixed(1)}점 초과)</span>`;
        return `<span class="univ-gap-badge" style="--gap-color:${hitColor};">${label}까지 ${num.toFixed(1)}점</span>`;
    };

    // 과목별 표 — 현재 원점수 / 표점·등급 / +1점 효율 / 역추적 목표 / 상승폭
    const isReachable = plan && plan.reachable === true;
    const planBySubject = plan
        ? (isReachable ? plan.bySubject : plan.bestEffort?.bySubject)
        : null;
    const planTotal = plan
        ? Number(isReachable ? plan.minTotalRaw : plan.bestEffort?.minTotalRaw)
        : null;
    const planUi = plan
        ? Number(isReachable ? plan.expected?.uiScore : plan.bestEffort?.expected?.uiScore)
        : null;

    const subjectRows = TARGET_SUBJECT_KEYS.map(key => {
        const subInfo = sim.sim_data?.[key];
        const scoreObj = scoreData?.[key] || {};
        const label = subjectLabel(sim, key);

        const currentRaw = Number.isFinite(parseInt(subInfo?.raw, 10))
            ? parseInt(subInfo.raw, 10)
            : (Number.isFinite(parseInt(scoreObj.raw, 10)) ? parseInt(scoreObj.raw, 10) : null);
        const currentStd = subInfo?.std ?? scoreObj.std ?? null;
        const currentGrd = subInfo?.grd ?? scoreObj.grd ?? null;
        const uiDiff = Number(subInfo?.uiDiff);

        const planGain = planBySubject && Number.isFinite(Number(planBySubject[key])) ? Math.round(Number(planBySubject[key])) : null;
        const planTargetRaw = (planGain !== null && currentRaw !== null) ? currentRaw + planGain : null;

        const fmt = (v, suffix = '') => (v === null || v === undefined || v === '') ? '-' : `${v}${suffix}`;
        const uiDiffCell = Number.isFinite(uiDiff)
            ? (uiDiff > 0 ? `<span class="us-up">+${uiDiff.toFixed(2)}점</span>` : `<span class="us-neutral">${uiDiff.toFixed(2)}점</span>`)
            : '-';
        const planCell = planGain
            ? `<span class="us-plan">${planTargetRaw !== null ? planTargetRaw + '점 원점수' : '+' + planGain}</span><span class="us-plan-delta">+${planGain}</span>`
            : '<span class="us-plan-none">-</span>';

        return `
            <tr>
                <td class="us-subj" data-label="과목">${escapeHtml(label)}</td>
                <td class="us-raw" data-label="현재 원점수">${fmt(currentRaw)}</td>
                <td class="us-std" data-label="표점 / 등급">${fmt(currentStd)} / ${fmt(currentGrd, '등급')}</td>
                <td class="us-rise" data-label="+1점 효율 (환산↑)">${uiDiffCell}</td>
                <td class="us-plan-cell" data-label="역추적 목표 / 상승">${planCell}</td>
            </tr>
        `;
    }).join('');

    // 역추적 요약 메시지
    let backtraceSummary = '';
    if (plan) {
        if (isReachable) {
            backtraceSummary = `
                <div class="univ-backtrace-msg univ-backtrace-msg--ok">
                    <i class="fas fa-route"></i>
                    합격권(<strong>100점</strong>) 도달까지 <strong>원점수 +${Math.round(planTotal)}점</strong>이 필요합니다${Number.isFinite(planUi) ? ` (도달 시 환산 <strong>${planUi.toFixed(1)}점</strong>)` : ''}.
                </div>`;
        } else if (plan.error) {
            backtraceSummary = `
                <div class="univ-backtrace-msg univ-backtrace-msg--warn">
                    <i class="fas fa-exclamation-circle"></i>
                    ${escapeHtml(plan.error)}
                </div>`;
        } else {
            backtraceSummary = `
                <div class="univ-backtrace-msg univ-backtrace-msg--warn">
                    <i class="fas fa-exclamation-circle"></i>
                    설정 범위 안에서는 합격권 도달이 어렵습니다.${Number.isFinite(planTotal) ? ` 최선 조합 기준 <strong>+${Math.round(planTotal)}점</strong>${Number.isFinite(planUi) ? ` → 환산 <strong>${planUi.toFixed(1)}점</strong>` : ''}.` : ''}
                </div>`;
        }
    }

    body.innerHTML = `
        <div class="univ-score-summary">
            <div class="univ-score-main">
                <span class="univ-score-label">현재 환산 점수</span>
                <span class="univ-score-value" style="color:${convColor};">${convertedScore}<span class="univ-score-unit">점</span></span>
            </div>
            <div class="univ-score-gap">
                ${gapBadge(cutGap, '합격선(100)', '#3b82f6')}
                ${gapBadge(safeGap, '안정선(150)', '#10b981')}
            </div>
            ${advice ? `<div class="univ-score-advice" style="color:${convColor};">${advice}</div>` : ''}
        </div>
        <div class="univ-subject-table-wrap">
            <table class="univ-subject-table">
                <thead>
                    <tr>
                        <th>과목</th>
                        <th>현재 원점수</th>
                        <th>표점 / 등급</th>
                        <th>+1점 효율 (환산↑)</th>
                        <th>역추적 목표 / 상승</th>
                    </tr>
                </thead>
                <tbody>${subjectRows}</tbody>
            </table>
        </div>
        ${backtraceSummary}
    `;
}

function renderTargetUnivsByExam() {
    if (!currentStudentData) return;

    const q = currentStudentData.quantitative || {};
    const filterEl = document.getElementById('targetUnivExamFilter');
    const chosenKey = filterEl && filterEl.value ? filterEl.value : (Object.keys(q).find((k) => q[k]) || '');
    selectedTargetExamKey = chosenKey || selectedTargetExamKey;
    renderTargetUnivs(currentStudentData.targetUnivs || [], q);
}

function renderQualitativeDetail(q) {
    const area = document.getElementById('qualContentArea');
    if (!q) { area.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">데이터가 없습니다.</p>'; return; }

    const v = (val) => val ? escapeHtml(val) : '-';

    area.innerHTML = `
        <div class="qual-section"><div class="qual-head">📍 현재 상황</div><div class="qual-grid">
            <div class="qual-item"><span class="detail-label">학년</span><div>${v(q.status)}</div></div>
            <div class="qual-item"><span class="detail-label">출신 학교</span><div>${v(q.school)}</div></div>
            <div class="qual-item"><span class="detail-label">희망 계열</span><div>${v(q.stream)}</div></div>
        </div></div>
        <div class="qual-section"><div class="qual-head">📍 컨설팅 요청사항</div><div class="qual-grid">
            <div class="qual-item" style="grid-column: 1 / -1;"><span class="detail-label">스터디크랙을 통해 얻고 싶은 점</span><div style="margin-top:6px; white-space:pre-wrap; line-height:1.6;">${v(q.benefits)}</div></div>
            <div class="qual-item" style="grid-column: 1 / -1;"><span class="detail-label">입시 고민 및 질문</span><div style="margin-top:6px; white-space:pre-wrap; line-height:1.6;">${v(q.questions)}</div></div>
        </div></div>
    `;
}

function renderPayments(p) {
    const listBody = document.getElementById('viewPaymentList');
    const totalEl = document.getElementById('payTotalAmount');
    const lastDateEl = document.getElementById('payLastDate');
    if (!listBody || !totalEl || !lastDateEl) return;
    listBody.innerHTML = "";
    if (p && p.length > 0) {
        const sortedP = [...p].sort((a,b) => new Date(b.date) - new Date(a.date));
        let total = 0;
        sortedP.forEach(item => total += parseInt(item.amount || 0));
        totalEl.innerText = total.toLocaleString() + "원";
        lastDateEl.innerText = new Date(sortedP[0].date).toLocaleDateString();
        sortedP.forEach(pay => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td data-label="결제 상품">${escapeHtml(pay.product)}</td><td data-label="결제 일시">${new Date(pay.date).toLocaleString()}</td><td data-label="금액" style="text-align:right;">${parseInt(pay.amount).toLocaleString()}원</td>`;
            listBody.appendChild(tr);
        });
    } else {
        totalEl.innerText = "0원"; lastDateEl.innerText = "-";
        listBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px;">결제 내역 없음</td></tr>`;
    }
}

async function saveAdminMemo() {
    const memoEl = document.getElementById('adminMemoInput');
    if (!memoEl) return;
    const memo = memoEl.value;
    try {
        await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'save_shared_memo',
                data: { targetUserId: targetUserId, memo: memo }
            })
        });
        alert("메모 저장 완료");
    } catch(e) {
        if (e.message === "Auth expired") return;
        // 레거시 백엔드 호환: shared memo API가 아직 배포되지 않은 경우 관리자 경로로 1회 폴백
        if (!isTutorView) {
            try {
                await apiFetch(ADMIN_API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        type: 'admin_update_memo',
                        data: { targetUserId: targetUserId, memo: memo }
                    })
                });
                alert("메모 저장 완료");
                return;
            } catch (_) {
                // noop
            }
        }
        alert("메모 저장 실패: 서버 배포 상태 또는 권한을 확인해주세요.");
    }
}

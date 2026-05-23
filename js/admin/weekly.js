// js/admin/weekly.js
// 주간 학습 점검 리포트 렌더링 및 튜터 피드백 기능
// currentWeeklyData, targetUserId, apiFetch, escapeHtml, formatReportKey, REPORT_API_URL, FILE_API_URL,
// updateCharCount 는 detail-core.js / shared/api.js / shared/utils.js 에서 제공

function renderWeeklyTab() {
    const container = document.getElementById('weeklyListContainer');
    container.innerHTML = '';

    const weeklyHistory = currentWeeklyData || [];
    const selYear = document.getElementById('filterYear')?.value;
    const selMonth = document.getElementById('filterMonth')?.value;

    // 필터링 로직: weekId('260401') 형식에서 년/월을 정확히 뽑아내어 드롭다운 값과 비교
    const filtered = weeklyHistory.filter(w => {
        const keyMatch = w.weekId?.match(/^(\d{2})(\d{2})\d{2}$/);
        let y = null, m = null;

        if (keyMatch) {
            y = "20" + keyMatch[1]; // '26' -> '2026'
            m = parseInt(keyMatch[2], 10).toString(); // '04' -> '4' (0 없애기)
        } else if (w.date) {
            const d = new Date(w.date);
            y = d.getFullYear().toString();
            m = (d.getMonth() + 1).toString();
        }

        const yearMatch = !selYear || y === selYear;
        const monthMatch = !selMonth || m === selMonth;

        return yearMatch && monthMatch;
    });

    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-msg" style="text-align:center; padding:40px; color:#cbd5e1;">해당 월의 리포트가 없습니다.</div>';
        return;
    }

    filtered.forEach((d, idx) => {
        const dateStr = new Date(d.date).toLocaleDateString();
        const safeComment = d.comment ? escapeHtml(d.comment) : '';

        // 제목 렌더링: formatReportKey 적용
        const displayTitle = formatReportKey(d.weekId, false) || d.title || (idx + 1) + '주차 리포트';

        let studyHtml = '';
        if (d.studyTime && Array.isArray(d.studyTime.details)) {
            let rows = '';
            d.studyTime.details.forEach(sub => {
                const rate = sub.plan > 0 ? Math.min((sub.act / sub.plan) * 100, 100).toFixed(0) : 0;
                const rateClass = rate >= 100 ? 'text-green' : (rate >= 80 ? 'text-blue' : 'text-gray');
                rows += `<tr><td style="text-align:left;">${escapeHtml(sub.subject)}</td><td class="text-center">${sub.plan}h</td><td class="text-center">${sub.act}h</td><td class="text-center font-bold ${rateClass}">${rate}%</td></tr>`;
            });
            studyHtml = `<div class="weekly-section"><div class="section-title"><i class="fas fa-clock"></i> 과목별 학습 달성도 (총 달성률: <span style="color:#2563eb;">${d.studyTime.totalRate || '0%'}</span>)</div><div class="table-responsive" style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch;"><table class="compact-table" style="min-width:300px; width:100%;"><thead><tr><th style="text-align:left;">과목</th><th class="text-center">계획</th><th class="text-center">실행</th><th class="text-center">달성</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
        }

        const reportFormVer = Number(d.formVersion) || 1;
        const nl2br = (str) => str ? escapeHtml(str).replace(/\n/g, '<br>') : '';

        let checkHtml = '';
        let mockHtml = '';
        let footerHtml = '';

        if (reportFormVer >= 2) {
            // V2: 학생 주간 정보 섹션
            let v2Items = '';
            if (d.bestPart) v2Items += `<div style="padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; margin-bottom:8px;"><strong style="color:#15803d; font-size:0.85rem;">잘 된 부분</strong><div style="margin-top:4px; color:#334155; font-size:0.9rem; white-space:pre-wrap;">${nl2br(d.bestPart)}</div></div>`;
            if (d.hardPart) v2Items += `<div style="padding:10px; background:#fff1f2; border:1px solid #fecaca; border-radius:8px; margin-bottom:8px;"><strong style="color:#dc2626; font-size:0.85rem;">어려웠던 부분</strong><div style="margin-top:4px; color:#334155; font-size:0.9rem; white-space:pre-wrap;">${nl2br(d.hardPart)}</div></div>`;
            if (d.weeklyAvailableTime) {
                const wt = d.weeklyAvailableTime;
                const days = [['월',wt.mon],['화',wt.tue],['수',wt.wed],['목',wt.thu],['금',wt.fri],['토',wt.sat],['일',wt.sun]];
                const total = days.reduce((s, x) => s + (parseFloat(x[1]) || 0), 0);
                v2Items += `<div style="margin-bottom:8px;"><strong style="font-size:0.85rem; color:#1e293b;">공부 가능 시간</strong><div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">${days.map(x => `<span style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:6px; padding:3px 8px; font-size:0.8rem;"><strong>${x[0]}</strong> ${x[1]||0}h</span>`).join('')}</div><div style="text-align:right; font-size:0.85rem; color:#475569; margin-top:4px;">합계: <strong style="color:#2563eb;">${total}시간</strong></div></div>`;
            }
            if (d.currentMaterials) v2Items += `<div style="margin-bottom:8px;"><strong style="font-size:0.85rem; color:#64748b;">진행 중 교재/강의</strong><div style="color:#334155; font-size:0.9rem; margin-top:4px; white-space:pre-wrap;">${nl2br(d.currentMaterials)}</div></div>`;
            if (d.weeklyGoal) v2Items += `<div style="margin-bottom:8px;"><strong style="font-size:0.85rem; color:#64748b;">이번 주 목표</strong><div style="color:#334155; font-size:0.9rem; margin-top:4px; white-space:pre-wrap;">${nl2br(d.weeklyGoal)}</div></div>`;
            if (d.stuckSubject) v2Items += `<div style="padding:10px; background:#fefce8; border:1px solid #fde68a; border-radius:8px; margin-bottom:8px;"><strong style="color:#92400e; font-size:0.85rem;">막히는 과목/유형</strong><div style="margin-top:4px; color:#334155; font-size:0.9rem; white-space:pre-wrap;">${nl2br(d.stuckSubject)}</div></div>`;
            if (d.fixedSchedule) v2Items += `<div style="margin-bottom:8px;"><strong style="font-size:0.85rem; color:#64748b;">고정 일정</strong><div style="color:#334155; font-size:0.9rem; margin-top:4px; white-space:pre-wrap;">${nl2br(d.fixedSchedule)}</div></div>`;
            if (d.questionToTutor) v2Items += `<div style="padding:10px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; margin-bottom:8px;"><strong style="color:#1d4ed8; font-size:0.85rem;">튜터에게 질문</strong><div style="margin-top:4px; color:#334155; font-size:0.9rem; white-space:pre-wrap;">${nl2br(d.questionToTutor)}</div></div>`;
            if (v2Items) {
                checkHtml = `<div class="weekly-section"><div class="section-title"><i class="fas fa-clipboard-check"></i> 학생 주간 정보</div>${v2Items}</div>`;
            }
        } else {
            // V1: 기존 심층 질문 + 트렌드 (과거 리포트 열람 전용)
            if (d.deepAnswers && d.deepAnswers.length > 0) {
                const QUESTIONS = ['학습 계획 점검', '학습 방향성 설정', '취약 과목 솔루션', '기타 멘탈 관리'];
                const listItems = d.deepAnswers.map((ans, i) => {
                   const questionLabel = QUESTIONS[i] ? `<span style="color:#1e293b; font-weight:800; margin-right:4px;">${QUESTIONS[i]}:</span>` : '';
                   return `<li><i class="fas fa-check-circle text-blue" style="margin-top:4px; flex-shrink:0;"></i><div style="flex:1;">${questionLabel} ${escapeHtml(ans)}</div></li>`;
                }).join('');

                let trendHtml = '';
                if (d.trend) {
                    const statusMap = { 'up': '상승세 🔥', 'down': '하락세 📉', 'keep': '유지중 -' };
                    const statusText = statusMap[d.trend.status] || '유지중 -';
                    let reasonHtml = '';
                    if (d.trend.status === 'down' && Array.isArray(d.trend.reasons) && d.trend.reasons.length > 0) {
                        const reasonMap = { 'overplan': '계획 과다', 'sense': '실전 감각 저하', 'condition': '컨디션/건강', 'etc': '기타' };
                        const translatedReasons = d.trend.reasons.map(r => reasonMap[r] || r).join(', ');
                        reasonHtml = `<div style="font-size: 0.85rem; color: #dc2626; margin-top: 8px; padding: 8px 12px; background: #fef2f2; border-radius: 6px; display: inline-block; font-weight: normal; border: 1px solid #fecaca;">⚠️ <strong>원인:</strong> ${escapeHtml(translatedReasons)}</div>`;
                    }
                    trendHtml = `<div class="trend-badge ${d.trend.status || 'keep'}" style="display: flex; flex-direction: column; align-items: flex-start;"><div style="font-weight: bold;">학습 흐름: ${statusText}</div>${reasonHtml}</div>`;
                }
                checkHtml = `<div class="weekly-section"><div class="section-title"><i class="fas fa-clipboard-check"></i> 이번주 심층 질문</div><ul class="check-list">${listItems}</ul>${trendHtml}</div>`;
            }

            // V1 전용: 모의고사 + 플래너 인증
            if (d.mockExam && d.mockExam.scores) {
                const s = d.mockExam.scores;
                const typeMap = { 'school': '교내', 'edu': '평가원/교육청', 'private': '사설' };
                const typeLabel = typeMap[d.mockExam.type] || '기타';
                const typeBadge = `<span class="mock-type-badge ${d.mockExam.type || ''}">${typeLabel}</span>`;
                const scoreItems = [
                    { l: '국어', v: s.kor }, { l: '수학', v: s.math }, { l: '영어', v: s.eng },
                    { l: s.inq1Name || '탐1', v: s.inq1 }, { l: s.inq2Name || '탐2', v: s.inq2 }
                ].map(item => item.v ? `<div class="score-pill"><span class="lbl">${item.l}</span><span class="val">${item.v}</span></div>` : '').join('');
                let proofHtml = '';
                if (d.mockExam.proofFile && d.mockExam.proofFile.startsWith('http')) {
                    proofHtml = `<div style="margin-top:15px; padding-top:15px; border-top:1px dashed #e2e8f0; text-align:right;"><a href="${d.mockExam.proofFile}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#eff6ff; color:#2563eb; padding:8px 16px; border-radius:6px; text-decoration:none; font-size:0.85rem; font-weight:bold; transition:all 0.2s; white-space:nowrap;"><i class="fas fa-file-invoice"></i> 📝 모의고사 성적표 원본 보기</a></div>`;
                }
                mockHtml = `<div class="weekly-mock-box"><div class="mock-header"><i class="fas fa-edit"></i> 주간 모의고사 결과 ${typeBadge}</div><div class="score-pills-container">${scoreItems}</div>${proofHtml}</div>`;
            }

            const hasFiles = d.plannerFiles && d.plannerFiles.length > 0;
            const hasComment = !!d.comment;
            if (hasFiles || hasComment) {
                let fileLinks = '';
                if (hasFiles) {
                    fileLinks = d.plannerFiles.map((f, i) => {
                        let rawName = typeof f === 'string' ? decodeURIComponent(f.split('/').pop()) : `파일 ${i+1}`;
                        let cleanName = rawName.includes('_') ? rawName.split('_').slice(1).join('_') : rawName;
                        return `<a href="${f}" target="_blank" class="file-chip" style="display:inline-flex; align-items:center; gap:6px; background:#f8fafc; border:1px solid #cbd5e1; color:#334155; padding:8px 14px; border-radius:20px; text-decoration:none; font-size:0.85rem; margin:0 8px 8px 0; transition:all 0.2s;"><i class="fas fa-paperclip" style="color:#64748b;"></i> ${cleanName}</a>`;
                    }).join('');
                }
                footerHtml = `<div class="weekly-section planner-auth-section" style="margin-top:20px; padding-top:20px; border-top:1px solid #e2e8f0; background:#ffffff;">${hasFiles ? `<div class="section-title" style="margin-bottom:15px; font-weight:bold; color:#1e293b;"><i class="fas fa-camera-retro" style="color:#10b981;"></i> 주간 플래너 인증 사진</div><div class="file-area" style="display:flex; flex-wrap:wrap;">${fileLinks}</div>` : ''}${hasComment ? `<div class="comment-box" style="margin-top:${hasFiles ? '15px' : '0'}; background:#f1f5f9; padding:15px; border-radius:8px; color:#334155; font-size:0.95rem;"><strong style="color:#2563eb;"><i class="fas fa-comment-dots"></i> 학생 전달사항:</strong><div style="margin-top:8px; line-height:1.6;">${safeComment}</div></div>` : ''}</div>`;
            }
        }
        const defaultFb = reportFormVer >= 2
            ? { weeklyPlanner: '', planReason: '', questionAnswer: '', tutorComment: '' }
            : { priorityCheck: '', weakSubject: '', nextWeekTop3: '', planEvaluation: '', extraQuestion: '' };
        const fb = d.tutorFeedback || defaultFb;

        // 키값 설정 로직 (안전장치 포함)
        let weeklyKey = d.weekId;
        if (!weeklyKey) {
            const dateObj = new Date(d.date);
            const year = dateObj.getFullYear().toString().slice(2);
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
            const dayOfWeek = startOfMonth.getDay();
            const offsetDate = dateObj.getDate() + dayOfWeek - 1;
            const weekNum = String(Math.floor(offsetDate / 7) + 1).padStart(2, '0');
            weeklyKey = `${year}${month}${weekNum}`;
        }

        const card = document.createElement('div');
        card.className = 'timeline-card weekly-new';
        card.innerHTML = `
            <div class="card-header-row">
                <div class="left">
                    <span class="week-title">${displayTitle}</span> <span class="week-date">${dateStr}</span>
                </div>
            </div>
            <div class="card-grid-body">${studyHtml}${checkHtml}</div>
            ${mockHtml}${footerHtml}
            ${renderWeeklyFeedbackArea(weeklyKey, fb, reportFormVer, {
                weekId: d.weekId || '',
                reportKey: d.reportKey || '',
                reportDate: d.reportDate || d.date || '',
                formVersion: reportFormVer
            })}
        `;
        container.appendChild(card);
    });
}

// ==========================================
// 주간 리포트 - 튜터 코멘트 영역 렌더링
// ==========================================
const WEEKLY_FB_FIELDS_V1 = [
    { key: 'priorityCheck',  label: '이번 주 우선순위 점검',        placeholder: '이번 주 학습 목표 이행 여부와 우선순위를 평가해주세요.' },
    { key: 'weakSubject',    label: '취약 과목 진단 및 개입 포인트', placeholder: '취약 과목에 대한 구체적인 진단과 개선 방향을 작성해주세요.' },
    { key: 'nextWeekTop3',   label: '다음 주 핵심 과제 Top3',        placeholder: '다음 주에 집중해야 할 핵심 과제 3가지를 작성해주세요.' },
    { key: 'planEvaluation', label: '플랜 평가 및 조정',             placeholder: '이번 주 플랜 달성률을 평가하고 조정 방향을 제시해주세요.' },
    { key: 'extraQuestion',  label: '심층 질문 답변',                placeholder: '학생의 심층 질문에 대한 답변을 근거와 함께 작성해주세요.' },
];
const WEEKLY_FB_FIELDS_V2 = [
    { key: 'weeklyPlanner',   label: '요일별 플래너',           placeholder: '요일별 학습 계획을 작성해주세요. (예: 월-수학 수분감 p82~92/120분, 화-국어 이감 독서+오답/90분)' },
    { key: 'planReason',      label: '이렇게 짠 이유',          placeholder: '위 플래너를 이렇게 구성한 근거를 작성해주세요.' },
    { key: 'questionAnswer',  label: '학생 질문에 대한 답변',   placeholder: '학생이 남긴 질문에 대한 답변을 작성해주세요.' },
    { key: 'tutorComment',    label: '튜터 총평 코멘트',        placeholder: '이번 주 전체적인 학습 상태에 대한 총평을 작성해주세요.' },
];
function getWeeklyFbFields(ver) { return ver >= 2 ? WEEKLY_FB_FIELDS_V2 : WEEKLY_FB_FIELDS_V1; }
const WEEKLY_FB_MIN = 150;
const WEEKLY_FB_META_KEYS = new Set(['submitted', 'tutorImage', 'feedbackVersion', 'updatedAt', 'createdAt']);
const WEEKLY_FB_LABEL_MAP = [...WEEKLY_FB_FIELDS_V1, ...WEEKLY_FB_FIELDS_V2].reduce((acc, f) => {
    acc[f.key] = f.label;
    return acc;
}, {});

function humanizeFeedbackKey(key) {
    return String(key || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .trim();
}

function resolveWeeklyFeedbackFields(formVersion, feedback = {}) {
    const baseFields = getWeeklyFbFields(Number(formVersion) || 1);
    const baseKeys = new Set(baseFields.map(f => f.key));
    const dynamicFields = Object.keys(feedback || {})
        .filter((k) => {
            if (WEEKLY_FB_META_KEYS.has(k) || baseKeys.has(k)) return false;
            const val = feedback[k];
            return typeof val === 'string' && val.trim() !== '';
        })
        .map((k) => ({
            key: k,
            label: WEEKLY_FB_LABEL_MAP[k] || humanizeFeedbackKey(k),
            placeholder: `${WEEKLY_FB_LABEL_MAP[k] || humanizeFeedbackKey(k)} 내용을 입력해주세요.`
        }));
    return [...baseFields, ...dynamicFields];
}

function weeklyIdKey(weeklyKey) {
    return String(weeklyKey || '').replace(/[^a-zA-Z0-9]/g, '_');
}

function findWeeklyReportByKeys(...keys) {
    const normalized = [...new Set(keys.filter(Boolean).map(v => String(v)))];
    if (normalized.length === 0) return null;
    return (currentWeeklyData || []).find((w) => {
        const candidates = [w.weekId, w.reportKey, w.reportDate, w.date].filter(Boolean).map(v => String(v));
        return normalized.some(k => candidates.includes(k));
    }) || null;
}

function resolveWeeklyPayloadContext(weeklyKey) {
    const idk = weeklyIdKey(weeklyKey);
    const area = document.getElementById(`wfb_area_${idk}`);
    const areaWeekId = area?.dataset?.weekId || '';
    const areaReportKey = area?.dataset?.reportKey || '';
    const areaReportDate = area?.dataset?.reportDate || '';
    const areaFormVersion = Number(area?.dataset?.formVersion) || 1;

    const reportData = findWeeklyReportByKeys(weeklyKey, areaWeekId, areaReportKey, areaReportDate) || {};
    const weekId = reportData.weekId || areaWeekId || areaReportKey || String(weeklyKey || '');
    const reportKey = reportData.reportKey || areaReportKey || reportData.weekId || weekId;
    const reportDate = reportData.reportDate || areaReportDate || reportData.weekId || weekId;
    const formVersion = Number(reportData.formVersion) || areaFormVersion || 1;

    return { reportData, weekId, reportKey, reportDate, formVersion };
}

function renderWeeklyFeedbackArea(weeklyKey, fb, formVersion, reportMeta = {}) {
    const userRole = localStorage.getItem('userRole');
    const submitted = fb.submitted === true;
    const ver = Number(reportMeta.formVersion || formVersion || fb.feedbackVersion) || 1;
    if (userRole === 'tutor') {
        return submitted
            ? createWeeklyFbReadOnly(fb, true, ver)
            : createWeeklyFbInput(weeklyKey, fb, ver, reportMeta);
    }
    return createWeeklyFbReadOnly(fb, false, ver);
}

function createWeeklyFbReadOnly(fb, isLockedTutor, formVersion) {
    const fields = resolveWeeklyFeedbackFields(formVersion, fb);
    const hasAny = fields.some(f => fb[f.key] && String(fb[f.key]).trim() !== '');
    const lockedBadge = isLockedTutor
        ? '<span style="font-size:0.8rem; color:#16a34a; font-weight:bold; background:#f0fdf4; padding:3px 10px; border-radius:20px; border:1px solid #bbf7d0;">✅ 최종 전송 완료 · 수정 불가</span>'
        : '';

    const content = hasAny
        ? fields.map(f => fb[f.key] && String(fb[f.key]).trim() !== ''
            ? `<div style="margin-bottom:14px;"><strong>${f.label}:</strong><div style="margin-top:4px; line-height:1.6; white-space:pre-wrap;">${escapeHtml(fb[f.key])}</div></div>`
            : '').join('')
        : '<span style="color:#94a3b8">튜터가 코멘트를 작성하지 않았습니다.</span>';

    const fileHtml = fb.tutorImage
        ? `<div style="margin-top:15px; border-top:1px dashed #cbd5e1; padding-top:15px;"><strong>📎 첨삭 플래너 / 추가 자료:</strong><br><a href="${escapeHtml(fb.tutorImage)}" target="_blank" style="display:inline-block; margin-top:8px; background:#eff6ff; color:#2563eb; padding:8px 16px; border-radius:6px; text-decoration:none; font-weight:bold;"><i class="fas fa-file-download"></i> 첨부 파일 확인하기</a></div>`
        : '';

    return `
        <div class="tutor-feedback-area">
            <div class="feedback-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div>👩‍🏫 튜터 코멘트</div>${lockedBadge}
            </div>
            <div class="doc-text" style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-top:10px;">
                ${content}
                ${fileHtml}
            </div>
        </div>`;
}

function createWeeklyFbInput(weeklyKey, fb, formVersion, reportMeta = {}) {
    const idk = weeklyIdKey(weeklyKey);
    const resolvedFormVersion = Number(reportMeta.formVersion || formVersion || fb.feedbackVersion) || 1;
    const fields = resolveWeeklyFeedbackFields(resolvedFormVersion, fb);
    const attr = (v) => String(v || '').replace(/"/g, '&quot;');
    const fieldsHtml = fields.map(f => {
        const val = fb[f.key] || '';
        const len = val.replace(/\s/g, '').length;
        const validClass = len >= WEEKLY_FB_MIN ? 'valid' : '';

        const isSaved = len >= WEEKLY_FB_MIN;
        const btnClass = isSaved ? 'temp-save-btn saved' : 'temp-save-btn';
        const btnText = isSaved ? '저장됨' : '임시저장';

        return `
        <div class="write-item" style="margin-bottom:15px;">
            <label class="write-label">${f.label}</label>
            <textarea id="wfb_${idk}_${f.key}" class="write-textarea"
                placeholder="${f.placeholder} (최소 ${WEEKLY_FB_MIN}자)"
                oninput="updateCharCount(this,'wfb_cnt_${idk}_${f.key}',${WEEKLY_FB_MIN}); handleWeeklyInput('${idk}', '${f.key}');"
            >${escapeHtml(val)}</textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                <div id="wfb_cnt_${idk}_${f.key}" class="char-count ${validClass}">${len} / 최소 ${WEEKLY_FB_MIN}자</div>
                <button type="button" id="wfb_btn_${idk}_${f.key}" class="${btnClass}" data-role="draft-save"
                    onclick="tempSaveWeeklyField('${weeklyKey}','${f.key}')">${btnText}</button>
            </div>
        </div>`;
    }).join('');

    const allPreSaved = fields.every(f => (fb[f.key] || '').replace(/\s/g, '').length >= WEEKLY_FB_MIN);
    const submitBtnClass = allPreSaved ? 'complete-write-btn active' : 'complete-write-btn';

    const existingFileHtml = fb.tutorImage
        ? `<div style="margin-bottom:10px; font-size:0.85rem; color:#2563eb; background:#eff6ff; padding:8px 12px; border-radius:6px; border:1px solid #bfdbfe;"><i class="fas fa-file-check"></i> 현재 첨부된 파일: <a href="${escapeHtml(fb.tutorImage)}" target="_blank" style="text-decoration:underline; font-weight:bold;">보기</a></div>`
        : '';

    return `
        <div class="tutor-feedback-area" id="wfb_area_${idk}"
            data-week-id="${attr(reportMeta.weekId)}"
            data-report-key="${attr(reportMeta.reportKey)}"
            data-report-date="${attr(reportMeta.reportDate)}"
            data-form-version="${resolvedFormVersion}">
            <div class="feedback-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div>👩‍🏫 튜터 코멘트 작성</div>
                <button type="button" class="guide-btn" onclick="showCoachingGuideModal()"><i class="fas fa-info-circle"></i> 작성 가이드</button>
            </div>
            ${fieldsHtml}

            <div class="write-item" style="margin-bottom:15px; padding-top: 15px; border-top: 1px dashed #e2e8f0;">
                <label class="write-label">첨삭 플래너 / 추가 자료 (선택)</label>

                <div id="wfb_existing_file_${idk}">${existingFileHtml}</div>

                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="file" id="wfb_file_${idk}" accept=".pdf" style="font-size:0.9rem; padding:5px; border:1px solid #cbd5e1; border-radius:6px; flex:1; background:#fff;">
                    <button type="button" id="wfb_file_btn_${idk}" class="temp-save-btn" data-role="file-upload" onclick="uploadWeeklyTutorFile('${weeklyKey}')" style="white-space:nowrap;"><i class="fas fa-upload"></i> 업로드</button>
                </div>
                <p style="font-size:0.8rem; color:#94a3b8; margin-top:5px;">* PDF 파일만 업로드 가능합니다. (학생에게 리포트와 함께 전달됩니다)</p>
            </div>

            <div style="text-align:right; margin-top:10px;">
                <button type="button" id="wfb_submit_${idk}" class="${submitBtnClass}"
                    onclick="submitWeeklyFeedback('${weeklyKey}')">최종 전송 (학생에게 전달)</button>
            </div>
        </div>`;
}

window.handleWeeklyInput = function(idk, key) {
    const btn = document.getElementById(`wfb_btn_${idk}_${key}`);
    if (btn && btn.classList.contains('saved')) {
        btn.classList.remove('saved');
        btn.innerText = '임시저장';
    }
    checkWeeklyAllSaved(idk);
};

window.checkWeeklyAllSaved = function(idk) {
    const area = document.getElementById(`wfb_area_${idk}`);
    if (!area) return;

    const btns = area.querySelectorAll('button[data-role="draft-save"]');
    const allSaved = btns.length > 0 && Array.from(btns).every(b => b.classList.contains('saved'));

    const submitBtn = document.getElementById(`wfb_submit_${idk}`);
    if (submitBtn) {
        if (allSaved) {
            submitBtn.classList.add('active');
        } else {
            submitBtn.classList.remove('active');
        }
    }
};

window.uploadWeeklyTutorFile = async function(weeklyKey) {
    const idk = weeklyIdKey(weeklyKey);
    const fileInput = document.getElementById(`wfb_file_${idk}`);
    if (!fileInput.files || fileInput.files.length === 0) return alert("업로드할 파일을 선택해주세요.");

    const file = fileInput.files[0];
    const btn = document.getElementById(`wfb_file_btn_${idk}`);
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 업로드 중...';
    btn.disabled = true;

    try {
        // 1. S3 Presigned URL 발급
        const urlResponse = await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_presigned_url', data: { fileName: encodeURIComponent(file.name), fileType: file.type, folder: 'tutor_feedback' } })
        });
        const { uploadUrl, fileUrl, fields } = await urlResponse.json();

        // 2. S3 직접 업로드
        const formData = new FormData();
        Object.entries(fields || {}).forEach(([k, v]) => formData.append(k, v));
        formData.append('file', file);

        const uploadResult = await fetch(uploadUrl, { method: 'POST', body: formData });
        if (!uploadResult.ok) throw new Error("S3 업로드 실패");

        // 3. 현재 입력된 텍스트 코멘트도 함께 모아서 DB 임시저장
        const context = resolveWeeklyPayloadContext(weeklyKey);
        const reportDataForVer = context.reportData || {};
        const uploadFields = resolveWeeklyFeedbackFields(context.formVersion, reportDataForVer.tutorFeedback || {});
        const feedback = {};
        uploadFields.forEach(f => {
            const el = document.getElementById(`wfb_${idk}_${f.key}`);
            feedback[f.key] = el ? el.value : '';
        });
        feedback.tutorImage = fileUrl; // 새로 업로드된 URL 포함
        feedback.feedbackVersion = context.formVersion;

        // 4. 로컬 데이터 갱신 (저장 시 덮어씌워지지 않게 메모리 유지)
        const reportData = context.reportData;
        if (reportData) {
            if (!reportData.tutorFeedback) reportData.tutorFeedback = {};
            reportData.tutorFeedback.tutorImage = fileUrl;
        }

        await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'tutor_save_weekly_draft',
                data: {
                    targetUserId,
                    reportDate: context.reportDate,
                    weekId: context.weekId,
                    reportKey: context.reportKey,
                    tutorFeedback: feedback
                }
            })
        });

        alert("파일이 성공적으로 업로드되었습니다.");

        // 탭 전체 새로고침 없이 해당 UI 부분만 즉시 업데이트
        const existingContainer = document.getElementById(`wfb_existing_file_${idk}`);
        if (existingContainer) {
            existingContainer.innerHTML = `<div style="margin-bottom:10px; font-size:0.85rem; color:#2563eb; background:#eff6ff; padding:8px 12px; border-radius:6px; border:1px solid #bfdbfe;"><i class="fas fa-file-check"></i> 현재 첨부된 파일: <a href="${escapeHtml(fileUrl)}" target="_blank" style="text-decoration:underline; font-weight:bold;">보기</a></div>`;
        }

        fileInput.value = '';
        btn.innerHTML = originalText;
        btn.disabled = false;

    } catch (e) {
        if (e.message !== "Auth expired") alert("파일 업로드에 실패했습니다.");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.tempSaveWeeklyField = async function(weeklyKey, fieldName) {
    const idk = weeklyIdKey(weeklyKey);
    const btn = document.getElementById(`wfb_btn_${idk}_${fieldName}`);
    const textarea = document.getElementById(`wfb_${idk}_${fieldName}`);
    if (!btn || !textarea) return;

    const val = textarea.value;
    const valLen = val.replace(/\s/g, '').length;
    if (valLen < WEEKLY_FB_MIN) {
        alert(`최소 ${WEEKLY_FB_MIN}자 이상 입력해주세요. (현재 ${valLen}자, 공백 제외)`);
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = '저장 중...'; btn.disabled = true;

    // 기존 데이터 메모리에서 파일 URL 가져오기
    const context = resolveWeeklyPayloadContext(weeklyKey);
    const reportData = context.reportData || {};
    const existingFb = reportData.tutorFeedback || {};
    const draftFields = resolveWeeklyFeedbackFields(context.formVersion, existingFb);

    const feedback = {};
    draftFields.forEach(f => {
        const el = document.getElementById(`wfb_${idk}_${f.key}`);
        feedback[f.key] = el ? el.value : '';
    });
    feedback.tutorImage = existingFb.tutorImage || ''; // 기존 파일 URL 유지
    feedback.feedbackVersion = context.formVersion;

    try {
        await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'tutor_save_weekly_draft',
                data: {
                    targetUserId,
                    reportDate: context.reportDate,
                    weekId: context.weekId,
                    reportKey: context.reportKey,
                    tutorFeedback: feedback
                }
            })
        });
        btn.classList.add('saved'); btn.innerText = '저장됨'; btn.disabled = false;
        checkWeeklyAllSaved(idk);
    } catch (e) {
        if (e.message !== 'Auth expired') alert('임시 저장에 실패했습니다.');
        btn.innerText = originalText; btn.disabled = false;
    }
};

window.submitWeeklyFeedback = async function(weeklyKey) {
    const idk = weeklyIdKey(weeklyKey);
    const context = resolveWeeklyPayloadContext(weeklyKey);
    const reportData = context.reportData || {};
    const reportFormVer = context.formVersion;
    const fields = resolveWeeklyFeedbackFields(reportFormVer, reportData.tutorFeedback || {});

    for (const f of fields) {
        const el = document.getElementById(`wfb_${idk}_${f.key}`);
        if (!el || el.value.replace(/\s/g, '').length < WEEKLY_FB_MIN) {
            alert(`'${f.label}' 항목을 최소 ${WEEKLY_FB_MIN}자 이상 입력해주세요. (공백 제외)`);
            return;
        }
    }

    if (!confirm('최종 전송 후에는 더 이상 수정할 수 없습니다.\n학생에게 코멘트를 전달하시겠습니까?')) return;

    const existingFb = reportData.tutorFeedback || {};

    const feedback = {};
    fields.forEach(f => {
        const el = document.getElementById(`wfb_${idk}_${f.key}`);
        feedback[f.key] = el ? el.value : '';
    });
    feedback.feedbackVersion = reportFormVer;
    feedback.tutorImage = existingFb.tutorImage || '';
    feedback.submitted = true;

    const submitBtn = document.getElementById(`wfb_submit_${idk}`);
    if (submitBtn) { submitBtn.innerText = '전송 중...'; submitBtn.disabled = true; }

    try {
        await apiFetch(REPORT_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'tutor_submit_weekly_feedback',
                data: {
                    targetUserId,
                    reportDate: context.reportDate,
                    weekId: context.weekId,
                    reportKey: context.reportKey,
                    tutorFeedback: feedback
                }
            })
        });
        alert('학생에게 코멘트가 전달되었습니다.');

        // 제출 후 폼을 읽기 전용으로 전환
        const area = document.getElementById(`wfb_area_${idk}`);
        if (area) area.outerHTML = createWeeklyFbReadOnly(feedback, true, reportFormVer);

    } catch (e) {
        if (e.message !== 'Auth expired') alert('전송에 실패했습니다.');
        if (submitBtn) { submitBtn.innerText = '최종 전송 (학생에게 전달)'; submitBtn.disabled = false; }
    }
};

// js/admin_detail.js

const urlParams = new URLSearchParams(window.location.search);
const targetUserId = urlParams.get('uid');
const adminId = localStorage.getItem('userId');
const ADMIN_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";

document.addEventListener('DOMContentLoaded', () => {
    if (!targetUserId || !adminId) {
        alert("잘못된 접근입니다.");
        window.location.href = 'admin.html';
        return;
    }
    loadStudentDetail();
});

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById('tab_' + tabName);
    if(target) target.classList.add('active');
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
}

// [보안] XSS 방지용 HTML 이스케이프 함수 (필수)
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
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_get_user_detail',
                userId: adminId,
                data: { targetUserId: targetUserId }
            })
        });

        if (!response.ok) throw new Error("Server Error");
        const data = await response.json();
        
        renderData(data);
    } catch (e) {
        console.error(e);
        alert("데이터 로드 실패");
    }
}

function renderData(s) {
    if (!s) return;

    // 1. 기본 정보 (escapeHtml 적용)
    document.getElementById('viewName').innerText = s.name || '미입력';
    document.getElementById('viewEmail').innerText = s.email || '-';
    document.getElementById('viewSchool').innerText = s.school || '-';
    document.getElementById('viewPhone').innerText = s.phone || '-';
    document.getElementById('viewEmailFull').innerText = s.email || '-';
    document.getElementById('viewJoinDate').innerText = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-';

    // 2. 뱃지 & 메모
    renderTierBadge(s.payments || []);
    updateAnalysisBadge(s.analysisStatus);
    document.getElementById('analysisEditor').value = s.analysisContent || '';
    document.getElementById('adminMemoInput').value = s.adminMemo || '';

    // 3. 목표 대학 리스트
    renderTargetUnivs(s.targetUnivs || []);

    // 4. 각 탭 데이터 렌더링
    renderQualitativeDetail(s.qualitative);
    renderQuantitativeDetail(s.quantitative);
    renderConsultHistory(s.weeklyHistory || [], s.deepCoachingHistory || []); 
    renderPayments(s.payments || []);
}

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
        
        // [보안] innerHTML 사용 시 escapeHtml 적용
        div.innerHTML = `
            <div>
                <strong>${idx+1}. ${escapeHtml(u.univ)}</strong>
                <div class="major">${escapeHtml(u.major)}</div>
            </div>
            <div class="date">${dateStr}</div>
        `;
        container.appendChild(div);
    });
}

// 상담/코칭 타임라인 (여기가 XSS 취약점이 가장 많은 곳이므로 주의)
function renderConsultHistory(weekly, deep) {
    const container = document.getElementById('consultTimeline');
    container.innerHTML = '';

    let allItems = [];
    
    if (Array.isArray(weekly)) {
        weekly.forEach(w => {
            allItems.push({ type: 'weekly', date: w.date, title: w.title || '주간 학습 점검', data: w });
        });
    }
    if (Array.isArray(deep)) {
        deep.forEach(d => {
            allItems.push({ type: 'deep', date: d.date, title: '심층 코칭 요청', data: d });
        });
    }

    allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allItems.length === 0) {
        container.innerHTML = '<div class="empty-msg" style="text-align:center; padding:30px; color:#cbd5e1;">데이터가 없습니다.</div>';
        return;
    }

    allItems.forEach((item, idx) => {
        const dateStr = new Date(item.date).toLocaleString();
        const isWeekly = item.type === 'weekly';
        const typeClass = isWeekly ? 'weekly' : 'deep';
        const typeLabel = isWeekly ? 'WEEKLY CHECK' : 'DEEP COACHING';
        
        let contentHtml = '';
        const d = item.data;

        if (isWeekly) {
            let detailsHtml = '';
            if (d.studyTime && Array.isArray(d.studyTime.details)) {
                detailsHtml = `<table style="width:100%; font-size:0.85rem; border-collapse: collapse; margin-top:8px; margin-bottom:8px;">
                    <tr style="background:#eef2ff; border-bottom:1px solid #dbeafe;">
                        <th style="padding:4px; text-align:left;">과목</th>
                        <th style="padding:4px; text-align:center;">계획</th>
                        <th style="padding:4px; text-align:center;">실제</th>
                        <th style="padding:4px; text-align:center;">달성률</th>
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

            // [보안] 코멘트, 이유 등 사용자가 쓴 글은 모두 escapeHtml 처리
            const safeComment = escapeHtml(d.comment);
            const safeReasons = d.trend?.reasons ? d.trend.reasons.map(r => escapeHtml(r)).join(', ') : '';

            contentHtml = `
                <div style="margin-bottom:8px;">
                    <span style="font-weight:bold; color:#2563eb;">총 달성률: ${d.studyTime?.totalRate || '0%'}</span> 
                    <span style="color:#64748b; font-size:0.9rem;">(계획 ${d.studyTime?.totalPlan || 0}H / 실제 ${d.studyTime?.totalAct || 0}H)</span>
                </div>
                
                ${detailsHtml}

                <div style="margin-top:10px; padding:10px; background:#fff; border-radius:6px; border:1px solid #e2e8f0;">
                    <strong>💬 코멘트:</strong> ${safeComment}
                </div>

                <div class="hidden-detail" id="detail-${idx}">
                    <p><strong>- 모의고사:</strong> ${d.mockExam?.type === 'none' ? '미응시' : `응시 (${escapeHtml(d.mockExam?.type)})`}</p>
                    ${d.mockExam?.type !== 'none' && d.mockExam?.scores ? 
                        `<p style="font-size:0.85rem; margin-left:10px; color:#475569;">
                            국:${d.mockExam.scores.kor} / 수:${d.mockExam.scores.math} / 영:${d.mockExam.scores.eng} / 
                            탐1:${d.mockExam.scores.inq1} / 탐2:${d.mockExam.scores.inq2}
                        </p>` : ''
                    }
                    <p><strong>- 학업 추이:</strong> ${d.trend?.status === 'up' ? '📈 상승' : (d.trend?.status === 'down' ? '📉 하락' : '➖ 유지')}</p>
                    ${d.trend?.status === 'down' && safeReasons ? `<p style="font-size:0.85rem; margin-left:10px; color:#ef4444;">└ 원인: ${safeReasons}</p>` : ''}
                </div>
                <div class="detail-toggle" onclick="toggleDetail('detail-${idx}')">상세 정보 더보기 ▼</div>
            `;
        } else {
            // Deep Coaching
            contentHtml = `
                <div><strong>[계획 점검]</strong> ${escapeHtml(d.plan)}</div>
                <div style="margin-top:5px;"><strong>[방향성]</strong> ${escapeHtml(d.direction)}</div>
                <div class="hidden-detail" id="detail-${idx}">
                    <p><strong>- 취약 과목:</strong> ${escapeHtml(d.subject)}</p>
                    <p><strong>- 기타/멘탈:</strong> ${escapeHtml(d.etc)}</p>
                </div>
                <div class="detail-toggle" onclick="toggleDetail('detail-${idx}')">전체 내용 보기 ▼</div>
            `;
        }

        const card = document.createElement('div');
        card.className = `timeline-card ${typeClass}`;
        card.innerHTML = `
            <div class="card-top">
                <span class="card-tag ${typeClass}">${typeLabel}</span>
                <span class="card-date">${dateStr}</span>
            </div>
            <div class="card-title">${item.title}</div>
            <div class="card-body">${contentHtml}</div>
        `;
        container.appendChild(card);
    });
}

function toggleDetail(id) {
    const el = document.getElementById(id);
    if(el.style.display === 'block') {
        el.style.display = 'none';
        event.target.innerText = '상세 보기 ▼';
    } else {
        el.style.display = 'block';
        event.target.innerText = '접기 ▲';
    }
}

function renderTierBadge(payments) {
    const area = document.getElementById('tierBadgeArea');
    let html = '<span class="tier-badge" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;">FREE USER</span>';
    
    if (payments && payments.length > 0) {
        const paid = payments.filter(p => p.status === 'paid');
        if (paid.length > 0) {
            paid.sort((a, b) => new Date(b.date) - new Date(a.date));
            const last = (paid[0].product || "").toLowerCase();
            
            if (last.includes('black')) html = '<span class="tier-badge" style="background: linear-gradient(to bottom right, #ffffff, #f8fafc); border: 2px solid #171717; color: #171717; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">BLACK TIER</span>';
            else if (last.includes('pro')) html = '<span class="tier-badge" style="background: linear-gradient(135deg, #F59E0B, #FCD34D); border: 2px solid #F59E0B; color: #78350f;">PRO TIER</span>';
            else if (last.includes('standard')) html = '<span class="tier-badge" style="background: linear-gradient(135deg, #94A3B8, #CBD5E1); border: 2px solid #64748B; color: #0F172A;">STANDARD TIER</span>';
            else html = '<span class="tier-badge" style="background: linear-gradient(135deg, #3B82F6, #60A5FA); border: 2px solid #3B82F6; color: white;">BASIC TIER</span>';
        }
    }
    area.innerHTML = html;
}

function updateAnalysisBadge(status) {
    const badge = document.getElementById('analysisStatusBadge');
    if(!badge) return;
    if (status === 'completed') { badge.className = 'analysis-badge completed'; badge.innerHTML = '✅ 분석 리포트 발송 완료'; }
    else { badge.className = 'analysis-badge pending'; badge.innerHTML = '⏳ 분석 대기중'; }
}

function renderQualitativeDetail(q) {
    const area = document.getElementById('qualContentArea');
    if (!q) { area.innerHTML = '<p style="text-align:center; color:#94a3b8;">데이터가 없습니다.</p>'; return; }
    
    const v = (val) => val ? escapeHtml(val) : '-'; // [보안] 여기도 escape
    let html = `<div class="qual-section"><div class="qual-head">📍 현재 상황</div><div class="qual-grid">
        <div class="qual-item"><span class="qual-label">신분</span><div>${v(q.status)}</div></div>
        <div class="qual-item"><span class="qual-label">계열</span><div>${v(q.stream)}</div></div>
        <div class="qual-item"><span class="qual-label">진로</span><div>${v(q.career)}</div></div></div></div>`;
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
    if(!content.trim()) return alert("내용을 입력하세요");
    if(!confirm("저장하시겠습니까?")) return;
    try {
        await fetch(ADMIN_API_URL, {
            method: 'POST', body: JSON.stringify({ type:'admin_save_analysis', userId:adminId, data:{targetUserId, content, status:'completed'} })
        });
        alert("저장 완료"); updateAnalysisBadge('completed');
    } catch(e) { alert("저장 실패"); }
}

async function saveAdminMemo() {
    const memo = document.getElementById('adminMemoInput').value;
    try {
        await fetch(ADMIN_API_URL, {
            method:'POST', body:JSON.stringify({ type:'admin_update_memo', userId:adminId, data:{targetUserId, memo} })
        });
        alert("메모 저장 완료");
    } catch(e) { alert("저장 실패"); }
}
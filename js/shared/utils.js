// js/shared/utils.js
// XSS 방어, 포맷 변환, UI 배지 생성 공유 유틸리티
// function 선언 사용 — auth.js와 함께 로드 시 마지막 정의가 우선됩니다.

function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatReportKey(key, isPro = true) {
    if (!key) return '알 수 없는 리포트';
    if (key.length === 6 && /^\d+$/.test(key)) {
        const yy = key.substring(0, 2);
        const mm = parseInt(key.substring(2, 4));
        const ww = parseInt(key.substring(4, 6));
        const suffix = isPro ? ' PRO 리포트' : '';
        return `${yy}년 ${mm}월 ${ww}주차${suffix}`;
    }
    const match = key.match(/^(\d{4})-W(\d{1,2})$/);
    if (match) {
        const suffix = isPro ? ' PRO 리포트' : '';
        return `${match[1]}년 ${match[2]}주차${suffix}`;
    }
    return key;
}

const KO_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
function formatKoDate(date, withTime = false) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const dow = KO_DAY_NAMES[date.getDay()];
    if (!withTime) return `${m}월 ${d}일 (${dow})`;
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${m}월 ${d}일 (${dow}) ${h}:${min}`;
}

function getTierBadgeHTML(studentItem) {
    if (!studentItem || !studentItem.currentSubscription || studentItem.currentSubscription.status !== 'active') {
        return '<span style="color:#64748b; background:#f1f5f9; padding:4px 8px; border-radius:12px; font-size:0.8rem;">FREE</span>';
    }
    const tier = (studentItem.currentSubscription.tier || '').toUpperCase();
    if (tier.includes('BLACK'))    return '<span style="color:#FFD700; background:#171717; padding:4px 8px; border-radius:12px; font-size:0.8rem; border:1px solid #333; font-weight:bold;">BLACK</span>';
    if (tier.includes('PRO'))      return '<span style="color:#92400e; background:#fef3c7; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">PRO</span>';
    if (tier.includes('STANDARD')) return '<span style="color:#334155; background:#e2e8f0; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">STANDARD</span>';
    return '<span style="color:#1e40af; background:#dbeafe; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">BASIC</span>';
}

const CONSULTING_API_URL = CONFIG.api.consulting;

async function requestConsultingAdmin(type, data = {}) {
    const response = await apiFetch(CONSULTING_API_URL, { method: 'POST', body: JSON.stringify({ type, data }) });
    const payload = await response.json();
    if (!payload || payload.success !== true || !payload.data) throw new Error('서버 응답을 확인할 수 없습니다.');
    return payload.data;
}

function consultingRequestKey(prefix) {
    if (typeof window.crypto?.randomUUID !== 'function') throw new Error('안전한 요청 식별자를 만들 수 없습니다.');
    return `${prefix}:${window.crypto.randomUUID()}`;
}

function setConsultingStatus(message, state = '') {
    const target = document.getElementById('consultingStatus');
    if (!target) return;
    target.textContent = message;
    target.dataset.state = state;
}

function formatConsultingDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatConsultingMoney(value) {
    return Number.isSafeInteger(Number(value)) ? `${Number(value).toLocaleString('ko-KR')}원` : '-';
}

const CONSULTING_API_URL = CONFIG.api.consulting;

async function requestConsultingAdmin(type, data = {}, signal) {
    const response = await apiFetch(CONSULTING_API_URL, { method: 'POST', body: JSON.stringify({ type, data }), ...(signal ? { signal } : {}) });
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
    return value != null && value !== '' && Number.isSafeInteger(Number(value)) ? `${Number(value).toLocaleString('ko-KR')}원` : '-';
}

function consultingOptionLabel(value, labels) {
    return Object.hasOwn(labels, value) ? labels[value] : value;
}

function createConsultingFacts(entries, decorate) {
    const list = document.createElement('dl');
    list.className = 'consulting-facts';
    for (const [label, value, field] of entries) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        description.textContent = value == null || value === '' ? '—' : String(value);
        decorate?.(description, field, label);
        row.append(term, description);
        list.appendChild(row);
    }
    return list;
}

function appendConsultingRecord(container, title, content) {
    const section = document.createElement('section');
    section.className = 'consulting-material-block';
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.append(heading, content);
    container.appendChild(section);
}

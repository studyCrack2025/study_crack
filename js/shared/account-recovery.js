const CONNECTION_ERROR = '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요.';
const RESPONSE_ERROR = '응답을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.';
const PASSWORD_ERROR = '비밀번호는 영문 대/소문자, 숫자, 특수문자를 모두 포함하여 8자 이상이어야 합니다.';

function recoveryError(status, type, data = {}) {
    let message = RESPONSE_ERROR;
    if (status >= 500) message = '서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
    else if (status === 429) message = '요청 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.';
    else if (status === 401 || status === 403) message = '요청을 확인하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.';
    else if (status === 404) message = type === 'find_email' ? '입력하신 정보와 일치하는 계정을 찾을 수 없습니다.' : '가입된 계정 정보를 찾을 수 없습니다. 이메일을 확인해주세요.';
    else if (status === 400) {
        if (type === 'reset_password') message = data.error === PASSWORD_ERROR || data.message === PASSWORD_ERROR ? PASSWORD_ERROR : '인증코드가 일치하지 않거나 만료되었습니다. 새 인증코드를 요청해주세요.';
        else message = type === 'find_email' ? '이름과 전화번호를 확인해주세요.' : '이메일을 확인해주세요.';
    }
    return Object.assign(new Error(message), { status });
}

export function formatRecoveryPhone(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('82')) digits = `0${digits.slice(2)}`;
    if (digits.startsWith('02')) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3');
    return digits.replace(/^(0\d{2})(\d{3,4})(\d{4})$/, '$1-$2-$3');
}

export async function requestAccountRecovery({ url, payload, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
    if (!url || typeof fetchImpl !== 'function' || !['find_email', 'send_pw_reset_code', 'reset_password'].includes(payload?.type)) throw new Error(RESPONSE_ERROR);
    const controller = new AbortController();
    let timer;
    try {
        return await Promise.race([
            (async () => {
                let response;
                try {
                    // 계정 복구에는 기존 로그인 정보나 세션 갱신을 사용하지 않는다.
                    response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: controller.signal, body: JSON.stringify(payload) });
                } catch (_) { throw new Error(CONNECTION_ERROR); }
                let data;
                try { data = await response.json(); }
                catch (_) { throw recoveryError(response.status, payload.type); }
                if (!response.ok) throw recoveryError(response.status, payload.type, data || {});
                if (data?.success !== true && !(payload.type === 'find_email' && data?.success === false)) throw new Error(RESPONSE_ERROR);
                return data;
            })(),
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error('응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'));
                    controller.abort();
                }, timeoutMs);
            })
        ]);
    } finally { clearTimeout(timer); }
}

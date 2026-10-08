(function() {
    'use strict';

    const INVITE_KEY = 'sc_jungsi_invite_v1';
    const status = document.getElementById('startStatus');
    const summary = document.getElementById('inviteSummary');
    const authActions = document.getElementById('authActions');
    const claimForm = document.getElementById('claimForm');
    const claimButton = document.getElementById('claimButton');

    function readInvite() {
        try {
            const value = JSON.parse(sessionStorage.getItem(INVITE_KEY) || 'null');
            if (value?.version !== 1 || !/^APP_[0-9a-f-]{36}$/i.test(value.applicationId || '')
                || !/^[A-Za-z0-9_-]{43}$/.test(value.token || '')
                || !/^claim_[0-9a-f-]{36}$/i.test(value.idempotencyKey || '')) return null;
            return value;
        } catch (_) { return null; }
    }

    function showStatus(message, tone = '') {
        status.textContent = message;
        if (tone) status.dataset.tone = tone;
        else delete status.dataset.tone;
    }

    function showClaimControls() {
        if (hasClientSession()) claimForm.hidden = false;
        else authActions.hidden = false;
    }

    async function preflight(invite) {
        const response = await fetch(CONFIG.api.consultingPublic, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            body: JSON.stringify({ type: 'public_preflight_v2_consulting_invite', data: { applicationId: invite.applicationId, token: invite.token } })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 409 && hasClientSession()) {
                showStatus('이미 처리된 초대인지 로그인 계정으로 확인해주세요.');
                showClaimControls();
                return;
            }
            throw Object.assign(new Error('INVITE_UNAVAILABLE'), { status: response.status, code: result.code });
        }
        document.getElementById('maskedEmail').textContent = result.data.maskedEmail;
        document.getElementById('maskedPhone').textContent = result.data.maskedPhone;
        document.getElementById('expiresAt').textContent = new Date(result.data.expiresAt).toLocaleString('ko-KR');
        summary.hidden = false;
        showStatus(hasClientSession() ? '이메일 인증코드를 입력해 이용 인증을 완료해주세요.' : '신청 시 입력한 연락처와 같은 계정으로 로그인해주세요.');
        showClaimControls();
    }

    async function claim(event) {
        event.preventDefault();
        const invite = readInvite();
        const code = document.getElementById('inviteCode').value.trim();
        if (!invite || !/^\d{10}$/.test(code)) {
            showStatus('이메일로 받은 10자리 인증코드를 확인해주세요.', 'error');
            return;
        }
        claimButton.disabled = true;
        try {
            const response = await apiFetch(CONFIG.api.consulting, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type: 'student_claim_v2_consulting_invite', data: {
                    applicationId: invite.applicationId, token: invite.token, code, idempotencyKey: invite.idempotencyKey
                } })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw Object.assign(new Error('CLAIM_FAILED'), { status: response.status, code: result.code });
            sessionStorage.removeItem(INVITE_KEY);
            claimForm.hidden = true;
            summary.hidden = true;
            showStatus('인증이 완료되었습니다. 기초조사서 작성 단계가 활성화되었습니다.', 'success');
        } catch (error) {
            if (error.status === 401) showStatus('로그인이 만료되었습니다. 다시 로그인해주세요.', 'error');
            else if (error.code === 'IDENTITY_MISMATCH') showStatus('가입 계정의 이메일 또는 전화번호가 신청 정보와 일치하지 않습니다.', 'error');
            else if (error.code === 'INVITE_LOCKED') showStatus('인증 시도가 잠겼습니다. 15분 후 다시 시도해주세요.', 'error');
            else showStatus('인증 정보를 확인하지 못했습니다. 코드와 초대 상태를 다시 확인해주세요.', 'error');
        } finally {
            claimButton.disabled = false;
        }
    }

    document.getElementById('clearInvite').addEventListener('click', () => {
        sessionStorage.removeItem(INVITE_KEY);
        summary.hidden = true;
        authActions.hidden = true;
        claimForm.hidden = true;
        showStatus('이 브라우저에서 초대 정보를 지웠습니다. 다시 시작하려면 받은 문자 링크를 열어주세요.');
    });
    claimForm.addEventListener('submit', claim);

    const invite = readInvite();
    if (!invite) {
        showStatus('유효한 초대 정보를 찾을 수 없습니다. 문자로 받은 링크를 다시 열어주세요.', 'error');
        return;
    }
    preflight(invite).catch((error) => {
        if (error.code === 'INVITE_EXPIRED' || error.status === 410) showStatus('초대 유효기간이 만료되었습니다. 운영팀에 재발급을 요청해주세요.', 'error');
        else if (error.code === 'INVITE_LOCKED' || error.status === 423) showStatus('인증 시도가 잠겼습니다. 15분 후 다시 시도해주세요.', 'error');
        else showStatus('초대 정보를 확인할 수 없습니다. 받은 링크를 다시 확인해주세요.', 'error');
    });
})();

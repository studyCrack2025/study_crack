// js/admin/modals.js
// 강제 탈퇴 / 임의 등급 부여 모달 로직
// ADMIN_API_URL, apiFetch 는 admin_ui.js / auth.js 에서 제공

window.openForceDeleteModal = function(userId, userName) {
    document.getElementById('fdUserId').value = userId;
    document.getElementById('fdUserName').innerText = userName || "이름없음";
    document.getElementById('fdReason').value = '';
    document.getElementById('fdConfirmText').value = '';
    const modal = document.getElementById('forceDelete-modal');
    modal.classList.remove('hidden'); modal.style.display = 'flex';
};

window.closeForceDeleteModal = function() {
    const modal = document.getElementById('forceDelete-modal');
    modal.classList.add('hidden'); modal.style.display = 'none';
};

window.executeForceDelete = async function() {
    const userId = document.getElementById('fdUserId').value;
    const reason = document.getElementById('fdReason').value.trim();
    const confirmText = document.getElementById('fdConfirmText').value.trim();
    if (!reason) return alert("탈퇴 사유를 반드시 입력해주세요.");
    if (confirmText !== "강제 탈퇴 확인했습니다") return alert("동의 확인 문구를 정확히 띄어쓰기까지 맞춰서 입력해주세요.");
    if (!confirm("마지막 확인입니다. 정말 삭제하시겠습니까? 데이터 복구는 불가능합니다.")) return;

    try {
        await apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_force_delete_user', userId: localStorage.getItem('userId'), data: { targetUserId: userId, reason: reason } }) });
        alert("강제 탈퇴 처리가 완료되었습니다.");
        closeForceDeleteModal();
        searchStudents();
    } catch (e) { if (e.message !== "Auth expired") alert("탈퇴 처리 중 오류가 발생했습니다."); }
};

let grantTierBusy = false;
const grantPendingKey = owner => 'studycrackAdminGrant:v1:' + owner;
function readPendingGrant(owner) {
    if (!owner) throw new Error('로그인 상태를 확인해주세요.');
    const raw = sessionStorage.getItem(grantPendingKey(owner));
    if (!raw) return null;
    const pending = JSON.parse(raw);
    if (!pending || pending.owner !== owner || typeof pending.requestId !== 'string'
        || !/^[a-f0-9-]{36}$/i.test(pending.requestId) || typeof pending.targetUserId !== 'string'
        || !['PRO', 'STANDARD', 'BASIC'].includes(pending.productTier) || !Number.isSafeInteger(pending.amount) || pending.amount < 0) {
        throw new Error('대기 중인 지급 정보를 확인할 수 없습니다. 기록을 삭제하지 말고 확인해주세요.');
    }
    return pending;
}
function showPendingGrant(pending) {
    document.getElementById('gtUserId').value = pending.targetUserId;
    document.getElementById('gtUserName').innerText = '처리 확인 대상 (' + pending.targetUserId + ')';
    document.getElementById('gtProductTier').value = pending.productTier;
    document.getElementById('gtAmount').value = String(pending.amount);
}
window.openGrantTierModal = function(userId, userName) {
    if (grantTierBusy) return;
    try {
        const pending = readPendingGrant(localStorage.getItem('userId'));
        document.getElementById('gtUserId').value = userId;
        document.getElementById('gtUserName').innerText = userName || '이름없음';
        document.getElementById('gtAmount').value = '0';
        if (pending) {
            showPendingGrant(pending);
            alert('결과 확인이 끝나지 않은 지급 요청이 있습니다. 이전 요청부터 다시 확인해주세요.');
        }
        const modal = document.getElementById('grantTier-modal');
        modal.classList.remove('hidden'); modal.style.display = 'flex';
    } catch { alert('지급 요청 기록을 읽을 수 없습니다. 저장소 설정을 확인해주세요.'); }
};

window.closeGrantTierModal = function() {
    if (grantTierBusy) return;
    const modal = document.getElementById('grantTier-modal');
    modal.classList.add('hidden'); modal.style.display = 'none';
};

window.executeGrantTier = async function() {
    if (grantTierBusy) return;
    let owner, pending;
    try {
        owner = localStorage.getItem('userId');
        pending = readPendingGrant(owner);
        const targetUserId = document.getElementById('gtUserId').value;
        const productTier = document.getElementById('gtProductTier').value;
        const rawAmount = document.getElementById('gtAmount').value.trim();
        const amount = Number(rawAmount);
        if (!targetUserId || !['PRO', 'STANDARD', 'BASIC'].includes(productTier) || !rawAmount || !Number.isSafeInteger(amount) || amount < 0) return alert('대상·상품·0 이상의 정수 금액을 확인해주세요.');
        if (pending && (pending.targetUserId !== targetUserId || pending.productTier !== productTier || pending.amount !== amount)) {
            showPendingGrant(pending);
            return alert('이전 요청의 내용으로 복원했습니다. 처리 결과부터 확인해주세요.');
        }
        if (!confirm(pending ? '이전 지급 요청의 처리 결과를 다시 확인하시겠습니까?'
            : '최신 회원·결제 정보를 확인하셨나요? 해당 학생에게 [' + productTier + '] 등급을 강제로 부여하며 장부에 기록됩니다.')) return;
        if (!pending) {
            if (typeof crypto.randomUUID !== 'function') return alert('이 브라우저에서는 안전한 지급 요청을 만들 수 없습니다.');
            pending = { owner, requestId: crypto.randomUUID(), targetUserId, productTier, amount };
            // Preserve the request before sending so an uncertain result cannot create another grant.
            sessionStorage.setItem(grantPendingKey(owner), JSON.stringify(pending));
        }
        if (localStorage.getItem('userId') !== owner) return alert('로그인 계정이 변경되었습니다. 다시 확인해주세요.');
    } catch { return alert('지급 요청을 안전하게 보관할 수 없습니다. 전송하지 않았습니다.'); }
    grantTierBusy = true;
    const controls = ['gtProductTier', 'gtAmount', 'gtSubmit'].map(id => document.getElementById(id)).filter(Boolean);
    controls.forEach(control => { control.disabled = true; });
    let committed = false;
    try {
        const response = await apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_grant_tier', data: pending }) });
        const result = await response.json();
        if (result?.success !== true || !/^ADMIN-GRANT-[a-f0-9]{64}$/.test(result.orderId || '')) throw new Error('처리 결과를 확인하지 못했습니다.');
        if (localStorage.getItem('userId') !== owner) return alert('계정이 변경되었습니다. 원래 계정으로 돌아와 이전 요청을 확인해주세요.');
        sessionStorage.removeItem(grantPendingKey(owner));
        committed = true;
        alert('등급 부여가 완료되었습니다.');
    } catch (error) {
        if (['ADMIN_GRANT_CONFLICT', 'ADMIN_GRANT_EXPIRED', 'ADMIN_GRANT_DELETING', 'ADMIN_GRANT_NOT_FOUND'].includes(error?.code)) {
            try { sessionStorage.removeItem(grantPendingKey(owner)); } catch { /* Keep the original request if storage is blocked. */ }
            alert('지급되지 않았습니다. 최신 회원·결제 정보를 확인한 뒤 새 요청을 승인해주세요.');
        } else alert('결과 확인이 끝나지 않았습니다. 입력을 변경하지 말고 같은 요청으로 다시 확인해주세요.');
    } finally {
        grantTierBusy = false;
        controls.forEach(control => { control.disabled = false; });
    }
    if (committed) { closeGrantTierModal(); searchStudents(); }
};

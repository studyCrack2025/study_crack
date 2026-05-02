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

window.openGrantTierModal = function(userId, userName) {
    document.getElementById('gtUserId').value = userId;
    document.getElementById('gtUserName').innerText = userName || "이름없음";
    document.getElementById('gtAmount').value = "0";
    const modal = document.getElementById('grantTier-modal');
    modal.classList.remove('hidden'); modal.style.display = 'flex';
};

window.closeGrantTierModal = function() {
    const modal = document.getElementById('grantTier-modal');
    modal.classList.add('hidden'); modal.style.display = 'none';
};

window.executeGrantTier = async function() {
    const userId = document.getElementById('gtUserId').value;
    const tier = document.getElementById('gtProductTier').value;
    const amount = document.getElementById('gtAmount').value;
    if (!confirm(`해당 학생에게 [${tier}] 등급을 강제로 부여하시겠습니까?\n이 내역은 장부 및 통계에 기록됩니다.`)) return;

    try {
        await apiFetch(ADMIN_API_URL, { method: 'POST', body: JSON.stringify({ type: 'admin_grant_tier', userId: localStorage.getItem('userId'), data: { targetUserId: userId, productTier: tier, amount: amount } }) });
        alert("등급 부여가 완료되었습니다.");
        closeGrantTierModal();
        searchStudents();
    } catch (e) { if (e.message !== "Auth expired") alert("등급 부여 처리 중 오류가 발생했습니다."); }
};

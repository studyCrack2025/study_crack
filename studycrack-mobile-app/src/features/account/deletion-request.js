export async function confirmDeletionRequest(ctx, dependencies) {
  const { alert, storage, postJson, verifyPassword, userApiUrl, clearSession,
    setWithdrawSubmitting, setWithdrawPassword, setWithdrawModalOpen, setLoggedIn, setHistory, goto } = dependencies;
  const isSocial = ['google', 'naver'].includes(String(ctx.user?.authProvider || 'local').toLowerCase());
  const deleteConfirmToken = isSocial ? storage?.getItem?.('deleteConfirmToken') || '' : '';
  const password = String(ctx.withdrawPassword || '');
  if ((isSocial && !deleteConfirmToken) || (!isSocial && !password.trim())) {
    alert(isSocial ? '가입한 소셜 계정으로 먼저 본인 확인을 완료해주세요.' : '현재 비밀번호를 입력해주세요.');
    return false;
  }
  setWithdrawSubmitting(true);
  try {
    let reauthAccessToken = '';
    if (!isSocial) {
      const proof = await (ctx.verifyPassword || verifyPassword)({ email: String(ctx.user?.email || ''), password });
      if (!proof?.ok || !proof.reauthAccessToken) {
        alert(proof?.error || '본인 확인을 완료하지 못했습니다. 다시 확인해주세요.');
        return false;
      }
      reauthAccessToken = proof.reauthAccessToken;
    }
    const result = await postJson({ apiFetch: ctx.apiFetch, url: userApiUrl,
      payload: { type: 'request_account_deletion', ...(deleteConfirmToken ? { deleteConfirmToken } : { reauthAccessToken }) } });
    if (!result.ok) { alert(result.error || '삭제 요청을 처리하지 못했습니다.'); return false; }
    if (result.data?.success !== true || result.data?.completed !== true || result.data?.status !== 'complete') {
      setWithdrawPassword('');
      if (result.data?.success === true && result.data?.completed === false && result.data?.status === 'review_required') {
        storage?.removeItem?.('deleteConfirmToken');
        setWithdrawModalOpen(false);
        alert('삭제 요청이 접수되었습니다. 담당자가 삭제·보존 범위를 확인한 뒤 처리합니다. 아직 삭제가 완료된 것은 아닙니다. 문의: contact@studycrack.co.kr');
        return true;
      }
      alert('삭제 완료 여부를 확인하지 못했습니다. 계정을 유지한 채 고객센터에 문의해주세요.');
      return false;
    }
    storage?.removeItem?.('deleteConfirmToken');
    await clearSession();
    setWithdrawModalOpen(false); setWithdrawPassword(''); setLoggedIn(false); setHistory([]);
    goto?.('authLogin', false); alert('회원탈퇴가 완료되었습니다.');
    return true;
  } catch {
    alert('삭제 요청 결과를 확인하지 못했습니다. 다시 확인해주세요.');
    return false;
  } finally { setWithdrawSubmitting(false); }
}

export async function blockAssignedTutor(ctx) {
  const alert = ctx.alert || globalThis.alert;
  const confirm = ctx.confirm || globalThis.confirm;
  const current = () => ctx.isCurrentProfile?.() !== false;
  const url = ctx.userApiUrl || ctx.apiBase?.user || ctx.window?.CONFIG?.api?.user;
  if (!url || !ctx.apiFetch || !current()) return false;
  async function request(type, data = {}) {
    const response = await ctx.apiFetch(url, { method: 'POST', body: JSON.stringify({ type, data }) });
    const body = await response?.json?.();
    if (!response?.ok || !body || body.success === false) throw new Error('request failed');
    return body;
  }
  try {
    const state = await request('get_tutor_contact_state');
    if (!current()) return false;
    if (!state.assignedTutorId) {
      alert?.(state.reassignmentRequested ? '차단되어 새 담당 튜터 배정을 기다리고 있어요. 고객센터에서 진행 상황을 문의할 수 있습니다.' : '현재 배정된 학습 코칭 튜터가 없어요.');
      return false;
    }
    if (!confirm?.('현재 학습 코칭 담당 튜터를 차단할까요?\n담당 배정이 해제되어 이 튜터의 새 코칭과 자료 접근이 제한됩니다. 새 담당 배정을 운영자에게 요청합니다.\n기존에 받은 자료나 별도 정시 컨설팅에는 적용되지 않아요.')) return false;
    if (!current()) return false;
    const result = await request('block_assigned_tutor', { tutorId: state.assignedTutorId, expectedRevision: state.revision });
    if (!current()) return false;
    if (result.success !== true || result.blocked !== true) throw new Error('unconfirmed');
    ctx.setUser?.(user => ({ ...user, tutorName: '', tutorInfo: null }));
    alert?.('담당 튜터를 차단하고 새 담당 배정을 요청했어요. 신고 내용은 상담·콘텐츠 신고하기로 별도 접수할 수 있습니다.');
    return true;
  } catch {
    if (current()) alert?.('차단 완료 여부를 확인하지 못했어요. 다시 확인하거나 고객센터에 문의해주세요.');
    return false;
  }
}

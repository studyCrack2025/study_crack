import React from 'react';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import { apiFailure } from '../../shared/api/client.js';
import { requestCalculatorWorkspace } from './calculator-workspace-api.js';

export default function useCalculatorWorkspace(applicationId, enabled) {
  const binding = React.useMemo(() => getMobileApiBinding('consulting', 'consultingApiUrl'), []);
  const [resource, setResource] = React.useState({ status: 'loading', data: null, error: '', code: '' }), [busy, setBusy] = React.useState(false);
  const latest = React.useRef(resource), pending = React.useRef(null), generation = React.useRef(0), retryRequest = React.useRef(null);
  latest.current = resource;
  const load = React.useCallback(async () => {
    if (!enabled || pending.current) return;
    const controller = new AbortController(), current = ++generation.current; pending.current = controller;
    setResource(previous => ({ ...previous, status: 'loading', error: '', code: '' }));
    const result = await requestCalculatorWorkspace(binding, { applicationId, signal: controller.signal });
    if (controller.signal.aborted || current !== generation.current) return;
    pending.current = null;
    if (result.ok && latest.current.data?.workspaceId !== result.data.workspaceId) retryRequest.current = null;
    setResource(previous => result.ok ? { status: 'ready', data: result.data, error: '', code: '' } : { ...previous, ...([401, 403].includes(result.status) ? { data: null } : {}), status: 'error', error: result.error, code: result.code });
  }, [applicationId, enabled, binding]);
  React.useEffect(() => {
    if (enabled) load();
    return () => { generation.current++; pending.current?.abort(); pending.current = null; setBusy(false); };
  }, [load, enabled]);
  const mutate = async (type, input) => {
    const saved = latest.current.data;
    if (!enabled || pending.current || !saved || latest.current.status !== 'ready') return apiFailure('이용 정보와 저장 상태를 먼저 확인해주세요.');
    const signature = JSON.stringify({ type, input });
    let request = retryRequest.current?.signature === signature ? retryRequest.current : null;
    if (!request) {
      if (typeof globalThis.crypto?.randomUUID !== 'function') return apiFailure('저장 요청을 만들지 못했습니다. 새로고침해주세요.');
      request = { signature, type, data: { expectedWorkspaceRevision: saved.revision, expectedLegacyRevision: saved.legacyRevision, requestId: 'workspace_' + globalThis.crypto.randomUUID(), ...input } };
    }
    retryRequest.current = request;
    const controller = new AbortController(), current = ++generation.current; pending.current = controller; setBusy(true);
    const result = await requestCalculatorWorkspace(binding, { applicationId, type, data: request.data, signal: controller.signal });
    if (controller.signal.aborted || current !== generation.current) return apiFailure('저장 결과를 다시 확인해주세요.', { code: 'REQUEST_ABORTED' });
    pending.current = null; setBusy(false);
    if (result.ok) { retryRequest.current = null; setResource({ status: 'ready', data: result.data, error: '', code: '' }); }
    else {
      if ([401, 403].includes(result.status)) { retryRequest.current = null; setResource({ status: 'error', data: null, error: result.error, code: result.code }); return result; }
      const conflict = ['REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(result.code);
      if (conflict) retryRequest.current = null;
      const specific = { CALCULATOR_PLAN_LIMIT: '저장할 수 있는 조합은 최대 10개입니다. 기존 조합을 정리해주세요.', CALCULATOR_WORKSPACE_TOO_LARGE: '저장 용량을 초과했습니다. 조합이나 후보를 줄여주세요.', CALCULATOR_SELECTION_CHANGED: '모집단위 정보가 바뀌었습니다. 해당 후보를 군별 후보 찾기에서 다시 선택해주세요.' };
      setResource(previous => ({ ...previous, status: conflict ? 'error' : 'ready', error: conflict ? '다른 화면에서 저장 내용이 바뀌었습니다. 최신 저장 상태를 확인한 뒤 다시 저장해주세요. 현재 편집은 유지됩니다.' : specific[result.code] || result.error, code: result.code }));
    }
    return result;
  };
  return { resource, busy, load, mutate };
}

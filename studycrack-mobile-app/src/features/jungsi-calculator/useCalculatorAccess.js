import React from 'react';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import { requestCalculatorAccess } from './calculator-api.js';

export function calculatorAccessAfterRefresh(previous, result) {
  if (result.ok) return { status: 'ready', data: result.data, error: '' };
  const temporary = result.status >= 500 || result.status === 429 || !result.status && ['OFFLINE', 'NETWORK_ERROR', 'TIMEOUT'].includes(result.code);
  return { status: 'error', data: temporary && previous.data?.access.allowed ? previous.data : null, error: result.error };
}

export default function useCalculatorAccess() {
  const [resource, setResource] = React.useState({ status: 'loading', data: null, error: '' });
  const sequence = React.useRef(0), pending = React.useRef(null), checkedAt = React.useRef(0);
  const refresh = React.useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController(), requestId = ++sequence.current;
    pending.current = controller; checkedAt.current = Date.now();
    setResource(previous => previous.data ? previous : { status: 'loading', data: null, error: '' });
    try {
      const result = await requestCalculatorAccess({ ...getMobileApiBinding('analysis', 'analysisApiUrl'), signal: controller.signal });
      if (controller.signal.aborted || requestId !== sequence.current) return;
      setResource(previous => calculatorAccessAfterRefresh(previous, result));
    } finally { if (pending.current === controller) pending.current = null; }
  }, []);
  React.useEffect(() => {
    refresh();
    const focus = () => { if (Date.now() - checkedAt.current >= 30_000) refresh(); };
    globalThis.addEventListener('focus', focus);
    return () => { sequence.current += 1; pending.current?.abort(); pending.current = null; globalThis.removeEventListener('focus', focus); };
  }, [refresh]);
  const deny = React.useCallback(() => {
    sequence.current += 1;
    pending.current?.abort();
    pending.current = null;
    setResource(previous => previous.data ? { status: 'ready', error: '', data: { ...previous.data, entitlement: null, access: { allowed: false, source: 'none' }, service: { ...previous.data.service, calculationEnabled: false, calculationMode: 'closed' } } } : previous);
  }, []);
  return { resource, refresh, deny };
}

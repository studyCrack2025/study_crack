import React from 'react';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import { requestCalculatorAccess } from './calculator-api.js';

export default function useCalculatorAccess() {
  const [resource, setResource] = React.useState({ status: 'loading', data: null, error: '' });
  const sequence = React.useRef(0), pending = React.useRef(null), checkedAt = React.useRef(0);
  const refresh = React.useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController(), requestId = ++sequence.current;
    pending.current = controller; checkedAt.current = Date.now();
    setResource({ status: 'loading', data: null, error: '' });
    try {
      const result = await requestCalculatorAccess({ ...getMobileApiBinding('analysis', 'analysisApiUrl'), signal: controller.signal });
      if (controller.signal.aborted || requestId !== sequence.current) return;
      setResource(result.ok ? { status: 'ready', data: result.data, error: '' } : { status: 'error', data: null, error: result.error });
    } finally { if (pending.current === controller) pending.current = null; }
  }, []);
  React.useEffect(() => {
    refresh();
    const focus = () => { if (Date.now() - checkedAt.current >= 30_000) refresh(); };
    globalThis.addEventListener('focus', focus);
    return () => { sequence.current += 1; pending.current?.abort(); pending.current = null; globalThis.removeEventListener('focus', focus); };
  }, [refresh]);
  const deny = React.useCallback(() => {
    setResource(previous => previous.status === 'ready' ? { ...previous, data: { ...previous.data, access: { allowed: false, source: 'none' } } } : previous);
  }, []);
  return { resource, refresh, deny };
}

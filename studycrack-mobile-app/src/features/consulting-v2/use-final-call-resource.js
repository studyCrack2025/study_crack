import React from 'react';

export function useFinalCallResource(loader) {
  const [resource, setResource] = React.useState({ status: 'loading', data: null });
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const lifetime = React.useRef(null), lock = React.useRef(false), sequence = React.useRef(0);
  const load = React.useCallback(async () => {
    const controller = lifetime.current, id = ++sequence.current;
    if (!controller || controller.signal.aborted) return;
    setResource(value => ({ ...value, status: 'loading' }));
    const result = await loader(controller.signal).catch(() => ({ ok: false, error: '일정을 불러오지 못했습니다.' }));
    if (controller.signal.aborted || id !== sequence.current) return;
    setResource(result.ok ? { status: 'ready', data: result.data } : { status: 'error', data: null });
    if (!result.ok) setMessage(result.error);
  }, [loader]);
  React.useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller; lock.current = false; setBusy(false);
    const end = () => { controller.abort(); sequence.current++; setResource({ status: 'error', data: null }); setMessage('로그인이 종료됐습니다. 다시 로그인해주세요.'); };
    globalThis.addEventListener?.('studycrack:session-ended', end); load();
    return () => { controller.abort(); sequence.current++; globalThis.removeEventListener?.('studycrack:session-ended', end); };
  }, [load]);
  const run = async (operation, { reload = true, onSuccess } = {}) => {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted || lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const result = await operation(controller.signal);
      if (controller.signal.aborted) return;
      if (!result.ok) setMessage(result.error || '처리 결과를 다시 확인해주세요.');
      else { onSuccess?.(result.data); if (reload) await load(); setMessage('처리했습니다. 최신 상태를 확인해주세요.'); }
    } catch (_error) { if (!controller.signal.aborted) setMessage('처리 결과를 확인하지 못했습니다. 새로 불러와 확인해주세요.'); }
    finally { if (lifetime.current === controller) { lock.current = false; if (!controller.signal.aborted) setBusy(false); } }
  };
  return { ...resource, busy, message, setMessage, run, reload: () => { if (!lock.current) load(); } };
}

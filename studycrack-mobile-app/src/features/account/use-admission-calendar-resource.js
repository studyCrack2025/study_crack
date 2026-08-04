import { useEffect, useRef } from 'react';
import { fetchMobileAdmissionCalendar } from './api.js';

export function useAdmissionCalendarResource({ enabled, getApiBinding, hasSession, setState } = {}) {
  const requestKeyRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!hasSession?.()) {
      setState({ calendarSyncStatus: 'local' });
      return undefined;
    }
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ calendarSyncStatus: 'loading' });
    fetchMobileAdmissionCalendar({ ...getApiBinding(), signal: controller?.signal }).then((result) => {
      if (requestKeyRef.current !== requestKey) return;
      setState(result.ok
        ? { personalEvents: result.data || [], calendarSyncStatus: 'ready' }
        : { calendarSyncStatus: result.code === 'AUTH_EXPIRED' ? 'loading' : 'error' });
    });
    return () => {
      controller?.abort();
      if (requestKeyRef.current === requestKey) requestKeyRef.current += 1;
    };
  }, [enabled, getApiBinding, hasSession, setState]);
}

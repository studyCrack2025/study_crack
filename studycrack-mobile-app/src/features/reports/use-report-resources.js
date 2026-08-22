import { useEffect, useRef } from 'react';
import { fetchMobileProReports, fetchMobileWeeklyReports } from './api.js';

const PRO_REPORT_SCREENS = new Set(['proElite', 'report', 'reportDetail']);
const WEEKLY_REPORT_SCREENS = new Set(['strategy', 'weekly', 'report', 'reportDetail']);

function useReportList({ enabled, fetcher, getApiBinding, listKey, setState, statusKey }) {
  const requestKeyRef = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    setState({ [statusKey]: 'loading' });
    fetcher({ ...getApiBinding(), signal: controller?.signal }).then((result) => {
      if (requestKeyRef.current !== requestKey) return;
      const items = result.data || [];
      setState({ [listKey]: items, [statusKey]: result.ok ? (items.length ? 'ready' : 'empty') : 'error' });
    });
    return () => {
      controller?.abort();
      if (requestKeyRef.current === requestKey) requestKeyRef.current += 1;
    };
  }, [enabled, fetcher, getApiBinding, listKey, setState, statusKey]);
}

export function useReportResources({ enabled, getApiBinding, screen, setState } = {}) {
  useReportList({
    enabled: enabled && PRO_REPORT_SCREENS.has(screen),
    fetcher: fetchMobileProReports,
    getApiBinding,
    listKey: 'proReports',
    setState,
    statusKey: 'proReportsStatus'
  });
  useReportList({
    enabled: enabled && WEEKLY_REPORT_SCREENS.has(screen),
    fetcher: fetchMobileWeeklyReports,
    getApiBinding,
    listKey: 'weeklyReports',
    setState,
    statusKey: 'weeklyReportsStatus'
  });
}

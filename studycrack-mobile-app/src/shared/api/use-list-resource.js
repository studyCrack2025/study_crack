import { useEffect } from 'react';

export function useListResource({ enabled, fetcher, getApiBinding, listKey, statusKey, errorKey, refreshTick = 0, setState }) {
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const controller = new AbortController();
    setState({ [statusKey]: 'loading', [errorKey]: '' });
    fetcher({ ...getApiBinding(), signal: controller.signal }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setState({ [statusKey]: 'error', [errorKey]: result.error });
        return;
      }
      const items = result.data || [];
      setState({ [listKey]: items, [statusKey]: items.length ? 'ready' : 'empty', [errorKey]: '' });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, fetcher, getApiBinding, listKey, statusKey, errorKey, refreshTick, setState]);
}

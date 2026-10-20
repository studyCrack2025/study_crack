import React from 'react';
import { getConsultingHome } from './api.js';

export function useConsultingHome(binding) {
  const [revision, retry] = React.useReducer(value => value + 1, 0);
  const [resource, setResource] = React.useState({ status: 'loading', data: null, code: '' });
  React.useEffect(() => {
    const controller = new AbortController();
    setResource({ status: 'loading', data: null, code: '' });
    getConsultingHome({ ...binding, signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setResource(result.ok ? { status: 'ready', data: result.data, code: '' } : { status: 'error', data: null, code: result.code });
    });
    return () => controller.abort();
  }, [binding.apiFetch, binding.consultingApiUrl, revision]);
  return { ...resource, retry };
}

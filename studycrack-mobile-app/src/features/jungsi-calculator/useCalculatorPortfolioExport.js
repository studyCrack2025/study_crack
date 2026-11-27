import React from 'react';
import { renderCalculatorPortfolioPng } from './calculator-portfolio-image.js';
import { deliverCalculatorPortfolioPng } from './calculator-portfolio-export.js';

export default function useCalculatorPortfolioExport(model) {
  const key = JSON.stringify(model), renderedKey = React.useRef(key), lifecycle = React.useRef(null), busy = React.useRef(null);
  renderedKey.current = key;
  const [attempt, setAttempt] = React.useState(0), [resource, setResource] = React.useState({ key: '', status: 'loading', blob: null, message: '', action: '' });
  React.useEffect(() => {
    const controller = new AbortController(), token = { key, controller }; lifecycle.current = token; busy.current = null;
    setResource({ key, status: 'loading', blob: null, message: '', action: '' });
    if (model) renderCalculatorPortfolioPng(model, { signal: controller.signal }).then(blob => {
      if (!controller.signal.aborted && renderedKey.current === key) setResource({ key, status: 'ready', blob, message: '', action: '' });
    }).catch(error => {
      if (!controller.signal.aborted && renderedKey.current === key) setResource({ key, status: 'error', blob: null, message: error.message || '이미지를 준비하지 못했습니다. 다시 시도해주세요.', action: '' });
    });
    return () => { controller.abort(); if (lifecycle.current === token) lifecycle.current = null; };
  }, [key, attempt]);
  const ready = resource.key === key && resource.status === 'ready';
  const deliver = async copy => {
    const token = lifecycle.current;
    if (!ready || !token || token.key !== key || token.controller.signal.aborted || busy.current) return;
    const operation = {}; busy.current = operation;
    const current = () => lifecycle.current === token && renderedKey.current === key && !token.controller.signal.aborted;
    setResource(previous => ({ ...previous, message: '', action: copy ? 'copying' : 'saving' }));
    try {
      const result = await deliverCalculatorPortfolioPng({ blob: resource.blob, copy, current });
      if (current()) setResource(previous => ({ ...previous, action: '', message: result === 'copied' ? '포트폴리오 이미지를 복사했습니다.' : result === 'downloaded-fallback' ? '이미지를 복사할 수 없어 PNG 저장을 요청했습니다.' : 'PNG 저장을 요청했습니다.' }));
    } catch (error) {
      if (current()) setResource(previous => ({ ...previous, action: '', message: error.message || '이미지를 내보내지 못했습니다. 다시 시도해주세요.' }));
    } finally { if (busy.current === operation) busy.current = null; }
  };
  return { ready, status: resource.key === key ? resource.status : 'loading', message: resource.key === key ? resource.message : '', action: resource.key === key ? resource.action : '', deliver, retry: () => setAttempt(value => value + 1) };
}

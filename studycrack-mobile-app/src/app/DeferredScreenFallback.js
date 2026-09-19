import React from 'react';
import { AppContent, AppFrame } from '../components/AppFrame.js';
import { StatusState } from '../components/StatusState.js';
import { reloadMobileLocation } from '../shared/browser/mobile-runtime.js';
import { describeFailure } from '../shared/api/failure.js';

export function DeferredScreenFallback({ onRetry, screen, status }) {
  const failed = status === 'error';
  const action = failed
    ? React.createElement(React.Fragment, null,
      React.createElement('button', { type: 'button', className: 'btn btn-primary', onClick: onRetry }, '다시 시도'),
      React.createElement('button', { type: 'button', className: 'btn btn-secondary', onClick: reloadMobileLocation }, '페이지 새로고침'))
    : null;
  return React.createElement(
    AppFrame,
    null,
    React.createElement(
      AppContent,
      { screen },
      React.createElement(StatusState, {
        action,
        description: failed ? `${describeFailure({ code: globalThis.navigator?.onLine === false ? 'OFFLINE' : 'CHUNK_LOAD' }, '화면 파일을 불러오지 못했어요. 다시 시도하거나 페이지를 새로고침해주세요.').message} 새로고침하면 작성 중인 내용이 사라질 수 있어요.` : '잠시만 기다려 주세요.',
        kind: failed ? 'error' : 'loading',
        title: failed ? '화면을 불러오지 못했습니다' : '앱 화면을 준비하고 있어요'
      })
    )
  );
}

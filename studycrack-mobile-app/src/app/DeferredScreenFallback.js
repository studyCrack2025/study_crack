import React from 'react';
import { AppContent, AppFrame } from '../components/AppFrame.js';
import { StatusState } from '../components/StatusState.js';

export function DeferredScreenFallback({ onRetry, screen, status }) {
  const failed = status === 'error';
  const action = failed
    ? React.createElement('button', { type: 'button', className: 'btn btn-primary', onClick: onRetry }, '다시 시도')
    : null;
  return React.createElement(
    AppFrame,
    null,
    React.createElement(
      AppContent,
      { screen },
      React.createElement(StatusState, {
        action,
        description: failed ? '네트워크 상태를 확인한 뒤 다시 시도해 주세요.' : '잠시만 기다려 주세요.',
        kind: failed ? 'error' : 'loading',
        title: failed ? '화면을 불러오지 못했습니다' : '앱 화면을 준비하고 있어요'
      })
    )
  );
}

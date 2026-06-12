import React from 'react';
import { createRoot } from 'react-dom/client';
import { createMobileAppKernel } from '../app/mobile-app.js';

const { useCallback, useMemo, useState } = React;

// Phase 7 런타임 셸 (모델 a): 분리 renderer는 문자열을 반환하고, React는
// 루트 마운트 + state 보관 + kernel 렌더(dangerouslySetInnerHTML) + data-action dispatch만 담당한다.
// 모놀리식 App()의 state/effect 전체 이관은 후속 단계(상태 인벤토리 기준)에서 진행한다.
// 현재는 빌드/마운트/렌더/dispatch 파이프라인을 검증하는 최소 vertical slice.
function MobileApp() {
  const [screen, setScreen] = useState('ob1');

  const ctx = useMemo(() => ({ screen }), [screen]);
  const kernel = useMemo(() => createMobileAppKernel(ctx, { fallbackScreen: 'home' }), [ctx]);

  const html = useMemo(() => kernel.render(screen), [kernel, screen]);

  const onClick = useCallback(
    (event) => {
      // 최소 내비게이션: data-action="goto"/"back"/"tab"만 우선 연결. 전체 dispatch는 후속.
      const el = event.target.closest('[data-action]');
      if (!el) return;
      const action = el.getAttribute('data-action');
      if (action === 'goto') {
        const target = el.getAttribute('data-target');
        if (target) setScreen(target);
      }
    },
    []
  );

  return React.createElement('div', {
    className: 'studycrack-mobile-root',
    onClick,
    dangerouslySetInnerHTML: { __html: html }
  });
}

const rootEl = document.getElementById('root') || document.body;
createRoot(rootEl).render(React.createElement(MobileApp));

import React from 'react';
import { createRoot } from 'react-dom/client';
import { renderAppBar } from '../components/app-bar.js';
import { renderAppShell } from '../components/app-shell.js';
import { renderIcon } from '../components/icon.js';
import { renderTabBar } from '../components/tab-bar.js';
import { createMobileEventHandlers } from '../handlers/mobile-handlers.js';
import { renderMobileScreen } from '../app/screen-registry.js';
import { createInitialAppState, createNavigationOps, createStateSetters } from './app-state.js';

const { useCallback, useMemo, useReducer, useRef } = React;

// 탭바 dimmed 조건. 원본 App()의 tabbarDimmed와 동일.
function isTabbarDimmed(state) {
  return Boolean(
    state.coachingSheetOpen ||
      state.studySubjectSheetOpen ||
      state.plannerCalendarOpen ||
      state.plannerEditIndex !== null ||
      state.drawerOpen ||
      state.universityModalOpen ||
      state.scoreEditOpen ||
      state.logoutModalOpen
  );
}

function reducer(state, patch) {
  return { ...state, ...patch };
}

// Phase 7 런타임 셸 (모델 a): 분리 renderer는 문자열을 반환하고, React는
// state 컨테이너 보관 + ctx 조립 + kernel 렌더 + data-action dispatch만 담당.
// 현재 연결: 상태 컨테이너 전체 + 내비게이션(goto/back/tab) + 전체 action dispatch(미연결 연산은 no-op).
// 미연결: 화면별 derived view-model, localStorage 영속/타이머/스크롤/제스처 effect(후속 단계).
function MobileApp() {
  const [state, setState] = useReducer(reducer, undefined, createInitialAppState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 상태 키별 setX setter 자동 생성(핸들러 ctx 계약 충족). 키는 고정이라 1회 생성.
  const setters = useMemo(
    () => createStateSetters(Object.keys(stateRef.current), { setState, getState: () => stateRef.current }),
    []
  );

  const nav = useMemo(
    () =>
      createNavigationOps({
        getState: () => stateRef.current,
        setState,
        onScreenChange: (from) => {
          // 스크롤 저장은 후속 단계. 현재는 위치만 보존 가드.
          if (typeof window !== 'undefined' && from) {
            stateRef.current.__lastScrollY = window.scrollY || window.pageYOffset || 0;
          }
        }
      }),
    []
  );

  const dimmed = isTabbarDimmed(state);

  const ctx = {
    ...state,
    // 상태 키별 setX setter 전체(핸들러 ctx 계약)
    ...setters,
    // 렌더 helper (실제 컴포넌트 주입)
    icon: renderIcon,
    appbar: (title, showBack) => renderAppBar({ title, showBack }),
    layout: (inner, withTab) =>
      renderAppShell({
        inner: String(inner || ''),
        withTab,
        dimmed,
        tabBar: renderTabBar({ tab: state.tab, dimmed, icon: renderIcon })
      }),
    // 내비게이션 백본
    goto: nav.goto,
    back: nav.back,
    beforeGoto: () => true,
    preserveScroll: (task) => {
      if (typeof task === 'function') task();
    },
    // 자주 쓰는 최소 연산 (나머지 도메인 연산은 후속 단계에서 연결)
    setField: (key, value) => setState({ [key]: value }),
    closeDrawer: () => setState({ drawerOpen: false }),
    selectPlan: (plan) => setState({ selectedPlan: plan }),
    markOnboardingComplete: () => setState({ loggedIn: true })
  };

  const events = useMemo(() => createMobileEventHandlers(ctx), [ctx]);

  const html = renderMobileScreen(state.screen, ctx, { fallbackScreen: 'home' });

  const onClick = useCallback(
    (event) => {
      events.dispatchAction(event);
    },
    [events]
  );
  const onInput = useCallback((event) => events.handleInput?.(event), [events]);
  const onChange = useCallback((event) => events.handleChange?.(event), [events]);
  const onBlur = useCallback((event) => events.handleBlur?.(event), [events]);

  return React.createElement('div', {
    className: 'studycrack-mobile-root',
    onClick,
    onInput,
    onChange,
    onBlur,
    dangerouslySetInnerHTML: { __html: html }
  });
}

const rootEl = document.getElementById('root') || document.body;
createRoot(rootEl).render(React.createElement(MobileApp));

import React from 'react';
import { createRoot } from 'react-dom/client';
// V2 재디자인 스타일(원본 designV2StyleTag 추출). 빌드 시 별도 CSS 자산으로 산출되어
// 프리뷰/런타임 HTML이 외부 V1 CSS 뒤에 로드한다.
import '../styles/design-v2.css';
import { renderAppBar } from '../components/app-bar.js';
import { renderAppShell } from '../components/app-shell.js';
import { renderIcon } from '../components/icon.js';
import { renderTabBar } from '../components/tab-bar.js';
import { createMobileEventHandlers } from '../handlers/mobile-handlers.js';
import { getScreenComponent, renderMobileScreen } from '../app/screen-registry.js';
import { createInitialAppState, createNavigationOps, createStateSetters } from './app-state.js';
import { buildDerivedContext } from './derived.js';
import { createScrollOps } from './scroll-ops.js';
import { createTimerOps } from './timer-ops.js';

const { useCallback, useLayoutEffect, useMemo, useReducer, useRef } = React;

// 스크롤 비-setter 연산(원본 window 스크롤 헬퍼). iOS 가드 상태를 유지해야 하므로
// 컴포넌트 밖 단일 인스턴스로 둔다(렌더마다 재생성 금지).
const scrollOps = createScrollOps();

// 라이브 공부 타이머 연산. 인터벌/누적 ref를 유지해야 하므로 컴포넌트 밖 단일 인스턴스.
const timerOps = createTimerOps();

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
// 프리뷰/디자인 점검용: URL ?screen=<id>로 초기 화면 지정(파라미터 있을 때만 override).
function createInitialAppStateWithScreenParam() {
  const base = createInitialAppState();
  if (typeof window === 'undefined' || !window.location) return base;
  const param = new URLSearchParams(window.location.search).get('screen');
  return param ? { ...base, screen: param } : base;
}

function MobileApp() {
  const [state, setState] = useReducer(reducer, undefined, createInitialAppStateWithScreenParam);
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

  // 플래너 진입/날짜 변경 시 날짜 스트립을 선택 날짜로 가로 센터링.
  // planner가 JSX(React 트리)라 스트립 노드가 재렌더 간 유지되므로 센터링이 정착한다.
  // useLayoutEffect에서 동기 실행: commit 직후 layout이 준비되고 paint 전이라 깜빡임이 없으며,
  // requestAnimationFrame에 의존하지 않아 모든 환경(헤드리스 포함)에서 동작한다.
  // 미연결 화면에선 .planner-date-strip 부재로 no-op.
  const plannerCenteredRef = useRef(false);
  useLayoutEffect(() => {
    if (state.screen !== 'planner') return;
    const behavior = plannerCenteredRef.current ? 'smooth' : 'auto';
    scrollOps.centerPlannerDate(state.selectedDate, behavior);
    plannerCenteredRef.current = true;
  }, [state.screen, state.selectedDate]);

  const dimmed = isTabbarDimmed(state);

  const ctx = {
    ...state,
    // 상태 키별 setX setter 전체(핸들러 ctx 계약)
    ...setters,
    // 화면 renderer가 기대하는 derived view-model(원시 state에서 파생).
    // 라이브 타이머 ref 현재값을 더해 재렌더 시 표시/랭킹/진행률이 base+live로 일관되게 한다.
    ...buildDerivedContext(state, timerOps.studyTimerSecondsRef.current),
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
    // JSX 화면이 셸을 직접 조립할 때 쓰는 raw 값(문자열 leaf로 임베드).
    dimmed,
    tabBarHtml: renderTabBar({ tab: state.tab, dimmed, icon: renderIcon }),
    // 내비게이션 백본
    goto: nav.goto,
    back: nav.back,
    beforeGoto: () => true,
    // 비-setter 스크롤 연산(원본 1:1). preserveScroll은 추가 payload 인자를 무시한다.
    preserveScroll: (task) => scrollOps.preserveScrollAfterStateChange(task),
    preserveScrollAfterStateChange: scrollOps.preserveScrollAfterStateChange,
    preserveY: scrollOps.preserveY,
    afterSafariViewportStable: scrollOps.afterSafariViewportStable,
    restoreIfUnexpectedTopJump: scrollOps.restoreIfUnexpectedTopJump,
    markStableScrollPosition: scrollOps.markStableScrollPosition,
    centerPlannerDate: scrollOps.centerPlannerDate,
    // 라이브 공부 타이머(원본 1:1). interval이 [data-study-base-seconds] DOM을 직접 갱신.
    studyTimerSecondsRef: timerOps.studyTimerSecondsRef,
    startLiveStudyTimer: timerOps.startLiveStudyTimer,
    stopLiveStudyTimer: timerOps.stopLiveStudyTimer,
    syncLiveStudyTimerUi: timerOps.syncLiveStudyTimerUi,
    // 자주 쓰는 최소 연산 (나머지 도메인 연산은 후속 단계에서 연결)
    setField: (key, value) => setState({ [key]: value }),
    closeDrawer: () => setState({ drawerOpen: false }),
    selectPlan: (plan) => setState({ selectedPlan: plan }),
    markOnboardingComplete: () => setState({ loggedIn: true })
  };

  const events = useMemo(() => createMobileEventHandlers(ctx), [ctx]);

  const onClick = useCallback(
    (event) => {
      events.dispatchAction(event);
    },
    [events]
  );
  const onInput = useCallback((event) => events.handleInput?.(event), [events]);
  const onChange = useCallback((event) => events.handleChange?.(event), [events]);
  const onBlur = useCallback((event) => events.handleBlur?.(event), [events]);

  // display:contents로 래퍼 박스를 없애 원본 DOM(#root > .app-shell) 레이아웃 체인을 보존한다.
  // 이벤트(onClick/onInput/...)는 양쪽 경로 공통으로 래퍼에 위임된다.
  const wrapperProps = {
    className: 'studycrack-mobile-root',
    style: { display: 'contents' },
    onClick,
    onInput,
    onChange,
    onBlur
  };

  // dual-mode: JSX 컴포넌트로 등록된 화면은 실제 React 트리로 렌더(reconciliation → DOM/scroll 보존).
  // 미등록 화면은 기존 문자열 renderer를 dangerouslySetInnerHTML로 주입(매 렌더 전체 교체).
  const ScreenComponent = getScreenComponent(state.screen);
  if (ScreenComponent) {
    return React.createElement('div', wrapperProps, React.createElement(ScreenComponent, ctx));
  }

  const html = renderMobileScreen(state.screen, ctx, { fallbackScreen: 'home' });
  return React.createElement('div', { ...wrapperProps, dangerouslySetInnerHTML: { __html: html } });
}

const rootEl = document.getElementById('root') || document.body;
createRoot(rootEl).render(React.createElement(MobileApp));

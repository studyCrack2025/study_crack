// 런타임 비-setter 스크롤 연산. 원본 App() 본문의 window 스크롤 헬퍼를 1:1 이식한다.
// 전부 window/DOM + requestAnimationFrame 기반이라 React ref가 필요 없고, iOS 가드 상태만
// 모듈 레벨 mutable holder로 대체한다(원본 lastStableScrollYRef/scrollGuardRef와 동일 역할).
// 주의: planner 진입 시 자동 센터링 useEffect(screen/selectedPlannerDate 의존)는 effect 단계에서 연결.

export function createScrollOps(options = {}) {
  const win = options.window || globalThis.window;
  const doc = options.document || globalThis.document;
  const raf =
    options.requestAnimationFrame ||
    (typeof globalThis.requestAnimationFrame === 'function'
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : (fn) => fn());

  // iOS Safari 스크롤 복원 가드(원본 ref 대체).
  const lastStableScrollYRef = { current: 0 };
  const scrollGuardRef = { current: { restoring: false } };

  const getScrollY = () => win?.scrollY || win?.pageYOffset || 0;

  const isIOSSafari = () => {
    const ua = win?.navigator?.userAgent || '';
    return /iP(ad|hone|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  };

  const safeScrollTo = (...args) => {
    if (isIOSSafari()) return;
    win?.scrollTo?.(...args);
  };

  const preserveScrollAfterStateChange = (callback) => {
    const y = getScrollY();
    callback?.();
    raf(() => {
      raf(() => {
        if (Math.abs(getScrollY() - y) > 80) {
          win?.scrollTo?.({ top: y, left: 0, behavior: 'auto' });
        }
      });
    });
  };

  const afterSafariViewportStable = (callback) => {
    raf(() => {
      raf(() => callback?.());
    });
  };

  const preserveY = (callback) => {
    const y = getScrollY();
    callback?.();
    afterSafariViewportStable(() => {
      if (y > 0 && getScrollY() === 0) {
        safeScrollTo({ top: y, left: 0, behavior: 'auto' });
      }
    });
  };

  const markStableScrollPosition = () => {
    if (!isIOSSafari()) return;
    const y = getScrollY();
    if (y > 0) lastStableScrollYRef.current = y;
  };

  const restoreIfUnexpectedTopJump = () => {
    if (!isIOSSafari()) return;
    if (scrollGuardRef.current.restoring) return;
    raf(() => {
      raf(() => {
        const nowY = getScrollY();
        if (nowY === 0 && lastStableScrollYRef.current > 80) {
          scrollGuardRef.current.restoring = true;
          safeScrollTo({ top: lastStableScrollYRef.current, left: 0, behavior: 'auto' });
          raf(() => {
            scrollGuardRef.current.restoring = false;
          });
        }
      });
    });
  };

  // 플래너 날짜 스트립을 선택 날짜가 가운데 오도록 가로 스크롤(원본 centerPlannerDate).
  const centerPlannerDate = (date, behavior = 'smooth') => {
    const container = doc?.querySelector?.('.planner-date-strip');
    const selectedBtn = container?.querySelector?.(`[data-planner-date="${date}"]`);
    if (!container || !selectedBtn) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = selectedBtn.getBoundingClientRect();
    const targetLeft =
      (container.scrollLeft || 0) +
      (btnRect.left - containerRect.left) -
      container.clientWidth / 2 +
      selectedBtn.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), behavior });
  };

  return {
    isIOSSafari,
    safeScrollTo,
    preserveScrollAfterStateChange,
    afterSafariViewportStable,
    preserveY,
    markStableScrollPosition,
    restoreIfUnexpectedTopJump,
    centerPlannerDate
  };
}

// 라이브 공부 타이머 연산(원본 startLiveStudyTimer/stopLiveStudyTimer/syncLiveStudyTimerUi 1:1).
// setInterval로 1초마다 ref를 증가시키고, [data-study-base-seconds] 노드의 textContent를 직접 갱신한다
// (state를 거치지 않아 매초 재렌더가 없음). 재렌더 시점의 표시값은 derived todayStudySeconds(=base+live)가
// 담당하므로, main.js가 studyTimerSecondsRef.current를 buildDerivedContext에 전달해야 일관된다.
// iOS 가드 ref처럼 인터벌/누적 ref는 모듈 레벨로 유지(렌더마다 재생성 금지).

function defaultFormatHms(total) {
  const t = Math.max(0, Number(total) || 0);
  const h = String(Math.floor(t / 3600)).padStart(2, '0');
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const s = String(t % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function createTimerOps(options = {}) {
  const getDoc = () => options.document || globalThis.document;
  const formatHms = options.formatHms || defaultFormatHms;
  const setIntervalFn = options.setInterval || globalThis.setInterval?.bind(globalThis);
  const clearIntervalFn = options.clearInterval || globalThis.clearInterval?.bind(globalThis);

  const studyTimerSecondsRef = { current: 0 };
  const studyTimerIntervalRef = { current: null };

  const syncLiveStudyTimerUi = (liveSeconds) => {
    const nodes = getDoc()?.querySelectorAll?.('[data-study-base-seconds]');
    if (!nodes) return;
    nodes.forEach((node) => {
      const base = Number(node.getAttribute('data-study-base-seconds')) || 0;
      node.textContent = formatHms(base + (Number(liveSeconds) || 0));
    });
  };

  const startLiveStudyTimer = () => {
    if (studyTimerIntervalRef.current) clearIntervalFn?.(studyTimerIntervalRef.current);
    studyTimerIntervalRef.current = setIntervalFn?.(() => {
      studyTimerSecondsRef.current += 1;
      syncLiveStudyTimerUi(studyTimerSecondsRef.current);
    }, 1000);
  };

  const stopLiveStudyTimer = () => {
    if (studyTimerIntervalRef.current) {
      clearIntervalFn?.(studyTimerIntervalRef.current);
      studyTimerIntervalRef.current = null;
    }
  };

  return {
    studyTimerSecondsRef,
    studyTimerIntervalRef,
    syncLiveStudyTimerUi,
    startLiveStudyTimer,
    stopLiveStudyTimer
  };
}

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
  const studyTimerStartedAtRef = { current: 0 };

  const syncLiveStudyTimerUi = (liveSeconds) => {
    const nodes = getDoc()?.querySelectorAll?.('[data-study-base-seconds]');
    if (!nodes) return;
    nodes.forEach((node) => {
      const base = Number(node.getAttribute('data-study-base-seconds')) || 0;
      node.textContent = formatHms(base + (Number(liveSeconds) || 0));
    });
  };

  const startLiveStudyTimer = (startedAt = Date.now(), onTick = null) => {
    if (studyTimerIntervalRef.current) clearIntervalFn?.(studyTimerIntervalRef.current);
    studyTimerStartedAtRef.current = Number(new Date(startedAt).getTime()) || Date.now();
    const update = () => {
      studyTimerSecondsRef.current = Math.max(0, Math.floor((Date.now() - studyTimerStartedAtRef.current) / 1000));
      syncLiveStudyTimerUi(studyTimerSecondsRef.current);
      onTick?.(studyTimerSecondsRef.current);
    };
    update();
    studyTimerIntervalRef.current = setIntervalFn?.(() => {
      update();
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
    studyTimerStartedAtRef,
    syncLiveStudyTimerUi,
    startLiveStudyTimer,
    stopLiveStudyTimer
  };
}

import { useEffect, useRef, useState } from 'react';

export function AquariumUnlockNotice({ view }) {
  const ref = useRef(null);
  const [notice, setNotice] = useState(null), [active, setActive] = useState(false);
  const stage = view.growth?.highestUnlockedStage;
  useEffect(() => {
    const element = ref.current, doc = element?.ownerDocument, browser = doc?.defaultView;
    if (!element || !browser?.IntersectionObserver || !view.claimUnlock) return;
    let intersecting = false, cancelled = false, pending = false;
    const visible = () => !cancelled && intersecting && doc.visibilityState === 'visible' && !element.closest('[inert], [aria-hidden="true"]');
    const update = () => {
      const ready = visible(); setActive(ready);
      if (!ready || pending || view.status !== 'ready' || !stage) return;
      pending = true;
      view.claimUnlock(visible).then(claimed => {
        if (claimed && visible()) setNotice({ stage: claimed, claim: view.claimUnlock });
      }).finally(() => { pending = false; });
    };
    const observer = new browser.IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); }, { rootMargin: '0px 0px -96px 0px' });
    observer.observe(element);
    const mutation = new browser.MutationObserver(update);
    for (let parent = element.parentElement; parent; parent = parent.parentElement) mutation.observe(parent, { attributes: true, attributeFilter: ['inert', 'aria-hidden'] });
    doc.addEventListener('visibilitychange', update);
    return () => { cancelled = true; observer.disconnect(); mutation.disconnect(); doc.removeEventListener('visibilitychange', update); };
  }, [view.claimUnlock, view.status, view.growth, stage]);
  const shown = notice && notice.claim === view.claimUnlock && notice.stage === stage;
  return <div ref={ref} className="aquarium-unlock-slot" data-unlock-active={active}>
    {shown ? <div className="aquarium-unlock-notice">
      <div role="status"><b>DAY {stage.slice(3)} 배경을 열었어요!</b><p>꾸준히 쌓은 공부가 수조를 바꿨어요.</p><small>이 기기의 계정별 안내예요.</small></div>
      <button type="button" onClick={() => setNotice(null)}>해금 안내 닫기</button>
    </div> : null}
  </div>;
}

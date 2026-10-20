import { useEffect, useRef, useState } from 'react';

export function useSceneActivity() {
  const ref = useRef(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const document = element.ownerDocument;
    const Observer = document.defaultView?.IntersectionObserver;
    let visible = !Observer;
    const update = () => setActive(visible && document.visibilityState === 'visible');
    const observer = Observer ? new Observer(([entry]) => {
      visible = entry.isIntersecting;
      update();
    }) : null;
    observer?.observe(element);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return { ref, active };
}

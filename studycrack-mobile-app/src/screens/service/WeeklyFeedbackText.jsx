import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export function WeeklyFeedbackText({ label, text }) {
  const id = useId();
  const paragraph = useRef(null);
  const previousHeight = useRef(null);
  const animation = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const node = paragraph.current;
    if (previousHeight.current === null || !node) return;
    const from = previousHeight.current;
    previousHeight.current = null;
    animation.current?.cancel();
    node.style.removeProperty('-webkit-line-clamp');
    if (!node.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches && node.animate) {
      const to = node.getBoundingClientRect().height;
      node.style.webkitLineClamp = 'unset';
      const motion = node.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 300, easing: 'cubic-bezier(.2,0,0,1)' });
      animation.current = motion;
      motion.onfinish = () => { if (animation.current === motion) { node.style.removeProperty('-webkit-line-clamp'); animation.current = null; } };
    }
  }, [expanded]);
  useEffect(() => () => animation.current?.cancel(), []);
  useLayoutEffect(() => {
    const node = paragraph.current;
    const measure = () => {
      if (!node?.getClientRects().length) return;
      setLong(node.scrollHeight > parseFloat(getComputedStyle(node).lineHeight) * 6 + 2);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);
  return <section className="feedback-item" aria-label={label}>
    <h4>{label}</h4>
    <p ref={paragraph} id={id} data-expanded={expanded}>{text}</p>
    {long ? <button type="button" aria-label={`${label} ${expanded ? '접기' : '전체 보기'}`} aria-expanded={expanded} aria-controls={id} onClick={() => { previousHeight.current = paragraph.current.getBoundingClientRect().height; setExpanded(value => !value); }}>{expanded ? '접기' : '전체 보기'}</button> : null}
  </section>;
}

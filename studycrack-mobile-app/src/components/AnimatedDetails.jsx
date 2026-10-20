import { Children, cloneElement, useEffect, useId, useRef, useState } from 'react';

export function AnimatedDetails({ children, open, onToggle, ...props }) {
  const parts = Children.toArray(children);
  const summary = parts.shift();
  const panel = useRef(null);
  const body = useRef(null);
  const trigger = useRef(null);
  const animation = useRef(null);
  const desired = useRef(Boolean(open));
  const [expanded, setExpanded] = useState(Boolean(open));
  const id = useId();
  const move = next => {
    const element = panel.current;
    if (!element) return;
    const from = element.getBoundingClientRect().height;
    animation.current?.cancel();
    animation.current = null;
    desired.current = next;
    setExpanded(next);
    if (!next && body.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
    body.current.inert = !next;
    body.current.setAttribute('aria-hidden', String(!next));
    element.open = true;
    const style = getComputedStyle(element);
    const edge = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((sum, key) => sum + (parseFloat(style[key]) || 0), 0);
    const to = next ? element.getBoundingClientRect().height : trigger.current.getBoundingClientRect().height + edge;
    if (element.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate || Math.abs(from - to) < 1) {
      element.open = next;
      return;
    }
    const motion = element.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 300, easing: 'cubic-bezier(.2,0,0,1)' });
    animation.current = motion;
    motion.onfinish = () => {
      if (animation.current !== motion) return;
      element.open = desired.current;
      animation.current = null;
    };
  };
  useEffect(() => {
    if (open !== undefined && Boolean(open) !== desired.current) move(Boolean(open));
  }, [open]);
  useEffect(() => () => animation.current?.cancel(), []);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (desired.current && animation.current) move(true);
    });
    observer.observe(body.current);
    return () => observer.disconnect();
  }, []);
  return <details {...props} ref={panel} open={expanded || Boolean(animation.current)} data-disclosure="animated">
    {cloneElement(summary, { ref: trigger, 'aria-expanded': expanded, 'aria-controls': id, onClick: event => {
      event.preventDefault();
      const next = !desired.current;
      move(next);
      onToggle?.({ currentTarget: { open: next } });
    } })}
    <div ref={body} id={id} className="sc-disclosure-body" aria-hidden={!expanded} inert={!expanded ? '' : undefined}>{parts}</div>
  </details>;
}

import { useRef, useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { Icon } from '../../components/Icon.jsx';
import { COACHING_PROCESS_STEPS } from './presentation.js';

export function CoachingProcessGuide({ onDismiss }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const start = useRef(null);
  const body = useRef(null);
  const step = COACHING_PROCESS_STEPS[index];
  const move = (delta) => {
    setDirection(delta);
    setIndex(current => Math.max(0, Math.min(COACHING_PROCESS_STEPS.length - 1, current + delta)));
    if (body.current) body.current.scrollTop = 0;
  };
  const onKeyDown = (event) => {
    if (event.isComposing || event.target.closest('input, textarea, select')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    }
  };
  return <Modal ariaLabel="코칭 진행 방식" panelClass="coaching-guide" onDismiss={onDismiss} onPanelKeyDown={onKeyDown}>
    <div className="coaching-guide-layout">
      <header className="coaching-guide-head"><h3>코칭 진행 방식</h3><button type="button" className="coach-close" aria-label="닫기" onClick={onDismiss}>×</button></header>
      <div className="coaching-guide-progress" aria-label={`전체 3단계 중 ${index + 1}단계`}><span>{index + 1} / 3</span><div aria-hidden="true">{COACHING_PROCESS_STEPS.map((item, number) => <i key={item.number} data-active={number <= index} />)}</div></div>
      <div className="coaching-guide-body" ref={body} onPointerDown={event => {
        start.current = event.isPrimary && event.button === 0 && !event.target.closest('button, a, input, textarea, select') ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
      }} onPointerCancel={() => { start.current = null; }} onPointerUp={event => {
        const origin = start.current;
        start.current = null;
        if (!origin || origin.id !== event.pointerId) return;
        const x = event.clientX - origin.x, y = event.clientY - origin.y;
        if (Math.abs(x) >= 48 && Math.abs(x) > Math.abs(y) * 1.4) move(x < 0 ? 1 : -1);
      }}>
        <article className="coaching-guide-step" key={step.number} data-direction={direction}>
          <div className="coaching-guide-art" aria-hidden="true">{step.visual.map(item => <div key={item.label}><Icon name={item.icon} /><b>{item.label}</b></div>)}</div>
          <div aria-live="polite" aria-atomic="true"><span className="coaching-guide-kicker">STEP {step.number}</span><h4>{step.title}</h4><p>{step.description}</p></div>
          <div className="coaching-guide-example"><Icon name="check" /><span>{step.example}</span></div>
        </article>
      </div>
      <footer className="coaching-guide-footer"><button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => move(-1)}>이전</button><button type="button" className="btn btn-primary" onClick={index === 2 ? onDismiss : () => move(1)}>{index === 2 ? '확인했어요' : '다음'}</button></footer>
    </div>
  </Modal>;
}

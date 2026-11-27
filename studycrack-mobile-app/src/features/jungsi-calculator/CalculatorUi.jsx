import React from 'react';

export function CalculatorButton({ primary = false, text = false, ...props }) {
  return <button type="button" className={primary ? 'jcalc-primary' : text ? 'jcalc-text-button' : 'jcalc-secondary'} {...props} />;
}

export function CalculatorNote(props) {
  return <p className="jcalc-note" {...props} />;
}

export function CalculatorTabs({ id, tabs, selected, onSelect, label, className }) {
  const onKeyDown = (event, index) => {
    let next;
    switch (event.key) {
      case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break;
      case 'ArrowRight': next = (index + 1) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    onSelect(tabs[next][0]);
    event.currentTarget.parentElement.children[next]?.focus({ preventScroll: true });
  };
  return <div role="tablist" aria-label={label} className={className}>{tabs.map(([key, title], index) =>
    <button key={key} type="button" role="tab" id={`${id}-tab-${key}`} aria-controls={`${id}-panel-${key}`}
      aria-selected={selected === key} tabIndex={selected === key ? 0 : -1} onClick={() => onSelect(key)} onKeyDown={event => onKeyDown(event, index)}>{title}</button>)}</div>;
}

import React from 'react';

export function CalculatorButton({ primary = false, text = false, ...props }) {
  return <button type="button" className={primary ? 'jcalc-primary' : text ? 'jcalc-text-button' : 'jcalc-secondary'} {...props} />;
}

export function CalculatorNote(props) {
  return <p className="jcalc-note" {...props} />;
}

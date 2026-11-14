import React from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (root && document.body.dataset.appSurface === 'jungsi-calculator-2027') {
  import('../features/jungsi-calculator/JungsiCalculatorApp.jsx')
    .then(({ default: Calculator }) => createRoot(root).render(React.createElement(Calculator)))
    .catch(() => { root.textContent = '계산기 화면을 준비하지 못했습니다. 새로고침하거나 잠시 후 다시 시도해주세요.'; });
}

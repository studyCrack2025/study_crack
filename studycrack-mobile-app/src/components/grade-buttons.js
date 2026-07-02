import { GRADE_STATUS_OPTIONS } from '../constants/options.js';

export function renderGradeButtons(current = '', options = GRADE_STATUS_OPTIONS) {
  return options
    .map((grade) => `<button class="ob1-pill ${current === grade ? 'active' : ''}" data-action="setObGradeStatus" data-ob-grade="${grade}">${grade}</button>`)
    .join('');
}

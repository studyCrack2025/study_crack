import React from 'react';

export function SurveySupplementNotes({ reasonText, fields = [], onEdit }) {
  if (!reasonText && !fields.length) return null;
  return <section className="consulting-survey-notes" aria-label="보완 요청 내용">
    {reasonText && <p>{reasonText}</p>}
    {fields.length > 0 && <ul>{fields.map(({ field, label, note }) => <li key={field}>
      <strong>{label}</strong>
      <p>{note}</p>
      {onEdit && <button className="consulting-v2-secondary" type="button" aria-label={`${label} 수정하기`} onClick={() => onEdit(field)}>해당 항목 수정</button>}
    </li>)}</ul>}
  </section>;
}

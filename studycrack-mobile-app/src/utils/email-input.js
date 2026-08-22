const EMAIL_ASCII_DISALLOWED = /[^A-Za-z0-9.!#$%&'*+/=?^_`{|}~@-]+/g;

export function sanitizeEmailInput(value = '') {
  return String(value).replace(EMAIL_ASCII_DISALLOWED, '');
}

export function sanitizeEmailInputElement(input) {
  if (!input) return '';
  const previous = String(input.value || '');
  const next = sanitizeEmailInput(previous);
  if (previous === next) return next;
  const cursor = Number.isFinite(input.selectionStart) ? input.selectionStart : previous.length;
  const removedBeforeCursor = previous.slice(0, cursor).length - sanitizeEmailInput(previous.slice(0, cursor)).length;
  input.value = next;
  const nextCursor = Math.max(0, cursor - removedBeforeCursor);
  try {
    input.setSelectionRange?.(nextCursor, nextCursor);
  } catch (_error) {}
  return next;
}

export function isValidEmailAddress(value = '') {
  const email = sanitizeEmailInput(value);
  return email === String(value).trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

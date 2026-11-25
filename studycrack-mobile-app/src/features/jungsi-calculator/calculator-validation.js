export const calculatorDigest = value => /^sha256:[a-f0-9]{64}$/.test(value || '');
export const admissionUnitId = value => /^UNIT_[A-Z0-9][A-Z0-9_-]{2,71}$/.test(value || '');
export const calculatorRecordId = value => /^(?:U|SG27|R(?:0[1-9]|1[0-9]|20))_[a-f0-9]{16}$/.test(value || '');
export const calculatorSelectionKey = value => /^PICK_[a-f0-9]{32}$/.test(value || '');
export const calculatorReasonCodes = value => Array.isArray(value) && value.length <= 12
  && value.every(code => /^[A-Z][A-Z0-9_]{1,99}$/.test(code));

export const calculatorLabel = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);
export const calculatorTargetNames = target => target && calculatorLabel(target.university) && target.university.trim() && target.university.length <= 160
  && calculatorLabel(target.major) && target.major.trim();

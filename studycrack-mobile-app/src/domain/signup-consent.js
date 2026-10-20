import { TERMS_REVISIONS } from '../constants/terms-revisions.js';

export function buildSignupConsent(birthdate, marketingAgreed, now = Date.now()) {
  const today = new Date(now + 9 * 60 * 60 * 1000);
  const cutoff = `${today.getUTCFullYear() - 14}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
  const birth = new Date(`${birthdate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || !Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthdate || birthdate > cutoff) {
    throw new Error('만 14세 이상만 가입할 수 있습니다. 생년월일을 확인해주세요.');
  }
  return { schema: 1, documents: Object.fromEntries(Object.entries(TERMS_REVISIONS).map(([id, revision]) => [id, { revision, accepted: id !== 'marketing' || marketingAgreed === true }])) };
}

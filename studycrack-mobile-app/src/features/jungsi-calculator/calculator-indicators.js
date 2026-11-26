export const CALCULATOR_RISK_BANDS = [['stable', '안정'], ['appropriate', '적정'], ['neutral', '소신'], ['challenge', '상향'], ['risky', '위험']];

const teacherRule = '학생부 100% 전형입니다. 수능 최저는 국어·수학·영어·탐구 중 상위 3개 영역 등급 합 6 이내입니다. 가채점은 예상 등급을 적용합니다.';
const selectionNotices = new Map([
  ['SELECTION_SCORE_POLICY_UNCONFIRMED', { label: '현재 계산 대상 제외', note: '대학의 환산 규정 확인이 남아 있습니다. 지원 조합에서 다른 후보를 선택할 수 있습니다.' }],
  ['CSAT_MINIMUM_MET', { label: '수능 최저 충족', note: teacherRule }],
  ['CSAT_MINIMUM_NOT_MET', { label: '수능 최저 미충족', note: teacherRule }],
  ['CSAT_MINIMUM_GRADE_REQUIREMENT', { label: '수능 최저 미충족', note: '입력한 성적 기준입니다. 대학 모집요강에서 이 전형의 영역별 기준을 확인해주세요.' }],
  ['SCIENCE_INQUIRY_REQUIRED', { label: '과탐 응시 요건 미충족', note: '과학탐구를 1과목 이상 응시해야 지원할 수 있습니다.' }],
  ['MATH_SELECTION_NOT_ALLOWED', { label: '수학 응시 요건 미충족', note: '이 모집단위에 지원하려면 대학이 지정한 수학 선택과목에 응시해야 합니다.' }],
  ['INQUIRY_TRACK_NOT_ALLOWED', { label: '탐구 응시 요건 미충족', note: '이 모집단위에 지원하려면 대학이 지정한 탐구 영역에 응시해야 합니다.' }],
  ['INQUIRY_COUNT_NOT_MET', { label: '탐구 응시 요건 미충족', note: '이 모집단위에서 요구하는 탐구 과목 수를 확인해주세요.' }],
  ['BIOLOGY_INQUIRY_REQUIRED', { label: '탐구 응시 요건 미충족', note: '이 모집단위에 지원하려면 생명과학Ⅰ 또는 Ⅱ에 응시해야 합니다.' }],
  ['SNU_SCIENCE_FIELD_COMBINATION_NOT_ALLOWED', { label: '탐구 응시 요건 미충족', note: '대학이 지정한 서로 다른 과학탐구 분야의 조합을 확인해주세요.' }],
  ['SNU_PHYSICS_OR_CHEMISTRY_REQUIRED', { label: '탐구 응시 요건 미충족', note: '이 모집단위에 지원하려면 물리학 또는 화학에 응시해야 합니다.' }],
  ['SELECTION_CARRYOVER_ONLY', { label: '수시 이월 때 선발', note: '수시 이월 인원이 발생하면 선발합니다. 대학의 최종 정시 모집인원을 확인해주세요.' }]
]);
const ineligibleNotice = { label: '지원 요건 미충족', note: '입력한 성적 기준입니다. 대학 모집요강에서 이 전형의 지원 요건을 확인해주세요.' };

export function calculatorSelectionNotice(result) {
  if (result?.status === 'available' || result?.previewCutoff) return null;
  const reason = result?.reasonCodes?.find(code => selectionNotices.has(code));
  return selectionNotices.get(reason) ?? (result?.status === 'ineligible' ? ineligibleNotice : null);
}

export function calculatorIndicator(result) {
  const notice = calculatorSelectionNotice(result);
  if (notice) return { band: null, label: notice.label };
  const formal = result?.status === 'available' && !result.previewCutoff;
  const measured = formal ? result.possibility : result?.previewCutoff;
  if (measured?.status === 'available') {
    const stage = CALCULATOR_RISK_BANDS.find(([band]) => band === measured.riskBand);
    if (stage) return { band: stage[0], label: stage[1] };
  }
  const score = formal ? result.convertedScore : measured?.convertedScore;
  const pass = measured?.cutoffs?.pass;
  if (measured?.status === 'reference_only' && Number.isFinite(score) && Number.isFinite(pass)) {
    return { band: null, label: score >= pass ? '합격 컷 이상' : '합격 컷 미만' };
  }
  return { band: null, label: '판단 대기' };
}

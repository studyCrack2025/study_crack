export const PROGRESS_LABELS = Object.freeze({
  onboarding: '가입 및 인증',
  survey: '기초조사서',
  materials: '자료 확인',
  written_consultation: '서면 상담',
  report: '보고서',
  final_call: '파이널 콜'
});

export const ACTION_LABELS = Object.freeze({
  ACCEPT_SERVICE_TERMS: '서비스 안내를 확인하고 기초조사를 시작해주세요.',
  COMPLETE_SURVEY: '기초조사서를 작성해주세요.',
  WAIT_FOR_MATERIAL_REVIEW: '제출한 자료를 확인하고 있습니다.',
  SUBMIT_SUPPLEMENT: '요청된 보완 자료를 제출해주세요.',
  SUBMIT_WRITTEN_AVAILABILITY: '서면 상담이 가능한 시간대를 선택해주세요.',
  WAIT_FOR_WRITTEN_ASSIGNMENT: '상담 일정을 배정하고 있습니다.',
  ATTEND_WRITTEN_SESSION: '예약된 시간에 서면 상담을 진행해주세요.',
  WAIT_FOR_REPORT: '상담 내용을 반영한 보고서를 작성하고 있습니다.',
  WAIT_FOR_REPORT_RELEASE: '보고서 발송을 준비하고 있습니다.',
  SUBMIT_FINAL_CALL_AVAILABILITY: '파이널 콜이 가능한 시간대를 선택해주세요.',
  ATTEND_FINAL_CALL: '예약된 시간에 파이널 콜을 진행해주세요.'
});

export function formatConsultingDueAt(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

export function actionPathForState(workflowState) {
  if (['ONBOARDING', 'SURVEY_DRAFT', 'SUPPLEMENT_REQUIRED'].includes(workflowState)) return '/2027-jungsi-consulting/survey';
  if (workflowState === 'MATERIAL_REVIEW') return '/2027-jungsi-consulting/materials';
  if (['AVAILABILITY_REQUIRED', 'SCHEDULING'].includes(workflowState)) return '/2027-jungsi-consulting/schedule';
  if (workflowState === 'WRITTEN_SESSION_BOOKED') return '/2027-jungsi-consulting/written-session';
  if (['WRITTEN_SESSION_COMPLETED', 'REPORT_GENERATING', 'REPORT_REVIEW', 'REPORT_SCHEDULED'].includes(workflowState)) return '/2027-jungsi-consulting/report';
  if (['FINAL_CALL_SCHEDULING', 'FINAL_CALL_BOOKED'].includes(workflowState)) return '/2027-jungsi-consulting/final-call';
  return '';
}

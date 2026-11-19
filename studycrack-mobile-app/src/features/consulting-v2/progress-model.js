export const HOME_GUIDANCE = Object.freeze({
  ACCEPT_SERVICE_TERMS: {
    title: '지원 상황부터 알려주세요.',
    description: '성적과 희망 조건을 알려주시면 서면 상담에서 함께 살펴볼 내용을 준비할 수 있어요.',
    button: '기초조사서 작성하기'
  },
  COMPLETE_SURVEY: {
    title: '기초조사서를 이어서 작성해요.',
    description: '저장한 답변을 다시 열 수 있어요. 상담에서 묻고 싶은 점까지 차근차근 적어주세요.',
    button: '이어서 작성하기'
  },
  WAIT_FOR_MATERIAL_REVIEW: {
    title: '제출한 자료를 확인하고 있어요.',
    description: '운영팀에서 조사서와 성적표를 살펴보고 있습니다. 확인이 끝나면 서면 상담 시간을 선택할 수 있어요.',
    button: '제출 자료 보기'
  },
  SUBMIT_SUPPLEMENT: {
    title: '추가로 확인할 내용이 있어요.',
    description: '보완 요청을 확인하고 해당하는 답변이나 성적표를 보완해주세요.',
    button: '보완 요청 확인'
  },
  SUBMIT_WRITTEN_AVAILABILITY: {
    title: '서면 상담 시간을 정해요.',
    description: '상담에 참여할 수 있는 시간대를 알려주시면 일정을 배정합니다.',
    button: '가능 시간 선택하기'
  },
  WAIT_FOR_WRITTEN_ASSIGNMENT: {
    title: '서면 상담 일정을 맞추고 있어요.',
    description: '제출한 가능 시간을 바탕으로 상담 일정을 확인하고 있습니다.',
    button: '가능 시간 확인하기'
  },
  ATTEND_WRITTEN_SESSION: {
    title: '서면 상담을 준비해주세요.',
    description: '예약된 시간에 상담 화면에서 궁금한 점을 함께 이야기해요.',
    button: '서면 상담 열기'
  },
  WAIT_FOR_REPORT: {
    title: '지원 전략을 보고서로 정리하고 있어요.',
    description: '서면 상담에서 나눈 내용을 반영하고 상담사가 검토합니다.',
    button: '보고서 상태 보기'
  },
  WAIT_FOR_REPORT_RELEASE: {
    title: '보고서 공개를 준비하고 있어요.',
    description: '공개된 보고서를 읽고 나면 파이널 콜에서 지원 전략을 정리할 수 있어요.',
    button: '보고서 상태 보기'
  },
  SUBMIT_FINAL_CALL_AVAILABILITY: {
    title: '파이널 콜 가능 시간을 알려주세요.',
    description: '보고서를 바탕으로 마지막으로 확인할 내용을 상담사와 정리해요.',
    button: '파이널 콜 시간 선택하기'
  },
  WAIT_FOR_FINAL_CALL_ASSIGNMENT: {
    title: '파이널 콜 일정을 확인하고 있어요.',
    description: '가능한 시간을 바탕으로 일정을 맞추고 있습니다.',
    button: '통화 일정 확인하기'
  },
  ATTEND_FINAL_CALL: {
    title: '파이널 콜을 준비해주세요.',
    description: '예약 시간과 참여 방법을 확인하고, 보고서를 보며 남은 질문을 정리해주세요.',
    button: '통화 일정 확인하기'
  }
});

export function formatConsultingDueAt(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

export function actionPathForState(workflowState) {
  if (['ONBOARDING', 'SURVEY_DRAFT'].includes(workflowState)) return '/2027-jungsi-consulting/survey';
  if (['MATERIAL_REVIEW', 'SUPPLEMENT_REQUIRED'].includes(workflowState)) return '/2027-jungsi-consulting/materials';
  if (['AVAILABILITY_REQUIRED', 'SCHEDULING'].includes(workflowState)) return '/2027-jungsi-consulting/schedule';
  if (workflowState === 'WRITTEN_SESSION_BOOKED') return '/2027-jungsi-consulting/written-session';
  if (['WRITTEN_SESSION_COMPLETED', 'REPORT_GENERATING', 'REPORT_REVIEW', 'REPORT_SCHEDULED'].includes(workflowState)) return '/2027-jungsi-consulting/report';
  if (['FINAL_CALL_SCHEDULING', 'FINAL_CALL_BOOKED'].includes(workflowState)) return '/2027-jungsi-consulting/final-call';
  return '';
}

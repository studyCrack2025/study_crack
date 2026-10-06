import plan from '../../assets/game-rules/plan.webp';
import planConfirmed from '../../assets/game-rules/plan-confirmed.webp';
import studyProgress from '../../assets/game-rules/study-progress.webp';
import studyConfirmed from '../../assets/game-rules/study-confirmed.webp';
import discovery from '../../assets/game-rules/discovery.webp';
import duplicatePlan from '../../assets/game-rules/duplicate-plan.webp';
import duplicateStudy from '../../assets/game-rules/duplicate-study.webp';

const asset = (src, width, height, alt, focus) => Object.freeze({ src, width, height, alt, focus });
const EXAMPLES = Object.freeze({
  plan: asset(plan, 716, 176, '국어 30분 예시 계획의 완료 체크 버튼', '왼쪽 완료 체크'),
  planConfirmed: asset(planConfirmed, 716, 100, '계획 완료 확인 후 뽑기권 지급 안내 예시', '완료 확인'),
  studyProgress: asset(studyProgress, 648, 100, '보유 뽑기권과 다음 뽑기권까지 남은 시간 예시', '남은 시간 확인'),
  studyConfirmed: asset(studyConfirmed, 648, 68, '공부 기록과 성장 보상 모두 완료된 화면 예시', '두 항목의 완료 확인'),
  discovery: asset(discovery, 264, 266, '무작위 뽑기 결과에서 발견한 구피 화면 예시', '결과 확인 → 내 물고기에서 배치'),
  duplicatePlan: asset(duplicatePlan, 632, 206, '중복 발견 후 물고기와 경험치·배치가 유지되는 결과 예시', '중복 결과 확인'),
  duplicateStudy: asset(duplicateStudy, 632, 162, '같은 물고기 발견 후 기존 친구의 성장에 반영되는 결과 예시', '중복 성장 확인')
});

export function rulesGuideExample(presentation, index) {
  if (!presentation.ready || !Number.isInteger(index) || index < 0 || index > 3 || (index >= 2 && !presentation.draw)) return null;
  return [presentation.plan ? EXAMPLES.plan : EXAMPLES.studyProgress,
    presentation.plan ? EXAMPLES.planConfirmed : EXAMPLES.studyConfirmed,
    EXAMPLES.discovery, presentation.plan ? EXAMPLES.duplicatePlan : EXAMPLES.duplicateStudy][index];
}

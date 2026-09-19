import { Sheet } from '../../components/Sheet.jsx';
import { PlannerStorageNotice } from '../../features/planner/PlannerStorageNotice.jsx';
import { PlannerAccountNotice } from '../../features/planner/PlannerAccountNotice.jsx';

function fieldValue(value) {
  return value && value !== '--:--' ? value : '';
}

export function PlannerEditSheet({ plannerEditIndex = null, plannerEditItem = null }) {
  return (
    <Sheet open={plannerEditIndex !== null} variant="planner" dismissAction="closePlannerEdit" ariaLabel="플래너 항목 수정" panelClass="planner-edit-sheet">
      <button type="button" className="planner-sheet-close" data-action="closePlannerEdit" aria-label="닫기">×</button>
      <h3>플래너 항목 수정</h3>
      <PlannerAccountNotice />
      <p className="planner-edit-note">계획 시간은 실제 공부 기록과 별개예요. 종료는 시작보다 늦게 입력해주세요.</p>
      <div className="planner-time-row">
        <div className="planner-sheet-block"><label htmlFor="planner-edit-start">시작</label><input id="planner-edit-start" className="planner-input" data-field="plannerEditStart" type="time" defaultValue={fieldValue(plannerEditItem?.start)} /></div>
        <div className="planner-sheet-block"><label htmlFor="planner-edit-end">종료</label><input id="planner-edit-end" className="planner-input" data-field="plannerEditEnd" type="time" defaultValue={fieldValue(plannerEditItem?.end)} /></div>
      </div>
      <div className="planner-sheet-block"><label htmlFor="planner-edit-subject">과목</label><input id="planner-edit-subject" className="planner-input" data-field="plannerEditSubject" defaultValue={plannerEditItem?.subject || ''} /></div>
      <div className="planner-sheet-block"><label htmlFor="planner-edit-detail">세부 과목</label><input id="planner-edit-detail" className="planner-input" data-field="plannerEditDetailSubject" defaultValue={plannerEditItem?.detailSubject || ''} /></div>
      <div className="planner-sheet-block"><label htmlFor="planner-edit-activity">학습 유형</label><input id="planner-edit-activity" className="planner-input" data-field="plannerEditActivityType" defaultValue={plannerEditItem?.activityType || ''} /></div>
      <div className="planner-sheet-block"><label htmlFor="planner-edit-content">세부 내용</label><textarea id="planner-edit-content" className="planner-input planner-edit-text" data-field="plannerEditContent" rows="3" defaultValue={plannerEditItem?.content || ''} /></div>
      <div className="planner-sheet-block"><label htmlFor="planner-edit-memo">메모</label><textarea id="planner-edit-memo" className="planner-input planner-edit-text" data-field="plannerEditMemo" rows="2" defaultValue={plannerEditItem?.memo || ''} /></div>
      <div className="planner-edit-footer"><PlannerStorageNotice /><button type="button" className="btn btn-primary" data-action="savePlannerEdit">수정 저장</button></div>
    </Sheet>
  );
}

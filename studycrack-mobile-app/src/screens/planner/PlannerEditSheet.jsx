import { Sheet } from '../../components/Sheet.jsx';

function fieldValue(value) {
  return value && value !== '--:--' ? value : '';
}

export function PlannerEditSheet({ plannerEditIndex = null, plannerEditItem = null }) {
  return (
    <Sheet open={plannerEditIndex !== null} variant="planner" dismissAction="closePlannerEdit">
      <button type="button" className="planner-sheet-close" data-action="closePlannerEdit" aria-label="닫기">×</button>
      <h3>플래너 항목 수정</h3>
      <div className="planner-time-row">
        <div className="planner-sheet-block"><label>시작</label><input className="planner-input" data-field="plannerEditStart" type="time" defaultValue={fieldValue(plannerEditItem?.start)} /></div>
        <div className="planner-sheet-block"><label>종료</label><input className="planner-input" data-field="plannerEditEnd" type="time" defaultValue={fieldValue(plannerEditItem?.end)} /></div>
      </div>
      <div className="planner-sheet-block"><label>과목</label><input className="planner-input" data-field="plannerEditSubject" defaultValue={plannerEditItem?.subject || ''} /></div>
      <div className="planner-sheet-block"><label>세부 과목</label><input className="planner-input" data-field="plannerEditDetailSubject" defaultValue={plannerEditItem?.detailSubject || ''} /></div>
      <div className="planner-sheet-block"><label>학습 유형</label><input className="planner-input" data-field="plannerEditActivityType" defaultValue={plannerEditItem?.activityType || ''} /></div>
      <div className="planner-sheet-block"><label>세부 내용</label><input className="planner-input" data-field="plannerEditContent" defaultValue={plannerEditItem?.content || ''} /></div>
      <div className="planner-sheet-block"><label>메모</label><input className="planner-input" data-field="plannerEditMemo" defaultValue={plannerEditItem?.memo || ''} /></div>
      <button type="button" className="btn btn-primary" data-action="savePlannerEdit">수정 저장</button>
    </Sheet>
  );
}

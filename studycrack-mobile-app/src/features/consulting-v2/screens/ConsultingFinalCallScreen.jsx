import React from 'react';
import { finalCallRequest, finalRequestKey, finalSessionTime, validateFinalSelection } from '../final-call-api.js';
import { useFinalCallResource } from '../use-final-call-resource.js';
import { groupWrittenSlots } from '../schedule-model.js';
import { FinalCallFrame } from './FinalCallFrame.jsx';
import { AdminFinalCall, CounselorFinalCall } from './ConsultingFinalCallWorkspaces.jsx';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';


function StudentFinalCall({ binding }) {
  const [selected, setSelected] = React.useState({}), key = React.useRef(null);
  const loader = React.useCallback(async signal => {
    const status = await finalCallRequest(binding, 'student_get_v2_final_call_status', {}, signal);
    if (!status.ok || !status.data.editable) return status;
    const slots = await finalCallRequest(binding, 'student_list_v2_final_call_slots', {}, signal);
    return slots.ok ? { ok: true, data: { ...status.data, slots: slots.data.slots } } : slots;
  }, [binding]);
  const resource = useFinalCallResource(loader), data = resource.data;
  React.useEffect(() => { if (data) { const allowed = new Set((data.slots || []).map(slot => slot.slotId)); setSelected(Object.fromEntries((data.selectedSlots || []).filter(slot => allowed.has(slot.slotId)).map(slot => [slot.slotId, slot.priority]))); } }, [data]);
  const toggle = slotId => setSelected(current => { const next = { ...current }; if (next[slotId]) delete next[slotId]; else if (Object.keys(next).length < 20) next[slotId] = 2; return next; });
  const submit = () => {
    const validation = validateFinalSelection(selected); if (validation.error) return resource.setMessage(validation.error);
    const payload = finalRequestKey(key, { selectedSlots: validation.selectedSlots, expectedCaseRevision: data.caseRevision, expectedAvailabilityRevision: data.availabilityRevision });
    resource.run(signal => finalCallRequest(binding, 'student_submit_v2_final_call_availability', payload, signal));
  };
  const completed = data?.workflowState === 'SERVICE_COMPLETED';
  return <FinalCallFrame resource={resource} binding={binding}>{data ? <><p className="consulting-v2-status">{completed ? '통화를 마치고 모든 컨설팅 과정이 완료됐습니다. 공개된 보고서는 계속 확인할 수 있습니다.' : data.session && ['booked', 'review'].includes(data.session.status) ? '확정된 시간에 등록된 전화번호로 상담사가 연락드립니다. 보고서를 준비해주세요. 일정 변경은 운영자에게 문의해주세요.' : data.availabilityRevision ? '가능 시간을 저장했습니다. 담당 상담사와 일정이 맞으면 자동 확정됩니다. 확정 전에는 시간을 다시 제출할 수 있습니다.' : '보고서를 확인한 뒤 마지막 통화 시간을 선택해주세요.'}</p>
    {data.session && ['booked', 'review', 'completed'].includes(data.session.status) ? <div className="consulting-schedule-confirmed"><strong>{completed ? '파이널 콜 완료' : data.session.status === 'review' ? '통화 결과 확인 중' : '확정 일정'}</strong><span>{finalSessionTime(data.session)}</span><small>한국 시간 · 30분</small></div> : null}
    {data.editable ? <><h2>통화 가능한 시간</h2><p>다음 7일 중 30분 단위로 3~20개, 최소 2일에 나누어 선택해주세요. 1순위 시간을 먼저 배정합니다.</p><p aria-live="polite">{Object.keys(selected).length}/20개 선택</p><fieldset className="consulting-final-slots" disabled={resource.busy}><legend>한국 시간 기준</legend><div className="consulting-schedule-days">{groupWrittenSlots(data.slots).map(group => <section key={group.date}><h2>{group.date}</h2><div>{group.slots.map(slot => <article key={slot.slotId} className={selected[slot.slotId] ? 'is-selected' : ''}><button type="button" aria-label={`${group.date} ${slot.localTime}`} aria-pressed={Boolean(selected[slot.slotId])} onClick={() => toggle(slot.slotId)}>{slot.localTime}</button>{selected[slot.slotId] ? <select aria-label={`${group.date} ${slot.localTime} 우선순위`} value={selected[slot.slotId]} onChange={event => setSelected(value => ({ ...value, [slot.slotId]: Number(event.target.value) }))}>{[1, 2, 3].map(priority => <option value={priority} key={priority}>{priority}순위</option>)}</select> : null}</article>)}</div></section>)}</div></fieldset><button className="consulting-v2-primary consulting-v2-wide" type="button" disabled={resource.busy} onClick={submit}>{resource.busy ? '저장 중…' : '가능 시간 제출·자동 배정'}</button></> : null}
    <div className="consulting-report-actions"><button type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.report)}>공개 보고서 보기</button></div></> : null}</FinalCallFrame>;
}

export function ConsultingFinalCallScreen({ binding }) {
  if (binding.userRole === 'admin') return <AdminFinalCall binding={binding} />;
  if (binding.userRole === 'tutor') return <CounselorFinalCall binding={binding} />;
  return <StudentFinalCall binding={binding} />;
}

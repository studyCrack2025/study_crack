import React from 'react';
import { getWrittenAvailability, getWrittenBooking, listWrittenSlots, submitWrittenAvailability } from '../schedule-api.js';
import { formatWrittenSession, groupWrittenSlots, validateWrittenSelection } from '../schedule-model.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';

export function ConsultingScheduleScreen({ binding }) {
  const [resource, setResource] = React.useState({ status: 'loading', slots: [], revision: 0, booking: null });
  const [selected, setSelected] = React.useState({});
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const load = React.useCallback(async () => {
    setResource(value => ({ ...value, status: 'loading' }));
    const [slots, availability, booking] = await Promise.all([listWrittenSlots(binding), getWrittenAvailability(binding), getWrittenBooking(binding)]);
    if (!slots.ok || !availability.ok || !booking.ok) return setResource({ status: 'error', slots: [], revision: 0, booking: null });
    setSelected(Object.fromEntries((availability.data.selectedSlots || []).map(slot => [slot.slotId, slot.priority || 2])));
    setResource({ status: 'ready', slots: slots.data.slots || [], revision: availability.data.revision || 0, booking: booking.data.session || null });
  }, [binding]);
  React.useEffect(() => { load(); }, [load]);
  const toggle = slotId => setSelected(current => {
    if (current[slotId]) { const next = { ...current }; delete next[slotId]; return next; }
    if (Object.keys(current).length >= 30) { setMessage('가능 시간은 최대 30개까지 선택할 수 있습니다.'); return current; }
    return { ...current, [slotId]: 2 };
  });
  const save = async () => {
    const validation = validateWrittenSelection(selected);
    if (!validation.valid) return setMessage(validation.message);
    setSaving(true); setMessage('');
    const result = await submitWrittenAvailability(binding, { expectedAvailabilityRevision: resource.revision, selectedSlots: validation.selectedSlots });
    if (result.ok) { setResource(value => ({ ...value, revision: result.data.revision })); setMessage('가능 시간을 저장했습니다. 운영자가 일정을 확정하면 알려드릴게요.'); }
    else setMessage(result.code === 'REVISION_CONFLICT' ? '다른 화면에서 시간이 변경되었습니다. 새로 불러와주세요.' : result.error);
    setSaving(false);
  };
  if (resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">상담 가능 시간을 불러오고 있습니다.</p></main>;
  if (resource.status === 'error') return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>일정을 불러오지 못했습니다</h1><button className="consulting-v2-primary consulting-v2-wide" onClick={load}>다시 시도</button></section></main>;
  const confirmed = formatWrittenSession(resource.booking);
  if (confirmed) return <main className="consulting-schedule"><section className="consulting-schedule-card"><p className="consulting-v2-kicker">서면 상담 일정</p><h1>상담 일정이 확정됐습니다</h1><div className="consulting-schedule-confirmed"><strong>{confirmed.date}</strong><span>{confirmed.time}</span><small>Asia/Seoul · 30분</small></div><button className="consulting-v2-secondary consulting-v2-wide" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>진행 현황으로</button></section></main>;
  const groups = groupWrittenSlots(resource.slots);
  return <main className="consulting-schedule"><header><button type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>← 진행 현황</button><span>{Object.keys(selected).length}/30개 선택</span></header><section className="consulting-schedule-card"><p className="consulting-v2-kicker">서면 상담 일정</p><h1>가능한 시간을 선택해주세요</h1><p className="consulting-v2-status">다음 7일 중 30분 단위로 6개 이상, 최소 3일에 나누어 선택해주세요.</p><div className="consulting-schedule-days">{groups.map(group => <section key={group.date}><h2>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${group.date}T00:00:00+09:00`))}</h2><div>{group.slots.map(slot => { const active = Boolean(selected[slot.slotId]); return <article className={active ? 'is-selected' : ''} key={slot.slotId}><button type="button" aria-pressed={active} onClick={() => toggle(slot.slotId)}>{slot.localTime}</button>{active ? <select aria-label={`${slot.localTime} 우선순위`} value={selected[slot.slotId]} onChange={event => setSelected(current => ({ ...current, [slot.slotId]: Number(event.target.value) }))}><option value="1">1순위</option><option value="2">2순위</option><option value="3">3순위</option></select> : null}</article>; })}</div></section>)}</div>{message ? <p className="consulting-survey-message" role="status">{message}</p> : null}<footer><button className="consulting-v2-primary consulting-v2-wide" type="button" disabled={saving} onClick={save}>{saving ? '저장 중…' : '가능 시간 저장'}</button></footer></section></main>;
}

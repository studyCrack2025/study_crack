import React from 'react';
import { getWrittenAvailability, getWrittenBooking, listWrittenSlots, submitWrittenAvailability } from '../schedule-api.js';
import { formatWrittenSession, groupWrittenSlots, validateWrittenSelection } from '../schedule-model.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';

const dateLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' });

export function ConsultingScheduleScreen({ binding }) {
  const [resource, setResource] = React.useState({ status: 'loading' });
  const [selected, setSelected] = React.useState({});
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const load = React.useCallback(async () => {
    setResource(value => ({ ...value, status: 'loading' }));
    const [slots, availability, booking] = await Promise.all([listWrittenSlots(binding), getWrittenAvailability(binding), getWrittenBooking(binding)]);
    if (availability.data?.serviceHold) return setResource({ status: 'held' });
    if (slots.code === 'INVALID_CASE_STATE') return setResource({ status: 'unavailable' });
    if (!slots.ok || !availability.ok || !booking.ok || availability.data.caseId !== booking.data.caseId) return setResource({ status: 'error' });
    const options = slots.data.slots || [];
    const prior = availability.data.selectedSlots || [];
    const slotIds = new Set(options.map(slot => slot.slotId));
    const valid = prior.filter(slot => slotIds.has(slot.slotId));
    setSelected(Object.fromEntries(valid.map(slot => [slot.slotId, slot.priority || 2])));
    setMessage('');
    setResource({ status: 'ready', slots: options, revision: availability.data.revision || 0, booking: booking.data.session || null,
      editable: availability.data.editable !== false, outsideWindowCount: prior.length - valid.length });
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
    if (result.ok) { setResource(value => ({ ...value, revision: result.data.revision, outsideWindowCount: 0 })); setMessage('가능 시간을 저장했습니다. 운영자가 일정을 확정하면 알려드릴게요.'); }
    else setMessage(result.code === 'REVISION_CONFLICT' ? '다른 화면에서 시간이 변경되었습니다. 새로 불러와주세요.' : result.error);
    setSaving(false);
  };
  if (resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">상담 가능 시간을 불러오고 있습니다.</p></main>;
  if (resource.status === 'error') return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>일정을 불러오지 못했습니다</h1><button className="consulting-v2-primary consulting-v2-wide" onClick={load}>다시 시도</button></section></main>;
  const confirmed = formatWrittenSession(resource.booking);
  if (confirmed) return <main className="consulting-schedule"><section className="consulting-schedule-card"><p className="consulting-v2-kicker">서면 상담 일정</p><h1>상담 일정이 확정됐습니다</h1><div className="consulting-schedule-confirmed"><strong>{confirmed.date}</strong><span>{confirmed.time}</span><small>Asia/Seoul · 30분</small></div><button className="consulting-v2-secondary consulting-v2-wide" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>진행 현황으로</button></section></main>;
  if (resource.status !== 'ready' || !resource.editable) return <main className="consulting-v2-center">
    <section className="consulting-v2-card">
      <h1>{resource.status === 'held' ? '서비스가 일시 보류 중이에요' : '상담 가능 시간을 선택할 수 없는 상태예요'}</h1>
      <p className="consulting-v2-status">기초조사서 화면에서 현재 진행 상태를 확인해 주세요.</p>
      <button className="consulting-v2-primary consulting-v2-wide" onClick={() => navigateConsulting(CONSULTING_ROUTES.materials)}>기초조사서 진행 상태 보기</button>
    </section>
  </main>;
  const groups = groupWrittenSlots(resource.slots);
  return <main className="consulting-schedule">
    <header><button type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>← 진행 현황</button><span>{Object.keys(selected).length}/30개 선택</span></header>
    <section className="consulting-schedule-card">
      <p className="consulting-v2-kicker">서면상담 일정 · {resource.revision ? '가능 시간 제출 완료' : '가능 시간 선택'}</p>
      <h1>가능한 시간을 선택해주세요</h1>
      <p className="consulting-v2-status">한국시간 기준 내일부터 7일 동안, 30분 단위로 6~30개를 최소 3일에 나누어 선택해 주세요. 제출한 시간을 바탕으로 상담 일정을 확정합니다.</p>
      {resource.outsideWindowCount > 0 && <p className="consulting-survey-message" role="status">이전에 선택한 시간 중 {resource.outsideWindowCount}개가 현재 선택 기간에서 벗어났어요. 가능한 시간을 다시 골라주세요.</p>}
      <div className="consulting-schedule-days">{groups.map(group => <section key={group.date}>
        <h2>{dateLabel.format(new Date(`${group.date}T00:00:00+09:00`))}</h2>
        <div>{group.slots.map(slot => {
          const active = Boolean(selected[slot.slotId]);
          return <article className={active ? 'is-selected' : ''} key={slot.slotId}>
            <button type="button" disabled={saving} aria-pressed={active} onClick={() => toggle(slot.slotId)}>{slot.localTime}</button>
            {active && <select disabled={saving} aria-label={`${slot.localTime} 우선순위`} value={selected[slot.slotId]} onChange={event => setSelected(current => ({ ...current, [slot.slotId]: Number(event.target.value) }))}>
              <option value="1">1순위</option><option value="2">2순위</option><option value="3">3순위</option>
            </select>}
          </article>;
        })}</div>
      </section>)}</div>
      {message && <p className="consulting-survey-message" role="status">{message}</p>}
      <footer><button className="consulting-v2-primary consulting-v2-wide" type="button" disabled={saving} onClick={save}>{saving ? '저장 중…' : '가능 시간 저장'}</button></footer>
    </section>
  </main>;
}

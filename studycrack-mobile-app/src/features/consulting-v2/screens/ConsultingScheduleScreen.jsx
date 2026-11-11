import React from 'react';
import { getWrittenAvailability, getWrittenBooking, listWrittenSlots, requestWrittenReschedule, respondWrittenReschedule, submitWrittenAvailability } from '../schedule-api.js';
import { formatWrittenSession, groupWrittenSlots, validateWrittenSelection } from '../schedule-model.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';

const dateLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' });
const kstDate = date => dateLabel.format(new Date(`${date}T00:00:00+09:00`));

function ScheduleTimePicker({ slots, selected, setSelected, saving }) {
  const toggle = slotId => setSelected(current => {
    if (!current[slotId]) return { ...current, [slotId]: 2 };
    const next = { ...current };
    delete next[slotId];
    return next;
  });
  return <div className="consulting-schedule-days">{groupWrittenSlots(slots).map(group => {
    const all = group.slots.every(slot => selected[slot.slotId]);
    return <section key={group.date}>
      <h2>{kstDate(group.date)}</h2>
      <label><input type="checkbox" checked={all} disabled={saving} onChange={() => setSelected(current => {
        const next = { ...current };
        for (const slot of group.slots) {
          if (all) delete next[slot.slotId];
          else next[slot.slotId] = next[slot.slotId] || 2;
        }
        return next;
      })} /> 이 날의 모든 시간 선택</label>
      <div>{group.slots.map(slot => {
        const active = Boolean(selected[slot.slotId]);
        return <article className={active ? 'is-selected' : ''} key={slot.slotId}>
          <button type="button" disabled={saving} aria-pressed={active} onClick={() => toggle(slot.slotId)}>{slot.localTime}</button>
        </article>;
      })}</div>
    </section>;
  })}</div>;
}

function ConfirmedWrittenTime({ value }) {
  return <div className="consulting-schedule-confirmed"><strong>{value.date}</strong><span>{value.time}</span><small>한국시간 · 30분</small></div>;
}

export function ConsultingScheduleScreen({ binding }) {
  const [resource, setResource] = React.useState({ status: 'loading' });
  const [selected, setSelected] = React.useState({});
  const [message, setMessage] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async (feedback = '') => {
    setResource(value => ({ ...value, status: 'loading' }));
    const [slots, availability, booking] = await Promise.all([listWrittenSlots(binding), getWrittenAvailability(binding), getWrittenBooking(binding)]);
    if (availability.data?.serviceHold) return setResource({ status: 'held' });
    if (slots.code === 'INVALID_CASE_STATE') return setResource({ status: 'unavailable' });
    if (!slots.ok || !availability.ok || !booking.ok || availability.data.caseId !== booking.data.caseId
        || slots.data.caseId && slots.data.caseId !== booking.data.caseId) return setResource({ status: 'error' });
    const options = slots.data.slots || [];
    const change = booking.data.change || null;
    const prior = booking.data.session?.status === 'booked' ? change?.selectedSlots || [] : availability.data.selectedSlots || [];
    const slotIds = new Set(options.map(slot => slot.slotId));
    const valid = prior.filter(slot => slotIds.has(slot.slotId));
    setSelected(Object.fromEntries(valid.map(slot => [slot.slotId, slot.priority || 2])));
    setMessage(feedback);
    setResource({ status: 'ready', slots: options, bookingWindow: slots.data.window, revision: availability.data.revision || 0,
      booking: booking.data.session || null, change, changeRevision: booking.data.changeRevision || 0, canRequestChange: booking.data.canRequestChange === true,
      editable: availability.data.editable !== false, outsideWindowCount: prior.length - valid.length });
  }, [binding]);
  React.useEffect(() => { load(); }, [load]);

  const revisionData = () => ({ expectedSessionRevision: resource.booking.revision, expectedChangeRevision: resource.changeRevision });
  const save = async () => {
    const validation = validateWrittenSelection(selected);
    if (!validation.valid) return setMessage(validation.message);
    setSaving(true); setMessage('');
    try {
      const result = editing
        ? await requestWrittenReschedule(binding, { ...revisionData(), selectedSlots: validation.selectedSlots })
        : await submitWrittenAvailability(binding, { expectedAvailabilityRevision: resource.revision, selectedSlots: validation.selectedSlots });
      if (!result.ok) {
        if (['REVISION_CONFLICT', 'INVALID_AVAILABILITY_SLOT'].includes(result.code)) await load('가능 시간이 바뀌었어요. 최신 시간표에서 다시 선택해주세요.');
        else setMessage(result.error);
        return;
      }
      if (editing) {
        setEditing(false);
        setResource(value => ({ ...value, change: result.data.change, changeRevision: result.data.changeRevision, outsideWindowCount: 0 }));
        setMessage('변경 요청을 보냈어요. 운영팀이 확정할 때까지 기존 예약이 유지됩니다.');
      } else {
        setResource(value => ({ ...value, revision: result.data.revision, outsideWindowCount: 0 }));
        setMessage('가능 시간을 저장했습니다. 운영자가 일정을 확정하면 알려드릴게요.');
      }
    } finally { setSaving(false); }
  };
  const respond = async decision => {
    setSaving(true); setMessage('');
    try {
      const result = await respondWrittenReschedule(binding, { ...revisionData(), requestId: resource.change.requestId, decision });
      if (result.ok) await load(decision === 'accept' ? '새 상담 일정으로 변경됐어요.' : '기존 상담 일정을 유지했어요.');
      else if (['SLOT_CONFLICT', 'SLOT_UNAVAILABLE', 'REVISION_CONFLICT', 'WRITTEN_CHANGE_EXPIRED'].includes(result.code)) await load(result.error);
      else setMessage(result.error);
    } finally { setSaving(false); }
  };

  if (resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">상담 가능 시간을 불러오고 있습니다.</p></main>;
  if (resource.status === 'error') return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>일정을 불러오지 못했습니다</h1><button className="consulting-v2-primary consulting-v2-wide" onClick={() => load()}>다시 시도</button></section></main>;
  const confirmed = formatWrittenSession(resource.booking);
  const proposed = resource.change?.kind === 'admin' ? formatWrittenSession({ ...resource.change.offer, status: 'booked' }) : null;
  if (!confirmed && (resource.status !== 'ready' || !resource.editable)) return <main className="consulting-v2-center">
    <section className="consulting-v2-card">
      <h1>{resource.status === 'held' ? '서비스가 일시 보류 중이에요' : '상담 가능 시간을 선택할 수 없는 상태예요'}</h1>
      <p className="consulting-v2-status">기초조사서 화면에서 현재 진행 상태를 확인해 주세요.</p>
      <button className="consulting-v2-primary consulting-v2-wide" onClick={() => navigateConsulting(CONSULTING_ROUTES.materials)}>기초조사서 진행 상태 보기</button>
    </section>
  </main>;

  const showPicker = !confirmed || (editing && resource.canRequestChange && !proposed);
  const count = Object.keys(selected).length;
  const { startDate, endDate } = resource.bookingWindow || {};
  const period = startDate && endDate ? `${kstDate(startDate)} ~ ${kstDate(endDate)}` : '';
  return <main className="consulting-schedule">
    <header><button type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>← 진행 현황</button>{showPicker && <span>{count}개 선택</span>}</header>
    {confirmed && <section className="consulting-schedule-card">
      <p className="consulting-v2-kicker">서면상담 일정</p><h1>상담 일정이 확정됐습니다</h1><ConfirmedWrittenTime value={confirmed} />
      {proposed && <>
        <h2>운영팀에서 새 상담 시간을 제안했어요</h2><ConfirmedWrittenTime value={proposed} />
        <p className="consulting-v2-status">동의하면 새 시간으로 바뀌어요. 지금 예약을 유지하려면 기존 일정을 선택해주세요.</p>
        <footer><button type="button" className="consulting-v2-primary" disabled={saving} onClick={() => respond('accept')}>새 시간으로 변경</button>
          <button type="button" className="consulting-v2-secondary" disabled={saving} onClick={() => respond('decline')}>기존 일정 유지</button></footer>
      </>}
      {resource.change?.kind === 'student' && <p className="consulting-v2-status">변경 요청을 확인 중이에요. 확정 전까지 기존 예약이 유지됩니다.</p>}
      {resource.canRequestChange && !proposed && !editing && <footer><button className="consulting-v2-secondary" type="button" disabled={saving} onClick={() => setEditing(true)}>{resource.change ? '변경 요청 수정' : '일정 변경 요청'}</button></footer>}
      {!showPicker && message && <p className="consulting-survey-message" role="status">{message}</p>}
    </section>}
    {showPicker && <section className="consulting-schedule-card">
      <p className="consulting-v2-kicker">서면상담 일정 · {editing ? '변경 요청' : resource.revision ? '가능 시간 제출 완료' : '가능 시간 선택'}</p>
      <h1>{editing ? '다시 상담할 수 있는 시간을 골라주세요' : '가능한 시간을 선택해주세요'}</h1>
      {period && <p className="consulting-v2-status">{period} · 한국시간</p>}
      <p className="consulting-v2-status">30분 단위로 참석할 수 있는 시간을 모두 골라주세요. 선택한 시간 중 하나로 확정합니다.</p>
      {resource.outsideWindowCount > 0 && <p className="consulting-survey-message" role="status">이전에 고른 시간 중 {resource.outsideWindowCount}개가 현재는 선택할 수 없어요.</p>}
      {resource.slots.length ? <ScheduleTimePicker slots={resource.slots} selected={selected} setSelected={setSelected} saving={saving} />
        : <p className="consulting-v2-status">지금 선택할 수 있는 시간이 없어요. 운영팀에서 시간표를 열면 다시 확인해주세요.</p>}
      {message && <p className="consulting-survey-message" role="status">{message}</p>}
      <footer><button className="consulting-v2-primary" type="button" disabled={saving || !resource.slots.length} onClick={save}>{saving ? '저장 중…' : editing ? '변경 요청 보내기' : '가능 시간 저장'}</button>
        {editing && <button type="button" className="consulting-v2-secondary" disabled={saving} onClick={() => setEditing(false)}>닫기</button>}</footer>
    </section>}
  </main>;
}

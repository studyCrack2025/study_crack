import React from 'react';
import { getBrowser } from '../../../shared/browser/mobile-runtime.js';
import { getWrittenAvailability, getWrittenBooking, listWrittenSlots, requestWrittenReschedule, respondWrittenReschedule, submitWrittenAvailability } from '../schedule-api.js';
import { formatWrittenSession, validateWrittenSelection, writtenChangeRemaining } from '../schedule-model.js';
import { CONSULTING_ROUTES, navigateConsulting } from '../route-model.js';
import { WrittenAvailabilityPicker, WrittenAvailabilitySaved } from './WrittenAvailabilityPicker.jsx';

const dateLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' });
const kstDate = date => dateLabel.format(new Date(`${date}T00:00:00+09:00`));
const proposalKey = offer => `${offer.slotId}#${offer.counselorId}`;
const proposalOffers = change => change?.kind === 'admin' ? change.offers || (change.offer ? [change.offer] : []) : [];

function ConfirmedWrittenTime({ value }) {
  return <div className="consulting-schedule-confirmed"><strong>{value.date}</strong><span>{value.time}</span><small>한국시간 · 30분</small></div>;
}

export function ConsultingScheduleScreen({ binding }) {
  const browser = getBrowser();
  const [resource, setResource] = React.useState({ status: 'loading' });
  const [selected, setSelected] = React.useState({});
  const [message, setMessage] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [choosing, setChoosing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [chosenProposal, setChosenProposal] = React.useState('');
  const [changeClosed, setChangeClosed] = React.useState(false);

  const load = React.useCallback(async (feedback = '') => {
    setResource(value => ({ ...value, status: 'loading' }));
    const [slots, availability, booking] = await Promise.all([listWrittenSlots(binding), getWrittenAvailability(binding), getWrittenBooking(binding)]);
    if (availability.data?.serviceHold) return setResource({ status: 'held' });
    if (slots.code === 'INVALID_CASE_STATE') return setResource({ status: 'unavailable' });
    if (!slots.ok || !availability.ok || !booking.ok || availability.data.caseId !== booking.data.caseId
        || slots.data.caseId && slots.data.caseId !== booking.data.caseId) return setResource({ status: 'error' });
    const options = slots.data.slots || [];
    const change = booking.data.change || null;
    const proposals = proposalOffers(change);
    setChosenProposal(proposals.length === 1 ? proposalKey(proposals[0]) : '');
    const prior = booking.data.session?.status === 'booked' ? change?.selectedSlots || [] : availability.data.selectedSlots || [];
    const byId = new Map(options.map(slot => [slot.slotId, slot]));
    const slotIds = new Set(options.map(slot => slot.slotId));
    const valid = prior.filter(slot => slotIds.has(slot.slotId));
    setSelected(Object.fromEntries(valid.map(slot => [slot.slotId, slot.priority || 2])));
    setMessage(feedback);
    setResource({ status: 'ready', slots: options, bookingWindow: slots.data.window, revision: availability.data.revision || 0,
      booking: booking.data.session || null, change, changeRevision: booking.data.changeRevision || 0, canRequestChange: booking.data.canRequestChange === true,
      changeDeadlineClock: performance.now() + writtenChangeRemaining(booking.data),
      editable: availability.data.editable !== false, submittedSlots: prior.map(slot => ({ ...byId.get(slot.slotId), ...slot })), outsideWindowCount: prior.length - valid.length });
  }, [binding]);
  React.useEffect(() => { load(); }, [load]);

  const canRequestNow = React.useCallback(() => resource.canRequestChange === true && performance.now() <= resource.changeDeadlineClock,
    [resource.canRequestChange, resource.changeDeadlineClock]);
  React.useEffect(() => {
    let timer;
    const check = () => {
      clearTimeout(timer);
      const closed = !canRequestNow();
      setChangeClosed(closed);
      if (closed) setEditing(false);
      else timer = setTimeout(check, Math.min(60000, Math.max(1, resource.changeDeadlineClock - performance.now() + 1)));
    };
    check();
    browser.addEventListener('focus', check); document.addEventListener('visibilitychange', check);
    return () => { clearTimeout(timer); browser.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [browser, canRequestNow, resource.changeDeadlineClock]);
  const canRequestChange = !changeClosed && canRequestNow();
  const revisionData = () => ({ expectedSessionRevision: resource.booking.revision, expectedChangeRevision: resource.changeRevision });
  const save = async () => {
    if (editing && !canRequestNow()) {
      setChangeClosed(true); setEditing(false);
      return setMessage('일정 변경 요청은 상담 시작 2시간 전까지만 가능해요. 이후에는 운영팀에 문의해주세요.');
    }
    const validation = validateWrittenSelection(selected);
    if (!validation.valid) return setMessage(validation.message);
    setSaving(true); setMessage('');
    try {
      const result = editing
        ? await requestWrittenReschedule(binding, { ...revisionData(), selectedSlots: validation.selectedSlots })
        : await submitWrittenAvailability(binding, { expectedAvailabilityRevision: resource.revision, selectedSlots: validation.selectedSlots });
      if (!result.ok) {
        if (result.code === 'WRITTEN_CHANGE_DEADLINE_PASSED') { setEditing(false); await load(result.error); }
        else if (['REVISION_CONFLICT', 'INVALID_AVAILABILITY_SLOT'].includes(result.code)) await load('가능 시간이 바뀌었어요. 최신 시간표에서 다시 선택해주세요.');
        else setMessage(result.error);
        return;
      }
      if (editing) {
        setEditing(false);
        setResource(value => ({ ...value, change: result.data.change, changeRevision: result.data.changeRevision, outsideWindowCount: 0 }));
        setMessage('변경 요청을 보냈어요. 운영팀이 확정할 때까지 기존 예약이 유지됩니다.');
      } else {
        setResource(value => ({ ...value, revision: result.data.revision, submittedSlots: (result.data.selectedSlots || validation.selectedSlots).map(slot => ({ ...value.slots.find(option => option.slotId === slot.slotId), ...slot })), outsideWindowCount: 0 }));
        setChoosing(false);
      }
    } finally { setSaving(false); }
  };
  const respond = async decision => {
    const selectedOffer = proposalOffers(resource.change).find(offer => proposalKey(offer) === chosenProposal);
    if (decision === 'accept' && !selectedOffer) return setMessage('변경할 시간을 한 개 선택해주세요.');
    setSaving(true); setMessage('');
    try {
      const result = await respondWrittenReschedule(binding, { ...revisionData(), requestId: resource.change.requestId, decision,
        ...(decision === 'accept' ? { slotId: selectedOffer.slotId, counselorId: selectedOffer.counselorId } : {}) });
      if (result.ok) await load(decision === 'accept' ? '새 상담 일정으로 변경됐어요.' : '기존 상담 일정을 유지했어요.');
      else if (['SLOT_CONFLICT', 'SLOT_UNAVAILABLE', 'REVISION_CONFLICT', 'WRITTEN_CHANGE_EXPIRED'].includes(result.code)) await load(result.error);
      else setMessage(result.error);
    } finally { setSaving(false); }
  };

  if (resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">상담 가능 시간을 불러오고 있습니다.</p></main>;
  if (resource.status === 'error') return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>일정을 불러오지 못했습니다</h1><button className="consulting-v2-primary consulting-v2-wide" onClick={() => load()}>다시 시도</button></section></main>;
  const confirmed = formatWrittenSession(resource.booking);
  const proposals = proposalOffers(resource.change);
  const proposed = proposals.length > 0;
  if (!confirmed && (resource.status !== 'ready' || !resource.editable)) return <main className="consulting-v2-center">
    <section className="consulting-v2-card">
      <h1>{resource.status === 'held' ? '서비스가 일시 보류 중이에요' : '상담 가능 시간을 선택할 수 없는 상태예요'}</h1>
      <p className="consulting-v2-status">기초조사서 화면에서 현재 진행 상태를 확인해 주세요.</p>
      <button className="consulting-v2-primary consulting-v2-wide" onClick={() => navigateConsulting(CONSULTING_ROUTES.materials)}>기초조사서 진행 상태 보기</button>
    </section>
  </main>;

  const showSaved = !confirmed && resource.revision > 0 && !choosing;
  const showPicker = (!confirmed && !showSaved) || (editing && canRequestChange);
  const count = Object.keys(selected).length;
  const { startDate, endDate } = resource.bookingWindow || {};
  const period = startDate && endDate ? `${kstDate(startDate)} ~ ${kstDate(endDate)}` : '';
  return <main className="consulting-schedule">
    <header><button type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>← 진행 현황</button>{showPicker && <span>{count}개 선택</span>}</header>
    {showSaved && <WrittenAvailabilitySaved slots={resource.submittedSlots} outsideWindowCount={resource.outsideWindowCount}
      onEdit={() => { setChoosing(true); setMessage(''); }} onHome={() => navigateConsulting(CONSULTING_ROUTES.home)} />}
    {confirmed && <section className="consulting-schedule-card">
      <p className="consulting-v2-kicker">서면상담 일정</p><h1>상담 일정이 확정됐습니다</h1><ConfirmedWrittenTime value={confirmed} />
      {resource.booking.status === 'booked' && <p className="consulting-v2-status">{performance.now() > resource.changeDeadlineClock
        ? '일정 변경 요청이 마감됐어요. 상담 시작 2시간 전까지만 요청할 수 있으며, 이후에는 운영팀에 문의해주세요.'
        : '일정 변경 요청은 상담 시작 2시간 전까지 가능해요.'}</p>}
      {proposed && !editing && <>
        <h2>상담 일정 변경을 부탁드립니다</h2>
        <p className="consulting-v2-status">일정 변경으로 번거로움을 드려 죄송합니다. 아래 후보 중 가능한 시간을 골라주세요. {canRequestChange ? '모두 어려우시면 다른 시간을 제안해 주세요.' : '모두 어려우시면 운영팀에 문의해주세요.'}</p>
        <fieldset className="consulting-schedule-proposals" disabled={saving}>
          <legend>변경 가능한 시간</legend>
          {proposals.map(offer => {
            const value = formatWrittenSession({ ...offer, status: 'booked' });
            if (!value) return null;
            const key = proposalKey(offer);
            return <label key={key}><input type="radio" name="writtenProposal" checked={chosenProposal === key} onChange={() => setChosenProposal(key)} />
              <span><strong>{value.date}</strong><span>{value.time}</span></span></label>;
          })}
        </fieldset>
        <p className="consulting-v2-status">새 일정이 확정될 때까지 기존 예약은 유지됩니다.</p>
        <footer><button type="button" className="consulting-v2-primary" disabled={saving || !chosenProposal} onClick={() => respond('accept')}>선택한 시간으로 변경</button>
          {canRequestChange && <button type="button" className="consulting-v2-secondary" disabled={saving} onClick={() => { setEditing(true); setMessage(''); }}>다른 시간 제안하기</button>}
          <button type="button" className="consulting-v2-secondary" disabled={saving} onClick={() => respond('decline')}>기존 일정 유지</button></footer>
      </>}
      {resource.change?.kind === 'student' && <p className="consulting-v2-status">변경 요청을 확인 중이에요. 확정 전까지 기존 예약이 유지됩니다.</p>}
      {canRequestChange && !proposed && !editing && <footer><button className="consulting-v2-secondary" type="button" disabled={saving} onClick={() => setEditing(true)}>{resource.change ? '변경 요청 수정' : '일정 변경 요청'}</button></footer>}
      {!showPicker && message && <p className="consulting-survey-message" role="status">{message}</p>}
    </section>}
    {showPicker && <section className="consulting-schedule-card">
      <p className="consulting-v2-kicker">서면상담 일정 · {editing ? '변경 요청' : resource.revision ? '가능 시간 제출 완료' : '가능 시간 선택'}</p>
      <h1>{editing ? '다시 상담할 수 있는 시간을 골라주세요' : '가능한 시간을 선택해주세요'}</h1>
      {editing && proposed && <p className="consulting-v2-status">편하신 시간을 모두 알려주세요. 운영팀에서 확인해 새 일정을 확정하겠습니다.</p>}
      {period && <p className="consulting-v2-status">{period} · 한국시간</p>}
      <p className="consulting-schedule-intro">날짜별로 가능한 시간을 모두 골라주세요.<br />선택한 시간 중 하나로 상담을 확정해드려요.</p>
      {resource.outsideWindowCount > 0 && <p className="consulting-survey-message" role="status">이전에 고른 시간 중 {resource.outsideWindowCount}개가 현재는 선택할 수 없어요.</p>}
      {resource.slots.length ? <WrittenAvailabilityPicker slots={resource.slots} window={resource.bookingWindow} selected={selected} setSelected={setSelected} saving={saving} />
        : <p className="consulting-v2-status">지금 선택할 수 있는 시간이 없어요. 선택 기간과 예약 현황을 확인하거나 운영팀에 문의해주세요.</p>}
      {message && <p className="consulting-survey-message" role="status">{message}</p>}
      <footer className="consulting-schedule-save-bar"><span>총 {count}개 시간 선택</span><button className="consulting-v2-primary" type="button" disabled={saving || !resource.slots.length} onClick={save}>{saving ? '저장 중…' : editing ? '변경 요청 보내기' : '가능 시간 저장'}</button>
        {(editing || choosing) && <button type="button" className="consulting-v2-secondary" disabled={saving} onClick={() => { if (choosing) load(); setEditing(false); setChoosing(false); }}>닫기</button>}</footer>
    </section>}
  </main>;
}

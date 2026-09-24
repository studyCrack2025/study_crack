import { Icon } from '../../components/Icon.jsx';

export function MySummaryContent({ presentation, showIdentity = false, navigationAction = 'goto' }) {
  if (!presentation) return null;
  const { profile, mbti, plan, stats, studyStatus, studyStale, weekRange, gameStatus, shells } = presentation;
  const studyStats = <section className={showIdentity ? 'my-summary-hero-stats' : 'my-study-stats'} aria-label="공부와 수조 요약">{stats.map(stat => <div key={stat.label}><span>{stat.label}</span><b>{stat.value}</b></div>)}</section>;
  return (
    <div className="my-summary-content">
      {showIdentity ? <section className="my-summary-identity"><span className="my-summary-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="프로필 사진" /> : <Icon name="user" />}</span><div><h2>{profile.name}님</h2><p>{profile.target || '목표 대학을 설정해주세요'}</p><p>{profile.meta}</p><span>{mbti.code ? `${mbti.code} · ${mbti.name}` : '학습유형 미설정'}</span></div><p className="my-summary-plan">{plan.label} · {plan.periodLabel}</p>{studyStats}</section> : studyStats}
      <p className="my-summary-source">{weekRange ? `${weekRange} · 한국 시간 기준` : '공부 기록 날짜 확인 필요'}<br />보유 조개 {shells}</p>
      {studyStale || studyStatus !== 'ready' ? <div className="my-summary-notice" role="status"><span>{studyStale ? '마지막 확인 기록이에요.' : studyStatus === 'loading' ? '공부 기록을 불러오고 있어요.' : '공부 기록을 확인해주세요.'}</span>{studyStatus === 'error' ? <button type="button" data-action="retryStudySummary">공부 기록 다시 확인</button> : null}</div> : null}
      {gameStatus !== 'ready' ? <div className="my-summary-notice" role="status"><span>{gameStatus === 'loading' ? '수조 정보를 불러오고 있어요.' : gameStatus === 'unavailable' ? '수조 기능을 아직 제공할 수 없어요.' : '수조 정보를 확인해주세요.'}</span>{gameStatus === 'error' ? <button type="button" data-action="retryGameResources">수조 정보 다시 확인</button> : null}</div> : null}
      <details className="my-summary-checklist"><summary><span>학습 프로필 설정</span><b>{profile.status === 'ready' ? `${profile.checklist.filter(row => row.complete).length}/4` : '확인 필요'}</b></summary><p>저장된 정보만 표시해요. 지금 모두 작성하지 않아도 앱을 이용할 수 있어요.</p>{profile.checklist.map(row => <button type="button" key={row.id} data-action={navigationAction} data-target={row.target} disabled={row.complete === null}><span>{row.label}</span><b>{row.complete === null ? '확인 필요' : row.complete ? '설정됨 · 수정' : '설정하기'}</b><Icon name="chevron" /></button>)}</details>
    </div>
  );
}

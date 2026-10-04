import { useContext, useState } from 'react';
import { Modal } from '../Modal.jsx';
import { Icon } from '../Icon.jsx';
import { AquariumGrowthContext } from '../../features/gamification/AquariumGrowthContext.js';
import { AQUARIUM_GUIDE_STAGES, GUIDE_RARITIES, buildRulesGrowthPresentation, buildRulesGuidePresentation, guideDuration } from '../../features/gamification/rules-guide-presentation.js';
import { FishArtwork } from '../../screens/aquarium/FishArtwork.jsx';
import { aquariumBackground } from './aquarium-backgrounds.js';

const RARITY_LABELS = Object.freeze({ common: '일반', rare: '희귀', epic: '영웅', legendary: '전설' });

function TicketArtwork() {
  return <svg className="game-rules-ticket" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M8 16h48v11a5 5 0 0 0 0 10v11H8V37a5 5 0 0 0 0-10V16Z" /><path d="M42 20v24" strokeDasharray="3 4" /><path d="m23 25 2 5 6 .5-4.5 3.5 1.5 6-5-3-5 3 1.5-6-4.5-3.5 6-.5 2-5Z" /></svg>;
}

function BackgroundArtwork({ day, label }) {
  const [failed, setFailed] = useState(false);
  const asset = aquariumBackground(`day${day}`);
  return <figure className="game-rules-background"><div>{failed ? <span>배경 이미지 확인 필요</span> : <img src={asset.src} alt={`DAY ${day} 수조 배경`} width={asset.width} height={asset.height} loading="lazy" decoding="async" onError={() => setFailed(true)} />}</div><figcaption><small>{label}</small><b>DAY {day}</b></figcaption></figure>;
}

function RulesGrowthGuide({ view }) {
  const presentation = buildRulesGrowthPresentation(view);
  return <section className="game-rules-growth" aria-label="수조 배경 성장">
    <div><span className="game-rules-eyebrow">꾸준히 완료하면 배경이 자라요</span><h3>수조 배경 성장</h3></div>
    <p>계정에 저장한 당일 개인계획을 처음 완료하고 서버에서 확인되면, 하루 최대 1일이 인정돼요.</p>
    <p className="game-rules-note">기기에서만 체크한 계획과 타이머 공부 시간은 배경 성장 일수로 계산하지 않아요.</p>
    {presentation ? <>
      <p className="game-rules-growth-state">성장 인정 <b>{presentation.growth.validDayCount}일</b>{presentation.next ? ` · 다음 배경까지 ${presentation.growth.nextStageDays}일` : ' · 마지막 배경 달성'}</p>
      <div className="game-rules-background-pair">{presentation.current ? <BackgroundArtwork key={`current-${presentation.current}`} day={presentation.current} label="현재 열린 배경" /> : <div className="game-rules-first-day"><Icon name="calendar" /><b>첫 성장 준비</b><span>성장 1일부터 첫 배경이 열려요.</span></div>}{presentation.next ? <BackgroundArtwork key={`next-${presentation.next}`} day={presentation.next} label="다음 목표" /> : null}</div>
      <details className="game-rules-details"><summary>전체 배경 6단계 보기</summary><div className="game-rules-background-grid">{AQUARIUM_GUIDE_STAGES.map(day => <BackgroundArtwork key={day} day={day} label={presentation.growth.validDayCount >= day ? '열린 배경' : '앞으로 만날 배경'} />)}</div></details>
    </> : <div className="game-rules-status" role="status"><b>성장 기록 확인 필요</b><p>{['idle', 'loading'].includes(view?.status) ? '성장 기록을 불러오는 중이에요.' : '최신 성장 기록을 확인하면 현재 배경과 다음 목표를 보여드려요.'}</p>{view?.refresh ? <button type="button" className="btn btn-secondary" onClick={view.refresh} disabled={view.status === 'loading'}>성장 기록 다시 확인</button> : null}</div>}
  </section>;
}

function RulesDetails({ presentation }) {
  const draw = presentation.draw;
  return <details className="game-rules-details"><summary>중복과 만남 규칙</summary>
    <div className="game-rules-duplicate"><div aria-hidden="true"><FishArtwork speciesId="guppy" variant="pixel" /><span>+</span><FishArtwork speciesId="guppy" variant="pixel" /><Icon name="chevron" /></div><b>{presentation.plan ? '같은 친구는 중복으로 기록해요' : '같은 친구를 만나면 성장해요'}</b><p>{presentation.plan ? '뽑기권 1장을 사용하며, 보유 물고기와 경험치·배치는 그대로예요.' : '같은 종은 새 개체가 늘어나는 대신 기존 친구의 성장 경험치로 반영돼요.'}</p>{!presentation.plan && draw?.maxLevelRefund && positiveRefund(draw.maxLevelRefund.tickets) ? <p>Lv.10 친구를 다시 만나면 뽑기권 {draw.maxLevelRefund.tickets}장을 돌려받아요.</p> : null}</div>
    {draw ? <>
      <h3>무작위로 만나는 친구</h3><div className="game-rules-odds">{GUIDE_RARITIES.map(rarity => <div key={rarity}><b>{RARITY_LABELS[rarity]}</b></div>)}</div>
      {presentation.plan ? <p>2시간·4시간 이상 계획의 뽑기권은 상위 등급 친구를 만날 기회가 조금 높아요.</p> : null}
      {positiveRefund(draw.protectedDrawCount) ? <p>첫 {draw.protectedDrawCount}회는 뽑힌 등급에 아직 만나지 않은 친구가 있으면 그 친구를 우선해요.</p> : null}
      {draw.specialAcquisition === 'achievement_or_event' ? <p>Special 친구는 업적과 이벤트 보상으로 만나요.</p> : null}
    </> : <p className="game-rules-note">만남 규칙은 최신 정보를 불러온 뒤 확인할 수 있어요.</p>}
    <p className="game-rules-note">뽑기권을 사용해도 실제 공부 기록은 줄어들지 않아요.</p>
  </details>;
}

const positiveRefund = value => Number.isSafeInteger(value) && value > 0;

export function GameRulesGuide({ gameRules = null, gameProfileStatus = 'idle', open = false }) {
  const view = useContext(AquariumGrowthContext);
  const presentation = buildRulesGuidePresentation(gameRules, gameProfileStatus);
  return <Modal open={open} dismissAction="closeGameRules" ariaLabel="수조 성장 규칙" panelClass="game-rules-modal">
    <header className="game-rules-head"><div><span className="game-rules-eyebrow">공부와 함께하는 수조</span><h2>수조 이용법</h2></div><button type="button" className="sc-overlay-close" data-action="closeGameRules" aria-label="수조 이용법 닫기">×</button></header>
    <div className="game-rules-body">
      <p className="game-rules-intro">{presentation.plan ? '계획을 완료해 새 친구를 만나고, 꾸준한 달성으로 배경을 키워요.' : '공부 시간으로 새 친구를 만나고, 계획 완료 일수로 배경을 키워요.'}</p>
      {presentation.ready ? <>
        <ol className="game-rules-steps">
          <li><div className="game-rules-illustration" aria-hidden="true"><Icon name="timer" /><FishArtwork speciesId="guppy" variant="pixel" /></div><div><span className="game-rules-step-number">01 · 첫 친구</span><h3>{presentation.starter ? `${guideDuration(presentation.starter.minimumSessionSeconds)} 이상 공부 완료` : '첫 유효 공부 완료'}</h3><p>보상 확인 후 첫 친구를 골라요.{presentation.starter ? ` ${presentation.starter.choiceCount}종 중 선택한 친구가` : ' 선택한 친구가'} 수조 중앙에 배치돼요.</p></div></li>
          <li><div className="game-rules-illustration" aria-hidden="true"><Icon name="calendar" /><TicketArtwork /></div><div><span className="game-rules-step-number">02 · 공부 보상</span><h3>{presentation.plan ? '30분 이상 계획 첫 완료마다 1장' : `확정 공부 ${guideDuration(presentation.ticket.intervalSeconds)}마다 1장`}</h3><p>{presentation.plan ? '계정에 저장한 계획의 완료가 확인되면 받아요. 완료 취소·재완료로는 다시 지급되지 않아요.' : '뽑기권을 받아요. 남은 시간은 날짜가 바뀌어도 다음 뽑기권으로 이월돼요.'}</p></div></li>
          <li><div className="game-rules-illustration" aria-hidden="true"><TicketArtwork /><FishArtwork speciesId="clownfish" variant="pixel" /></div><div><span className="game-rules-step-number">03 · 새로운 친구</span><h3>뽑기권 {presentation.ticket.drawCost}장으로 만나기</h3><p>무작위 친구가 보관함에 들어와요. 내 물고기에서 위치를 골라 수조에 배치하세요.</p></div></li>
        </ol>
        <RulesDetails presentation={presentation} />
      </> : <div className="game-rules-status" role="status"><b>공부 보상 규칙 확인 필요</b><p>{['idle', 'loading'].includes(gameProfileStatus) ? '최신 규칙을 불러오는 중이에요.' : '최신 규칙을 확인하면 보상 시간과 물고기 만남 방법을 보여드려요.'}</p><button type="button" className="btn btn-secondary" data-action="retryGameResources" disabled={gameProfileStatus === 'loading'}>규칙 다시 확인</button></div>}
      <RulesGrowthGuide view={view} />
    </div>
    <footer className="game-rules-footer"><button type="button" className="btn btn-primary" data-action="closeGameRules">확인</button></footer>
  </Modal>;
}

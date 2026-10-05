import { useContext, useRef, useState } from 'react';
import { Modal } from '../Modal.jsx';
import { Icon } from '../Icon.jsx';
import { AquariumGrowthContext } from '../../features/gamification/AquariumGrowthContext.js';
import { AQUARIUM_GUIDE_STAGES, GUIDE_RARITIES, buildRulesGrowthPresentation, buildRulesGuidePresentation, buildRulesGuideSteps, guideDuration } from '../../features/gamification/rules-guide-presentation.js';
import { aquariumBackground } from './aquarium-backgrounds.js';
import { rulesGuideExample } from './game-rules-examples.js';

const RARITY_LABELS = Object.freeze({ common: '일반', rare: '희귀', epic: '영웅', legendary: '전설' });

function BackgroundArtwork({ day, label }) {
  const [failed, setFailed] = useState(false);
  const asset = aquariumBackground(`day${day}`);
  return <figure className="game-rules-background"><div>{failed ? <span>배경 이미지 확인 필요</span> : <img src={asset.src} alt={`DAY ${day} 수조 배경`} width={asset.width} height={asset.height} loading="lazy" decoding="async" onError={() => setFailed(true)} />}</div><figcaption><small>{label}</small><b>DAY {day}</b></figcaption></figure>;
}

function RulesGrowthGuide({ view }) {
  const presentation = buildRulesGrowthPresentation(view);
  return <section className="game-rules-growth" aria-label="수조 배경 성장">
    <h3>수조 배경 성장</h3>
    {presentation ? <>
      <p className="game-rules-growth-state">성장 인정 <b>{presentation.growth.validDayCount}일</b>{presentation.next ? ` · 다음 배경까지 ${presentation.growth.nextStageDays}일` : ' · 마지막 배경 달성'}</p>
      <details className="game-rules-details"><summary>배경 목표 보기</summary><p className="game-rules-note">당일 계정 계획의 첫 완료가 확인되면 하루 최대 1일 인정돼요.</p><p className="game-rules-note">기기에서만 체크한 계획과 타이머 공부 시간은 배경 성장 일수로 계산하지 않아요.</p><div className="game-rules-background-pair">{presentation.current ? <BackgroundArtwork key={`current-${presentation.current}`} day={presentation.current} label="현재 열린 배경" /> : <div className="game-rules-first-day"><Icon name="calendar" /><b>첫 성장 준비</b><span>성장 1일부터 첫 배경이 열려요.</span></div>}{presentation.next ? <BackgroundArtwork key={`next-${presentation.next}`} day={presentation.next} label="다음 목표" /> : null}</div>
      <div className="game-rules-background-grid">{AQUARIUM_GUIDE_STAGES.map(day => <BackgroundArtwork key={day} day={day} label={presentation.growth.validDayCount >= day ? '열린 배경' : '앞으로 만날 배경'} />)}</div></details>
    </> : <div className="game-rules-status" role="status"><b>성장 기록 확인 필요</b><p>{['idle', 'loading'].includes(view?.status) ? '성장 기록을 불러오는 중이에요.' : '최신 성장 기록을 확인하면 현재 배경과 다음 목표를 보여드려요.'}</p>{view?.refresh ? <button type="button" className="btn btn-secondary" onClick={view.refresh} disabled={view.status === 'loading'}>성장 기록 다시 확인</button> : null}</div>}
  </section>;
}

function StepExample({ asset }) {
  const [failed, setFailed] = useState(false);
  if (!asset) return null;
  return <figure className="game-rules-example" aria-label={asset.focus}>
    <div className="game-rules-example-frame">{failed ? <span role="status" aria-label="화면 예시를 불러오지 못했어요. 아래 안내를 따라 진행해주세요.">예시 이미지 없음</span> : <img src={asset.src} alt={asset.alt} width={asset.width} height={asset.height} loading="lazy" decoding="async" onError={() => setFailed(true)} />}</div>
    <figcaption>화면 예시 · 실제 수량·결과와 달라요</figcaption>
  </figure>;
}

function RulesWizard({ presentation, status }) {
  const view = useContext(AquariumGrowthContext);
  const [index, setIndex] = useState(0);
  const body = useRef(null);
  const steps = buildRulesGuideSteps(presentation), step = steps[index];
  const change = next => { setIndex(next); if (body.current) body.current.scrollTop = 0; };
  const draw = presentation.draw;
  const example = rulesGuideExample(presentation, index);
  return <Modal dismissAction="closeGameRules" ariaLabel="수조 성장 규칙" panelClass="game-rules-modal">
    <header className="game-rules-head"><div><span className="game-rules-eyebrow">공부와 함께하는 수조</span><h2>수조 이용법</h2></div><button type="button" className="sc-overlay-close" data-action="closeGameRules" aria-label="수조 이용법 닫기">×</button></header>
    {step ? <div className="game-rules-progress" aria-label={`수조 안내 ${index + 1}/4 단계`}><span aria-live="polite">{index + 1}/4</span><ol aria-hidden="true">{steps.map((_, i) => <li key={i} className={i <= index ? 'is-current' : ''} />)}</ol></div> : null}
    <div className="game-rules-body" ref={body}>
      {step ? <article className="game-rules-step" aria-label={`${index + 1}단계`}>
        <StepExample key={example?.src || 'unavailable'} asset={example} />
        <div className="game-rules-copy" aria-live="polite"><h3>{step.title}</h3><p>{step.body}</p></div>
        {index === 1 ? <details className="game-rules-details"><summary>첫 물고기는 어떻게 만나나요?</summary><p>{presentation.starter ? `${guideDuration(presentation.starter.minimumSessionSeconds)} 이상 공부 완료 후 보상이 확인되면 ${presentation.starter.choiceCount}종 중 첫 친구를 골라요.` : '첫 친구 조건은 최신 규칙 확인이 필요해요.'} 선택한 친구는 수조 중앙에 배치돼요.</p></details> : null}
        {index === 2 && draw ? <>
          {presentation.plan ? <p className="game-rules-highlight">2시간·4시간 이상 계획은 상위 등급의 기회가 조금 높아요.</p> : null}
          <details className="game-rules-details"><summary>만날 수 있는 친구</summary><div className="game-rules-rarities">{GUIDE_RARITIES.map(rarity => <span key={rarity}>{RARITY_LABELS[rarity]}</span>)}</div>{positive(draw.protectedDrawCount) ? <p>첫 {draw.protectedDrawCount}회는 뽑힌 등급에 아직 만나지 않은 친구가 있으면 그 친구를 우선해요.</p> : null}{draw.specialAcquisition === 'achievement_or_event' ? <p>Special 친구는 업적과 이벤트 보상으로 만나요.</p> : null}<p className="game-rules-note">뽑기권을 사용해도 실제 공부 기록은 줄어들지 않아요.</p></details>
        </> : null}
        {index === 3 ? <>{!presentation.plan && positive(draw?.maxLevelRefund?.tickets) ? <p className="game-rules-note">Lv.10 친구를 다시 만나면 뽑기권 {draw.maxLevelRefund.tickets}장을 돌려받아요.</p> : null}<RulesGrowthGuide view={view} /></> : null}
        {!draw && index >= 2 ? <button type="button" className="btn btn-secondary" data-action="retryGameResources">규칙 다시 확인</button> : null}
      </article> : <div className="game-rules-status" role="status"><Icon name="fish" /><b>{presentation.state === 'loading' ? '규칙을 불러오는 중이에요' : presentation.state === 'unavailable' ? '수조 기능을 준비하고 있어요' : '공부 보상 규칙 확인 필요'}</b><p>{presentation.state === 'loading' ? '잠시 후 적용 중인 이용법을 보여드릴게요.' : '확인되지 않은 보상 조건은 표시하지 않아요.'}</p><button type="button" className="btn btn-secondary" data-action="retryGameResources" disabled={status === 'loading'}>규칙 다시 확인</button></div>}
    </div>
    <footer className="game-rules-footer">{step ? <><button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => change(index - 1)}>이전</button>{index < 3 ? <button type="button" className="btn btn-primary" onClick={() => change(index + 1)}>다음</button> : <button type="button" className="btn btn-primary" data-action="closeGameRules">완료</button>}</> : <button type="button" className="btn btn-primary" data-action="closeGameRules">닫기</button>}</footer>
  </Modal>;
}

const positive = value => Number.isSafeInteger(value) && value > 0;

export function GameRulesGuide({ gameRules = null, gameProfileStatus = 'idle', open = false }) {
  if (!open) return null;
  const presentation = buildRulesGuidePresentation(gameRules, gameProfileStatus);
  return <RulesWizard key={`${presentation.ready ? gameRules.ticketPolicy.version : presentation.state}:${gameRules?.drawPolicy?.version}:${Boolean(presentation.draw)}`} presentation={presentation} status={gameProfileStatus} />;
}

import { CRACKY_HI_SRC, CRACKY_SRC, STUDYCRACK_LOGO_SRC } from '../../constants/assets.js';
import { AppContent, AppFrame } from '../../components/AppFrame.js';

function IntroScreen({ activeDot, children, description, nextLabel = '다음', nextTarget, screen, title }) {
  return (
    <AppFrame><AppContent screen={screen}>
      <div className="onboarding-shot">
        <div className="onboarding-shot-head"><span className="onboarding-kicker">STUDYCRACK STRATEGY</span><h2>{title}</h2><p>{description}</p></div>
        <div className="onboarding-center">{children}</div>
        <img src={CRACKY_SRC} className={`onboarding-character ${screen}`} alt="크랙이" />
        <div className="onboarding-shot-dots">{[0, 1, 2].map((index) => <i className={activeDot === index ? 'active' : ''} key={index} />)}</div>
        <button type="button" className="onboarding-next" data-action="goto" data-target={nextTarget}>{nextLabel}</button>
      </div>
    </AppContent></AppFrame>
  );
}

export function SplashScreen({ crackyHiSrc = CRACKY_HI_SRC, studycrackLogoSrc = STUDYCRACK_LOGO_SRC }) {
  return <AppFrame><div className="splash splash-v2"><div className="splash-brand"><div className="splash-logo-panel"><img className="splash-real-logo" src={studycrackLogoSrc} alt="StudyCrack" /></div><div className="splash-brand-copy"><span>ADMISSIONS PLATFORM</span><h1>STUDY CRACK</h1><p>합격까지 가장 빠른 전략</p></div></div><img className="splash-cracky" src={crackyHiSrc} alt="크랙이" /><div className="splash-progress" aria-hidden="true"><i /></div></div></AppFrame>;
}

export function On1Screen() {
  return <IntroScreen screen="on1" activeDot={0} nextTarget="on2" title={<><span className="accent">데이터 기반으로</span>{'\n'}지원학과 환산점수를 분석해요</>} description={'대학별 반영 방식에 맞춘\n현재 위치를 확인할 수 있어요.'}>
    <div className="onboarding-card data"><div className="onboarding-label">지원학과 환산 점수</div><div className="onboarding-score">128<em>점</em></div><svg className="onboarding-graph data" viewBox="0 0 320 124" aria-hidden="true"><defs><linearGradient id="obDataFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--sc-info-blue)" stopOpacity="0.28" /><stop offset="100%" stopColor="var(--sc-info-blue)" stopOpacity="0" /></linearGradient></defs><path d="M16 106 L42 84 L66 92 L94 60 L122 76 L146 92 L172 74 L196 36 L224 76 L248 62 L272 24 L292 56 L310 10 L310 124 L16 124 Z" fill="url(#obDataFill)" /><path d="M16 106 L42 84 L66 92 L94 60 L122 76 L146 92 L172 74 L196 36 L224 76 L248 62 L272 24 L292 56 L310 10" stroke="var(--sc-blue)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="310" cy="10" r="5" fill="var(--sc-blue)" /></svg></div>
  </IntroScreen>;
}

export function On2Screen() {
  return <IntroScreen screen="on2" activeDot={1} nextTarget="on3" title={'나에게 최적화된\n점수 상승 전략을 제공해요'} description={'과목별 효율과 목표 도달 시간을\n정확하게 예측해 드려요.'}>
    <div className="onboarding-card strategy"><div className="onboarding-stat"><span>수학 원점수 +1</span>{'\n'}환산점수 +18점</div><svg className="onboarding-graph strategy" viewBox="0 0 320 96" aria-hidden="true">{[[72, 58, 38], [142, 40, 56], [212, 22, 74], [282, -2, 98]].map(([x, y, height]) => <rect x={x} y={y} width="16" height={height} rx="3" fill="var(--sc-blue)" fillOpacity="0.85" key={x} />)}<path d="M18 88 L56 84 L92 70 L126 62 L162 48 L196 42 L232 30 L266 20 L302 12" stroke="var(--sc-info-blue)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="18" cy="88" r="3" fill="var(--sc-info-blue)" /><circle cx="302" cy="12" r="3" fill="var(--sc-info-blue)" /></svg></div>
  </IntroScreen>;
}

function FeatureIcon({ kind }) {
  if (kind === 'planner') return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M9 12l2 2 4-4" /></svg>;
  if (kind === 'tutor') return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><circle cx="12" cy="8" r="4" /><path d="M4 20c1.8-4 5-6 8-6s6.2 2 8 6" /></svg>;
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M14 3v6h6" /></svg>;
}

export function On3Screen() {
  const features = [['planner', '플래너 & 주간 점검'], ['tutor', 'SKY 튜터 1:1 피드백'], ['report', '중장기 합격 전략 리포트']];
  return <IntroScreen screen="on3" activeDot={2} nextTarget="authLogin" nextLabel="시작하기" title={'실행부터 관리까지\n끝까지 함께해요'} description={'플래너, 주간 점검, SKY 튜터 피드백,\n프로 보고서로 완성됩니다.'}>
    <div className="onboarding-card list">{features.map(([kind, label]) => <div className={`onboarding-list-item ${kind === 'report' ? 'long-report' : ''}`} key={kind}><span className="onboarding-icon-box"><FeatureIcon kind={kind} /></span><span>{label}</span></div>)}</div>
  </IntroScreen>;
}

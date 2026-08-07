import { CRACKY_SRC } from '../../constants/assets.js';
import { MBTI_LETTER_LABELS, getMbtiProfile, normalizeMbtiCode } from '../../constants/mbti.js';
import { scoreTierClass as defaultScoreTierClass } from '../../components/score-journey.js';
import { OnboardingScreenShell } from './OnboardingShell.jsx';
import { ScoreJourneyCard } from './ScoreJourneyCard.jsx';

function MbtiResultCard({ mbtiResult = '' }) {
  const code = normalizeMbtiCode(mbtiResult);
  if (!code) return null;
  const profile = getMbtiProfile(code);
  const keywords = profile.code.split('').map((letter) => MBTI_LETTER_LABELS[letter] || letter).join(', ');
  return <div className="card ob-card ob-mbti-result"><p className="analysis-title">진단 결과</p><p className="ob-mbti-code">{profile.code}</p><p className="ob-mbti-name">{profile.name}</p><p className="sub ob-mbti-desc">({keywords})</p></div>;
}

function Gauge({ current, currentPct, passPct, safePct, scoreTierClass, target, targetPct }) {
  return <><div className="ob-gauge"><div className={`ob-gauge-current ${scoreTierClass(current)}`} style={{ width: `${currentPct}%` }} /><div className={`ob-gauge-target ${scoreTierClass(target)}`} style={{ width: `${targetPct}%` }} /><i className="ob-gauge-cut pass" style={{ left: `${passPct}%` }} /><i className="ob-gauge-cut safe" style={{ left: `${safePct}%` }} /></div><div className="ob-gauge-labels"><span>합격컷 100점</span><span>안정컷 150점</span></div></>;
}

export function Ob4Screen(ctx) {
  const {
    analysisGaugeColor = 'var(--sc-blue)', analysisGaugeFill = 0, analysisSelected = {}, analysisStatus = '',
    analysisStatusColor = 'var(--sc-blue)', crackySrc = CRACKY_SRC, liveCurrentScore = 0, mbtiResult = '',
    scoreTierClass = defaultScoreTierClass, targetMajor = ''
  } = ctx;
  const score = Number(analysisSelected.score || 0);
  const gap = score - 100;
  const recommended = ['연세대학교 경영학과', '고려대학교 경영학과', '성균관대학교 글로벌경영학과'];
  return <OnboardingScreenShell screen="ob4" step={2} title="목표 설정 및 분석" crackySrc={crackySrc} subcopy={<>현재 성적 기준으로 도전 가능한 대학과<br />합격 가능성을 분석해드릴게요.</>} bubble="목표 대학마다 유리한 과목이 달라요. 그래서 대학별로 따로 봐야 해요!" cta={<button type="button" className="cta-button" data-action="goto" data-target="ob5">내 맞춤 솔루션 보기</button>}>
    <div className="card ob-card"><p className="analysis-title">현재 성적 기준 추천 대학</p><div className="ob-uni-list">{recommended.map((name) => <button type="button" className={`ob-uni-item ${targetMajor === name ? 'active' : ''}`} data-action="selectTarget" data-target-major={name} key={name}>{name}</button>)}</div></div>
    <div className="card ob-card analysis-top"><p className="analysis-title">지원학과 환산점수 분석</p><div className="analysis-v2-summary-top"><div><p className="analysis-v2-univ">{targetMajor}</p><p className="analysis-v2-label">환산 점수 · 합격컷 대비 위치</p></div><div className="analysis-v2-score-wrap"><span className={`analysis-v2-verdict ${scoreTierClass(score)}`} style={{ color: analysisStatusColor, borderColor: analysisStatusColor }}>{analysisStatus}</span><strong>{score}점</strong><small>환산 점수</small></div></div><div className="analysis-v2-gauge"><i className={scoreTierClass(score)} style={{ width: `${analysisGaugeFill}%`, background: analysisGaugeColor }} /><span className="cut pass" style={{ left: '40%' }} /><span className="cut safe" style={{ left: '60%' }} /></div><div className="analysis-v2-gauge-meta"><span>0</span><span>합격컷 100점</span><span>안정컷 150점</span><span>MAX 250점</span></div><div className="kpi-row score-row"><div className="kpi-item"><b>{liveCurrentScore}점</b>현재성적</div><div className="kpi-item"><b>100점</b>합격 컷</div><div className="kpi-item danger"><b>{gap > 0 ? `+${gap}` : gap}점</b>격차</div></div></div>
    <div className="card ob-card plus-one-card"><p className="analysis-title">원점수 1점 효율</p><div className="analysis-impact-item">수학<div className="track"><i style={{ width: '90%' }} /></div><span>환산 +18.0점</span></div><div className="analysis-impact-item">탐구<div className="track"><i style={{ width: '68%', background: 'var(--sc-teal)' }} /></div><span>환산 +6.8점</span></div><div className="analysis-impact-item">영어<div className="track"><i style={{ width: '48%', background: 'var(--sc-warning)' }} /></div><span>환산 +3.0점</span></div></div>
    <MbtiResultCard mbtiResult={mbtiResult} />
  </OnboardingScreenShell>;
}

function PossibleUniversityCard({ current, name, passPct, safePct, scoreTierClass, target }) {
  return <div className="possible-univ-card"><button type="button" className="card ob-card" style={{ margin: '10px 0 0', width: '100%', textAlign: 'left' }} data-action="addPossibleUniversity" data-target-major={name}><p className="analysis-title">{name}</p><div className="ob-total-compare"><div><span>현재</span><b>{current}점</b></div><i>→</i><div><span>목표</span><b className="target">{target}점</b></div></div><Gauge current={current} currentPct={Math.min(100, current / 250 * 100)} target={target} targetPct={Math.min(100, target / 250 * 100)} passPct={passPct} safePct={safePct} scoreTierClass={scoreTierClass} /><p className="sub"><b>현재 → 합격권 진입 구간</b></p></button></div>;
}

export function Ob5Screen(ctx) {
  const {
    crackySrc = CRACKY_SRC, gaugeCurrent = 0, gaugeCurrentPct = 0, gaugePassPct = 40, gaugeSafePct = 60,
    gaugeTarget = 0, gaugeTargetPct = 0, ob3IsAnalyzing = false, scoreTierClass = defaultScoreTierClass
  } = ctx;
  const possibleUniversities = [['국민대 경영학부', gaugeCurrent + 6], ['숭실대 경제학과', gaugeCurrent + 10], ['세종대 미디어커뮤니케이션학과', gaugeCurrent + 14]];
  return <OnboardingScreenShell screen="ob5" step={3} title="공부 성향 맞춤 솔루션" crackySrc={crackySrc} subcopy={<>현재 성적에서 합격컷까지,<br />가장 효율적인 점수 상승 루트를 보여드릴게요.</>} bubble="무작정 전 과목을 올리는 게 아니라, 합격에 가장 크게 기여하는 과목부터 잡아야 해요!" cta={<><button type="button" className="cta-button" data-action="startStandard">Standard로 시작하기</button><button type="button" className="auth-link-btn" data-action="completeOnboarding">홈으로 이동</button></>}>
    <div className="card ob-card"><ScoreJourneyCard {...ctx} /></div>
    <div className="eta-card"><div className="card ob-card ob-period-card on-eta-card"><span className="eyebrow">현재 학습분석 기반</span><b>Standard 이용 시 평균 3개월 내 도달 예상</b><p>주간 플래너 피드백과 학습 방향 코칭 제공</p></div>{ob3IsAnalyzing ? <div className="loading-overlay"><div className="loading-box"><div className="dots">● ● ●</div><div>분석중입니다</div><div>잠시만 기다려주세요</div></div></div> : null}</div>
    <div className="ob5-after-eta"><div className="card ob-card"><p className="analysis-title">환산점수 변화</p><div className="ob-total-compare"><div><span>현재</span><b>{gaugeCurrent}점</b></div><i>→</i><div><span>목표</span><b className="target">{gaugeTarget}점</b></div></div><Gauge current={gaugeCurrent} currentPct={gaugeCurrentPct} target={gaugeTarget} targetPct={gaugeTargetPct} passPct={gaugePassPct} safePct={gaugeSafePct} scoreTierClass={scoreTierClass} /><p className="sub"><b>현재 → 합격권 진입 구간</b></p></div>
      <div className="card ob-card"><p className="analysis-title">성적 변화 시 가능한 대학</p><div className="possible-univ-slider" data-slider-group="possible"><div className="possible-univ-track">{possibleUniversities.map(([name, target]) => <PossibleUniversityCard current={gaugeCurrent} name={name} target={target} passPct={gaugePassPct} safePct={gaugeSafePct} scoreTierClass={scoreTierClass} key={name} />)}</div></div><div className="possible-univ-nav"><button type="button" data-action="slidePrev" aria-label="이전 대학">‹</button><div className="possible-univ-dots slider-indicator possible-univ-indicator possible-slider-indicator">{[0, 1, 2].map((index) => <button type="button" data-action="slideTo" data-slide-index={index} className={`${index === 0 ? 'active ' : ''}slider-dot possible-univ-dot possible-slider-dot`} aria-label={`${index + 1}번째 대학`} key={index} />)}</div><button type="button" data-action="slideNext" aria-label="다음 대학">›</button></div></div>
    </div>
  </OnboardingScreenShell>;
}

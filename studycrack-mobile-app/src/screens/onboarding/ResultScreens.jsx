import { CRACKY_SRC } from '../../constants/assets.js';
import { MBTI_LETTER_LABELS, getMbtiProfile, normalizeMbtiCode } from '../../constants/mbti.js';
import { scoreTierClass as defaultScoreTierClass } from '../../components/score-journey.js';
import { OnboardingScreenShell } from './OnboardingShell.jsx';
import { ScoreJourneyCard } from './ScoreJourneyCard.jsx';

const GAUGE_MAX = 250;
const PASS_SCORE = 100;
const SAFE_SCORE = 150;

function uniqueLabels(values = []) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function formatPoint(value) {
  const number = Number(value) || 0;
  return number.toFixed(number >= 10 || Number.isInteger(number) ? 0 : 1);
}

function MbtiResultCard({ mbtiResult = '' }) {
  const code = normalizeMbtiCode(mbtiResult);
  if (!code) return null;
  const profile = getMbtiProfile(code);
  const keywords = profile.code.split('').map((letter) => MBTI_LETTER_LABELS[letter] || letter).join(', ');
  return <div className="card ob-card ob-mbti-result"><p className="analysis-title">학습 성향 진단 결과</p><p className="ob-mbti-code">{profile.code}</p><p className="ob-mbti-name">{profile.name}</p><p className="sub ob-mbti-desc">({keywords})</p></div>;
}

function OnboardingState({ action = null, description, kind = 'empty', title }) {
  return <div className={`ob-result-state ${kind}`} role={kind === 'loading' ? 'status' : undefined} aria-live="polite"><strong>{title}</strong><p>{description}</p>{action}</div>;
}

function TargetSelection({ analysisMajorOptions = [], analysisRecommended = [], recommendationError = '', recommendationStatus = 'idle', targetMajor = '' }) {
  const savedTargets = uniqueLabels([targetMajor, ...analysisMajorOptions]);
  const recommendations = uniqueLabels(analysisRecommended).filter((label) => !savedTargets.includes(label));
  const recommendationState = recommendationStatus === 'loading'
    ? <OnboardingState kind="loading" title="현재 성적으로 추천 대학을 계산 중이에요" description="서버 분석이 끝나면 선택 가능한 대학과 학과를 보여드려요." />
    : recommendationError
      ? <OnboardingState kind="error" title="추천 대학을 불러오지 못했어요" description={recommendationError} action={<button type="button" className="btn btn-secondary mini" data-action="refreshUniversityRecommendations">다시 시도</button>} />
      : !recommendations.length && !savedTargets.length
        ? <OnboardingState title="아직 선택할 목표 대학이 없어요" description="성적 정보가 없거나 추천 결과가 비어 있습니다. 직접 대학과 학과를 추가할 수 있어요." action={<button type="button" className="btn btn-secondary mini" data-action="goto" data-target="addUniversity">직접 추가하기</button>} />
        : null;
  return <div className="card ob-card"><div className="ob-card-heading"><div><p className="analysis-title">목표 대학 선택</p><p>저장된 목표와 서버가 계산한 추천만 표시합니다.</p></div><button type="button" className="btn btn-secondary mini" data-action="refreshUniversityRecommendations" disabled={recommendationStatus === 'loading'}>{recommendationStatus === 'loading' ? '추천 중' : '새로고침'}</button></div>{savedTargets.length ? <div className="ob-uni-group"><span>저장된 목표</span><div className="ob-uni-list">{savedTargets.map((name) => <button type="button" className={`ob-uni-item ${targetMajor === name ? 'active' : ''}`} data-action="selectTarget" data-target-major={name} key={name}>{name}</button>)}</div></div> : null}{recommendations.length ? <div className="ob-uni-group"><span>현재 성적 기준 추천</span><div className="ob-uni-list">{recommendations.map((name) => <button type="button" className="ob-uni-item recommended" data-action="addPossibleUniversity" data-target-major={name} key={name}>{name}<small>목표에 추가</small></button>)}</div></div> : recommendationState}</div>;
}

function ScoreResult({ analysisApiError = '', analysisApiStatus = 'idle', analysisGaugeFill = 0, analysisScoreView = null, analysisSelected = {}, analysisStatus = '', analysisStatusColor = '', scoreTierClass, targetMajor = '' }) {
  const score = Number(analysisScoreView?.score ?? analysisSelected.score ?? 0);
  const hasScore = analysisScoreView?.hasScore === true;
  const pending = analysisApiStatus === 'loading';
  if (!targetMajor) return <div className="card ob-card analysis-top"><p className="analysis-title">지원학과 환산점수 분석</p><OnboardingState title="목표 대학을 먼저 선택해주세요" description="저장된 목표나 서버 추천에서 대학과 학과를 선택하면 분석을 이어갈 수 있어요." /></div>;
  if (!hasScore) {
    return <div className="card ob-card analysis-top"><p className="analysis-title">지원학과 환산점수 분석</p><OnboardingState kind={pending ? 'loading' : analysisApiError ? 'error' : 'empty'} title={pending ? '환산점수를 준비하고 있어요' : analysisApiError || '아직 계산된 환산점수가 없어요'} description={pending ? `${targetMajor} 분석 상태를 확인하고 있습니다.` : '저장된 성적과 목표 대학을 기준으로 분석 화면에서 계산해주세요.'} action={!pending ? <button type="button" className="btn btn-secondary mini" data-action="goto" data-target="analysis">환산점수 계산하기</button> : null} /></div>;
  }
  const gapToPass = Math.max(0, PASS_SCORE - score);
  return <div className="card ob-card analysis-top"><p className="analysis-title">지원학과 환산점수 분석</p><div className="analysis-v2-summary-top"><div><p className="analysis-v2-univ">{targetMajor}</p><p className="analysis-v2-label">환산 점수 · 합격컷 대비 위치</p></div><div className="analysis-v2-score-wrap"><span className={`analysis-v2-verdict ${scoreTierClass(score)}`} style={analysisStatusColor ? { color: analysisStatusColor, borderColor: analysisStatusColor } : undefined}>{analysisStatus || analysisScoreView?.status || '분석 결과'}</span><strong>{formatPoint(score)}점</strong><small>환산 점수</small></div></div><div className="analysis-v2-gauge"><i className={scoreTierClass(score)} style={{ width: `${analysisGaugeFill}%` }} /><span className="cut pass" style={{ left: '40%' }} /><span className="cut safe" style={{ left: '60%' }} /></div><div className="analysis-v2-gauge-meta"><span>0</span><span>합격컷 {PASS_SCORE}점</span><span>안정컷 {SAFE_SCORE}점</span><span>MAX {GAUGE_MAX}점</span></div><div className="kpi-row score-row"><div className="kpi-item"><b>{formatPoint(score)}점</b>환산 점수</div><div className="kpi-item"><b>{PASS_SCORE}점</b>합격 컷</div><div className="kpi-item danger"><b>{gapToPass ? `+${formatPoint(gapToPass)}점` : '도달'}</b>합격컷까지</div></div></div>;
}

function ScoreEfficiency({ analysisApiStatus = 'idle', rows = [] }) {
  const normalizedRows = rows.map((row) => ({ ...row, gain: Math.max(0, Number(row.gainNum || 0)) })).filter((row) => row.subject && row.gain > 0).sort((a, b) => b.gain - a.gain);
  const max = Math.max(...normalizedRows.map((row) => row.gain), 0);
  return <div className="card ob-card plus-one-card"><p className="analysis-title">원점수 1점 효율</p>{normalizedRows.length ? normalizedRows.map((row) => <div className="analysis-impact-item" key={row.subject}><span>{row.subject}</span><div className="track"><i style={{ width: `${Math.max(8, row.gain / max * 100)}%` }} /></div><b>환산 +{formatPoint(row.gain)}점</b></div>) : <OnboardingState kind={analysisApiStatus === 'loading' ? 'loading' : 'empty'} title={analysisApiStatus === 'loading' ? '과목별 효율을 계산 중이에요' : '계산된 과목별 효율이 없어요'} description="환산 분석을 완료하면 서버가 계산한 과목별 효율을 보여드려요." />}</div>;
}

export function Ob4Screen(ctx) {
  const {
    analysisApiError = '', analysisApiStatus = 'idle', analysisGaugeFill = 0, analysisMajorOptions = [],
    analysisRecommended = [], analysisScoreView = null, analysisSelected = {}, analysisSimRows = [],
    analysisStatus = '', analysisStatusColor = '', crackySrc = CRACKY_SRC, mbtiResult = '',
    scoreTierClass = defaultScoreTierClass, targetMajor = '', universityRecommendationError = '',
    universityRecommendationStatus = 'idle'
  } = ctx;
  return <OnboardingScreenShell screen="ob4" step={3} title="목표 설정 및 분석" crackySrc={crackySrc} subcopy={<>저장된 성적과 실제 목표 대학을 기준으로<br />분석 준비 상태를 확인해요.</>} bubble="추천과 환산 결과가 준비되지 않았다면 예시 수치 대신 필요한 다음 행동을 안내해요." cta={<button type="button" className="cta-button" data-action="goto" data-target="ob5">내 맞춤 솔루션 보기</button>}>
    <TargetSelection analysisMajorOptions={analysisMajorOptions} analysisRecommended={analysisRecommended} recommendationError={universityRecommendationError} recommendationStatus={universityRecommendationStatus} targetMajor={targetMajor} />
    <ScoreResult analysisApiError={analysisApiError} analysisApiStatus={analysisApiStatus} analysisGaugeFill={analysisGaugeFill} analysisScoreView={analysisScoreView} analysisSelected={analysisSelected} analysisStatus={analysisStatus} analysisStatusColor={analysisStatusColor} scoreTierClass={scoreTierClass} targetMajor={targetMajor} />
    <ScoreEfficiency analysisApiStatus={analysisApiStatus} rows={analysisSimRows} />
    <MbtiResultCard mbtiResult={mbtiResult} />
  </OnboardingScreenShell>;
}

function Gauge({ current, currentPct, passPct, safePct, scoreTierClass, target, targetPct }) {
  return <><div className="ob-gauge"><div className={`ob-gauge-current ${scoreTierClass(current)}`} style={{ width: `${currentPct}%` }} /><div className={`ob-gauge-target ${scoreTierClass(target)}`} style={{ width: `${targetPct}%` }} /><i className="ob-gauge-cut pass" style={{ left: `${passPct}%` }} /><i className="ob-gauge-cut safe" style={{ left: `${safePct}%` }} /></div><div className="ob-gauge-labels"><span>합격컷 {PASS_SCORE}점</span><span>안정컷 {SAFE_SCORE}점</span></div></>;
}

function ActualUniversityCard({ item, passPct, safePct, scoreTierClass }) {
  const score = Number(item.score || 0);
  const pct = Math.min(100, score / GAUGE_MAX * 100);
  return <div className="possible-univ-card"><div className="card ob-card"><div className="possible-univ-card-head"><p className="analysis-title">{item.major}</p><b>{formatPoint(score)}점</b></div><Gauge current={score} currentPct={pct} target={score} targetPct={pct} passPct={passPct} safePct={safePct} scoreTierClass={scoreTierClass} /><p className="sub">서버에서 계산된 현재 환산점수</p></div></div>;
}

export function Ob5Screen(ctx) {
  const {
    analysisApiError = '', analysisApiStatus = 'idle', analysisScoreView = null, analysisSimulationTargets = [],
    analysisTargetScore = 0, crackySrc = CRACKY_SRC, gaugeCurrent = 0, gaugeCurrentPct = 0,
    gaugePassPct = 40, gaugeSafePct = 60, scoreTierClass = defaultScoreTierClass
  } = ctx;
  const hasScore = analysisScoreView?.hasScore === true;
  const targetScore = Math.max(Number(gaugeCurrent || 0), Number(analysisTargetScore || 0));
  const targetPct = Math.min(100, targetScore / GAUGE_MAX * 100);
  const isLoading = analysisApiStatus === 'loading';
  const actualTargets = analysisSimulationTargets.filter((item) => item?.major && Number.isFinite(Number(item.score)));
  return <OnboardingScreenShell screen="ob5" step={3} title="공부 성향 맞춤 솔루션" crackySrc={crackySrc} subcopy={<>저장된 성적과 서버 분석을 바탕으로<br />확인 가능한 전략만 보여드려요.</>} bubble="아직 계산되지 않은 결과는 숫자로 꾸미지 않고, 분석에 필요한 다음 단계를 안내해요." cta={<><button type="button" className="cta-button" data-action="startStandard">Standard 기능 살펴보기</button><button type="button" className="auth-link-btn" data-action="completeOnboarding">홈으로 이동</button></>}>
    <div className="card ob-card"><ScoreJourneyCard {...ctx} /></div>
    <div className="eta-card"><div className="card ob-card ob-period-card on-eta-card"><span className="eyebrow">STANDARD 학습 관리</span><b>역산 전략과 주간 플래너 피드백</b><p>이용 가능한 기능과 구독 조건은 플랜 화면에서 확인할 수 있어요.</p></div>{isLoading ? <div className="loading-overlay"><div className="loading-box" role="status"><div className="dots">● ● ●</div><div>서버 분석을 확인하고 있습니다</div></div></div> : null}</div>
    <div className="ob5-after-eta"><div className="card ob-card"><p className="analysis-title">환산점수 변화</p>{hasScore ? <><div className="ob-total-compare"><div><span>현재</span><b>{formatPoint(gaugeCurrent)}점</b></div><i>→</i><div><span>서버 분석 목표</span><b className="target">{formatPoint(targetScore)}점</b></div></div><Gauge current={gaugeCurrent} currentPct={gaugeCurrentPct} target={targetScore} targetPct={targetPct} passPct={gaugePassPct} safePct={gaugeSafePct} scoreTierClass={scoreTierClass} /><p className="sub"><b>{targetScore > gaugeCurrent ? '시뮬레이션 결과 기준' : '현재 계산 결과 기준'}</b></p></> : <OnboardingState kind={isLoading ? 'loading' : analysisApiError ? 'error' : 'empty'} title={isLoading ? '환산 분석을 확인 중이에요' : analysisApiError || '표시할 환산 결과가 없어요'} description="분석 화면에서 저장된 성적과 목표 대학의 환산점수를 먼저 계산해주세요." action={!isLoading ? <button type="button" className="btn btn-secondary mini" data-action="goto" data-target="analysis">분석 화면으로 이동</button> : null} />}</div>
      <div className="card ob-card"><p className="analysis-title">목표 대학별 현재 위치</p><div className="possible-univ-slider" data-slider-group="possible"><div className="possible-univ-track">{actualTargets.length ? actualTargets.map((item) => <ActualUniversityCard item={item} passPct={gaugePassPct} safePct={gaugeSafePct} scoreTierClass={scoreTierClass} key={item.major} />) : <OnboardingState title="비교할 대학별 결과가 없어요" description="목표 대학을 추가하고 환산 분석을 완료하면 실제 결과를 비교할 수 있어요." />}</div></div><div className="possible-univ-nav"><button type="button" data-action="slidePrev" aria-label="이전 대학">‹</button><div className="possible-univ-dots slider-indicator possible-univ-indicator possible-slider-indicator">{actualTargets.map((item, index) => <button type="button" data-action="slideTo" data-slide-index={index} className={`${index === 0 ? 'active ' : ''}slider-dot possible-univ-dot possible-slider-dot`} aria-label={`${index + 1}번째 대학`} key={item.major} />)}</div><button type="button" data-action="slideNext" aria-label="다음 대학">›</button></div></div>
    </div>
  </OnboardingScreenShell>;
}

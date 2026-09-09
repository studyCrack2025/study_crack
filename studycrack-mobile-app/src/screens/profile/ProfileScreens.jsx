import { SecondaryIntro, SecondaryScreenShell, SecondaryState } from '../../components/SecondaryScreen.jsx';
import { EXAM_OPTIONS, GRADE_STATUS_OPTIONS } from '../../constants/options.js';
import { ScoreEditModal } from './ScoreEditModal.jsx';

const TRACK_OPTIONS = ['예체능', '인문사회', '상경계열', '자연/공학', '의치한약수', '간호', '사범/교대', '기타'];
const RANKING_PERIODS = [
  ['daily', '일간'],
  ['weekly', '주간'],
  ['monthly', '월간']
];

function RankingBoard({ formatHms, rankingError, rankingMe, rankingRows, rankingStatus }) {
  if (['idle', 'loading'].includes(rankingStatus)) return <SecondaryState kind="loading" title="랭킹을 집계하고 있어요" description="학습 기록을 반영하는 중입니다." />;
  if (rankingStatus === 'error') return <SecondaryState kind="error" title="랭킹을 불러오지 못했어요" description={rankingError || '잠시 후 다시 확인해주세요.'} action={<button type="button" className="btn btn-secondary mini" data-action="retryRanking">다시 시도</button>} />;
  if (rankingStatus === 'empty' || !rankingRows.length) return <SecondaryState title="아직 이 기간의 공부 기록이 없어요" description="공부 타이머를 시작하면 자동으로 집계됩니다." />;
  return (
    <section className="sc-secondary-section ranking-board">
      <div className="sc-secondary-section-head"><div><h3>전체 순위</h3><p>상위 기록부터 차례로 표시합니다.</p></div><span className="sc-badge">{rankingRows.length}명</span></div>
      <div className="sc-secondary-list ranking-list-card">
        {rankingRows.map((row, index) => {
          const rank = Number(row.rank) || index + 1;
          const isMe = row.isMe === true || (rankingMe && rank === Number(rankingMe.rank) && String(row.name || '') === String(rankingMe.name || row.name || ''));
          return (
            <div className={`sc-secondary-row ranking-row ${isMe ? 'is-me' : ''}`} key={`${rank}-${row.name || index}`}>
              <span className={`ranking-position ${rank <= 3 ? 'is-top' : ''}`}>{rank}</span>
              <span className="sc-secondary-row-main"><b>{row.name || '회원'}</b><p>{formatHms(row.seconds)} 공부</p></span>
              <span className="sc-secondary-row-meta"><b>{row.tier || 'BRONZE'}</b>{isMe ? <em>내 순위</em> : null}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function RankingScreen(ctx) {
  const {
    formatHms = (seconds) => {
      const total = Math.max(0, Number(seconds) || 0);
      return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    },
    rankingError = '',
    rankingMe = null,
    rankingPeriod = 'daily',
    rankingRows = [],
    rankingStatus = 'idle'
  } = ctx;
  const ready = ['ready', 'empty'].includes(rankingStatus);
  const currentMe = ready ? rankingMe : null;
  const myRank = !ready ? (rankingStatus === 'error' ? '확인 필요' : '조회 중') : currentMe?.rank ? `${currentMe.rank}등` : '집계 전';
  const myTier = currentMe?.tier || '—';
  const rankingTotal = ready ? Number(currentMe?.total) || 0 : 0;
  const percentile = currentMe?.rank && rankingTotal ? Math.max(1, Math.ceil((Number(currentMe.rank) / rankingTotal) * 100)) : 0;
  const periodLabel = RANKING_PERIODS.find(([key]) => key === rankingPeriod)?.[1] || '일간';
  return (
    <SecondaryScreenShell screen="ranking" title="공부 랭킹">
      <section className="sc-secondary-page ranking-page">
        <SecondaryIntro eyebrow="STUDY RANKING" title="나의 공부 순위" description="실제 누적 공부 시간을 기준으로 같은 기간의 순위를 확인해요." aside={<span className="sc-chip">{periodLabel}</span>} />
        <section className="sc-secondary-section ranking-summary">
          <div className="ranking-summary-main"><span>{periodLabel} 내 순위</span><b>{myRank}</b><p>{!ready ? '선택한 기간의 기록을 확인하고 있어요.' : currentMe ? `${formatHms(currentMe.seconds)} 집중했어요` : '공부를 시작하면 집계됩니다.'}</p></div>
          <div className="ranking-summary-tier"><span>현재 티어</span><b className={myTier.toLowerCase()}>{myTier}</b></div>
          <div className="ranking-summary-stats"><div><span>참여</span><b>{rankingTotal ? `${rankingTotal}명` : '—'}</b></div><div><span>상위</span><b>{percentile ? `${percentile}%` : '—'}</b></div><div><span>기준</span><b>{periodLabel}</b></div></div>
        </section>
        <div className="sc-secondary-segmented ranking-tabs" role="group" aria-label="랭킹 기간">{RANKING_PERIODS.map(([key, label]) => <button type="button" aria-pressed={rankingPeriod === key} className={rankingPeriod === key ? 'active' : ''} data-action="setRankingPeriod" data-ranking-period={key} key={key}>{label}</button>)}</div>
        <RankingBoard formatHms={formatHms} rankingError={rankingError} rankingMe={rankingMe} rankingRows={rankingRows} rankingStatus={rankingStatus} />
      </section>
    </SecondaryScreenShell>
  );
}

export function QualInfoScreen(ctx) {
  const { obGoalText = '', obGradeStatus = '', obQuestionText = '', obSchoolName = '', obTrack = '' } = ctx;
  return (
    <SecondaryScreenShell screen="qualInfo" title="정성조사서">
      <section className="sc-secondary-page qual-form-page">
        <SecondaryIntro eyebrow="STUDENT PROFILE" title="전략 설계 정보" description="현재 상황과 목표를 입력하면 분석과 튜터 피드백에 함께 반영됩니다." aside={<span className="sc-badge">* 필수</span>} />
        <section className="sc-secondary-section">
          <div className="sc-secondary-section-head"><div><h3>기본 정보</h3><p>학년과 학교, 희망 계열을 알려주세요.</p></div></div>
          <div className="sc-secondary-form qual-form-card">
            <div className="sc-secondary-field qual-field wide"><label id="qual-grade-label">현재 학년 <span>*</span></label><div className="ob1-pill-row qual-grade-row" role="group" aria-labelledby="qual-grade-label">{GRADE_STATUS_OPTIONS.map((grade) => <button type="button" className={`ob1-pill ${obGradeStatus === grade ? 'active' : ''}`} aria-pressed={obGradeStatus === grade} data-action="setObGradeStatus" data-ob-grade={grade} key={grade}>{grade}</button>)}</div></div>
            <div className="sc-secondary-field qual-field"><label htmlFor="qual-school">출신 학교 <span>*</span></label><input id="qual-school" className="planner-input" data-field="obSchoolName" defaultValue={obSchoolName} placeholder="출신 학교 입력" /></div>
            <div className="sc-secondary-field qual-field"><label htmlFor="qual-track">희망 계열 <span>*</span></label><select id="qual-track" className="planner-input" data-field="obTrack" defaultValue={obTrack}>{TRACK_OPTIONS.map((track) => <option value={track} key={track}>{track}</option>)}</select></div>
          </div>
        </section>
        <section className="sc-secondary-section">
          <div className="sc-secondary-section-head"><div><h3>목표와 고민</h3><p>전략에 반영할 내용을 구체적으로 적어주세요.</p></div></div>
          <div className="sc-secondary-form qual-form-card">
            <div className="sc-secondary-field qual-field wide"><label htmlFor="qual-goal">스터디크랙을 통해 얻고 싶은 점 <span>*</span></label><textarea id="qual-goal" className="planner-input qual-textarea" data-field="obGoalText" rows="4" defaultValue={obGoalText} placeholder="예: 목표 대학에 맞는 과목별 우선순위를 알고 싶어요." /></div>
            <div className="sc-secondary-field qual-field wide"><label htmlFor="qual-question">입시 고민 및 질문</label><textarea id="qual-question" className="planner-input qual-textarea" data-field="obQuestionText" rows="5" defaultValue={obQuestionText} placeholder="현재 가장 고민되는 부분을 자유롭게 적어주세요." /></div>
            <button type="button" className="btn btn-primary qual-save-btn" data-action="saveQualInfo">정성조사서 저장</button>
          </div>
        </section>
      </section>
    </SecondaryScreenShell>
  );
}

function ScoreSubjectCard({ grade = '-', pct = '-', raw = '-', std = '-', subject = '' }) {
  return (
    <article className="score-info-subject-card">
      <div><b>{subject}</b><strong>{raw}{raw !== '-' ? '점' : ''}</strong></div>
      <dl><div><dt>표준</dt><dd>{std}</dd></div><div><dt>백분위</dt><dd>{pct}</dd></div><div><dt>등급</dt><dd>{grade}</dd></div></dl>
    </article>
  );
}

export function ScoreInfoScreen(ctx) {
  const { scoreEditOpen = false, scoreExamType = '', scoreInfoSubjects = [] } = ctx;
  const overlays = <ScoreEditModal {...ctx} />;
  return (
    <SecondaryScreenShell screen="scoreInfo" title="성적 정보" overlays={scoreEditOpen ? overlays : null}>
      <section className="sc-secondary-page score-info-page">
        <SecondaryIntro eyebrow="SCORE DATA" title="모의고사 성적" description="선택한 시험 성적이 홈과 분석의 대학별 환산점수 기준이 됩니다." />
        <section className="sc-secondary-section">
          <div className="sc-secondary-section-head"><div><h3>분석 기준 시험</h3><p>확인할 모의고사를 선택해주세요.</p></div></div>
          <div className="score-info-picker"><label htmlFor="profile-score-exam">기준 시험</label><select id="profile-score-exam" className="planner-input" data-field="scoreExamType" defaultValue={scoreExamType}>{EXAM_OPTIONS.map((label) => <option value={label} key={label}>{label}</option>)}</select><button type="button" className="btn btn-secondary" data-action="applyScoreExam">적용</button></div>
        </section>
        <section className="sc-secondary-section score-info-card">
          <div className="sc-secondary-section-head score-info-card-head"><div><h3>내 성적</h3><p>원점수와 표준점수·백분위·등급을 함께 확인합니다.</p></div><button type="button" className="btn btn-primary score-edit-btn" data-action="openScoreEdit">입력·수정</button></div>
          <div className="score-info-subject-list">{scoreInfoSubjects.length ? scoreInfoSubjects.map((subject, index) => <ScoreSubjectCard {...subject} key={`${subject.subject}-${index}`} />) : <SecondaryState title="아직 저장된 시험 성적이 없어요" description="입력·수정에서 과목별 성적을 저장하면 분석에 사용할 수 있어요." />}</div>
        </section>
      </section>
    </SecondaryScreenShell>
  );
}

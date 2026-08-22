export function MbtiInsightCard({ mbti }) {
  if (mbti.empty) {
    return (
      <button type="button" className="my-insight-card my-insight-empty" data-action="openMbtiModal">
        <span><small>학습 유형</small><strong>나에게 맞는 공부 방식을 찾아보세요</strong><p>36문항으로 학습 성향을 진단할 수 있어요.</p></span>
        <b>검사하기</b>
      </button>
    );
  }

  return (
    <section className="my-insight-card">
      <header className="my-insight-head">
        <div><small>내 학습 유형</small><h2><span>{mbti.code}</span>{mbti.name}</h2></div>
        <button type="button" data-action="openMbtiModal">다시 검사</button>
      </header>
      <p className="my-insight-desc">{mbti.desc}</p>
      <dl className="my-insight-list">
        {mbti.rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
      </dl>
    </section>
  );
}

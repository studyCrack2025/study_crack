import React from 'react';
import CalculatorRiskScale from './CalculatorRiskScale.jsx';
import './calculator-portfolio.css';

export default function CalculatorPortfolio({ model, onBack }) {
  const heading = React.useRef(null);
  React.useEffect(() => { heading.current?.focus(); }, []);
  return <section className="jcalc-portfolio" aria-label="나의 정시 포트폴리오">
    <div className="jcalc-workspace-actions"><button type="button" className="jcalc-secondary" onClick={onBack}>지원 조합으로 돌아가기</button><span className="jcalc-note">저장한 조합 기준</span></div>
    <header className="jcalc-portfolio-hero"><p>2027 · STUDYCRACK</p><h2 ref={heading} tabIndex={-1}>{model.title}</h2><strong>{model.name}</strong><span>나의 성적에서, 다음 지원 후보까지.</span></header>
    <section className="jcalc-panel" aria-label="포트폴리오 성적 요약"><h2>내 성적</h2><p className="jcalc-note">{model.scoreSummary.basis}</p><dl className="jcalc-profile-scores">{model.scoreSummary.items.map(item => <div key={item.label}><dt>{item.label} · {item.subject}</dt><dd>{item.value}<small>{item.detail}</small></dd></div>)}</dl><p className="jcalc-note">{model.scoreSummary.grades}</p></section>
    <div className="jcalc-portfolio-cards">{model.cards.map(card => <article key={card.group} className="jcalc-panel jcalc-portfolio-card" aria-label={`${card.label} 대표 지원안`} data-risk={card.indicator?.band || 'unavailable'}>
      <div className="jcalc-portfolio-card-heading"><h3>{card.label}</h3><span className="jcalc-forecast-badge">{card.status === 'empty' ? '미선택' : card.indicator.label}</span></div>
      {card.identity ? <><div className="jcalc-portfolio-identity"><strong>{card.identity.university}</strong><h4>{card.identity.unit}</h4><p>{card.identity.campus} · {card.identity.track}</p></div>
        {card.score && <div className="jcalc-portfolio-score"><span>{card.score.label}</span><strong>{card.score.value}</strong><small>{card.score.maximum}</small></div>}
        <div className="jcalc-portfolio-indicator"><p>{card.indicator.caption}{card.indicator.points && <strong>{card.indicator.points}</strong>}</p><CalculatorRiskScale band={card.indicator.band} /></div>
        {card.reference && <div className="jcalc-portfolio-reference"><p>{card.reference.label}</p><dl>{card.reference.lines.map(line => <div key={line.label}><dt>{line.label}</dt><dd>{line.value}</dd></div>)}</dl><small>{card.reference.note}</small></div>}
      </> : <p className="jcalc-portfolio-empty">아직 선택하지 않은 가능성.</p>}
      {card.notes.map(note => <p key={note} className="jcalc-note">{note}</p>)}
    </article>)}</div>
    <footer className="jcalc-portfolio-footer"><p>{model.disclaimer}</p><p>{model.probability}</p></footer>
  </section>;
}

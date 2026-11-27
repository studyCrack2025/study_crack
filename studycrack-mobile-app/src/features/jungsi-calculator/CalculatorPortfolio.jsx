import React from 'react';
import { CalculatorButton, CalculatorNote } from './CalculatorUi.jsx';
import CalculatorRiskScale from './CalculatorRiskScale.jsx';
import useCalculatorPortfolioExport from './useCalculatorPortfolioExport.js';
import CalculatorResult from './CalculatorResult.jsx';
import { calculatorIndicator } from './calculator-indicators.js';
import { calculatorOfferLine } from './calculator-display.js';
import './calculator-portfolio.css';

function PortfolioCandidate({ card }) {
  return <article className="jcalc-portfolio-card" aria-label={`${card.label} 지원 후보`}>
    <div className="jcalc-portfolio-row">
      <div className="jcalc-portfolio-candidate"><h3>{card.label}</h3>{card.identity ? <div><strong>{card.identity.unit}</strong><small>{card.identity.university} · {card.identity.campus} · {card.identity.track}</small></div> : <p>미선택</p>}</div>
      <div className="jcalc-portfolio-metric"><span>내 환산점수</span><strong>{card.score?.value ?? '—'}</strong>{card.score?.label === '기존 산식 환산점수' && <small>{card.score.label}</small>}</div>
      <div className="jcalc-portfolio-metric"><span>예상 합격 컷</span><strong>{card.cutoff ?? '—'}</strong></div>
      <div className="jcalc-portfolio-stage">{card.indicator ? <CalculatorRiskScale band={card.indicator.band} label={card.indicator.label} /> : <span>—</span>}</div>
    </div>
    {card.identity && <details className="jcalc-portfolio-details"><summary>상세 보기</summary>
      {card.score?.maximum && <CalculatorNote>{card.score.maximum}</CalculatorNote>}
      {card.reference?.lines.length > 1 && <dl>{card.reference.lines.slice(1).map(line => <div key={line.label}><dt>{line.label}</dt><dd>{line.value}</dd></div>)}</dl>}
      {card.reference?.note && <CalculatorNote>{card.reference.note}</CalculatorNote>}
      {card.notes.map(note => <CalculatorNote key={note}>{note}</CalculatorNote>)}
    </details>}
  </article>;
}

function PortfolioRepresentative({ label, entry, onRetry }) {
  if (!entry) return <article className="jcalc-portfolio-empty" aria-label={`${label} 지원 후보`}><h3>{label}</h3><CalculatorNote>대표 미선택</CalculatorNote></article>;
  const { target, result, status, error } = entry;
  const { universityName, unitName, campusName, trackName } = target.selection;
  const indicator = result && calculatorIndicator(result);
  const offer = result && calculatorOfferLine(result.previewCutoff ?? result.possibility);
  return <article className="jcalc-portfolio-representative" data-risk={indicator?.band} aria-label={`${label} 지원 후보`}>
    <details open>
      <summary className="jcalc-portfolio-representative-head">
        <div><small>{label}</small><strong>{universityName}</strong><span>{unitName}</span></div>
        {offer ? <strong className="jcalc-candidate-estimate" aria-label={`${offer.label} ${offer.value}`}>{offer.value.split(' (')[0]}</strong>
          : indicator && <CalculatorRiskScale band={indicator.band} label={indicator.label} />}
      </summary>
      <p className="jcalc-portfolio-campus">{result?.selectionCampusName ?? campusName} · {trackName}</p>
      {result ? <CalculatorResult exactSelection current result={result} offerInDetails />
        : <div className="jcalc-group-result-state">{status === 'error' ? <><CalculatorNote role="alert">{error}</CalculatorNote>{onRetry && <CalculatorButton text onClick={() => onRetry(target)}>후보 다시 계산</CalculatorButton>}</> : <CalculatorNote role="status">{status === 'idle' ? '계산 대기' : '계산 중…'}</CalculatorNote>}</div>}
    </details>
  </article>;
}

export default function CalculatorPortfolio({ model, onBack, onRetry }) {
  const heading = React.useRef(null);
  const { candidates, representatives, exportMessage, ...summary } = model;
  const output = useCalculatorPortfolioExport(exportMessage ? null : summary);
  React.useEffect(() => { heading.current?.focus(); }, []);
  return <section className="jcalc-portfolio" aria-label="나의 정시 포트폴리오">
    <CalculatorButton text onClick={onBack}>지원 조합으로 돌아가기</CalculatorButton>
    <header className="jcalc-portfolio-hero">
      <div><h2 ref={heading} tabIndex={-1}>{model.title}</h2><p>{!candidates && <strong>{model.name}</strong>}<span>{model.basisLabel}</span></p></div>
      <div className="jcalc-export-actions" aria-label="포트폴리오 이미지 내보내기" aria-busy={output.status === 'loading' || Boolean(output.action)}>
        <div className="jcalc-workspace-actions"><CalculatorButton primary disabled={!output.ready || Boolean(output.action)} onClick={() => output.deliver(true)}>이미지 복사</CalculatorButton><CalculatorButton disabled={!output.ready || Boolean(output.action)} onClick={() => output.deliver(false)}>PNG 저장</CalculatorButton>{output.status === 'error' && <CalculatorButton onClick={output.retry}>이미지 다시 준비</CalculatorButton>}</div>
        <CalculatorNote role={output.status === 'error' && !exportMessage ? 'alert' : 'status'}>{exportMessage || (output.action ? output.action === 'copying' ? '이미지를 복사하고 있습니다…' : 'PNG 저장을 요청하고 있습니다…' : output.message || (output.status === 'loading' ? '공유할 이미지를 준비하고 있습니다…' : ''))}</CalculatorNote>
      </div>
    </header>
    {candidates ? <div className="jcalc-group-board jcalc-portfolio-groups" aria-label="모집군별 환산점수 비교">{model.cards.map(({ group, label }) => {
      const entry = candidates.find(candidate => candidate.target.selection.admissionGroup === group && candidate.target.selection.key === representatives[group]);
      return <PortfolioRepresentative key={group} label={label} entry={entry} onRetry={onRetry} />;
    })}</div> : <div className="jcalc-portfolio-comparison" aria-label="모집군별 환산점수 비교">
      <div className="jcalc-portfolio-row jcalc-portfolio-column-head" aria-hidden="true"><span>지원 후보</span><span>내 환산점수</span><span>예상 합격 컷</span><span>지원 단계</span></div>
      {model.cards.map(card => <PortfolioCandidate key={card.group} card={card} />)}
    </div>}
    <CalculatorNote>{model.disclaimer}</CalculatorNote>
    <details className="jcalc-portfolio-details"><summary>내 성적 상세</summary><CalculatorNote>{model.scoreSummary.basis}</CalculatorNote><dl>{model.scoreSummary.items.map(item => <div key={item.label}><dt>{item.label} · {item.subject}</dt><dd>{item.value} · {item.detail}</dd></div>)}</dl><CalculatorNote>{model.scoreSummary.grades}</CalculatorNote></details>
  </section>;
}

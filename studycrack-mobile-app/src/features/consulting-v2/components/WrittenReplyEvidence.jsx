import React from 'react';
import { evidenceBand, evidenceGroup, evidenceUrl, passLineLabel, registeredLineLabel, unitEvidenceSources, validReplyEvidence } from '../written-reply-evidence.js';

export function WrittenReplyEvidence({ evidence, style }) {
  if (!evidence) return <small>이전 추천에는 상세 근거가 저장되지 않았어요. 새로 추천하면 확인할 수 있어요.</small>;
  if (!validReplyEvidence(evidence)) return <p role="status">수치 근거를 확인하지 못했습니다. 새로 추천해주세요.</p>;
  const claims = evidence.uses.find(use => use.style === style).claims;
  const basis = { official_reviewed: '검수 성적 기준', historical_reference: '2026학년도 수능 참고 성적 기준', student_reported: '학생 입력 성적 기준', unavailable: '성적 근거 확인 필요' }[evidence.scoreBasis];
  return <details className="consulting-reply-evidence"><summary>이 답변의 수치·출처 보기 <span>{claims.length}개 학과</span></summary>
    <p>추천 생성 당시의 자료입니다. {basis}</p>
    {!claims.length ? <p>이 초안에는 대학·학과별 수치를 사용하지 않았습니다. 검수된 자료가 없으면 점수나 컷을 채워 넣지 않습니다.</p> : claims.map(claim => {
      const unit = evidence.units.find(row => row.admissionUnitId === claim.admissionUnitId), lines = claim.kind === 'cut_comparison' ? unit.referenceLines : null;
      return <article key={unit.admissionUnitId} className="consulting-reply-unit"><h4>{unit.universityName}</h4><p>{unit.campusName} · {unit.admissionUnitName}</p><small>{unit.admissionYear}학년도 · {evidenceGroup(unit.admissionGroup)}</small>
        <dl><div><dt>학생 환산점수</dt><dd>{unit.convertedScore}점 <small>/ {unit.maximumScore}점</small></dd></div>
          {lines ? <><div><dt>{passLineLabel(unit)}</dt><dd>{lines.passLine}점</dd></div><div><dt>{registeredLineLabel(unit)}</dt><dd>{lines.registered70Line}점</dd></div>
            <div><dt>추정선 대비 차이</dt><dd>{Number((unit.convertedScore - lines.passLine).toFixed(6)) > 0 ? '+' : ''}{Number((unit.convertedScore - lines.passLine).toFixed(6))}점</dd></div>
            {unit.possibilityIndex !== null ? <div><dt>가능성 지수 · {evidenceBand(unit.riskBand)}</dt><dd>{unit.possibilityIndex} <small>확률이 아닌 참고 지수</small></dd></div> : null}</> : <div><dt>컷 비교</dt><dd>이 답변에서 사용하지 않음</dd></div>}
        </dl>
        {lines ? <p className="consulting-reply-evidence-note">{lines.sourceYear}학년도 자료를 {lines.targetYear}학년도 환산 척도에 맞춘 참고선입니다. 올해 확정 컷이나 합격 보장을 뜻하지 않습니다.</p> : null}
        <h5>수치에 연결된 출처</h5><ol>{unitEvidenceSources(evidence, unit, claim.kind).map(doc => <li key={doc.sourceId}><strong>{doc.title}</strong><span>{doc.roles.join(' · ')}{doc.page ? ' · ' + doc.page + '쪽' : ''}</span>
          {evidenceUrl(doc.url) ? <a href={evidenceUrl(doc.url)} target="_blank" rel="noopener noreferrer">원문 확인 ↗</a> : <small>원문 링크 미등록</small>}
          <details><summary>자료 식별 정보</summary><small>출처 번호: {doc.sourceId}<br />원본 지문: {doc.checksum}</small></details>
        </li>)}</ol>
      </article>;
    })}
    {evidence.release ? <details className="consulting-reply-evidence-version"><summary>사용한 자료 버전</summary><small>{evidence.release.releaseId}<br />환산식 {evidence.release.formulaVersion} · 응시 조건 {evidence.release.eligibilityRuleVersion}<br />{evidence.release.contentDigest}</small></details> : null}
  </details>;
}

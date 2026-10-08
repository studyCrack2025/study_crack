import React from 'react';
import { getV2SurveyDraft } from '../survey-api.js';
import { navigateConsulting, CONSULTING_ROUTES } from '../route-model.js';

export function ConsultingMaterialsScreen({ binding }) {
  const [resource, setResource] = React.useState({ status: 'loading', data: null });
  const load = React.useCallback(async () => {
    setResource({ status: 'loading', data: null });
    const result = await getV2SurveyDraft(binding);
    setResource(result.ok ? { status: 'ready', data: result.data } : { status: 'error', data: null });
  }, [binding]);
  React.useEffect(() => { load(); }, [load]);
  if (resource.status === 'loading') return <main className="consulting-v2-center"><p className="consulting-v2-loading">자료 상태를 확인하고 있습니다.</p></main>;
  if (resource.status === 'error') return <main className="consulting-v2-center"><section className="consulting-v2-card"><h1>자료 상태를 불러오지 못했습니다</h1><button className="consulting-v2-primary consulting-v2-wide" onClick={load}>다시 시도</button></section></main>;
  const supplement = resource.data.workflowState === 'SUPPLEMENT_REQUIRED';
  return <main className="consulting-v2-center"><section className="consulting-v2-card"><p className="consulting-v2-kicker">자료 검수</p><h1>{supplement ? '추가 자료가 필요합니다' : '제출 자료를 확인하고 있습니다'}</h1><p className="consulting-v2-status">{supplement ? '운영자 요청에 맞춰 조사서와 성적표를 보완해주세요.' : '검수가 끝나면 서면 상담 가능 시간을 입력할 수 있습니다.'}</p><div className="consulting-v2-summary"><p><span>현재 단계</span><strong>{supplement ? '보완 요청' : '자료 검수 중'}</strong></p><p><span>등록 파일</span><strong>{resource.data.files.length}개</strong></p></div>{supplement ? <button className="consulting-v2-primary consulting-v2-wide" onClick={() => navigateConsulting(CONSULTING_ROUTES.survey)}>보완 작성하기</button> : null}<button className="consulting-v2-secondary consulting-v2-wide" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>진행 현황으로</button></section></main>;
}

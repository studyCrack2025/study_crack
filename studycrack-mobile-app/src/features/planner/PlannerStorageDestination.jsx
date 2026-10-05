import { useContext } from 'react';
import { PlannerStorageContext } from './PlannerStorageContext.js';

export function PlannerStorageDestination() {
  const view = useContext(PlannerStorageContext)?.controller?.account?.getView();
  const label = view?.mode !== 'account' ? '이 기기에 저장' : !view.verified ? '계정 연결 확인 필요' : view.snapshot?.version === 2 ? '계정에 계획·시간 저장' : '계정에 계획 저장 · 시간은 이 기기';
  return <p className="planner-storage-destination" aria-label="계획 저장 위치">{label}</p>;
}

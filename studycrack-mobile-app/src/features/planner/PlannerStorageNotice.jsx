import { useContext } from 'react';
import { StatusState } from '../../components/StatusState.js';
import { PlannerStorageContext } from './PlannerStorageContext.js';

export function PlannerStorageNotice() {
  const storage = useContext(PlannerStorageContext);
  if (!storage?.error) return null;
  const read = storage.error === 'read';
  const conflict = storage.error === 'conflict';
  return <StatusState kind="error"
    title={read ? '기기 계획을 불러오지 못했어요' : conflict ? '다른 화면에서 계획이 변경됐어요' : '기기에 계획을 저장하지 못했어요'}
    description={read ? '저장 원본을 덮어쓰지 않았어요. 저장소 접근을 허용한 뒤 다시 확인해주세요. 손상된 자료가 있다면 먼저 원본을 보관해주세요.' : conflict ? '다른 화면의 기록을 먼저 불러온 뒤 변경을 다시 시도해주세요. 입력 내용은 그대로 남아 있어요.' : storage.pending ? '공부 완료는 유지됐지만 계획의 공부시간은 이 화면에만 남아 있어요. 저장 공간이나 접근 설정을 확인하고, 화면을 닫기 전에 다시 저장해주세요.' : '기존 계획과 입력 내용은 그대로예요. 저장 공간이나 접근 설정을 확인한 뒤 같은 버튼으로 다시 시도해주세요. 저장 전에는 화면을 닫거나 새로고침하지 마세요.'}
    action={read || conflict || storage.pending ? <button type="button" className="btn btn-primary" onClick={storage.retry}>{storage.pending ? '기기 기록 다시 저장' : '기기 기록 다시 불러오기'}</button> : null}
  />;
}

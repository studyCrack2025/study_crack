import { Modal } from '../../components/Modal.jsx';
import { Icon } from '../../components/Icon.jsx';
import { GuidePreview } from './GuidePreview.jsx';

const STEPS = [
  { label: '01 · 목표부터', title: '오늘의 공부는\n목표 대학까지 이어져요.', body: '저장한 목표와 학습 정보를 확인하고, 오늘 시작할 공부를 정해보세요.', icon: 'target', action: '내 학습 흐름 보기' },
  { label: '02 · 오늘의 플래너', title: '첫 과제 하나부터\n시작하면 돼요.', body: '오늘 할 일을 플래너에 적고 공부를 시작해요. 완료 표시는 계획을 돌아보는 데 도움을 줘요.', icon: 'report', action: '공부와 수조 알아보기' },
  { label: '03 · 공부와 수조', title: '공부를 마치고\n물고기를 돌봐주세요.', body: '공부를 완료하고 보상을 확인해요. 받은 먹이는 수조에서 직접 물고기에게 줄 수 있어요.', icon: 'fish', action: '연속 기록 알아보기' },
  { label: '04 · 연속 기록', title: '매일의 공부가\n기록으로 이어져요.', body: '확정된 공부 기록으로 연속 학습일을 확인해요. 작은 공부부터 차근차근 이어가세요.', icon: 'bolt', action: '새로운 발견 알아보기' },
  { label: '05 · 새로운 발견', title: '새 친구를 만나\n나의 수조를 채워요.', body: '발견한 물고기는 도감에 기록돼요. 원하는 물고기를 수조에 배치하고 함께 성장해보세요.', icon: 'fish', action: '내 공부 시작하기' }
];
const STEP_THEMES = ['product-guide-goal', 'product-guide-plan', 'product-guide-care', 'product-guide-record', 'product-guide-find'];

export function ProductGuideError({ ui }) {
  if (!ui?.error) return null;
  return <div className="product-guide-error" role="status"><p>{ui.error}</p><button type="button" data-action="retryProductGuide" disabled={ui.busy}>기록 다시 확인</button>{!ui.open ? <button type="button" data-action="dismissProductGuideError">닫기</button> : null}</div>;
}

export function ProductGuideOverlay({ ui, presentation }) {
  const item = STEPS[ui.step - 1] || STEPS[0];
  return <Modal ariaLabel="StudyCrack 사용법" dismissAction="closeProductGuide" overlayClass="product-guide-overlay" panelClass={`product-guide-panel ${STEP_THEMES[ui.step - 1] || STEP_THEMES[0]}`}>
    <header className="product-guide-header"><div className="product-guide-progress" aria-label={`${ui.step} / 5단계`}>{STEPS.map((_, index) => <span key={index} data-current={index === ui.step - 1} data-seen={index < ui.step} />)}</div><button type="button" data-action="closeProductGuide" aria-label="사용법 안내 닫기"><span aria-hidden="true">×</span></button></header>
    <div className="product-guide-body" aria-live="polite"><span className="product-guide-icon"><Icon name={item.icon} /></span><small>{item.label}</small><h1>{item.title}</h1><p>{item.body}</p><GuidePreview step={ui.step} {...presentation} /><ProductGuideError ui={ui} /></div>
    <footer className="product-guide-footer"><div><button type="button" data-action="previousProductGuide" disabled={ui.step === 1 || ui.busy}>← 이전</button><span>{ui.step} / 5</span><button type="button" data-action="closeProductGuide">나중에 보기</button></div><button type="button" className="product-guide-next" data-action="nextProductGuide" aria-disabled={ui.busy}>{ui.busy ? '기록 확인 중…' : item.action} <span aria-hidden="true">→</span></button></footer>
  </Modal>;
}

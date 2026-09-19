import { AquariumScene } from '../../components/aquarium/AquariumScene.jsx';
import { Icon } from '../../components/Icon.jsx';

export function GuidePreview({ step, profile, aquarium, catalog, tasks = [] }) {
  if (step === 1) return <div className="product-guide-preview product-guide-target"><Icon name="target" /><small>나의 목표 대학</small><strong>{profile?.target || '목표 대학을 설정해 볼까요?'}</strong><p>{profile?.mbtiCode ? `${profile.mbtiCode} · 나의 학습유형` : '학습 프로필을 설정하면 나에게 맞는 공부를 준비할 수 있어요.'}</p><span>저장된 목표와 학습 정보를 바탕으로 시작해요.</span></div>;
  if (step === 2) {
    const rows = Array.isArray(tasks) && tasks.length ? tasks.slice(0, 3) : [{ content: '국어 독서 지문 1개 읽기', done: false }];
    const example = !Array.isArray(tasks) || !tasks.length;
    return <div className="product-guide-preview"><small>{example ? '예시 · 아직 오늘 계획이 없어요' : '이 기기에 저장된 오늘의 계획'}</small><strong>오늘의 플래너</strong>{rows.map((task, index) => <div className="product-guide-task" key={task.id || index}><span aria-hidden="true">{task.done ? '✓' : '○'}</span><span>{task.content || task.subject || '공부 과제'}</span></div>)}<p>첫 과제 하나를 정하고 공부를 시작해요.</p></div>;
  }
  if (step === 3) return <div className="product-guide-scene"><AquariumScene backgroundKey={aquarium?.backgroundKey} variant="guide" slots={aquarium?.slots} catalog={catalog} /><span>{aquarium?.activeCount ? '공부 보상을 확인한 뒤 먹이로 돌봐주세요.' : '물고기를 수조에 배치하면 여기에 보여요.'}</span></div>;
  if (step === 4) return <div className="product-guide-preview product-guide-streak"><Icon name="bolt" /><small>내 연속 학습 기록</small><strong>{aquarium?.streakDays == null ? '기록 확인 필요' : `${aquarium.streakDays}일 연속 학습`}</strong><p>{aquarium?.streakDays == null ? '기록을 확인한 뒤 연속 학습일을 표시해요.' : '서버에서 확인한 연속 학습 기록이에요.'}</p><span>플래너의 체크와 확정된 공부 기록은 따로 관리해요.</span></div>;
  return <div className="product-guide-preview product-guide-discovery"><Icon name="fish" /><small>공부로 채우는 나의 도감</small><strong>발견하고, 기록하고,<br />수조에 배치해요.</strong><p>{aquarium?.collection?.collected == null ? '새로 만난 물고기는 도감에서 확인할 수 있어요.' : `현재 도감에 ${aquarium.collection.collected}종을 모았어요.`}</p><span>발견 조건과 필요한 재화는 수조에서 확인해요.</span></div>;
}

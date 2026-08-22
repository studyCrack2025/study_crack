export const PLAN_META = {
  Basic: {
    introPrice: '25,000원 / 4주',
    payPrice: '25,000원 / 4주',
    originalPrice: '49,000원',
    weeklyPrice: '6,250원 / 주',
    billingNote: '4주 단건 결제',
    theme: 'green',
    desc: '대학별 환산점수와 과목 효율 분석',
    features: ['개인 학습 플래너', '목표대학 최대 18개 설정', '합격 컷 대비 환산점수 거리', '전 과목 원점수 +1 환산 효율', '점수 상승 시뮬레이션'],
    complete: '개인 플래너와 대학별 환산점수 분석을 함께 관리할 수 있어요.',
    audience: ['혼자 계획을 세우되 기록을 한곳에서 관리하고 싶은 학생', '목표 대학별 점수 효율을 먼저 확인하고 싶은 학생']
  },
  Starter: {
    introPrice: '39,000원 / 1회',
    payPrice: '39,000원',
    originalPrice: '',
    weeklyPrice: '39,000원',
    billingNote: '1회 플래너 진단',
    theme: 'blue',
    desc: 'SKY 튜터 1주 플래너 진단',
    features: ['Basic 기능 모두 포함', 'SKY 튜터 1회 플래너 피드백', '과목별 시간 배분 점검', '목표 대학 기준 우선순위 제안', '다음 1주 플래너 제시'],
    complete: '한 번의 플래너 피드백으로 현재 학습 방향을 점검할 수 있어요.',
    audience: ['현재 플래너의 문제를 한 번 정확히 진단받고 싶은 학생', '장기 구독 전에 튜터 피드백을 경험하고 싶은 학생']
  },
  Standard: {
    introPrice: '49,000원 / 4주',
    payPrice: '49,000원 / 4주',
    originalPrice: '정가 37,250원 / 주',
    weeklyPrice: '12,250원 / 주',
    billingNote: '4주 총 49,000원',
    theme: 'blue',
    desc: 'SKY 튜터 주간 합격 플래너 설계',
    features: ['Basic 기능 모두 포함', '합격권 최소 원점수 역산', 'SKY 튜터 주 1회 플래너 피드백', '과목별 시간 배분 점검', '목표 대학 기준 우선순위 제안', '매주 플래너 제시'],
    complete: '플래너 피드백과 학습 방향 코칭을 받을 수 있어요.',
    audience: ['무엇을 먼저 공부할지 막막한 학생', '매주 계획과 시간 배분을 점검받고 싶은 학생', '꾸준한 튜터 피드백이 필요한 학생']
  },
  Pro: {
    introPrice: '149,000원 / 4주',
    payPrice: '149,000원 / 4주',
    originalPrice: '정가 74,750원 / 주',
    weeklyPrice: '37,250원 / 주',
    billingNote: '4주 총 149,000원',
    theme: 'rose',
    desc: '합격 보장형 프리미엄 전략 관리',
    features: ['STANDARD 모든 기능 포함', '목표 성적 정밀 제시', '정밀 역추적', '상향 지원 중장기 로드맵', '심화 합격 전략 리포트', '학부모 공유용 전략 리포트', '조건부 환급 혜택 제공'],
    complete: '심화 합격 전략 리포트와 중장기 로드맵을 확인할 수 있어요.',
    audience: ['상위권 대학을 목표로 정밀 전략이 필요한 학생', '학습과 지원 전략을 함께 관리받고 싶은 학생']
  }
};

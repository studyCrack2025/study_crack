const MENU_GROUPS = [
  {
    label: '학습 정보',
    rows: [
      { icon: 'target', target: 'scoreInfo', title: '목표 대학 · 성적', subtitle: '목표 대학과 모의고사 성적 관리' },
      { icon: 'report', target: 'qualInfo', title: '정성조사서', subtitle: '학년, 계열과 학습 고민 수정' }
    ]
  },
  {
    label: '학습 서비스',
    rows: [
      { icon: 'chart', target: 'weekly', title: '학습 리포트', subtitle: '주간 점검과 튜터 피드백 확인' },
      { icon: 'bolt', target: 'proIntro', title: '플랜 · 결제', subtitle: '이용 기능과 구독 상태 확인' }
    ]
  },
  {
    label: '계정 및 지원',
    rows: [
      { icon: 'user', target: 'accountInfo', title: '계정정보 관리', subtitle: '프로필, 전화번호와 소셜 계정' },
      { icon: 'bell', target: 'notificationList', title: '알림', subtitle: '받은 알림과 상세 내용 확인' },
      { icon: 'chat', target: 'customerSupport', title: '문의 · FAQ', subtitle: '1:1 문의와 자주 묻는 질문' },
      { icon: 'shield', target: 'settingsMain', title: '약관 · 설정', subtitle: '약관, 알림 설정과 로그아웃' }
    ]
  }
];

function MenuIcon({ icon, name }) {
  return <span className="my-menu-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon(name, false) }} />;
}

export function MyMenuList({ icon }) {
  return (
    <div className="my-menu-sections">
      {MENU_GROUPS.map((group) => (
        <section className="my-menu-section" key={group.label}>
          <h2>{group.label}</h2>
          <div className="my-menu-group">
            {group.rows.map((row) => (
              <button type="button" className="my-menu-row" data-action="goto" data-target={row.target} key={row.title}>
                <MenuIcon icon={icon} name={row.icon} />
                <span className="my-menu-copy"><b>{row.title}</b><small>{row.subtitle}</small></span>
                <span className="my-menu-chevron" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon('chevron', false) }} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

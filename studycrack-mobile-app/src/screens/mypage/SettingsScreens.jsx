import { SecondaryIntro, SecondaryScreenShell } from '../../components/SecondaryScreen.jsx';
import { Icon } from '../../components/Icon.jsx';

const SETTINGS_GROUPS = [
  { title: '학습 알림', rows: [{ icon: 'bell', title: '알림 설정', description: '플래너와 리포트 안내 관리', target: 'notificationSettings' }] },
  { title: '계정 및 보안', rows: [{ icon: 'user', title: '계정 정보', description: '프로필·연락처·소셜 계정과 탈퇴 관리', target: 'accountInfo' }] },
  { title: '도움 및 지원', rows: [
    { icon: 'chat', title: '문의 · FAQ', description: '이용 문의와 자주 묻는 질문', target: 'customerSupport' },
    { icon: 'shield', title: '약관 보기', description: '이용약관과 개인정보 처리방침', target: 'settingsTermsPicker' }
  ] }
];

export function SettingsMainScreen() {
  return (
    <SecondaryScreenShell screen="settingsMain" title="설정">
      <div className="sc-secondary-page settings-page">
        <SecondaryIntro eyebrow="SETTINGS" title="설정" description="계정과 약관, 로그인 상태를 관리합니다." />
        <div className="my-menu-sections">{SETTINGS_GROUPS.map(group => <section className="my-menu-section" key={group.title}><h2>{group.title}</h2><div className="my-menu-group">{group.rows.map(row => <button type="button" className="my-menu-row" data-action={row.action || 'goto'} data-target={row.target} key={row.title}><span className="my-menu-icon" aria-hidden="true"><Icon name={row.icon} /></span><span className="my-menu-copy"><b>{row.title}</b><small>{row.description}</small></span><span className="my-menu-chevron" aria-hidden="true"><Icon name="chevron" /></span></button>)}</div></section>)}</div>
        <section className="my-menu-section"><h2>로그인 상태</h2><div className="my-menu-group"><button type="button" className="my-menu-row" data-action="openLogoutModal"><span className="my-menu-icon" aria-hidden="true"><Icon name="user" /></span><span className="my-menu-copy"><b>로그아웃</b><small>현재 기기에서 로그인 종료</small></span><span className="my-menu-chevron" aria-hidden="true"><Icon name="chevron" /></span></button></div></section>
      </div>
    </SecondaryScreenShell>
  );
}

import { SecondaryIntro, SecondaryScreenShell } from '../../components/SecondaryScreen.jsx';
import { AccountInfoOverlays } from './ProfileOverlays.jsx';
import { buildSocialProviders, buildSubscriptionSummary, displayAccountEmail, displayAccountName, displayProvider, formatMarketingConsentDate } from './account-presentation.js';

function SectionHead({ badge = '', description, title }) {
  return <div className="sc-secondary-section-head account-section-head"><div><h3>{title}</h3><p>{description}</p></div>{badge ? <span>{badge}</span> : null}</div>;
}

function SocialAccountRows({ user }) {
  return buildSocialProviders(user).map((provider) => (
    <div className="mobile-social-row" key={provider.key}>
      <div className="mobile-social-info"><span className={`mobile-social-mark ${provider.key}`}>{provider.mark}</span><div><b>{provider.label}</b><small>{provider.isPrimary ? '기본 로그인 계정' : provider.isLinked ? '연동된 계정' : '미연동'}</small></div></div>
      <div className="mobile-social-action">
        <span className={`social-badge ${provider.isLinked ? 'linked' : 'unlinked'}`}>{provider.isLinked ? '연동됨' : '미연동'}</span>
        {provider.isLinked ? (provider.isPrimary ? null : <button type="button" className="social-action-btn unlink-btn" data-action="unlinkSocial" data-provider={provider.key}>해제</button>) : <button type="button" className="social-action-btn link-btn" data-action="linkSocial" data-provider={provider.key}>연동</button>}
      </div>
    </div>
  ));
}

export function AccountInfoScreen(ctx) {
  const { selectedPlan = '', user = {} } = ctx;
  const marketingAgreed = user?.marketingAgreed === true;
  const marketingDate = formatMarketingConsentDate(user?.marketingAgreedAt);
  const authProvider = user?.authProvider || 'local';
  const hasPhone = Boolean(String(user?.phone || '').trim());
  const subscription = buildSubscriptionSummary(user, selectedPlan);
  const overlayOpen = Boolean(ctx.myProfileEditOpen || ctx.phoneChangeModalOpen || ctx.withdrawModalOpen || ctx.mbtiModalOpen);
  const overlays = overlayOpen ? <AccountInfoOverlays {...ctx} /> : null;
  return (
    <SecondaryScreenShell screen="accountInfo" title="계정 정보" overlays={overlays}>
      <div className="sc-secondary-page account-info-page">
        <SecondaryIntro eyebrow="ACCOUNT" title={displayAccountName(user)} description={displayAccountEmail(user)} aside={<span className="sc-chip">{subscription.planLabel}</span>} />
        <section className="sc-secondary-section account-subscription-card">
          <SectionHead title="구독 정보" description="현재 이용권과 다음 변경 일정을 확인합니다." badge={subscription.hasPlan ? '이용 중' : '미구독'} />
          <div className="account-subscription-summary"><div><span>현재 플랜</span><strong>{subscription.planLabel}</strong></div><div><span>{subscription.lifetime ? '이용 기간' : '다음 결제 안내'}</span><strong>{subscription.renewalLine}</strong></div></div>
          {subscription.pendingLine ? <p className="account-pending-plan">{subscription.pendingLine}</p> : null}
          <button type="button" className="btn btn-secondary account-full-btn" data-action="goto" data-target="proIntro">플랜 확인</button>
        </section>
        <section className="sc-secondary-section mobile-account-card">
          <SectionHead title="프로필" description="서비스와 리포트에 표시되는 정보입니다." badge="기본 정보" />
          <div className="account-info-row"><span>이름</span><strong>{displayAccountName(user)}</strong></div>
          <div className="account-info-row"><span>탐구 MBTI</span><strong>{user?.mbti || user?.qualitative?.mbti || '-'}</strong></div>
          <div className="account-action-grid"><button type="button" className="btn btn-secondary account-full-btn" data-action="openMyProfileEdit">이름 변경</button><button type="button" className="btn btn-secondary account-full-btn" data-action="openMbtiModal">탐구 MBTI 수정</button></div>
        </section>
        <section className="sc-secondary-section mobile-account-card">
          <SectionHead title="로그인 및 연락처" description="인증 정보와 마케팅 수신 여부를 관리합니다." badge={displayProvider(authProvider) || 'Local'} />
          <div className="account-info-row"><span>이메일</span><strong>{displayAccountEmail(user)}</strong></div>
          <div className={`account-info-row action phone-row ${hasPhone ? '' : 'missing'}`}><span>전화번호</span><strong>{user?.phone || '등록된 번호 없음'}</strong><button type="button" className="text-link-btn account-inline-action" data-action="openPhoneChangeModal">{hasPhone ? '변경' : '등록'}</button></div>
          {!hasPhone ? <p className="account-inline-warning">결제와 중요 알림을 위해 전화번호 인증 등록이 필요합니다.</p> : null}
          {authProvider === 'local' ? <div className="account-info-row action"><span>비밀번호</span><strong>********</strong><button type="button" className="text-link-btn account-inline-action" data-action="openChangePassword">변경</button></div> : null}
          <div className="account-marketing-row"><div><b>마케팅 수신 동의</b><p>{marketingAgreed ? `${marketingDate || '동의일 확인 중'} 동의` : '미동의 상태입니다.'}</p></div><button type="button" className={`notify-switch ${marketingAgreed ? 'on' : ''}`} data-action="saveMarketingConsent" data-marketing-agreed={marketingAgreed ? 'false' : 'true'} role="switch" aria-checked={marketingAgreed}><i /></button></div>
        </section>
        <section className="sc-secondary-section mobile-account-card">
          <SectionHead title="소셜 계정 연동" description="Google과 Naver 계정을 연결하거나 해제합니다." badge="2개 제공" />
          <div className="mobile-social-list"><SocialAccountRows user={user} /></div>
        </section>
        <footer className="account-danger-utility">
          <div><b>계정 탈퇴</b><p>탈퇴하면 학습 기록과 계정 정보를 복구할 수 없습니다.</p></div>
          <button type="button" className="account-withdraw-link" data-action="openWithdrawModal">탈퇴하기</button>
        </footer>
      </div>
    </SecondaryScreenShell>
  );
}

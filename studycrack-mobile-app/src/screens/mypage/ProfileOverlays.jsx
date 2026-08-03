import { Modal } from '../../components/Modal.jsx';
import { MbtiModal } from '../../components/MbtiModal.jsx';
import { buildSubscriptionSummary, canViewTutorInfo, displayAccountEmail, displayAccountName, displayPlanStatus } from './account-presentation.js';

function CloseButton({ action }) {
  return <button type="button" className="account-edit-close" data-action={action} aria-label="닫기">✕</button>;
}

function ProfileAvatar({ user }) {
  const image = String(user?.profileImage || '').trim();
  if (image) return <img className="profile-photo-img" src={image} alt="프로필 사진" loading="lazy" />;
  return <span aria-hidden="true">{displayAccountName(user).slice(0, 1)}</span>;
}

function TutorInfo({ selectedPlan, user }) {
  if (!canViewTutorInfo(selectedPlan, user)) return null;
  const tutor = user?.tutorInfo && typeof user.tutorInfo === 'object' ? user.tutorInfo : {};
  const name = tutor.nickname || user?.tutorName || '배정 튜터 확인 중';
  const schoolMajor = [tutor.school, tutor.major].filter(Boolean).join(' · ');
  const strengths = Array.isArray(tutor.strengths) ? tutor.strengths.join(' · ') : (tutor.strengths || '');
  return (
    <section className="profile-detail-section profile-tutor-card">
      <div className="profile-tutor-photo">{tutor.profileImage ? <img src={tutor.profileImage} alt="튜터 프로필" loading="lazy" /> : <span>T</span>}</div>
      <div>
        <p className="profile-detail-kicker">담당 튜터</p>
        <h4>{name}</h4>
        {schoolMajor ? <p>{schoolMajor}</p> : null}
        {strengths ? <small>{strengths}</small> : null}
        {tutor.message ? <em>{tutor.message}</em> : null}
      </div>
    </section>
  );
}

export function ProfileDetailModal({ profileDetailModalOpen = false, profilePhotoUploading = false, selectedPlan = '', user = {} }) {
  if (!profileDetailModalOpen) return null;
  const subscription = buildSubscriptionSummary(user, selectedPlan);
  const periodLabel = subscription.lifetime ? '이용 기간' : '이용 종료 예정일';
  const periodValue = subscription.lifetime ? '평생 이용' : (subscription.endDate || (subscription.hasPlan ? '정보 없음' : '이용권 없음'));
  return (
    <Modal panelClass="profile-detail-modal" dismissAction="closeProfileDetailModal">
      <div className="profile-detail-modal-head"><p className="home-modal-title">계정 및 구독 정보</p><button type="button" className="qna-modal-close" data-action="closeProfileDetailModal" aria-label="닫기">✕</button></div>
      <div className="profile-detail-hero"><div className="profile-photo-large"><ProfileAvatar user={user} /></div><div className="profile-photo-copy"><strong>{displayAccountName(user)}</strong><span>{displayPlanStatus(selectedPlan)}</span></div></div>
      <div className="profile-photo-actions">
        <label className="profile-photo-pick"><input className="profile-photo-input" type="file" accept="image/*" data-profile-photo-input /><svg className="profile-photo-pick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg><span className="profile-photo-pick-text">사진 선택</span></label>
        <button type="button" className="btn btn-primary profile-photo-save" data-action="saveProfilePhoto" disabled={profilePhotoUploading}>{profilePhotoUploading ? '업로드 중…' : '사진 저장'}</button>
      </div>
      <section className="profile-detail-section"><div className="profile-detail-row"><span>이름</span><strong>{displayAccountName(user)}</strong></div><div className="profile-detail-row"><span>이메일</span><strong>{displayAccountEmail(user)}</strong></div><div className="profile-detail-row"><span>전화번호</span><strong>{user?.phone || '등록된 번호 없음'}</strong></div></section>
      <section className="profile-detail-section">
        <div className="profile-detail-row"><span>현재 플랜</span><strong>{subscription.planLabel}</strong></div>
        {subscription.hasPlan && subscription.startDate ? <div className="profile-detail-row"><span>이용 시작일</span><strong>{subscription.startDate}</strong></div> : null}
        <div className="profile-detail-row"><span>{periodLabel}</span><strong>{periodValue}</strong></div>
        {subscription.pendingLine ? <div className="profile-detail-row"><span>예약 플랜</span><strong>{subscription.pendingLine}</strong></div> : null}
      </section>
      <TutorInfo user={user} selectedPlan={selectedPlan} />
      <section className="profile-detail-section profile-detail-actions-section"><div className="profile-detail-actions"><button type="button" className="profile-action-row" data-action="openAccountManagement"><span>계정정보 관리</span><i aria-hidden="true">›</i></button></div></section>
    </Modal>
  );
}

export function ProfileEditModal({ myProfileEditOpen = false, myProfileNameDraft = '' }) {
  return (
    <Modal open={myProfileEditOpen} panelClass="my-profile-edit-modal account-edit-modal" dismissAction="closeMyProfileEdit">
      <div className="account-edit-head"><div><p className="home-modal-title">이름 변경</p><p>서비스에서 사용할 이름을 입력해주세요.</p></div><CloseButton action="closeMyProfileEdit" /></div>
      <div className="account-edit-fields"><label htmlFor="mobile-profile-name">새 이름</label><input id="mobile-profile-name" className="planner-input" data-field="myProfileNameDraft" defaultValue={myProfileNameDraft} autoComplete="name" maxLength="30" placeholder="이름" /><small>변경한 이름은 프로필과 학습 리포트에 함께 표시됩니다.</small></div>
      <div className="account-edit-actions"><button type="button" className="btn btn-secondary" data-action="closeMyProfileEdit">취소</button><button type="button" className="btn btn-primary" data-action="saveMyProfileEdit">저장</button></div>
    </Modal>
  );
}

export function PhoneChangeModal({ myProfilePhoneCodeDraft = '', myProfilePhoneDraft = '', phoneChangeModalOpen = false, phoneChangeSending = false, phoneChangeStep = 'input', user = {} }) {
  if (!phoneChangeModalOpen) return null;
  const verify = phoneChangeStep === 'verify';
  const title = verify ? '인증번호 확인' : (user?.phone ? '전화번호 변경' : '전화번호 등록');
  return (
    <Modal panelClass="phone-change-modal account-edit-modal" dismissAction="closePhoneChangeModal">
      <div className="account-edit-head"><div><p className="home-modal-title">{title}</p><p>{verify ? '문자로 받은 6자리 번호를 입력해주세요.' : '중요한 결제 및 서비스 안내에 사용할 번호를 인증합니다.'}</p></div><CloseButton action="closePhoneChangeModal" /></div>
      {verify ? <div className="account-edit-fields"><label htmlFor="mobile-phone-code">인증번호</label><input id="mobile-phone-code" className="planner-input" data-field="myProfilePhoneCodeDraft" inputMode="numeric" autoComplete="one-time-code" maxLength="6" defaultValue={myProfilePhoneCodeDraft} placeholder="6자리 인증번호" /><small>{myProfilePhoneDraft || '입력한 번호'}로 발송된 번호를 입력해주세요.</small></div> : <div className="account-edit-fields"><label htmlFor="mobile-phone-number">휴대폰 번호</label><input id="mobile-phone-number" className="planner-input" data-field="myProfilePhoneDraft" inputMode="numeric" autoComplete="tel" maxLength="11" defaultValue={myProfilePhoneDraft} placeholder="01012345678" /><small>하이픈 없이 숫자 11자리를 입력해주세요.</small></div>}
      <div className="account-edit-actions">
        {verify ? <><button type="button" className="btn btn-secondary" data-action="requestPhoneChange" disabled={phoneChangeSending}>{phoneChangeSending ? '재전송 중' : '재전송'}</button><button type="button" className="btn btn-primary" data-action="verifyPhoneChange">인증 후 변경</button></> : <><button type="button" className="btn btn-secondary" data-action="closePhoneChangeModal">취소</button><button type="button" className="btn btn-primary" data-action="requestPhoneChange" disabled={phoneChangeSending}>{phoneChangeSending ? '전송 중' : '인증번호 받기'}</button></>}
      </div>
    </Modal>
  );
}

export function WithdrawModal({ withdrawModalOpen = false, withdrawPassword = '' }) {
  return (
    <Modal open={withdrawModalOpen} panelClass="account-edit-modal" dismissAction="closeWithdrawModal">
      <div className="account-edit-head"><div><p className="home-modal-title">회원탈퇴</p><p>현재 비밀번호를 입력하면 탈퇴할 수 있습니다.</p></div><CloseButton action="closeWithdrawModal" /></div>
      <div className="account-edit-fields"><label htmlFor="mobile-withdraw-password">현재 비밀번호</label><input id="mobile-withdraw-password" className="planner-input" type="password" data-field="withdrawPassword" defaultValue={withdrawPassword} autoComplete="current-password" placeholder="현재 비밀번호" /></div>
      <div className="account-edit-actions"><button type="button" className="btn btn-secondary" data-action="closeWithdrawModal">취소</button><button type="button" className="btn btn-primary" data-action="confirmWithdraw">탈퇴하기</button></div>
    </Modal>
  );
}

export function MyPageOverlays(ctx) {
  return <><ProfileDetailModal {...ctx} /><MbtiModal {...ctx} /></>;
}

export function AccountInfoOverlays(ctx) {
  return <><ProfileEditModal {...ctx} /><PhoneChangeModal {...ctx} /><WithdrawModal {...ctx} /><MbtiModal {...ctx} /></>;
}

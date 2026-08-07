import { Icon } from '../../components/Icon.jsx';

export function MyProfileHeader({ presentation }) {
  const { mbti, plan, profile } = presentation;
  return (
    <button type="button" className="my-profile-hero" data-action="openProfileDetailModal">
      <span className="my-profile-avatar">
        {profile.avatarUrl ? <img src={profile.avatarUrl} alt="프로필 사진" loading="lazy" /> : <span className="my-profile-avatar-icon" aria-hidden="true"><Icon name="user" /></span>}
      </span>
      <span className="my-profile-copy">
        <small>MY STUDYCRACK</small>
        <strong>{profile.name}님</strong>
        <span>{profile.meta}</span>
        <em>{plan.periodLabel}</em>
      </span>
      <span className="my-profile-chips">
        {mbti.code ? <i>{mbti.code}</i> : null}
        <i className={`plan-${plan.key || 'none'}`}>{plan.label}</i>
      </span>
      <span className="my-profile-chevron" aria-hidden="true"><Icon name="chevron" /></span>
    </button>
  );
}

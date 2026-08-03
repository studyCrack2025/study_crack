function IconLeaf({ html = '' }) {
  return <span className="my-profile-avatar-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MyProfileHeader({ icon, presentation }) {
  const { mbti, plan, profile } = presentation;
  return (
    <button type="button" className="my-profile-hero" data-action="openProfileDetailModal">
      <span className="my-profile-avatar">
        {profile.avatarUrl ? <img src={profile.avatarUrl} alt="프로필 사진" loading="lazy" /> : <IconLeaf html={icon('user', false)} />}
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
      <span className="my-profile-chevron" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon('chevron', false) }} />
    </button>
  );
}

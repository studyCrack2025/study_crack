import { STUDYCRACK_LOGO_SRC } from '../constants/assets.js';

export function PrimaryScreenHeader({ className = '', eyebrow = '', title, description = '', action = null }) {
  const classes = ['primary-screen-header', action ? 'has-action' : '', className].filter(Boolean).join(' ');

  return (
    <header className={classes}>
      <img src={STUDYCRACK_LOGO_SRC} alt="" />
      <div className="primary-screen-header__copy">
        <h1>{title}</h1>
        {eyebrow ? <span>{eyebrow}</span> : null}
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="primary-screen-header__action">{action}</div> : null}
    </header>
  );
}

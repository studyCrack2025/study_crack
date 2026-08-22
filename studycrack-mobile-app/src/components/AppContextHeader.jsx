import { Icon } from './Icon.jsx';

export function AppContextHeader({ className = '', description = '', eyebrow = '', icon = '', meta = null, title, tone = 'brand', visual = null }) {
  const accessory = visual || (icon ? <span className="app-context-header__icon" aria-hidden="true"><Icon name={icon} /></span> : null);
  const classes = ['app-context-header', accessory ? 'has-visual' : '', meta ? 'has-meta' : '', className].filter(Boolean).join(' ');

  return (
    <header className={classes} data-tone={tone}>
      <div className="app-context-header__copy">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {accessory ? <div className="app-context-header__visual">{accessory}</div> : null}
      {meta ? <div className="app-context-header__meta">{meta}</div> : null}
    </header>
  );
}

export function PrimaryScreenHeader({ className = '', eyebrow = '', title, description = '', action = null }) {
  const classes = ['primary-screen-header', action ? 'has-action' : '', className].filter(Boolean).join(' ');

  return (
    <header className={classes}>
      <div>
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="primary-screen-header__action">{action}</div> : null}
    </header>
  );
}

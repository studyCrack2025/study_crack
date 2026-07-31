export function SecondaryIntro({ aside = null, description = '', eyebrow = '', title = '' }) {
  return (
    <header className="sc-secondary-intro">
      <div>
        {eyebrow ? <span className="sc-secondary-eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {aside ? <div className="sc-secondary-intro-aside">{aside}</div> : null}
    </header>
  );
}

export function SecondaryScreenShell({ children, overlays = null, screen, title }) {
  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className={`screen app-screen app-content ${overlays ? 'modal-lock' : ''}`} data-screen={screen}>
          <div className="appbar">
            <button type="button" className="back-btn" data-action="back" aria-label="뒤로가기">←</button>
            <div className="title">{title}</div>
          </div>
          {children}
        </div>
        {overlays ? <div className="app-screen-overlays" style={{ display: 'contents' }}>{overlays}</div> : null}
      </div>
    </div>
  );
}

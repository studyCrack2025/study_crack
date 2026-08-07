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

export function SecondaryState({ description = '', kind = 'empty', title }) {
  const mark = kind === 'loading' ? <i /> : kind === 'error' ? '!' : '—';
  return <div className={`sc-secondary-state is-${kind}`} role="status"><span aria-hidden="true">{mark}</span><div><b>{title}</b>{description ? <p>{description}</p> : null}</div></div>;
}

export function SecondaryScreenShell(props) {
  return <AppScreenShell {...props} />;
}
import { AppScreenShell } from './AppScreenShell.jsx';

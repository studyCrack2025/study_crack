import { AppScreenShell } from './AppScreenShell.jsx';
import { StatusState } from './StatusState.js';

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

export function SecondaryState({ action = null, description = '', kind = 'empty', title }) {
  return <StatusState action={action} description={description} kind={kind} title={title} />;
}

export function SecondaryScreenShell(props) {
  return <AppScreenShell {...props} />;
}

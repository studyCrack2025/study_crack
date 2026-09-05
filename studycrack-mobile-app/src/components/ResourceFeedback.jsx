import { StatusState } from './StatusState.js';

export function ResourceFeedback({ status, error = '', hasData = false, loadingTitle, errorTitle, retryAction }) {
  if (!['idle', 'loading', 'error'].includes(status)) return null;
  const failed = status === 'error';
  return <StatusState
    kind={failed ? 'error' : 'loading'}
    title={hasData ? (failed ? '최신 정보를 확인하지 못했어요' : '최신 정보를 확인하고 있어요') : failed ? errorTitle : loadingTitle}
    description={[hasData ? '표시 중인 내용은 마지막으로 확인한 정보예요.' : '', failed ? error : '잠시만 기다려주세요.'].filter(Boolean).join(' ')}
    action={failed ? <button type="button" className="btn btn-secondary" data-action={retryAction}>다시 시도</button> : null}
  />;
}

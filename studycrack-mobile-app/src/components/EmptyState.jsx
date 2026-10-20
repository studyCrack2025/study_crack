import { StatusState } from './StatusState.js';

export function EmptyState({ action = null, className = '', description = '', kind = 'empty', loading = false, title = '' }) {
  return <StatusState action={action} className={className} description={description} kind={loading ? 'loading' : kind} title={title} />;
}

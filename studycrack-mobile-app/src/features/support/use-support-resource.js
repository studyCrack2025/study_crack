import { useListResource } from '../../shared/api/use-list-resource.js';
import { fetchMobileQnaHistory } from './api.js';

export function useSupportResource(options = {}) {
  useListResource({ ...options, fetcher: fetchMobileQnaHistory, listKey: 'qnaHistory', statusKey: 'qnaStatus', errorKey: 'qnaError' });
}

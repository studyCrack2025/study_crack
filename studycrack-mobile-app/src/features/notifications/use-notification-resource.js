import { useListResource } from '../../shared/api/use-list-resource.js';
import { fetchMobileNotifications } from './api.js';

export function useNotificationResource(options = {}) {
  useListResource({ ...options, fetcher: fetchMobileNotifications, listKey: 'notiList', statusKey: 'notiStatus', errorKey: 'notiError' });
}

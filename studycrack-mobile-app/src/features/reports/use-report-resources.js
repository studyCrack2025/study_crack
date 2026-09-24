import { useListResource } from '../../shared/api/use-list-resource.js';
import { fetchMobileProReports, fetchMobileWeeklyReports } from './api.js';

const PRO_REPORT_SCREENS = new Set(['proElite', 'report', 'reportDetail']);
const WEEKLY_REPORT_SCREENS = new Set(['strategy', 'weekly', 'report', 'reportDetail']);

export function useReportResources({ enabled, getApiBinding, screen, refreshTick = 0, setState } = {}) {
  useListResource({ enabled: enabled && PRO_REPORT_SCREENS.has(screen), fetcher: fetchMobileProReports, getApiBinding, listKey: 'proReports', statusKey: 'proReportsStatus', errorKey: 'proReportsError', refreshTick, setState });
  useListResource({ enabled: enabled && WEEKLY_REPORT_SCREENS.has(screen), fetcher: fetchMobileWeeklyReports, getApiBinding, listKey: 'weeklyReports', statusKey: 'weeklyReportsStatus', errorKey: 'weeklyReportsError', refreshTick, setState });
}

const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER;
const date = value => typeof value === 'string' && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const text = (value, max) => typeof value === 'string' && value.length <= max && Boolean(value.replace(/[\s\u200b-\u200d\ufeff]/g, '')) && !/[\u0000-\u001f\u007f]/.test(value);
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
const same = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);

export function createPlannerSyncModel() {
  const validItem = item => exact(item, ['id', 'date', 'subject', 'title', 'revision', 'completed', 'deleted', 'firstCompletedAt', 'growthDate', 'updatedAt'])
    && id(item.id) && date(item.date) && text(item.subject, 40) && text(item.title, 200) && count(item.revision) && item.revision > 0
    && typeof item.completed === 'boolean' && typeof item.deleted === 'boolean' && timestamp(item.updatedAt)
    && (item.firstCompletedAt === null || timestamp(item.firstCompletedAt)) && (!item.completed || item.firstCompletedAt !== null)
    && (item.firstCompletedAt === null || item.firstCompletedAt <= item.updatedAt)
    && (item.growthDate === null || (date(item.growthDate) && item.firstCompletedAt !== null && new Date(Date.parse(item.firstCompletedAt) + 9 * 3600000).toISOString().slice(0, 10) === item.growthDate));
  const validGrowth = value => {
    if (!exact(value, ['supported', 'policyVersion', 'countingSince', 'revision', 'asOf', 'historyStatus', 'validDayCount', 'highestUnlockedStage', 'nextStageDays'])
      || value.supported !== true || value.policyVersion !== 'planner-days-v1' || !date(value.countingSince) || !count(value.revision)
      || !timestamp(value.asOf) || value.historyStatus !== 'not_available' || !count(value.validDayCount)) return false;
    const thresholds = [1, 7, 15, 30, 50, 100];
    const stage = thresholds.filter(days => days <= value.validDayCount).at(-1);
    const next = thresholds.find(days => days > value.validDayCount);
    return value.highestUnlockedStage === (stage ? `day${stage}` : null) && value.nextStageDays === (next ? next - value.validDayCount : null);
  };
  const validRequest = request => {
    if (!exact(request, ['type', 'data'])) return false;
    const data = request.data;
    if (!['save_server_planner', 'complete_server_planner', 'delete_server_planner'].includes(request.type)
      || !exact(data, request.type === 'save_server_planner' ? ['id', 'requestId', 'revision', 'date', 'subject', 'title', 'completed'] : ['id', 'requestId', 'revision'])
      || !id(data.id) || !id(data.requestId) || data.requestId.length < 8 || !count(data.revision)) return false;
    return request.type === 'save_server_planner' ? date(data.date) && text(data.subject, 40) && text(data.title, 200) && data.completed === false : data.revision > 0;
  };
  const validDetails = row => exact(row, ['id', 'minutes', 'start', 'end', 'detailSubject', 'activityType', 'memo']) && id(row.id)
    && Number.isFinite(row.minutes) && row.minutes >= 0 && row.minutes <= 1440
    && ['start', 'end'].every(key => row[key] === '--:--' || /^([01]\d|2[0-3]):[0-5]\d$/.test(row[key]))
    && ['detailSubject', 'activityType', 'memo'].every(key => typeof row[key] === 'string' && row[key].length <= (key === 'memo' ? 2000 : 100) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(row[key]));
  const validDocument = (doc, owner) => exact(doc, ['version', 'owner', 'items', 'growth', 'queue', 'imports', 'details', 'resolved']) && doc.version === 1 && doc.owner === owner
    && (doc.details === undefined || (Array.isArray(doc.details) && doc.details.length <= 5000 && doc.details.every(validDetails) && new Set(doc.details.map(row => row.id)).size === doc.details.length))
    && (doc.resolved === undefined || (Array.isArray(doc.resolved) && doc.resolved.length <= 100 && doc.resolved.every(validRequest)))
    && Array.isArray(doc.items) && doc.items.length <= 5000 && doc.items.every(validItem) && new Set(doc.items.map(item => item.id)).size === doc.items.length
    && (doc.growth === null || validGrowth(doc.growth)) && Array.isArray(doc.queue) && doc.queue.length <= 100 && doc.queue.every(validRequest)
    && new Set(doc.queue.map(item => item.data.id)).size === doc.queue.length && new Set(doc.queue.map(item => item.data.requestId)).size === doc.queue.length
    && doc.queue.every(request => { const item = doc.items.find(value => value.id === request.data.id); return !item?.deleted && request.data.revision === (item?.revision || 0); })
    && Array.isArray(doc.imports) && doc.imports.length <= 5000 && doc.imports.every(row => exact(row, ['sourceId', 'id']) && text(row.sourceId, 256) && id(row.id))
    && new Set(doc.imports.map(row => row.sourceId)).size === doc.imports.length && new Set(doc.imports.map(row => row.id)).size === doc.imports.length
    && doc.imports.every(row => doc.items.some(item => item.id === row.id) || doc.queue.some(request => request.data.id === row.id));
  const acceptGrowth = (doc, growth) => {
    if (!validGrowth(growth) || (growth.revision === 0 && growth.validDayCount !== 0)) throw new Error('response');
    if (doc.growth && (doc.growth.policyVersion !== growth.policyVersion || doc.growth.countingSince !== growth.countingSince
      || (growth.revision === doc.growth.revision && !same(doc.growth, growth) && !(growth.revision === 0 && same({ ...doc.growth, asOf: growth.asOf }, growth)))
      || (growth.revision > doc.growth.revision && growth.validDayCount < doc.growth.validDayCount))) throw new Error('response');
    return !doc.growth || growth.revision > doc.growth.revision ? growth : doc.growth;
  };
  const accept = (doc, item, growth) => {
    if (!validItem(item)) throw new Error('response');
    const previous = doc.items.find(value => value.id === item.id);
    if (previous && previous.revision === item.revision && !same(previous, item)) throw new Error('response');
    if (previous && item.revision > previous.revision && (previous.deleted || (previous.firstCompletedAt !== null && previous.firstCompletedAt !== item.firstCompletedAt)
      || (previous.growthDate !== null && previous.growthDate !== item.growthDate))) throw new Error('response');
    return { ...doc, items: !previous ? [...doc.items, item] : doc.items.map(value => value.id === item.id && value.revision < item.revision ? item : value),
      growth: acceptGrowth(doc, growth) };
  };
  const acceptPage = (doc, page) => {
    if (!page || !Array.isArray(page.items) || page.items.length > 50 || new Set(page.items.map(item => item?.id)).size !== page.items.length
      || !(page.cursor === null || id(page.cursor))) throw new Error('response');
    return page.items.reduce((next, item) => accept(next, item, page.growth), { ...doc, growth: acceptGrowth(doc, page.growth) });
  };
  return { validDocument, validRequest, accept, acceptPage };
}

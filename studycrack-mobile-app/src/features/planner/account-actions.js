import { minutesBetween } from '../../screens/planner/planner-options.js';
import { buildPlannerId } from '../../state/planner-storage.js';

export function bindAccountPlannerHandlers(workspace, handlers, ctx) {
  const query = selector => (ctx.document || globalThis.document)?.querySelector(selector);
  const value = selector => query(selector)?.value?.trim() || '';
  const radio = name => value(`input[name="${name}"]:checked`);
  async function handle(action, input = {}) {
    if (workspace.getView().result?.error === 'session') { await workspace.run('retry'); return false; }
    const id = input.actionEl?.getAttribute('data-planner-id');
    if (action === 'removePlannerItem') return id ? workspace.mutate('delete', { id }) : false;
    if (action === 'togglePlannerDone') {
      const item = workspace.getItems().find(row => row.id === id);
      return item ? workspace.mutate(item.done ? 'cancel' : 'complete', item) : false;
    }
    const adding = action === 'addPlannerFromSheet';
    const root = query(adding ? '[data-planner-add-root]' : '.planner-edit-sheet');
    const current = adding ? {} : workspace.getItems().find(row => row.id === ctx.plannerEditIndex);
    if (!root || !current) return false;
    const field = name => {
      const suffix = adding ? name : `Edit${name === 'StartTime' ? 'Start' : name === 'EndTime' ? 'End' : name}`;
      return value(`[data-field="planner${suffix}"]`);
    };
    const start = field('StartTime'), end = field('EndTime');
    const minutes = minutesBetween(start, end) || (adding ? 0 : current.minutes);
    const item = { ...current, subject: adding ? radio('plannerCategory') : field('Subject'), detailSubject: adding ? radio('plannerDetailSubject') : field('DetailSubject'),
      activityType: adding ? radio('plannerActivityType') : field('ActivityType'), content: field('Content'), memo: field('Memo'), start, end, minutes };
    if (!item.subject || !item.content || (adding && !minutes) || (start && end && !minutesBetween(start, end))) return false;
    if (adding) {
      item.id = root.getAttribute('data-planner-account-id') || buildPlannerId();
      root.setAttribute('data-planner-account-id', item.id);
      item.date = ctx.selectedPlannerDateKey || ctx.selectedPlannerDate;
    }
    const saved = await workspace.mutate(adding ? 'add' : 'edit', item);
    if (saved && root.isConnected) {
      if (adding) {
        if (ctx.plannerContentRef) ctx.plannerContentRef.current = '';
        if (ctx.plannerCustomMinutesRef) ctx.plannerCustomMinutesRef.current = '';
        ctx.setPlannerDraft({ subject: '', content: '', durationChoice: '', customMinutes: '', start: '', end: '', detailSubject: '', activityType: '', memo: '' });
        ctx.goto?.('planner', false);
      } else ctx.setPlannerEditIndex(null);
    }
    return true;
  }
  const actions = new Set(['addPlannerFromSheet', 'savePlannerEdit', 'togglePlannerDone', 'removePlannerItem']);
  return Object.fromEntries(Object.entries(handlers).map(([name, handler]) => [name, input => workspace.getView().mode === 'account' && actions.has(name) ? handle(name, input) : handler(input)]));
}

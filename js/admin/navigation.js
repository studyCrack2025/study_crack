const ADMIN_SECTIONS = ['dashboard', 'advanced-stats', 'sales-chart', 'students', 'tutors', 'notifications', 'qna', 'matching', 'consulting'];
const ADMIN_CONSULTING_PHASES = ['all', 'intake', 'onboarding', 'written', 'report', 'final', 'completed', 'attention'];
const ADMIN_CONSULTING_TABS = ['overview', 'materials', 'written', 'report', 'final', 'service'];
let adminRestoringLocation = false;
let adminNavigationReady = false;

function readAdminLocation(hash = window.location.hash) {
    const fallback = { section: 'dashboard' };
    if (typeof hash !== 'string' || hash.length > 1000) return fallback;
    const [section, query = '', extra] = hash.replace(/^#/, '').split('?');
    if (!ADMIN_SECTIONS.includes(section) || extra !== undefined) return fallback;
    const params = new URLSearchParams(query);
    if ([...params.keys()].some(key => !['sub', 'phase', 'student', 'record', 'tab'].includes(key) || params.getAll(key).length !== 1)) return fallback;
    if (section === 'qna') return { section, sub: ['waiting', 'read', 'done'].includes(params.get('sub')) ? params.get('sub') : 'waiting' };
    if (section === 'notifications') return { section, sub: ['inbox', 'send', 'sent'].includes(params.get('sub')) ? params.get('sub') : 'inbox' };
    if (section !== 'consulting') return { section };
    const route = { section, phase: ADMIN_CONSULTING_PHASES.includes(params.get('phase')) ? params.get('phase') : 'all' };
    if (params.has('student') || params.has('record')) {
        if (!/^APP_[0-9a-f-]{36}$/i.test(params.get('student') || '') || !/^[A-Za-z0-9_-]{8,200}$/.test(params.get('record') || '')) return route;
        Object.assign(route, { applicationId: params.get('student'), sourceResponseId: params.get('record') });
        if (ADMIN_CONSULTING_TABS.includes(params.get('tab'))) route.tab = params.get('tab');
    }
    return route;
}

function writeAdminLocation(route, replace = false) {
    if (adminRestoringLocation) return;
    const params = new URLSearchParams();
    if (route.sub) params.set('sub', route.sub);
    if (route.phase) params.set('phase', route.phase);
    if (route.applicationId) params.set('student', route.applicationId);
    if (route.sourceResponseId) params.set('record', route.sourceResponseId);
    if (route.tab) params.set('tab', route.tab);
    const safe = readAdminLocation(`#${route.section}${params.size ? `?${params}` : ''}`);
    const canonical = new URLSearchParams();
    for (const [key, field] of [['sub', 'sub'], ['phase', 'phase'], ['student', 'applicationId'], ['record', 'sourceResponseId'], ['tab', 'tab']]) if (safe[field]) canonical.set(key, safe[field]);
    const hash = `#${safe.section}${canonical.size ? `?${canonical}` : ''}`;
    if (window.location.hash === hash) return;
    window.history[replace ? 'replaceState' : 'pushState'](null, '', `${window.location.pathname}${window.location.search}${hash}`);
}

function restoreAdminNavigation() {
    if (!adminNavigationReady) return;
    const route = readAdminLocation();
    adminRestoringLocation = true;
    try {
        if (route.section === 'qna') window.showQnaSection(route.sub);
        else if (route.section === 'notifications') window.showNotiMenu(route.sub);
        else showSection(route.section);
    } finally { adminRestoringLocation = false; }
}

window.addEventListener('hashchange', restoreAdminNavigation);
window.addEventListener('studycrack:session-ended', () => { adminNavigationReady = false; });
document.addEventListener('click', event => {
    const link = event.target.closest?.('.sidebar a[onclick]');
    if (link && link.getAttribute('href')?.startsWith('#')) event.preventDefault();
});

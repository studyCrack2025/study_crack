(function (browser) {
    'use strict';
    const kinds = new Set(['boot_failure', 'chunk_load_failure', 'api_failure', 'auth_refresh_failure', 'payment_return_failure', 'runtime_failure']);
    const routes = new Set(['none', 'user', 'admin', 'file', 'noti', 'qna', 'report', 'game', 'analysis', 'payment', 'auth', 'pdf']);
    const pending = new Map();
    let initialized = false, active = false, release = '', endpoint = '', timer = 0, remaining = 20, sends = 0;

    function start() {
        if (initialized || browser.CONFIG?.clientDiagnostics?.enabled !== true) return;
        initialized = true;
        release = browser.document.querySelector('meta[name="studycrack-release"]')?.content || '';
        if (!/^(?:dev|main|local)-[a-f0-9]{8}$/.test(release)) return;
        const origin = browser.location.origin;
        if (origin === 'https://dev.studycrack.co.kr' && release.startsWith('dev-')) endpoint = 'https://api.dev.studycrack.co.kr/api/client-diagnostics';
        else if (origin === 'https://studycrack.co.kr' && release.startsWith('main-')) endpoint = 'https://api.studycrack.co.kr/api/client-diagnostics';
        else if (/^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/.test(origin)) endpoint = `${origin}/api/client-diagnostics`;
        if (!endpoint) return;
        const rate = browser.CONFIG.clientDiagnostics.sampleRate;
        if (!Number.isFinite(rate) || rate <= 0 || Math.random() >= Math.min(rate, 0.1)) return;
        active = true;
        browser.addEventListener('unhandledrejection', () => record('runtime_failure'));
        browser.addEventListener('vite:preloadError', () => record('chunk_load_failure'));
        browser.addEventListener('error', (event) => {
            if (event.target === browser) record('runtime_failure');
        });
        browser.addEventListener('pagehide', () => { void flush(); });
        if (['/studycrack-mobile', '/studycrack-mobile.html', '/studycrack-mobile/'].includes(browser.location.pathname)) {
            if (browser.__studycrackAppBooted !== true) browser.setTimeout(() => {
                if (browser.__studycrackAppBooted !== true) record('boot_failure');
            }, 12000);
        }
        // Only the presence of a failure flag is used; query values never enter diagnostics.
        if (['/payment', '/payment.html'].includes(browser.location.pathname) && new URLSearchParams(browser.location.search).has('error')) record('payment_return_failure', 'payment');
    }

    function record(kind, route = 'none', status = 0) {
        try {
            start();
            if (!active || remaining <= 0 || sends >= 3 || !kinds.has(kind) || !routes.has(route)) return;
            if (!Number.isInteger(status) || (status !== 0 && (status < 400 || status > 599))) return;
            if (kind === 'api_failure' ? route === 'none' : kind === 'auth_refresh_failure' ? route !== 'auth' : kind === 'payment_return_failure' ? route !== 'payment' || status !== 0 : route !== 'none' || status !== 0) return;
            remaining--;
            const key = `${kind}:${route}:${status}`;
            const previous = pending.get(key);
            // Reconstruct allowlisted fields instead of retaining errors, payloads or browser data.
            if (previous) previous.count = Math.min(previous.count + 1, 10);
            else if (pending.size < 10) pending.set(key, { kind, route, status, count: 1 });
            if (!timer) timer = browser.setTimeout(() => { void flush(); }, 10000);
        } catch (_) { /* Diagnostics must not change application behavior. */ }
    }

    async function flush() {
        try {
            if (timer) browser.clearTimeout(timer);
            timer = 0;
            const events = Array.from(pending.values()).slice(0, 5);
            pending.clear();
            if (!active || !events.length || sends >= 3 || browser.navigator.onLine === false) return;
            sends++;
            const controller = new AbortController();
            const timeout = browser.setTimeout(() => controller.abort(), 3000);
            try {
                const response = await browser.fetch(endpoint, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ schema: 1, release, events }), credentials: 'omit',
                    referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store', keepalive: true,
                    signal: controller.signal
                });
                await response.body?.cancel();
            } catch (_) { /* Drop failed batches without retry or recursive reporting. */ }
            finally { browser.clearTimeout(timeout); }
        } catch (_) { /* Diagnostics must not change application behavior. */ }
    }

    try {
        Object.defineProperty(browser, 'STUDYCRACK_DIAGNOSTICS', { value: Object.freeze({ record, flush }), writable: false, configurable: false });
        if (browser.document.readyState === 'loading') browser.document.addEventListener('DOMContentLoaded', start, { once: true });
        else start();
    } catch (_) { /* An unavailable collector never blocks the application. */ }
})(window);

(function() {
    'use strict';

    // No student scores, contact details, or form contents are collected here.
    let selectedService = null;
    function track(name, entry) {
        if (window.SCTrack) window.SCTrack.event(name, {
            entry: entry || 'jungsi_landing',
            analysis_type: selectedService || 'consulting',
            plan_type: 'jungsi_consulting'
        });
    }
    let visibleSeconds = 0, engaged = false;
    const engagementTimer = window.setInterval(() => {
        if (document.visibilityState !== 'visible' || selectedService !== 'consulting') return;
        if (++visibleSeconds >= 30 && !engaged) {
            engaged = true;
            track('consulting_engaged', 'visible_30_seconds');
            window.clearInterval(engagementTimer);
        }
    }, 1000);
    document.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (!link || link.getAttribute('aria-disabled') === 'true') return;
        if (link.id === 'consultingApply' || link.id === 'jungsiGoogleForm') {
            track('consulting_apply_click', 'application_form');
        } else if (link.getAttribute('href') === '/2027-jungsi-consulting/login') {
            track('consulting_login_click', 'existing_applicant');
        } else if (/^\/jungsi-(score|admission-prediction|percentile|consulting-timing|gachaejeom)-guide/.test(link.getAttribute('href') || '')) {
            track('consulting_guide_click', 'guide');
        }
    });

    const serviceTabs = Array.from(document.querySelectorAll('.jungsi-service-tabs [role="tab"]'));
    function selectService(index, updateHash = false) {
        serviceTabs.forEach((tab, i) => {
            const active = i === index;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
        });
        const nextService = serviceTabs[index].getAttribute('aria-controls') === 'calculator' ? 'calculator' : 'consulting';
        if (selectedService !== nextService) {
            selectedService = nextService;
            track(nextService + '_view', updateHash ? 'tab_switch' : 'landing_or_anchor');
        }
        if (updateHash) history.replaceState(null, '', '#' + nextService);
    }
    serviceTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectService(index, true));
        tab.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? serviceTabs.length - 1 : (index + 1) % serviceTabs.length;
            selectService(next, true);
            serviceTabs[next].focus();
        });
    });
    function selectHashService() {
        if (location.hash === '#application' && selectedService) return;
        const target = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
        // Consulting is the default panel; only anchors inside the calculator panel open it.
        const inConsulting = target && document.getElementById('consultingPanel')?.contains(target);
        const panel = target && !inConsulting && document.getElementById('calculator')?.contains(target) ? 'calculator' : 'consultingPanel';
        selectService(serviceTabs.findIndex(tab => tab.getAttribute('aria-controls') === panel));
    }
    if (serviceTabs.length) {
        selectHashService();
        window.addEventListener('hashchange', selectHashService);
    }

    const accountLink = document.getElementById('consultingAccountLink');
    let accountCheck = 0;
    async function updateAccountLink() {
        if (!accountLink) return;
        const revision = ++accountCheck;
        const render = (text, path, busy = false) => {
            accountLink.textContent = text;
            accountLink.href = path;
            accountLink.setAttribute('aria-busy', String(busy));
        };
        const loginPath = '/2027-jungsi-consulting/login';
        if (!window.hasClientSession?.()) { render('이용자 로그인 ↗', loginPath); return; }
        render('로그인 확인 중…', loginPath, true);
        const scope = window.captureClientSession?.();
        try {
            const verified = typeof window.tryRefreshToken === 'function' && await window.tryRefreshToken({ preserveTransientErrors: true });
            if (revision !== accountCheck) return;
            if (scope && !window.isClientSessionCurrent(scope)) { render('이용자 로그인 ↗', loginPath); return; }
            render(verified ? '나의 컨설팅 ↗' : '이용자 로그인 ↗', verified ? '/2027-jungsi-consulting/home' : loginPath);
        } catch (_) {
            if (revision === accountCheck) render('컨설팅으로 이동 ↗', loginPath);
        }
    }
    window.addEventListener('pageshow', event => { if (event.persisted) void updateAccountLink(); });
    window.addEventListener('studycrack:session-ended', () => { void updateAccountLink(); });
    window.addEventListener('storage', event => {
        if (event.key === null || ['userId', 'sc_session_epoch', 'sc_session_ended'].includes(event.key)) void updateAccountLink();
    });
    void updateAccountLink();

    const policyDialog = document.getElementById('jungsi-policy-dialog');
    const policyTitle = document.getElementById('jungsiPolicyTitle');
    const policyStatus = document.getElementById('jungsiPolicyStatus');
    const policyContent = document.getElementById('jungsiPolicyContent');
    const policyRetry = policyDialog.querySelector('.jungsi-policy-retry');
    const policyBody = policyDialog.querySelector('.jungsi-policy-body');
    const policies = {
        '/terms': { title: '이용약관', ids: ['standard', 'service', 'marketing'] },
        '/refund': { title: '환불 규정', ids: ['refund'] },
        '/privacy': { title: '개인정보처리방침', ids: ['privacy'] }
    };
    let policyRequest = null, policyTrigger = null, selectedPolicy = '';
    const policyCache = new Map();
    async function loadPolicy(path) {
        policyRequest?.abort();
        const controller = new AbortController();
        policyRequest = controller;
        const timer = window.setTimeout(() => controller.abort(), 10000);
        policyTitle.textContent = policies[path].title;
        policyStatus.textContent = '규정을 불러오고 있습니다.';
        policyContent.replaceChildren();
        policyRetry.hidden = true;
        policyBody.setAttribute('aria-busy', 'true');
        policyBody.scrollTop = 0;
        try {
            let documents = policyCache.get(path);
            if (!documents) {
                const response = await fetch(path, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
                if (!response.ok) throw new Error();
                const html = new DOMParser().parseFromString(await response.text(), 'text/html');
                documents = policies[path].ids.map(id => {
                    const copy = html.querySelector(`[data-legal-document="${id}"]`);
                    const title = copy?.closest('section')?.querySelector('h2')?.textContent;
                    if (!title || !copy?.textContent.trim() || !copy.getAttribute('data-legal-revision')) throw new Error();
                    return { title, body: copy.textContent };
                });
                policyCache.set(path, documents);
            }
            if (policyRequest !== controller || !policyDialog.open) return;
            for (const documentCopy of documents) {
                const section = document.createElement('section');
                const title = document.createElement('h3');
                const copy = document.createElement('p');
                title.textContent = documentCopy.title;
                copy.textContent = documentCopy.body;
                section.append(title, copy);
                policyContent.append(section);
            }
            policyStatus.textContent = '';
        } catch (_) {
            if (policyRequest !== controller || !policyDialog.open) return;
            policyStatus.textContent = '규정을 불러오지 못했어요. 연결 상태를 확인하고 다시 불러와주세요.';
            policyRetry.hidden = false;
        } finally {
            window.clearTimeout(timer);
            if (policyRequest === controller) policyBody.setAttribute('aria-busy', 'false');
        }
    }
    document.addEventListener('click', event => {
        const link = event.target.closest('a');
        const path = link?.getAttribute('href');
        if (!Object.hasOwn(policies, path || '') || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        selectedPolicy = path;
        policyTrigger = link;
        if (!policyDialog.open) policyDialog.showModal();
        void loadPolicy(path);
    });
    policyDialog.querySelector('.jungsi-policy-close').addEventListener('click', () => policyDialog.close());
    policyDialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(policyDialog.querySelectorAll('button:not([hidden]), [tabindex="0"]')).filter(node => !node.disabled);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    policyDialog.addEventListener('close', () => {
        policyRequest?.abort();
        policyRequest = null;
        policyTrigger?.focus({ preventScroll: true });
    });
    policyRetry.addEventListener('click', () => { void loadPolicy(selectedPolicy); });

    const apply = document.getElementById('jungsiGoogleForm');

    function isSafeCampaign(value) {
        return value && value.campaignSlug === '2027-jungsi-consulting' && value.admissionYear === 2027 && ['open', 'unavailable'].includes(value.enrollmentStatus);
    }

    async function loadCampaign() {
        try {
            const response = await fetch(CONFIG.api.consultingPublic, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                body: JSON.stringify({ type: 'get_v2_consulting_campaign', data: { slug: '2027-jungsi-consulting' } })
            });
            const body = await response.json().catch(() => null);
            const campaign = response.ok && body?.success === true && isSafeCampaign(body.data) ? body.data : null;
            if (!campaign) return;
            // Promotional eligibility is described in the landing; a base price must not erase those terms.
            if (campaign.enrollmentStatus === 'open' && typeof campaign.applicationUrl === 'string' && /^https:\/\/docs\.google\.com\/forms\//.test(campaign.applicationUrl)) {
                apply.href = window.SCConsultingAttribution && campaign.attributionFormEntry
                    ? await window.SCConsultingAttribution.decorate(campaign.applicationUrl, campaign.attributionFormEntry)
                    : campaign.applicationUrl;
                apply.dataset.available = 'true';
                apply.hidden = document.getElementById('jungsiEnrollment')?.dataset.productType === 'calculator';
                apply.target = '_blank';
                apply.rel = 'noopener noreferrer';
                apply.removeAttribute('aria-disabled');
            }
        } catch (_) {}
    }

    void loadCampaign();
})();

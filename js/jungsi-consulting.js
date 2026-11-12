(function() {
    'use strict';

    // Public landing only: no student scores, contact details, or form contents.
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
        if (link.id === 'consultingApply' && /^https:\/\/docs\.google\.com\/forms\//.test(link.href)) {
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
        const nextService = index === 0 ? 'calculator' : 'consulting';
        if (selectedService !== nextService) {
            selectedService = nextService;
            track(nextService + '_view', updateHash ? 'tab_switch' : 'landing_or_anchor');
        }
        if (updateHash) history.replaceState(null, '', index === 0 ? '#calculator' : '#consulting');
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
        const target = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
        // Consulting is the default panel; only anchors inside the calculator panel open it.
        const inConsulting = target && document.getElementById('consultingPanel')?.contains(target);
        selectService(target && !inConsulting && document.getElementById('calculator')?.contains(target) ? 0 : 1);
    }
    if (serviceTabs.length) {
        selectHashService();
        window.addEventListener('hashchange', selectHashService);
    }

    const apply = document.getElementById('consultingApply');
    const price = document.getElementById('consultingPrice');

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
            if (Number.isSafeInteger(campaign.price) && campaign.price >= 0) price.textContent = `컨설팅 비용 ${campaign.price.toLocaleString('ko-KR')}원`;
            if (campaign.enrollmentStatus === 'open' && typeof campaign.applicationUrl === 'string' && /^https:\/\/docs\.google\.com\/forms\//.test(campaign.applicationUrl)) {
                apply.href = campaign.applicationUrl;
                apply.textContent = '컨설팅 신청하기';
                apply.target = '_blank';
                apply.rel = 'noopener noreferrer';
                apply.removeAttribute('aria-disabled');
            }
        } catch (_) {}
    }

    void loadCampaign();
})();

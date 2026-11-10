(function() {
    'use strict';

    const serviceTabs = Array.from(document.querySelectorAll('.jungsi-service-tabs [role="tab"]'));
    function selectService(index, updateHash = false) {
        serviceTabs.forEach((tab, i) => {
            const active = i === index;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
        });
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
        const target = document.getElementById(location.hash.slice(1));
        selectService(target && document.getElementById('consultingPanel')?.contains(target) ? 1 : 0);
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

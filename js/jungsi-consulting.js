(function() {
    'use strict';

    const apply = document.getElementById('consultingApply');
    const price = document.getElementById('consultingPrice');
    const entries = document.querySelectorAll('[data-consulting-entry]');

    function syncEntryLinks() {
        const signedIn = window.hasClientSession?.();
        for (const entry of entries) {
            entry.href = signedIn ? '/2027-jungsi-consulting/home' : '/2027-jungsi-consulting/login';
            entry.firstElementChild.textContent = signedIn ? '나의 컨설팅' : entry.dataset.consultingEntry;
        }
    }

    function isSafeCampaign(value) {
        return value && value.campaignSlug === '2027-jungsi-consulting' && value.admissionYear === 2027 && ['open', 'unavailable'].includes(value.enrollmentStatus);
    }

    async function revealServiceLink(event) {
        if (event.persisted) return;
        const serviceId = window.location.hash.slice(1);
        if (!['calculator', 'consulting'].includes(serviceId)) return;
        await document.fonts?.ready;
        window.requestAnimationFrame(() => {
            if (window.location.hash === `#${serviceId}`) document.getElementById(serviceId)?.scrollIntoView({ block: 'start' });
        });
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

    syncEntryLinks();
    for (const event of ['pageshow', 'storage', 'studycrack:session-ended']) window.addEventListener(event, syncEntryLinks);
    window.addEventListener('pageshow', revealServiceLink);
    void loadCampaign();
})();

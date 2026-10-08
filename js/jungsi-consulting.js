(function() {
    'use strict';

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

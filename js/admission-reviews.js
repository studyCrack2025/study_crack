(function () {
    'use strict';

    const universityInitials = {
        건국: 'K', 경북: 'K', 경희: 'K', 고려: 'K',
        광운: 'K', 중앙: 'C', 한국외: 'H', 홍익: 'H',
    };
    const romanInitials = ['G', 'K', 'N', 'D', 'T', 'R', 'M', 'B', 'P', 'S', 'S', '', 'J', 'J', 'C', 'K', 'T', 'P', 'H'];

    const vowelInitials = ['A', 'A', 'Y', 'Y', 'E', 'E', 'Y', 'Y', 'O', 'W', 'W', 'O', 'Y', 'U', 'W', 'W', 'W', 'Y', 'E', 'U', 'I'];

    function universityInitial(name) {
        const stem = name.trim().replace(/대(?:학교)?$/, '');
        const first = stem.charAt(0);
        const offset = first.charCodeAt(0) - 0xAC00;
        const initial = universityInitials[stem] || (offset >= 0 && offset < 11172
            ? romanInitials[Math.floor(offset / 588)] || vowelInitials[Math.floor(offset / 28) % 21]
            : /^[A-Za-z]$/.test(first) ? first.toUpperCase() : '');
        return initial ? initial + '대학교' : '';
    }

    function reviewCard(review, index, universityNames) {
        const card = document.createElement('article');
        card.className = index === 0 ? 'review-card featured' : 'review-card';

        const header = document.createElement('div');
        header.className = 'review-header';
        const badge = document.createElement('span');
        badge.className = 'review-badge';
        badge.textContent = review.universities.map(universityInitial).filter(Boolean).join(' · ');
        if (badge.textContent) header.append(badge);

        const quote = document.createElement('p');
        quote.className = 'review-text';
        let content = review.content;
        for (const name of universityNames) {
            content = content.replaceAll(name, universityInitial(name));
        }
        content = content.replace(/[가-힣]{2,}대학교/g, universityInitial);
        quote.textContent = '“' + content + '”';

        const author = document.createElement('div');
        author.className = 'review-author';
        author.textContent = String(review.name || '');
        card.append(header, quote, author);
        return card;
    }

    window.renderAdmissionReviews = async function (container) {
        if (!container) return;
        try {
            const response = await fetch(CONFIG.api.auth, {
                method: 'POST',
                credentials: 'omit',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'get_user_reviews' }),
            });
            const data = response.ok ? await response.json() : null;
            const rows = typeof data?.body === 'string' ? JSON.parse(data.body) : data;
            const reviews = Array.isArray(rows) ? rows.filter(row => typeof row?.content === 'string' && row.content.trim()).map(row => ({
                ...row,
                universities: String(row.univ || '').split(/[,，·/]/).map(part => part.trim().split(/\s+/)[0]).filter(Boolean),
            })) : [];
            const universityNames = [...new Set(reviews.flatMap(review => review.universities)
                .flatMap(name => name.endsWith('대학교') ? [name, name.slice(0, -2)] : name.endsWith('대') ? [name, name + '학교'] : [name]))]
                .sort((a, b) => b.length - a.length);
            if (reviews.length) {
                container.replaceChildren(...reviews.map((review, index) => reviewCard(review, index, universityNames)));
                return;
            }
        } catch {
            // The same empty state is used when the public review feed is unavailable.
        }
        const notice = document.createElement('p');
        notice.textContent = '지금은 후기를 불러올 수 없습니다.';
        container.replaceChildren(notice);
    };

    const consultingReviews = document.getElementById('consultingReviews');
    if (consultingReviews) window.renderAdmissionReviews(consultingReviews);
})();

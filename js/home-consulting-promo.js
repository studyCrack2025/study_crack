(function () {
    'use strict';
    const prefix = 'studycrack:promo:jungsi-2027-v1';
    const sessionKey = `${prefix}:closed`;
    const todayKey = `${prefix}:hideUntil`;
    const read = (kind, key) => { try { return window[kind].getItem(key); } catch { return null; } };
    const write = (kind, key, value) => { try { window[kind].setItem(key, value); } catch {} };
    const midnight = () => (Math.floor((Date.now() + 9 * 60 * 60 * 1000) / 86400000) + 1) * 86400000 - 9 * 60 * 60 * 1000;
    function suppressed() {
        if (read('sessionStorage', sessionKey) === '1') return true;
        return ['localStorage', 'sessionStorage'].some(kind => {
            const until = Number(read(kind, todayKey));
            return Number.isFinite(until) && until > Date.now() && until <= midnight();
        });
    }
    function init() {
        const dialog = document.getElementById('homeConsultingPromo');
        if (!['/', '/index', '/index.html', '/index/'].includes(location.pathname) || !dialog || typeof dialog.showModal !== 'function' || suppressed()) return;
        const closeButton = document.getElementById('homeConsultingPromoClose');
        const dismiss = document.getElementById('homeConsultingPromoDismiss');
        const today = document.getElementById('homeConsultingPromoToday');
        const link = document.getElementById('homeConsultingPromoLink');
        let previousFocus, scrollStyles, finished = false;
        function restore() {
            if (!scrollStyles) return;
            for (const [element, value, priority] of scrollStyles) {
                if (value) element.style.setProperty('overflow', value, priority);
                else element.style.removeProperty('overflow');
            }
            scrollStyles = null;
            if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        }
        function close(mode = 'session') {
            finished = true;
            if (mode === 'today') {
                const until = String(midnight());
                write('localStorage', todayKey, until);
                write('sessionStorage', todayKey, until);
            } else write('sessionStorage', sessionKey, '1');
            dialog.close();
            restore();
        }
        function open() {
            if (finished || dialog.open || document.visibilityState !== 'visible') return;
            if (suppressed()) { finished = true; return; }
            const otherOverlay = [...document.querySelectorAll('dialog[open], .modal, .mobile-nav-panel.active')].some(element => element !== dialog && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).opacity !== '0');
            if (otherOverlay || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
            previousFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
                ? document.activeElement : document.querySelector('#site-header .logo-link');
            scrollStyles = [document.documentElement, document.body].map(element => [element, element.style.getPropertyValue('overflow'), element.style.getPropertyPriority('overflow')]);
            for (const [element] of scrollStyles) element.style.setProperty('overflow', 'hidden');
            try { dialog.showModal(); closeButton.focus({ preventScroll: true }); }
            catch { restore(); }
        }
        closeButton.addEventListener('click', () => close());
        dismiss.addEventListener('click', () => close());
        today.addEventListener('click', () => close('today'));
        link.addEventListener('click', () => close());
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
        dialog.addEventListener('keydown', event => {
            if (event.key !== 'Tab') return;
            if (event.shiftKey && document.activeElement === closeButton) { event.preventDefault(); dismiss.focus(); }
            else if (!event.shiftKey && document.activeElement === dismiss) { event.preventDefault(); closeButton.focus(); }
        });
        dialog.addEventListener('close', restore);
        dialog.addEventListener('click', event => {
            const box = dialog.getBoundingClientRect();
            if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) close();
        });
        window.addEventListener('storage', event => {
            if (event.key === todayKey && suppressed()) { finished = true; if (dialog.open) dialog.close(); }
        });
        window.addEventListener('pagehide', () => { finished = true; if (dialog.open) dialog.close(); restore(); });
        document.addEventListener('visibilitychange', open);
        window.setTimeout(open, 450);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();

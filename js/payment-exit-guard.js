(function () {
    const TYPEFORM_ID = '01KSFFXNN2R95QMDJC34YZAAYY';
    const TYPEFORM_SCRIPT_SRC = 'https://embed.typeform.com/next/embed.js';

    let config = {};
    let modalEl = null;
    let pendingExitAction = null;
    let bypassUntil = 0;
    let historyTrapArmed = false;
    let clickListenerAttached = false;
    let popListenerAttached = false;

    function now() {
        return Date.now();
    }

    function getSeenKey() {
        return config.seenKey || 'payment_exit_guard_seen_v2';
    }

    function shouldGuard() {
        if (now() < bypassUntil) return false;
        if (sessionStorage.getItem(getSeenKey()) === '1') return false;
        if (typeof config.isPaymentInProgress === 'function' && config.isPaymentInProgress()) return false;
        return typeof config.shouldGuard === 'function' ? !!config.shouldGuard() : true;
    }

    function allowNavigationOnce(durationMs = 1600) {
        bypassUntil = now() + durationMs;
    }

    function runExitAction(action) {
        allowNavigationOnce();
        closeExitModal();
        if (typeof action === 'function') action();
    }

    function restoreHistoryTrapIfNeeded() {
        if (!historyTrapArmed) return;
        if (now() < bypassUntil) return;
        if (history.state && history.state.paymentExitGuard) return;
        history.pushState({ paymentExitGuard: true }, '', window.location.href);
    }

    function getModalHtml() {
        return `
            <div class="payment-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="paymentExitTitle">
                <button type="button" class="payment-exit-close" data-payment-exit-close aria-label="닫기">×</button>
                <div class="payment-exit-view payment-exit-view-main" data-payment-exit-main>
                    <div class="payment-exit-mascot-wrap">
                        <img class="payment-exit-mascot" src="/assets/images/mascots/crack_startle.png" alt="놀란 크랙이">
                    </div>
                    <h2 id="paymentExitTitle">결제 전에 확인이 필요하신가요?</h2>
                    <p class="payment-exit-copy">선택하신 플랜은 결제 후 4주 동안 이용할 수 있어요. 가격, 이용 방식, 결제 오류가 걱정된다면 바로 확인해드릴게요.</p>
                    <div class="payment-exit-actions">
                        <button type="button" class="payment-exit-primary" data-payment-exit-continue>계속 결제하기</button>
                        <button type="button" class="payment-exit-secondary" data-payment-exit-contact>궁금한 점 문의하기</button>
                        <button type="button" class="payment-exit-secondary" data-payment-exit-survey>이유 남기고 나가기</button>
                        <button type="button" class="payment-exit-ghost" data-payment-exit-leave>그냥 나가기</button>
                    </div>
                </div>
                <div class="payment-exit-view payment-exit-view-survey" data-payment-exit-survey-view hidden>
                    <h2>어떤 점이 망설여졌나요?</h2>
                    <p class="payment-exit-copy">남겨주신 이유는 결제 흐름과 상품 안내를 개선하는 데만 사용됩니다.</p>
                    <div class="payment-exit-typeform" data-payment-exit-typeform></div>
                    <div class="payment-exit-survey-actions">
                        <button type="button" class="payment-exit-primary" data-payment-exit-continue>계속 결제하기</button>
                        <button type="button" class="payment-exit-ghost" data-payment-exit-leave>설문 닫고 나가기</button>
                    </div>
                </div>
            </div>
        `;
    }

    function ensureModal() {
        if (modalEl) return modalEl;
        modalEl = document.createElement('div');
        modalEl.className = 'payment-exit-modal';
        modalEl.setAttribute('hidden', '');
        modalEl.innerHTML = getModalHtml();
        document.body.appendChild(modalEl);

        modalEl.addEventListener('click', (event) => {
            if (event.target === modalEl || event.target.closest('[data-payment-exit-close]') || event.target.closest('[data-payment-exit-continue]')) {
                closeExitModal();
                return;
            }

            if (event.target.closest('[data-payment-exit-contact]')) {
                const contactUrl = config.contactUrl || '/qna?source=payment_exit';
                runExitAction(() => { window.location.href = contactUrl; });
                return;
            }

            if (event.target.closest('[data-payment-exit-survey]')) {
                showSurveyView();
                return;
            }

            if (event.target.closest('[data-payment-exit-leave]')) {
                runExitAction(pendingExitAction);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modalEl && !modalEl.hasAttribute('hidden')) closeExitModal();
        });

        return modalEl;
    }

    function openExitModal(action) {
        ensureModal();
        pendingExitAction = action;
        sessionStorage.setItem(getSeenKey(), '1');
        modalEl.removeAttribute('hidden');
        document.body.classList.add('payment-exit-lock');
        showMainView();
        const primaryButton = modalEl.querySelector('[data-payment-exit-continue]');
        if (primaryButton) primaryButton.focus();
    }

    function closeExitModal() {
        if (!modalEl) return;
        modalEl.setAttribute('hidden', '');
        document.body.classList.remove('payment-exit-lock');
        pendingExitAction = null;
        showMainView();
        restoreHistoryTrapIfNeeded();
    }

    function showMainView() {
        if (!modalEl) return;
        const mainView = modalEl.querySelector('[data-payment-exit-main]');
        const surveyView = modalEl.querySelector('[data-payment-exit-survey-view]');
        if (mainView) mainView.hidden = false;
        if (surveyView) surveyView.hidden = true;
    }

    function showSurveyView() {
        if (!modalEl) return;
        const mainView = modalEl.querySelector('[data-payment-exit-main]');
        const surveyView = modalEl.querySelector('[data-payment-exit-survey-view]');
        if (mainView) mainView.hidden = true;
        if (surveyView) surveyView.hidden = false;
        mountTypeform();
    }

    function mountTypeform() {
        if (!modalEl) return;
        const mount = modalEl.querySelector('[data-payment-exit-typeform]');
        if (!mount) return;
        if (!mount.querySelector('[data-tf-live]')) {
            mount.innerHTML = `<div data-tf-live="${TYPEFORM_ID}"></div>`;
        }

        const existingScript = document.querySelector('script[data-payment-exit-typeform-script]');
        if (existingScript) {
            if (window.tf && typeof window.tf.load === 'function') window.tf.load();
            return;
        }

        const script = document.createElement('script');
        script.src = TYPEFORM_SCRIPT_SRC;
        script.async = true;
        script.dataset.paymentExitTypeformScript = 'true';
        document.body.appendChild(script);
    }

    function requestExit(action) {
        if (!shouldGuard()) {
            runExitAction(action);
            return;
        }
        openExitModal(action);
    }

    function shouldInterceptAnchor(anchor, event) {
        if (!anchor || event.defaultPrevented) return false;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
        if (anchor.target && anchor.target !== '_self') return false;
        if (anchor.hasAttribute('download')) return false;

        const href = anchor.getAttribute('href');
        if (!href || href === '#' || href.startsWith('#') || href.startsWith('javascript:')) return false;

        const targetUrl = new URL(href, window.location.href);
        const isSamePageHash = targetUrl.origin === window.location.origin
            && targetUrl.pathname === window.location.pathname
            && targetUrl.search === window.location.search
            && targetUrl.hash;
        return !isSamePageHash;
    }

    function attachClickListener() {
        if (clickListenerAttached) return;
        clickListenerAttached = true;
        document.addEventListener('click', (event) => {
            const backButton = event.target.closest('[data-payment-exit-back]');
            if (backButton) {
                event.preventDefault();
                const targetUrl = backButton.getAttribute('data-payment-exit-back') || config.backUrl || '/payment';
                requestExit(() => { window.location.href = targetUrl; });
                return;
            }

            const anchor = event.target.closest('a[href]');
            if (!shouldInterceptAnchor(anchor, event)) return;
            event.preventDefault();
            requestExit(() => { window.location.href = anchor.href; });
        }, true);
    }

    function armHistoryTrap() {
        if (historyTrapArmed) return;
        historyTrapArmed = true;
        history.pushState({ paymentExitGuard: true }, '', window.location.href);

        if (popListenerAttached) return;
        popListenerAttached = true;
        window.addEventListener('popstate', () => {
            if (!shouldGuard()) return;
            requestExit(() => { history.back(); });
        });
    }

    function init(options = {}) {
        config = {
            contactUrl: '/qna?source=payment_exit',
            ...options
        };
        ensureModal();
        attachClickListener();
        if (options.historyTrap) armHistoryTrap();
    }

    window.PaymentExitGuard = {
        init,
        armHistoryTrap,
        requestExit,
        allowNavigationOnce,
        close: closeExitModal
    };
})();

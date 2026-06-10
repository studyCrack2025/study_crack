(function () {
    const TYPEFORM_ID = '01KSFFXNN2R95QMDJC34YZAAYY';
    const TYPEFORM_SCRIPT_SRC = 'https://embed.typeform.com/next/embed.js';

    let config = {};
    let modalEl = null;
    let surveyEl = null;
    let pendingExitAction = null;
    let bypassUntil = 0;
    let historyTrapArmed = false;
    let clickListenerAttached = false;
    let popListenerAttached = false;

    function now() {
        return Date.now();
    }

    function shouldGuard() {
        if (now() < bypassUntil) return false;
        if (typeof config.isPaymentInProgress === 'function' && config.isPaymentInProgress()) return false;
        return typeof config.shouldGuard === 'function' ? !!config.shouldGuard() : true;
    }

    function allowNavigationOnce(durationMs = 1600) {
        bypassUntil = now() + durationMs;
    }

    function runExitAction(action) {
        allowNavigationOnce();
        closeExitModal({ skipRestore: true });
        closeSurveyOverlay({ skipRestore: true });
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
                    <h2 id="paymentExitTitle">잠깐만요, 나가기 전 할인 혜택을 받아가세요</h2>
                    <p class="payment-exit-copy">가격이나 이용 방식이 고민되셨다면 30초 설문에 남겨주세요. 설문 참여자에게 결제 부담을 줄일 수 있는 할인 혜택을 안내해드릴게요.</p>
                    <div class="payment-exit-actions">
                        <button type="button" class="payment-exit-primary" data-payment-exit-continue>계속 결제하기</button>
                        <button type="button" class="payment-exit-secondary" data-payment-exit-contact>궁금한 점 문의하기</button>
                        <button type="button" class="payment-exit-secondary" data-payment-exit-survey>설문 참여하고 할인 받기</button>
                        <button type="button" class="payment-exit-ghost" data-payment-exit-leave>그냥 나가기</button>
                    </div>
                </div>
            </div>
        `;
    }

    function getSurveyHtml() {
        return `
            <div class="payment-survey-panel" role="dialog" aria-modal="true" aria-label="결제 이탈 설문">
                <div class="payment-survey-head">
                    <p class="payment-survey-eyebrow">결제 이탈 설문</p>
                    <button type="button" class="payment-survey-close" data-payment-survey-close aria-label="설문 닫기">×</button>
                </div>
                <div class="payment-survey-typeform" data-payment-exit-typeform></div>
                <div class="payment-survey-actions">
                    <button type="button" class="payment-exit-primary" data-payment-survey-continue>계속 결제하기</button>
                    <button type="button" class="payment-exit-ghost" data-payment-survey-leave>설문 닫고 나가기</button>
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
                showSurveyOverlay();
                return;
            }

            if (event.target.closest('[data-payment-exit-leave]')) {
                runExitAction(pendingExitAction);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (surveyEl && !surveyEl.hasAttribute('hidden')) {
                closeSurveyOverlay();
                return;
            }
            if (modalEl && !modalEl.hasAttribute('hidden')) closeExitModal();
        });

        return modalEl;
    }

    function ensureSurveyOverlay() {
        if (surveyEl) return surveyEl;
        surveyEl = document.createElement('div');
        surveyEl.className = 'payment-survey-overlay';
        surveyEl.setAttribute('hidden', '');
        surveyEl.innerHTML = getSurveyHtml();
        document.body.appendChild(surveyEl);

        surveyEl.addEventListener('click', (event) => {
            if (event.target === surveyEl || event.target.closest('[data-payment-survey-close]') || event.target.closest('[data-payment-survey-continue]')) {
                closeSurveyOverlay();
                return;
            }

            if (event.target.closest('[data-payment-survey-leave]')) {
                runExitAction(pendingExitAction);
            }
        });

        return surveyEl;
    }

    function openExitModal(action) {
        ensureModal();
        pendingExitAction = action;
        modalEl.removeAttribute('hidden');
        document.body.classList.add('payment-exit-lock');
        const primaryButton = modalEl.querySelector('[data-payment-exit-continue]');
        if (primaryButton) primaryButton.focus();
    }

    function closeExitModal(options = {}) {
        if (!modalEl) return;
        modalEl.setAttribute('hidden', '');
        document.body.classList.remove('payment-exit-lock');
        if (!options.keepAction) pendingExitAction = null;
        if (!options.skipRestore) restoreHistoryTrapIfNeeded();
    }

    function showSurveyOverlay() {
        closeExitModal({ keepAction: true, skipRestore: true });
        ensureSurveyOverlay();
        surveyEl.removeAttribute('hidden');
        document.body.classList.add('payment-exit-lock');
        mountTypeform();
    }

    function closeSurveyOverlay(options = {}) {
        if (!surveyEl) return;
        surveyEl.setAttribute('hidden', '');
        document.body.classList.remove('payment-exit-lock');
        if (!options.keepAction) pendingExitAction = null;
        if (!options.skipRestore) restoreHistoryTrapIfNeeded();
    }

    function mountTypeform() {
        ensureSurveyOverlay();
        const mount = surveyEl.querySelector('[data-payment-exit-typeform]');
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

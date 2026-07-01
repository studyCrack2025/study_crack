(function() {
    const USER_API_URL = CONFIG.api.user;
    const TEAM_LABELS = { yonsei: '연세대 팀', korea: '고려대 팀' };
    const PROJECT_ID = 'kcc01';

    const TERMS = {
        kcc: {
            title: '연고전 프로젝트 참여 및 콘텐츠 활용 동의서',
            body: `연고전 프로젝트 참여 및 콘텐츠 활용 동의서

본인은 스터디크랙 × KCC 「연고전 프로젝트」에 자발적으로 참여하며, 아래 사항에 동의합니다.

1. 본 프로젝트 참여는 무료로 진행됩니다.
2. 프로젝트 진행 과정에서 사진, 영상, 음성, 화면 녹화 및 인터뷰 등이 촬영·기록될 수 있음에 동의합니다.
3. 촬영된 콘텐츠에는 본인의 얼굴, 음성, 이름(또는 닉네임), 학년, 목표 대학, 활동 내용 등이 포함될 수 있음에 동의합니다.
4. 촬영된 콘텐츠는 스터디크랙 및 KCC의 홍보·마케팅·브랜딩 목적으로 다음 채널에서 활용될 수 있음에 동의합니다.

* 유튜브(롱폼·쇼츠)
* 인스타그램(릴스·피드·스토리)
* 틱톡
* 스레드
* 네이버 블로그
* 공식 홈페이지 및 앱
* 기타 스터디크랙 및 KCC가 운영하는 공식 SNS 및 온라인 채널

5. 콘텐츠는 편집, 자막 삽입, 썸네일 제작, 일부 발췌 및 재가공될 수 있으며, 이에 동의합니다.
6. 본인은 본 프로젝트 참여 및 콘텐츠 활용에 대해 별도의 출연료나 저작권료를 요구하지 않습니다.
7. 본인은 본인의 초상, 음성 및 인터뷰 내용의 사용을 허락하며, 프로젝트 종료 후에도 이미 제작·게시된 콘텐츠는 삭제되지 않을 수 있음에 동의합니다.
8. 본인은 타인의 권리를 침해하거나 허위 사실을 포함한 자료를 제출하지 않으며, 이에 따른 책임은 본인에게 있습니다.
9. 본인은 언제든지 프로젝트 참여를 중단할 수 있으나, 중단 이전에 제작 및 게시된 콘텐츠는 법령상 삭제 의무가 있는 경우를 제외하고 계속 활용될 수 있음을 이해합니다.

□ 위 내용을 모두 확인하였으며 이에 동의합니다.`
        },
        marketing: {
            title: '마케팅 정보 수신 동의',
            body: `“스터디크랙”(이하 “회사”)는 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 및 「개인정보 보호법」 등 관계 법령에 따라 광고성 정보를 전송하기 위해 이용자의 사전 동의를 받고 있습니다.

1. 목적
- 이메일 및 문자(SMS/LMS)를 통한 광고성 정보 전송
- 스터디크랙 서비스, 이벤트, 혜택, 맞춤 입시 전략 및 합격 사례 안내

2. 이용 항목
- 휴대폰번호, 이메일주소

3. 보유 및 이용 기간
- 회원 탈퇴 또는 동의 철회 시까지

※ 본 동의는 선택 사항이며, 동의하지 않아도 서비스 이용에는 제한이 없습니다.
※ 이용자는 언제든지 수신 거부를 할 수 있습니다.`
        }
    };

    let selectedTeam = '';
    let alreadyClaimed = false;

    document.addEventListener('DOMContentLoaded', async () => {
        setupHeader();
        setupTeamSelection();
        setupConsentModal();
        setupTermModal();
        hydrateTeamFromQuery();
        await loadPromotionStatus();
        openModalFromReturnUrl();
    });

    function setupHeader() {
        const isLoggedIn = hasClientSession();
        toggleEl('navAnalysis', isLoggedIn, false);
        toggleEl('navQna', isLoggedIn, false);
        toggleEl('myPageBtn', isLoggedIn, false);
        toggleEl('logoutBtn', isLoggedIn, false);
        toggleEl('loginBtn', !isLoggedIn, false);
        toggleEl('mobileNavAnalysis', isLoggedIn, false);
        toggleEl('mobileNavQna', isLoggedIn, false);
        toggleEl('mobileMyPageBtn', isLoggedIn, false);
        toggleEl('mobileLogoutBtn', isLoggedIn, false);
        toggleEl('mobileLoginBtn', !isLoggedIn, false);

        const myPageBtn = document.getElementById('myPageBtn');
        if (myPageBtn) myPageBtn.href = '/mypage';
        bindLogout('logoutBtn');
        bindLogout('mobileLogoutBtn');

        const openBtn = document.getElementById('hamburgerBtn');
        const closeBtn = document.getElementById('mobileNavClose');
        const overlay = document.getElementById('mobileNavOverlay');
        const panel = document.getElementById('mobileNavPanel');
        const setOpen = (open) => {
            if (overlay) overlay.classList.toggle('show', open);
            if (panel) panel.classList.toggle('show', open);
            document.body.classList.toggle('modal-open', open);
        };
        if (openBtn) openBtn.addEventListener('click', () => setOpen(true));
        if (closeBtn) closeBtn.addEventListener('click', () => setOpen(false));
        if (overlay) overlay.addEventListener('click', () => setOpen(false));
    }

    function toggleEl(id, show, useDisplay = true) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('hidden', !show);
        if (useDisplay) el.style.display = show ? '' : 'none';
    }

    function bindLogout(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', async (e) => {
            e.preventDefault();
            if (typeof performClientLogout === 'function') {
                await performClientLogout('/login');
            } else {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/login';
            }
        });
    }

    function setupTeamSelection() {
        document.querySelectorAll('.team-card').forEach((card) => {
            card.addEventListener('click', () => selectTeam(card.dataset.team));
        });
        const claimBtn = document.getElementById('claimBtn');
        if (claimBtn) claimBtn.addEventListener('click', handleClaimClick);
    }

    function hydrateTeamFromQuery() {
        const params = new URLSearchParams(window.location.search);
        const team = params.get('team');
        if (TEAM_LABELS[team]) selectTeam(team);
    }

    function selectTeam(team) {
        if (!TEAM_LABELS[team]) return;
        selectedTeam = team;
        document.querySelectorAll('.team-card').forEach((card) => {
            const selected = card.dataset.team === team;
            card.classList.toggle('selected', selected);
            card.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        renderModalTeamState();
        renderClaimState();
    }

    function renderModalTeamState() {
        document.querySelectorAll('[data-consent-team]').forEach((btn) => {
            const selected = btn.dataset.consentTeam === selectedTeam;
            btn.classList.toggle('selected', selected);
            btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        updateSubmitState();
    }

    function renderClaimState() {
        const status = document.getElementById('claimStatus');
        const btn = document.getElementById('claimBtn');
        if (!status || !btn) return;

        if (alreadyClaimed) {
            status.textContent = '이미 KCC 연고전 프로젝트 혜택을 받았습니다.';
            btn.textContent = '이미 받았습니다';
            btn.disabled = true;
            btn.classList.add('claimed');
            return;
        }

        btn.classList.remove('claimed');
        btn.textContent = '튜터링 신청하기';
        if (!selectedTeam) {
            status.textContent = '팀을 선택하면 튜터링 신청을 진행할 수 있습니다.';
            btn.disabled = true;
            return;
        }
        status.textContent = `${TEAM_LABELS[selectedTeam]}으로 신청합니다. 로그인 후 동의 절차를 완료하면 혜택이 지급됩니다.`;
        btn.disabled = false;
    }

    async function loadPromotionStatus() {
        if (!hasClientSession()) {
            renderClaimState();
            return;
        }
        try {
            await tryRefreshToken();
            const res = await apiFetch(USER_API_URL, {
                method: 'POST',
                body: JSON.stringify({ type: 'get_user_payment' })
            });
            const data = await res.json();
            const claim = data && data.promotionClaims && data.promotionClaims[PROJECT_ID];
            alreadyClaimed = !!claim;
            renderClaimState();
        } catch (error) {
            if (error && error.code === 'AUTH_EXPIRED') return;
            renderClaimState();
        }
    }

    function handleClaimClick() {
        if (alreadyClaimed || !selectedTeam) return;
        if (!hasClientSession()) {
            redirectToClaimLogin();
            return;
        }
        openConsentModal();
    }

    function redirectToClaimLogin(message = '튜터링 신청을 위해 로그인이 필요합니다.') {
        const teamParam = selectedTeam ? `&team=${encodeURIComponent(selectedTeam)}` : '';
        const returnUrl = `/promotion/kcc01?claim=1${teamParam}`;
        if (typeof clearClientSession === 'function') clearClientSession();
        alert(message);
        window.location.href = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
    }

    function openModalFromReturnUrl() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('claim') !== '1') return;
        if (!selectedTeam || alreadyClaimed || !hasClientSession()) return;
        openConsentModal();
        params.delete('claim');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
        window.history.replaceState({}, document.title, nextUrl);
    }

    function setupConsentModal() {
        const modal = document.getElementById('consentModal');
        const contentConsent = document.getElementById('contentConsent');
        const submitBtn = document.getElementById('submitClaimBtn');
        if (!modal || !contentConsent || !submitBtn) return;

        document.querySelectorAll('[data-consent-team]').forEach((btn) => {
            btn.addEventListener('click', () => selectTeam(btn.dataset.consentTeam));
        });
        contentConsent.addEventListener('change', updateSubmitState);
        submitBtn.addEventListener('click', submitClaim);
        modal.querySelectorAll('[data-close-modal]').forEach((btn) => btn.addEventListener('click', closeConsentModal));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeConsentModal();
        });
    }

    function updateSubmitState() {
        const contentConsent = document.getElementById('contentConsent');
        const submitBtn = document.getElementById('submitClaimBtn');
        if (!submitBtn) return;
        submitBtn.disabled = !selectedTeam || !contentConsent || !contentConsent.checked;
    }

    function openConsentModal() {
        const modal = document.getElementById('consentModal');
        const contentConsent = document.getElementById('contentConsent');
        const marketingConsent = document.getElementById('marketingConsent');
        const submitBtn = document.getElementById('submitClaimBtn');
        if (!modal) return;
        if (contentConsent) contentConsent.checked = false;
        if (marketingConsent) marketingConsent.checked = false;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '동의하고 혜택 받기';
        }
        renderModalTeamState();
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }

    function closeConsentModal() {
        const modal = document.getElementById('consentModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        if (document.getElementById('termModal')?.classList.contains('hidden')) {
            document.body.classList.remove('modal-open');
        }
    }

    function setupTermModal() {
        document.querySelectorAll('[data-term]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openTermModal(btn.dataset.term);
            });
        });
        const modal = document.getElementById('termModal');
        if (!modal) return;
        modal.querySelectorAll('[data-close-term]').forEach((btn) => btn.addEventListener('click', closeTermModal));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeTermModal();
        });
    }

    function openTermModal(key) {
        const detail = TERMS[key];
        const modal = document.getElementById('termModal');
        const title = document.getElementById('termTitle');
        const body = document.getElementById('termBody');
        if (!detail || !modal || !title || !body) return;
        title.textContent = detail.title;
        body.textContent = detail.body;
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }

    function closeTermModal() {
        const modal = document.getElementById('termModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        if (document.getElementById('consentModal')?.classList.contains('hidden')) {
            document.body.classList.remove('modal-open');
        }
    }

    async function submitClaim() {
        const contentConsent = document.getElementById('contentConsent');
        const marketingConsent = document.getElementById('marketingConsent');
        const submitBtn = document.getElementById('submitClaimBtn');
        if (!selectedTeam || !contentConsent || !contentConsent.checked) return;

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '혜택 지급 중...';
        }

        try {
            await tryRefreshToken();
            const res = await apiFetch(USER_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'claim_kcc_promotion',
                    data: {
                        projectId: PROJECT_ID,
                        team: selectedTeam,
                        contentConsent: true,
                        marketingAgreed: marketingConsent && marketingConsent.checked === true
                    }
                })
            });
            const result = await res.json();
            if (result && result.alreadyClaimed) {
                alreadyClaimed = true;
                closeConsentModal();
                renderClaimState();
                alert('이미 지급받은 프로모션입니다.');
                return;
            }
            window.location.href = `/success?tier=standard&status=promo&source=${encodeURIComponent(PROJECT_ID)}&team=${encodeURIComponent(selectedTeam)}`;
        } catch (error) {
            if (error && error.code === 'AUTH_EXPIRED') {
                redirectToClaimLogin('로그인이 만료되었습니다. 다시 로그인하면 신청을 이어갈 수 있습니다.');
                return;
            }
            const msg = error && error.message ? error.message : '신청 처리 중 오류가 발생했습니다.';
            alert(msg);
            if (submitBtn) {
                submitBtn.textContent = '동의하고 혜택 받기';
                updateSubmitState();
            }
        }
    }
})();

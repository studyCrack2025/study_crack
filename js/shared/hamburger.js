// hamburger.js — 모바일 햄버거 메뉴 공통 모듈
// 모든 페이지에서 #hamburgerBtn 이 존재하면 자동 활성화됩니다.

window.openMobileNav = function() {
    const panel = document.getElementById('mobileNavPanel');
    const overlay = document.getElementById('mobileNavOverlay');
    const btn = document.getElementById('hamburgerBtn');
    if (!panel) return;
    overlay.style.display = 'block';
    requestAnimationFrame(() => {
        panel.classList.add('active');
        overlay.classList.add('active');
        if (btn) btn.classList.add('open');
    });
    document.body.style.overflow = 'hidden';
};

window.closeMobileNav = function() {
    const panel = document.getElementById('mobileNavPanel');
    const overlay = document.getElementById('mobileNavOverlay');
    const btn = document.getElementById('hamburgerBtn');
    if (panel) panel.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    if (btn) btn.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
        if (overlay && !overlay.classList.contains('active')) overlay.style.display = 'none';
    }, 280);
};

document.addEventListener('DOMContentLoaded', () => {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    if (!hamburgerBtn) return;

    hamburgerBtn.addEventListener('click', openMobileNav);
    document.getElementById('mobileNavClose')?.addEventListener('click', closeMobileNav);
    document.getElementById('mobileNavOverlay')?.addEventListener('click', closeMobileNav);

    // 로그아웃 버튼 (static 페이지용 — handleSignOut이 없을 때 fallback)
    const mobileLogout = document.getElementById('mobileLogoutBtn');
    if (mobileLogout && !mobileLogout.dataset.bound) {
        mobileLogout.dataset.bound = '1';
        mobileLogout.addEventListener('click', (e) => {
            e.preventDefault();
            closeMobileNav();
            if (typeof handleSignOut === 'function') {
                handleSignOut();
            } else {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/';
            }
        });
    }
});

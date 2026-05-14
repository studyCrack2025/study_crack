if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('site-header');
  if (header) header.classList.add('scrolled');
  syncHeaderNav();

  // 모바일: 플랜 슬라이더 기본값 STANDARD(두 번째)
  if (window.innerWidth <= 640) {
    const planGrid = document.querySelector('.plan-grid');
    const planCards = planGrid ? planGrid.querySelectorAll('.plan-card') : [];
    if (planCards.length >= 2) {
      setTimeout(() => {
        const card = planCards[1];
        planGrid.scrollTo({ left: card.offsetLeft - (planGrid.clientWidth - card.offsetWidth) / 2, behavior: 'instant' });
      }, 0);
    }
  }

  // Scroll reveal animation
  // 모바일에서 plan-card는 가로 슬라이더 안에 있어 IntersectionObserver가 제대로 작동하지 않으므로 제외
  const isMobile = window.innerWidth <= 640;
  const revealSelector = isMobile
    ? '.process-card, .formula-item, .message-band'
    : '.process-card, .plan-card, .formula-item, .message-band';
  const reveals = document.querySelectorAll(revealSelector);
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = entry.target.style.transform.replace('translateY(24px)', 'translateY(0)');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    io.observe(el);
  });
});

function syncHeaderNav() {
  const isLoggedIn = !!localStorage.getItem('userId');
  const btnAnalysis = document.getElementById('navAnalysis');
  const btnQna = document.getElementById('navQna');
  const btnLogin = document.getElementById('loginBtn');
  const btnMyPage = document.getElementById('myPageBtn');
  const btnLogout = document.getElementById('logoutBtn');

  if (isLoggedIn) {
    if (btnAnalysis) btnAnalysis.classList.remove('hidden');
    if (btnQna) btnQna.classList.remove('hidden');
    if (btnMyPage) btnMyPage.classList.remove('hidden');
    if (btnLogout) btnLogout.classList.remove('hidden');
    if (btnLogin) btnLogin.classList.add('hidden');
  }

  // 모바일 햄버거 패널 링크 동기화
  const mobileAnalysis = document.getElementById('mobileNavAnalysis');
  const mobileQna      = document.getElementById('mobileNavQna');
  const mobileLogin    = document.getElementById('mobileLoginBtn');
  const mobileMyPage   = document.getElementById('mobileMyPageBtn');
  const mobileLogout   = document.getElementById('mobileLogoutBtn');
  if (isLoggedIn) {
    if (mobileAnalysis) mobileAnalysis.classList.remove('hidden');
    if (mobileQna)      mobileQna.classList.remove('hidden');
    if (mobileMyPage)   mobileMyPage.classList.remove('hidden');
    if (mobileLogout)   mobileLogout.classList.remove('hidden');
    if (mobileLogin)    mobileLogin.classList.add('hidden');
  } else {
    if (mobileAnalysis) mobileAnalysis.classList.add('hidden');
    if (mobileQna)      mobileQna.classList.add('hidden');
    if (mobileMyPage)   mobileMyPage.classList.add('hidden');
    if (mobileLogout)   mobileLogout.classList.add('hidden');
    if (mobileLogin)    mobileLogin.classList.remove('hidden');
  }

  if (btnMyPage) {
    btnMyPage.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/mypage';
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    });
  }

  if (mobileMyPage) {
    mobileMyPage.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/mypage';
    });
  }
}

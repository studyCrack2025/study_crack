document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('site-header');
  if (header) header.classList.add('scrolled');
  syncHeaderNav();

  // Scroll reveal animation
  const reveals = document.querySelectorAll('.process-card, .plan-card, .formula-item, .message-band');
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
}

// js/script.js

/* =========================================
   1. 전역 설정 및 유틸리티
   ========================================= */
const AUTH_API_URL = CONFIG.api.auth;
const NOTI_API_URL = CONFIG.api.noti;

// 점수 상승 시뮬레이션 토글
function toggleScoreUp(btnEl) {
    const barItem = document.getElementById('simScoreUpBar');
    if (!barItem) return;

    const bar = barItem.querySelector('.sim-preview-bar');
    const extBar = barItem.querySelector('.sim-ext-bar');
    const scoreLabel = barItem.querySelector('.sim-preview-score');
    const toggleBtn = btnEl || document.querySelector('.sim-score-up-btn');

    const isUp = barItem.classList.toggle('score-up-active');
    if (isUp) {
        if (bar) bar.style.borderRadius = '0';
        if (extBar) {
            extBar.style.height = '10.5%';
            extBar.style.opacity = '1';
        }
        if (scoreLabel) scoreLabel.style.opacity = '0';
    } else {
        if (bar) bar.style.borderRadius = '';
        if (extBar) {
            extBar.style.height = '0';
            extBar.style.opacity = '0';
        }
        if (scoreLabel) scoreLabel.style.opacity = '1';
    }

    if (toggleBtn) toggleBtn.classList.toggle('is-active', isUp);
}

// apiFetch는 shared/api.js 의 단일 구현 사용

function openModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(type) {
    const modal = document.getElementById(type + '-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

/* =========================================
   2. 커리큘럼 탭 로직 (기존 코드 유지)
   ========================================= */
const COURSE_DATA = {
    basic: { title: "BASIC PLAN", price: `<span class="original-price">49,000원</span> <span class="discount-price">특별 할인가 <strong class="highlight-price">25,000원</strong></span>`, desc: "내 점수와 목표 대학 합격선 사이의 거리를 정밀하게 진단합니다.", list: [ { text: "개인 성적 및 목표 대학 환산점수 계산 (최대 18개)" }, { text: "합격 컷 대비 거리 분석 (위험도 경고)", action: "preview", imgBase: "feat_basic_1" }, { text: "목표 대학별 '효자 과목' 발굴" }, { text: "과목별 1점당 환산 기울기(효율) 계산" }, { text: "현재 점수 기준 목표 대학 위치 진단" }, { text: "현재 성적 및 학습 성향 바탕 목표 대학 합격컷 도달 위한 목표 성적 제시" }, { text: "내 점수에 가장 유리한 대학 역추적" } ], bg: "assets/backgrounds/bg_basic.png", themeColor: "#059669" },
    starter: { title: "STARTER PLAN", price: "39,000원", desc: "SKY 튜터의 1회 플래너 피드백으로 학습 방향을 점검합니다.", list: [ { text: "Basic 기능 모두 포함" }, { text: "SKY 튜터 1회 플래너 피드백" }, { text: "과목별 시간 배분 점검" }, { text: "목표 대학 기준 우선순위 제안" }, { text: "다음 1주 플래너 제시" } ], bg: "assets/backgrounds/bg_mbti.png", themeColor: "#8B5CF6" },
    standard: { title: "STANDARD PLAN", price: `<span class="original-price">정가 37,250원 / 주</span> <span class="discount-price">특별 할인가 <strong class="highlight-price">12,250원</strong> / 주</span>`, desc: "매주 SKY 튜터의 플래너 피드백으로 학습을 체계적으로 관리합니다.", list: [ { text: "Basic 기능 모두 포함" }, { text: "점수 상승 시뮬레이션 제공" }, { text: "SKY 튜터 주 1회 플래너 피드백" }, { text: "과목별 시간 배분 점검" }, { text: "목표 대학 기준 우선순위 제안" }, { text: "매주 플래너 제시" } ], bg: "assets/backgrounds/bg_standard.png", themeColor: "#2563EB" },
    pro: { title: "PRO PLAN", price: `<span class="original-price">정가 74,750원 / 주</span> <span class="discount-price">특별 할인가 <strong class="highlight-price">37,250원</strong> / 주</span>`, desc: "STANDARD의 모든 기능에 정밀 분석과 심화 전략을 더합니다.", list: [ { text: "STANDARD 모든 기능 포함" }, { text: "현재 성적 및 학습 성향 바탕 목표 대학 합격컷 도달 위한 목표 성적 정밀 제시" }, { text: "내 점수에 가장 유리한 대학 정밀 역추적" }, { text: "상향 지원 중장기 로드맵" }, { text: "심화 합격 전략 리포트" }, { text: "학부모 공유용 전략 리포트" }, { text: "조건부 환급 혜택 제공" }, { text: "PRO 전용 보고서 미리보기 📄", action: "download", file: "assets/features/feat_pro_report.pdf" } ], bg: "assets/backgrounds/bg_pro.png", themeColor: "#E11D48" }
};

function initMobileCourses() {
    document.querySelectorAll('.course-tab-btn').forEach(btn => {
        const iconHtml = btn.querySelector('.tab-icon')?.outerHTML || '';
        const infoHtml = btn.querySelector('.tab-info')?.outerHTML || '';

        btn.innerHTML = `
            <div class="tab-summary-wrap">
                ${iconHtml}
                ${infoHtml}
            </div>
        `;
    });
}

function selectCourse(tier, noScroll = false) {
    const data = COURSE_DATA[tier];
    if (!data) return;

    const isMobile = window.innerWidth <= 900;
    const activeBtn = document.querySelector(`.course-tab-btn[data-tier="${tier}"]`);

    const overlay = document.querySelector('.curriculum-bg-overlay');
    if (overlay) overlay.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url('${data.bg}')`;
    closeFeaturePreview();

    if (isMobile) {
        const mobileDetail = document.getElementById('mobileCourseDetail');
        if (activeBtn.classList.contains('active-expand')) {
            activeBtn.classList.remove('active-expand', 'active');
            if (mobileDetail) { mobileDetail.innerHTML = ''; mobileDetail.style.display = 'none'; }
        } else {
            document.querySelectorAll('.course-tab-btn').forEach(btn => btn.classList.remove('active-expand', 'active'));
            activeBtn.classList.add('active-expand', 'active');
            if (mobileDetail) {
                const listHtml = data.list.map(item => {
                    const checkColor = '#4ade80';
                    if (item.action) {
                        let clickHandler = "";
                        if (item.action === "preview") clickHandler = `onclick="openFeaturePreview('${item.imgBase}', '${item.text}')"`;
                        else if (item.action === "download") clickHandler = `onclick="downloadProReport('${item.file}')"`;
                        return `<li class="clickable-item" ${clickHandler}><i class="fas fa-check-circle" style="color:${checkColor}"></i><span>${item.text}</span></li>`;
                    } else {
                        return `<li><i class="fas fa-check-circle" style="color:${checkColor}"></i><span>${item.text}</span></li>`;
                    }
                }).join('');
                let extraBtnHtml = "";
                if (tier === 'mbti') {
                    extraBtnHtml = `<span class="solution-cta-link solution-cta-link--disabled" aria-disabled="true">맞춤 공부법 PDF 준비 중</span>`;
                }
                mobileDetail.innerHTML = `
                    <span class="detail-badge">${tier.toUpperCase()}</span>
                    <h3 class="detail-title">${data.title}</h3>
                    <div class="detail-price">${data.price}</div>
                    <p class="detail-desc">${data.desc}</p>
                    <ul class="detail-list">${listHtml}</ul>
                    ${extraBtnHtml}
                `;
                mobileDetail.style.display = 'block';
                if (!noScroll) setTimeout(() => mobileDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
            }
        }
    } else {
        document.querySelectorAll('.course-tab-btn').forEach(btn => btn.classList.remove('active', 'active-expand'));
        if(activeBtn) activeBtn.classList.add('active', 'active-expand');

        const detailView = document.getElementById('courseDetailView');
        if (detailView) {
            const listHtml = data.list.map(item => {
                const checkColor = data.themeColor;
                if (item.action) {
                    let clickHandler = "";
                    if (item.action === "preview") clickHandler = `onclick="openFeaturePreview('${item.imgBase}', '${item.text}')"`;
                    else if (item.action === "download") clickHandler = `onclick="downloadProReport('${item.file}')"`;
                    return `
                        <li class="clickable-item" ${clickHandler} title="클릭하여 확인하기">
                            <i class="fas fa-check-circle" style="color:${checkColor}"></i>
                            <span>${item.text}</span>
                            <i class="fas fa-external-link-alt" style="font-size: 0.7em; margin-left: 5px; opacity: 0.7;"></i>
                        </li>
                    `;
                } else {
                    return `
                        <li>
                            <i class="fas fa-check-circle" style="color:${checkColor}"></i>
                            <span>${item.text}</span>
                        </li>
                    `;
                }
            }).join('');

            let extraBtnHtml = "";
            if (tier === 'mbti') {
                extraBtnHtml = `<span class="solution-cta-link solution-cta-link--disabled" aria-disabled="true">맞춤 공부법 PDF 준비 중</span>`;
            }

            detailView.innerHTML = `
                <span class="detail-badge">${tier.toUpperCase()}</span>
                <h3 class="detail-title">${data.title}</h3>
                <div class="detail-price">${data.price}</div>
                <p class="detail-desc">${data.desc}</p>
                <ul class="detail-list">${listHtml}</ul>
                ${extraBtnHtml}
            `;
        }
    }
}

function openFeaturePreview(imgBase, title) {
    const panel = document.getElementById('featurePreviewPanel');
    const previewTitle = document.getElementById('previewTitle');
    const imgWrapper = document.querySelector('.preview-img-wrapper');

    if (!panel || !imgWrapper) return;

    imgWrapper.innerHTML = '<img id="previewImage" src="" alt="기능 예시 이미지" style="width:100%; height:100%; object-fit:contain;">';
    const previewImg = document.getElementById('previewImage');
    const isMobile = window.innerWidth <= 900;
    
    let imgPath = "";
    if (isMobile) {
        const parts = imgBase.split('_');
        const number = parts.pop(); 
        const base = parts.join('_'); 
        imgPath = `assets/features/${base}_mobile_${number}.png`;
    } else {
        imgPath = `assets/features/${imgBase}.png`;
    }

    if(previewTitle) previewTitle.innerText = title;

    previewImg.onerror = function() {
        imgWrapper.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:rgba(255,255,255,0.5); gap:15px;">
                <i class="fas fa-image" style="font-size:3rem;"></i>
                <span style="font-size:0.95rem;">이미지를 준비 중입니다.</span>
            </div>
        `;
    };

    previewImg.src = imgPath;
    panel.classList.add('active');
}

function closeFeaturePreview() {
    const panel = document.getElementById('featurePreviewPanel');
    if (panel) panel.classList.remove('active');
}

function downloadProReport(filePath) {
    if (confirm("PRO 전용 분석 보고서 샘플을 다운로드 하시겠습니까?")) {
        const link = document.createElement('a');
        link.href = filePath;
        link.download = 'StudyCrack_Pro_Report_Sample.pdf'; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

/* =========================================
   3. 후기 데이터 로직 (기존 유지)
   ========================================= */
async function getUserReviews() {
    try {
        const response = await apiFetch(AUTH_API_URL, { method: 'POST', body: JSON.stringify({ type: 'get_user_reviews' }) });
        const data = await response.json();
        if (Array.isArray(data)) return data; 
        if (data.body) {
            const parsedBody = JSON.parse(data.body);
            if (Array.isArray(parsedBody)) return parsedBody;
        }
        return [];
    } catch (error) {
        return []; 
    }
}

async function renderReviews() {
    const container = document.getElementById('reviewContainer');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center;">후기를 불러오는 중...</p>';
    const fallbackReviews = [
        { univ: '광운대 자율전공학부', name: '구*우', content: '기존에는 진학사를 보면서 감으로 기준을 잡았습니다. 컨설팅 후에는 제 점수가 어디에 유리한지 구조적으로 이해하게 됐습니다.' },
        { univ: '경희대, 건국대, 한국외대', name: '구*우', content: '막연한 안정 지원이 아니라, 왜 안정인지 설명할 수 있는 지원을 하게 됐습니다.' },
        { univ: '고려대, 중앙대', name: '구*우', content: '컨설팅을 통해 감정이 아닌 구조로 기준을 다시 세우고, 확신을 가지고 지원했습니다.' },
        { univ: '광운대 자율전공학부', name: '구*우', content: '학과 정보와 실제 예상 합격률을 분석받은 순간, 불안이 확신으로 바뀌었습니다.' },
        { univ: '광운대 자율전공학부', name: '구*우', content: '왜 이 선택이 유리한지 구조적으로 설명해주셔서 납득하고 지원할 수 있었습니다.' },
        { univ: '광운대 자율전공학부', name: '구*우', content: '제 점수가 어디에 유리한지 구조적으로 이해하게 됐고, 대학 라인이 달라졌습니다.' }
    ];
    const fetchedReviews = await getUserReviews();
    const reviews = fetchedReviews.length > 0 ? fetchedReviews : fallbackReviews;

    container.innerHTML = reviews.map((review, index) => `
        <div class="review-card${index === 0 ? ' featured' : ''}">
            <div class="review-header">
                <span class="review-badge">${escapeHtml(review.univ)}</span>
                <span class="review-score">${index === 0 ? '★★★★☆' : '★★★★★'}</span>
            </div>
            <p class="review-text">"${escapeHtml(review.content)}"</p>
            <div class="review-author">
                <div class="review-info">
                    <div>${escapeHtml(review.name)}</div>
                </div>
            </div>
        </div>
    `).join('');

    initReviewIndicators();
}

/* =========================================
   4. 인터랙티브 데모 로직
   ========================================= */
window.nextDemoStep = function(stepNumber) {
    document.querySelectorAll('.demo-step').forEach(el => el.classList.remove('active'));
    const nextStep = document.getElementById('demoStep' + stepNumber);
    if (nextStep) {
        nextStep.classList.add('active');
        nextStep.style.animation = 'none';
        nextStep.offsetHeight; 
        nextStep.style.animation = 'slideUp 0.4s ease-out';
    }
};

window.cycleResultView = function() {
    const activeSlide = document.querySelector('.result-slide.active');
    let currentId = 1;
    if (activeSlide) {
        currentId = parseInt(activeSlide.id.replace('resultView', ''));
        activeSlide.classList.remove('active');
    }
    let nextId = currentId + 1;
    if (nextId > 3) nextId = 1;
    const nextSlide = document.getElementById('resultView' + nextId);
    if (nextSlide) nextSlide.classList.add('active');
};

/* =========================================
   5. 페이지 초기화 및 이벤트 리스너
   ========================================= */
// 브라우저 자동 스크롤 복원 비활성화 → 항상 최상단에서 시작
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

document.addEventListener('DOMContentLoaded', () => {
    // 권한 체크
    const userRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName') || '회원';

    if (localStorage.getItem('userId') && userRole) {
        if (userRole === 'tutor') {
            alert(`${userName} 선생님 페이지로 이동합니다.`);
            window.location.href = '/mypage/tutor';
            return;
        } else if (userRole === 'admin') {
            alert("관리자 페이지로 이동합니다.");
            window.location.href = '/admin';
            return;
        }
    }

    updateNavUI();
    renderReviews();
    initMobileCourses();
    selectCourse('basic', true);
    initPptCardSlider();
    initEffectsSlider();

    const myPageBtn = document.getElementById('myPageBtn');
    if (myPageBtn) {
        myPageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const userId = localStorage.getItem('userId');
            if (!userId) {
                alert("로그인이 필요합니다.");
                window.location.href = '/login';
            } else {
                window.location.href = '/mypage';
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (typeof performClientLogout === 'function') {
                await performClientLogout('/');
                return;
            }
            clearClientSession();
            alert("로그아웃 되었습니다.");
            window.location.replace('/');
        });
    }

    // 햄버거 메뉴
    document.getElementById('hamburgerBtn')?.addEventListener('click', openMobileNav);
    document.getElementById('mobileNavClose')?.addEventListener('click', closeMobileNav);
    document.getElementById('mobileNavOverlay')?.addEventListener('click', closeMobileNav);
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        closeMobileNav();
        if (typeof performClientLogout === 'function') {
            await performClientLogout('/');
            return;
        }
        clearClientSession();
        alert("로그아웃 되었습니다.");
        window.location.replace('/');
    });
    document.getElementById('mobileMyPageBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileNav();
        const userId = localStorage.getItem('userId');
        if (!userId) { alert("로그인이 필요합니다."); window.location.href = '/login'; }
        else window.location.href = '/mypage';
    });

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.scroll-reveal').forEach(el => {
        // 이미 뷰포트 안에 있는 요소는 즉시 표시 (초기 로딩 흔들림 방지)
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add('visible');
        } else {
            observer.observe(el);
        }
    });

    // 튜토리얼 강제 체크는 auth.js resolveUserIdentity()에서 전역 처리
});

function updateNavUI() {
    const isLoggedIn = !!localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');

    const btnAnalysis = document.getElementById('navAnalysis');
    const btnQna = document.getElementById('navQna');
    const btnLogin = document.getElementById('loginBtn');
    const btnMyPage = document.getElementById('myPageBtn');
    const btnLogout = document.getElementById('logoutBtn');
    const btnNoti = document.getElementById('studentNotiFab');

    // mobile nav panel elements
    const mobileAnalysis = document.getElementById('mobileNavAnalysis');
    const mobileQna = document.getElementById('mobileNavQna');
    const mobileLogin = document.getElementById('mobileLoginBtn');
    const mobileMyPage = document.getElementById('mobileMyPageBtn');
    const mobileLogout = document.getElementById('mobileLogoutBtn');

    if (isLoggedIn) {
        if (btnAnalysis) btnAnalysis.classList.remove('hidden');
        if (btnQna) btnQna.classList.remove('hidden');
        if (btnMyPage) btnMyPage.classList.remove('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');
        if (btnLogin) btnLogin.classList.add('hidden');
        if (mobileAnalysis) mobileAnalysis.classList.remove('hidden');
        if (mobileQna) mobileQna.classList.remove('hidden');
        if (mobileMyPage) mobileMyPage.classList.remove('hidden');
        if (mobileLogout) mobileLogout.classList.remove('hidden');
        if (mobileLogin) mobileLogin.classList.add('hidden');
        if (userRole !== 'admin' && userRole !== 'tutor') {
            if (btnNoti) {
                btnNoti.classList.remove('hidden');
                fetchStudentNotifications();
            }
        }
    } else {
        if (btnAnalysis) btnAnalysis.classList.add('hidden');
        if (btnQna) btnQna.classList.add('hidden');
        if (btnMyPage) btnMyPage.classList.add('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
        if (btnLogin) btnLogin.classList.remove('hidden');
        if (mobileAnalysis) mobileAnalysis.classList.add('hidden');
        if (mobileQna) mobileQna.classList.add('hidden');
        if (mobileMyPage) mobileMyPage.classList.add('hidden');
        if (mobileLogout) mobileLogout.classList.add('hidden');
        if (mobileLogin) mobileLogin.classList.remove('hidden');
        if (btnNoti) btnNoti.classList.add('hidden');
    }
}

/* ── 햄버거 모바일 내비게이션 ── */
window.openMobileNav = function() {
    const panel = document.getElementById('mobileNavPanel');
    const overlay = document.getElementById('mobileNavOverlay');
    const btn = document.getElementById('hamburgerBtn');
    if (!panel) return;
    overlay.style.display = 'block';
    requestAnimationFrame(() => {
        panel.classList.add('active');
        overlay.classList.add('active');
        btn?.classList.add('open');
    });
    document.body.style.overflow = 'hidden';
};

window.closeMobileNav = function() {
    const panel = document.getElementById('mobileNavPanel');
    const overlay = document.getElementById('mobileNavOverlay');
    const btn = document.getElementById('hamburgerBtn');
    panel?.classList.remove('active');
    overlay?.classList.remove('active');
    btn?.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { if (overlay && !overlay.classList.contains('active')) overlay.style.display = 'none'; }, 280);
};

/* ── 수평 슬라이더 스크롤 헬퍼 (페이지 수직 스크롤 없이 컨테이너만 이동) ── */
function scrollSliderTo(container, item, smooth) {
    if (!container || !item) return;
    const left = item.offsetLeft - (container.clientWidth - item.offsetWidth) / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'instant' });
}

/* ── PPT 카드 슬라이더 (모바일) ── */
function initPptCardSlider() {
    const grid = document.querySelector('.card-grid--three');
    const indicatorsEl = document.getElementById('pptIndicators');
    if (!grid || !indicatorsEl || window.innerWidth > 640) return;

    const cards = grid.querySelectorAll('.ppt-card');
    const bgImg = document.querySelector('.dark-feature .bg-img');
    if (cards.length === 0) return;

    const cardImages = Array.from(cards).map(card => {
        const img = card.querySelector('.ppt-card-img img');
        return img ? img.getAttribute('src') : null;
    });

    const pptInitIdx = Math.min(1, cards.length - 1);

    indicatorsEl.innerHTML = Array.from({length: cards.length}, (_, i) =>
        `<button class="review-dot${i === pptInitIdx ? ' active' : ''}" data-idx="${i}" aria-label="카드 ${i+1}번"></button>`
    ).join('');

    if (bgImg && cardImages[pptInitIdx]) bgImg.src = cardImages[pptInitIdx];
    setTimeout(() => { scrollSliderTo(grid, cards[pptInitIdx], false); }, 0);

    indicatorsEl.querySelectorAll('.review-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            scrollSliderTo(grid, cards[parseInt(dot.dataset.idx)], true);
        });
    });

    let scrollTimer;
    grid.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            const cardWidth = (cards[0]?.offsetWidth || 0) + 14;
            const idx = Math.max(0, Math.min(Math.round(grid.scrollLeft / cardWidth), cards.length - 1));
            indicatorsEl.querySelectorAll('.review-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
            if (bgImg && cardImages[idx]) bgImg.src = cardImages[idx];
        }, 60);
    }, { passive: true });
}

/* ── 기대효과 슬라이더 (모바일) ── */
function initEffectsSlider() {
    const grid = document.querySelector('.effects-grid');
    const indicatorsEl = document.getElementById('effectsIndicators');
    if (!grid || !indicatorsEl || window.innerWidth > 640) return;

    const items = grid.querySelectorAll('.effect-item');
    if (items.length === 0) return;

    const effInitIdx = Math.min(1, items.length - 1);

    indicatorsEl.innerHTML = Array.from({length: items.length}, (_, i) =>
        `<button class="review-dot${i === effInitIdx ? ' active' : ''}" data-idx="${i}" aria-label="효과 ${i+1}번"></button>`
    ).join('');

    setTimeout(() => { scrollSliderTo(grid, items[effInitIdx], false); }, 0);

    indicatorsEl.querySelectorAll('.review-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            scrollSliderTo(grid, items[parseInt(dot.dataset.idx)], true);
        });
    });

    let scrollTimer;
    grid.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            const itemWidth = (items[0]?.offsetWidth || 0) + 14;
            const idx = Math.max(0, Math.min(Math.round(grid.scrollLeft / itemWidth), items.length - 1));
            indicatorsEl.querySelectorAll('.review-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
        }, 60);
    }, { passive: true });
}

/* ── 후기 인디케이터 ── */
function initReviewIndicators() {
    const grid = document.getElementById('reviewContainer');
    const indicatorsEl = document.getElementById('reviewIndicators');
    if (!grid || !indicatorsEl || window.innerWidth > 640) return;

    const cards = grid.querySelectorAll('.review-card');
    if (cards.length === 0) return;

    const revInitIdx = Math.min(1, cards.length - 1);

    indicatorsEl.innerHTML = Array.from({length: cards.length}, (_, i) =>
        `<button class="review-dot${i === revInitIdx ? ' active' : ''}" data-idx="${i}" aria-label="후기 ${i+1}번"></button>`
    ).join('');

    setTimeout(() => { scrollSliderTo(grid, cards[revInitIdx], false); }, 0);

    indicatorsEl.querySelectorAll('.review-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            scrollSliderTo(grid, cards[parseInt(dot.dataset.idx)], true);
        });
    });

    let scrollTimer;
    grid.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            const scrollLeft = grid.scrollLeft;
            const cardWidth = (cards[0]?.offsetWidth || 0) + 14;
            const idx = Math.round(scrollLeft / cardWidth);
            const clamped = Math.max(0, Math.min(idx, cards.length - 1));
            indicatorsEl.querySelectorAll('.review-dot').forEach((d, i) => d.classList.toggle('active', i === clamped));
        }, 60);
    }, { passive: true });
}

// ============================================================
// 학생 알림 시스템 및 액션 라우팅
// ============================================================
window.toggleStudentNotiPanel = function() {
    const panel = document.getElementById('studentNotiPanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) fetchStudentNotifications();
}

let isFetchingNoti = false; 

window.fetchStudentNotifications = async function() {
    if (isFetchingNoti) return;
    isFetchingNoti = true;

    try {
        if (!localStorage.getItem('userId')) return;

        const response = await apiFetch(NOTI_API_URL, {
            method: 'POST', body: JSON.stringify({ type: 'student_get_notifications' })
        });
        
        const data = await response.json();
        const notis = data.notifications || [];
        const unreadCount = notis.filter(n => !n.isRead).length;
        
        const badge = document.getElementById('studentNotiBadge');
        if (badge) {
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
            badge.innerText = unreadCount;
        }

        const listArea = document.getElementById('studentNotiList');
        listArea.innerHTML = '';
        
        if (notis.length === 0) {
            listArea.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 250px; color: #94a3b8;">
                    <i class="far fa-bell-slash" style="font-size: 2.5rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <span style="font-size: 0.95rem;">새로운 알림이 없습니다.</span>
                </div>
            `;
            return;
        }

        notis.forEach(n => {
            const div = document.createElement('div');
            div.className = `student-noti-item ${n.isRead ? '' : 'unread'}`;
            div.onclick = async () => {
                if (!n.isRead) await markStudentNotiRead(n.id);
                handleNotiAction(n);
            };
            div.innerHTML = `
                <div class="student-noti-title">${escapeHtml(n.message)}</div>
                <div class="student-noti-time">${new Date(n.createdAt).toLocaleString()}</div>
            `;
            listArea.appendChild(div);
        });
    } catch (e) { 
        if (e.message !== "Auth expired") console.error("Noti Fetch Error:", e); 
    } finally {
        isFetchingNoti = false;
    }
}

function handleNotiAction(noti) {
    toggleStudentNotiPanel();

    if (noti.actionType === 'weekly_report') window.location.href = '/analysis?tab=coach';
    else if (noti.actionType === 'pro_report') window.location.href = '/analysis?tab=pro';
    else if (noti.actionType === 'qna_reply') window.location.href = '/qna';
    else if (noti.actionType === 'payment_success') {
        showPaymentSuccessModal(noti);
    }
    else if (noti.actionType === 'admin_notice') {
        document.getElementById('noticeModalTitle').innerText = escapeHtml(noti.title) || "공지사항";
        document.getElementById('noticeModalDate').innerText = new Date(noti.createdAt).toLocaleDateString();
        document.getElementById('noticeModalContent').innerText = escapeHtml(noti.detail) || "내용이 없습니다.";
        
        const modal = document.getElementById('noticeDetail-modal');
        if(modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }
}

function showPaymentSuccessModal(noti) {
    const existing = document.getElementById('paymentSuccessModal');
    if (existing) existing.remove();

    // 티어별 한 줄 안내 — productName에서 상품 키워드 감지
    const productName = noti.productName || '';
    const productLower = String(productName).toLowerCase();
    let tierBenefit = '';
    if (productLower.includes('pro')) {
        tierBenefit = '입시 데이터 기반 프리미엄 학습 전략 관리와 PRO 리포트를 4주간 받아보실 수 있습니다.';
    } else if (productLower.includes('standard')) {
        tierBenefit = '4주간의 체계적인 합격 플래너 설계와 주간 리포트로 입시 전략을 정교하게 다듬어보세요.';
    } else if (productLower.includes('starter')) {
        tierBenefit = '1주 플래너 진단을 통해 현재 학습 방향과 보완점을 정확히 파악하실 수 있습니다.';
    } else if (productLower.includes('basic')) {
        tierBenefit = 'AI 기반 대학 합격 가능성 분석으로 현재 점수의 가능성을 정확하게 확인해보세요.';
    } else if (productLower.includes('테스트') || productLower.includes('test')) {
        tierBenefit = '시스템 연동 테스트 결제가 정상 처리되었습니다.';
    } else {
        tierBenefit = '스터디크랙 멤버십이 활성화되었습니다.';
    }

    const safeProduct  = escapeHtml(productName || '스터디크랙 멤버십');
    const safeAmount   = escapeHtml(noti.amount || '');
    const safeStart    = escapeHtml(noti.startDate || '');
    const safeEnd      = escapeHtml(noti.endDate || '');
    const safeBenefit  = escapeHtml(tierBenefit);
    const safeDate     = escapeHtml(noti.createdAt ? new Date(noti.createdAt).toLocaleString() : '');

    const modal = document.createElement('div');
    modal.id = 'paymentSuccessModal';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;';
    modal.innerHTML = `
        <div style="background:#fff; border-radius:16px; max-width:480px; width:100%; box-shadow:0 24px 64px rgba(15,23,42,0.28); position:relative; overflow:hidden;">
            <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%); color:#fff; padding:26px 24px 22px; position:relative;">
                <span id="paymentSuccessClose" style="position:absolute; top:14px; right:18px; font-size:1.5rem; cursor:pointer; color:rgba(255,255,255,0.85); line-height:1;">&times;</span>
                <div style="font-size:2rem; margin-bottom:6px;">🎉</div>
                <div style="font-size:1.3rem; font-weight:700; margin-bottom:4px;">결제가 완료되었습니다</div>
                <div style="font-size:0.88rem; opacity:0.9;">스터디크랙을 선택해주셔서 진심으로 감사합니다.</div>
            </div>
            <div style="padding:22px 24px 24px;">
                <div style="font-size:0.92rem; color:#475569; line-height:1.6; margin-bottom:18px;">${safeBenefit}</div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; margin-bottom:18px;">
                    <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:0.9rem;">
                        <span style="color:#64748b;">이용 상품</span>
                        <span style="color:#1e293b; font-weight:600; text-align:right; max-width:60%;">${safeProduct}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:0.9rem; border-top:1px dashed #e2e8f0;">
                        <span style="color:#64748b;">결제 금액</span>
                        <span style="color:#1e293b; font-weight:600;">${safeAmount}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:0.9rem; border-top:1px dashed #e2e8f0;">
                        <span style="color:#64748b;">이용 기간</span>
                        <span style="color:#1e293b; font-weight:600;">${safeStart} ~ ${safeEnd}</span>
                    </div>
                </div>
                <div style="font-size:0.82rem; color:#94a3b8; margin-bottom:18px; text-align:right;">결제 시각 ${safeDate}</div>
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button id="paymentSuccessConfirm" style="background:#f1f5f9; color:#475569; border:none; border-radius:9px; padding:11px 18px; font-size:0.92rem; cursor:pointer;">확인</button>
                    <a href="/mypage" style="background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; text-decoration:none; border-radius:9px; padding:11px 20px; font-size:0.92rem; font-weight:600; display:inline-flex; align-items:center;">마이페이지로 이동 →</a>
                </div>
            </div>
        </div>
    `;

    const close = () => { modal.remove(); document.body.style.overflow = ''; };
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#paymentSuccessClose').addEventListener('click', close);
    modal.querySelector('#paymentSuccessConfirm').addEventListener('click', close);
}

async function markStudentNotiRead(notiId) {
    try {
        await apiFetch(NOTI_API_URL, {
            method: 'POST', body: JSON.stringify({ type: 'student_read_notification', data: { notiId: notiId } })
        });
        fetchStudentNotifications(); 
    } catch(e) {
        if (e.message !== "Auth expired") console.error("Noti Read Update Error");
    }
}

window.markAllStudentNotiRead = async function() {
    if(!confirm("모든 알림을 읽음 처리하시겠습니까?")) return;
    await markStudentNotiRead('all');
}

// 특수문자 변환 (해킹 방지)
function escapeHtml(text) {
    if (text === null || text === undefined) return ""; 
    return String(text) 
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function hoverMockup(index) {
    const targetBlock = document.getElementById('mock-' + index);
    if(targetBlock) targetBlock.classList.add('active');
}

function leaveMockup(index) {
    const targetBlock = document.getElementById('mock-' + index);
    if(targetBlock) targetBlock.classList.remove('active');
}

window.toggleMockupMobile = function(index) {
    if (window.innerWidth > 768) return;
    
    const blocks = document.querySelectorAll('.mockup-block');
    blocks.forEach((block, i) => {
        if (i + 1 === index) block.classList.toggle('active-expand');
        else block.classList.remove('active-expand');
    });
};

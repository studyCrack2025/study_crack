// js/black_univ_news.js

const API_URL = CONFIG.api.base;

let allNews = []; // 전체 뉴스 데이터
let currentFilter = { univ: null, tag: 'all', keyword: '' };

// 주요 대학 로고 데이터 (더미)
const universities = [
    { code: 'snu', name: '서울대', img: 'assets/logos/snu.png' },
    { code: 'yonsei', name: '연세대', img: 'assets/logos/yonsei.png' },
    { code: 'korea', name: '고려대', img: 'assets/logos/korea.png' },
    { code: 'kaist', name: 'KAIST', img: 'assets/logos/kaist.png' },
    { code: 'postech', name: 'POSTECH', img: 'assets/logos/postech.png' },
    { code: 'sogang', name: '서강대', img: 'assets/logos/sogang.png' },
    { code: 'skku', name: '성균관대', img: 'assets/logos/skku.png' },
    { code: 'hanyang', name: '한양대', img: 'assets/logos/hanyang.png' },
    { code: 'cau', name: '중앙대', img: 'assets/logos/cau.png' }
];

document.addEventListener('DOMContentLoaded', () => {
    renderUnivLogos();
    loadNewsData(); // 초기 데이터 로드
});

// 1. 대학 로고 렌더링
function renderUnivLogos() {
    const grid = document.getElementById('univLogoGrid');
    
    // '전체 보기' 버튼 추가
    const allBtn = document.createElement('div');
    allBtn.className = 'univ-logo-item active'; // 기본 활성
    allBtn.onclick = () => filterByUniv(null, allBtn);
    allBtn.innerHTML = '<span style="color:#fff; font-size:0.8rem; font-weight:bold;">ALL</span>';
    grid.appendChild(allBtn);

    universities.forEach(univ => {
        const div = document.createElement('div');
        div.className = 'univ-logo-item';
        div.onclick = () => filterByUniv(univ.name, div);
        // 이미지가 없으면 텍스트로 대체 (placeholder)
        div.innerHTML = `<img src="${univ.img}" onerror="this.style.display='none'; this.parentNode.innerText='${univ.name.substring(0,1)}'">`;
        grid.appendChild(div);
    });
}

// 2. 뉴스 데이터 로드 (API or Mock)
async function loadNewsData() {
    const list = document.getElementById('newsList');
    list.innerHTML = '<li class="loading-item">뉴스를 불러오는 중입니다...</li>';

    try {
        // 실제로는 API 호출: await fetch(API_URL, { body: { type: 'get_univ_news' } ... })
        // 여기서는 더미 데이터 사용
        await new Promise(r => setTimeout(r, 500)); // 로딩 시늉

        allNews = generateDummyNews(); // 더미 생성 함수 하단 참조
        renderNewsList();

    } catch (e) {
        console.error(e);
        list.innerHTML = '<li class="loading-item">뉴스를 불러오지 못했습니다.</li>';
    }
}

// 3. 뉴스 리스트 렌더링
function renderNewsList() {
    const list = document.getElementById('newsList');
    list.innerHTML = '';

    // 필터링
    const filtered = allNews.filter(n => {
        const matchUniv = !currentFilter.univ || n.univ === currentFilter.univ;
        const matchTag = currentFilter.tag === 'all' || n.tag === currentFilter.tag;
        const matchKey = !currentFilter.keyword || n.title.includes(currentFilter.keyword) || n.univ.includes(currentFilter.keyword);
        return matchUniv && matchTag && matchKey;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<li class="loading-item" style="color:#64748b;">검색 결과가 없습니다.</li>';
        return;
    }

    filtered.forEach(news => {
        const li = document.createElement('li');
        li.className = 'news-item';
        // 클릭 시 뉴스 상세 링크 이동 (여기서는 alert)
        li.onclick = () => alert(`${news.title}\n\n상세 내용은 준비 중입니다.`);
        
        li.innerHTML = `
            <div class="news-info">
                <h4><span class="univ-badge">${news.univ}</span> ${news.title}</h4>
                <div class="news-meta">
                    <span>${getTagLabel(news.tag)}</span>
                    <span class="news-date">${news.date}</span>
                </div>
            </div>
            <div class="news-arrow"><i class="fas fa-chevron-right"></i></div>
        `;
        list.appendChild(li);
    });
}

// 필터링 함수들
function filterByUniv(univName, element) {
    currentFilter.univ = univName;
    
    // UI 활성화 처리
    document.querySelectorAll('.univ-logo-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    
    renderNewsList();
}

function filterByTag(tag) {
    currentFilter.tag = tag;
    
    // UI 활성화 처리
    document.querySelectorAll('.news-tag').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active'); // event 객체 활용
    
    renderNewsList();
}

function filterNews() {
    const input = document.getElementById('newsSearchInput');
    currentFilter.keyword = input.value.trim();
    renderNewsList();
}

// 유틸리티
function getTagLabel(tag) {
    const map = {
        'recruit': '모집요강', 'interview': '면접/논술', 'schedule': '일정변경', 'analysis': '입시분석'
    };
    return map[tag] || '기타';
}

function generateDummyNews() {
    const univs = ['서울대', '연세대', '고려대', '성균관대', '한양대'];
    const tags = ['recruit', 'interview', 'schedule', 'analysis'];
    const dummy = [];
    
    for(let i=0; i<20; i++) {
        const u = univs[Math.floor(Math.random() * univs.length)];
        const t = tags[Math.floor(Math.random() * tags.length)];
        dummy.push({
            id: i,
            univ: u,
            tag: t,
            title: `[${u}] 2026학년도 수시 모집요강 주요 변경사항 안내 (${i+1})`,
            date: `2026.03.${String(Math.floor(Math.random()*30)+1).padStart(2,'0')}`
        });
    }
    // 최신순 정렬
    dummy.sort((a,b) => b.date.localeCompare(a.date));
    return dummy;
}
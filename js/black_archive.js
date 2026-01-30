// js/black_archive.js

const API_URL = CONFIG.api.base;

// [상태 변수]
let currentColumnPage = 1;
const COLUMN_PER_PAGE = 8;
let allNewsData = []; // 검색을 위해 전체 뉴스 저장

document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    loadMyConsultants();
    loadColumnArchive(); // 초기 8개 로드
    loadUnivNews();
}

// -------------------------------------------------------------
// 1. 나만의 컨설턴트 로드
// -------------------------------------------------------------
async function loadMyConsultants() {
    const container = document.getElementById('myConsultantList');
    container.innerHTML = '';

    // [더미 데이터] 실제로는 API에서 pickedConsultants를 가져와야 함
    // 예: const picks = await fetchFromAPI...
    const myPicks = [
        { name: '이태성', title: '수학 전문', img: 'https://placehold.co/100x100?text=LTS', tags: ['수학', '정시'] },
        { name: '김민지', title: '멘탈/전략', img: 'https://placehold.co/100x100?text=KMJ', tags: ['멘탈', '수시'] }
    ];
    // 최대 3명

    // 3개 슬롯 생성
    for (let i = 0; i < 3; i++) {
        if (i < myPicks.length) {
            // 선택된 컨설턴트 카드
            const data = myPicks[i];
            const div = document.createElement('div');
            div.className = 'consultant-card';
            div.onclick = () => location.href = 'black_consult.html'; // 해당 컨설턴트 페이지로 이동(임시)
            
            div.innerHTML = `
                <button class="btn-remove-consultant" onclick="removeConsultant(event, '${data.name}')" title="설정 해제">
                    <i class="fas fa-times"></i>
                </button>
                <img src="${data.img}" class="c-profile-img" alt="${data.name}">
                <div class="c-info">
                    <h4>${data.name}</h4>
                    <span>${data.title}</span>
                </div>
                <div class="c-tags">
                    ${data.tags.map(t => `<span class="c-tag">${t}</span>`).join('')}
                </div>
            `;
            container.appendChild(div);
        } else {
            // 빈 슬롯
            const div = document.createElement('div');
            div.className = 'empty-slot';
            div.onclick = () => alert("컨설턴트 목록 페이지로 이동하여 추가하세요."); // 기능 연결 필요
            div.innerHTML = `<i class="fas fa-plus plus-icon"></i>`;
            container.appendChild(div);
        }
    }
}

function removeConsultant(e, name) {
    e.stopPropagation(); // 카드 클릭 방지
    if(confirm(`${name} 컨설턴트를 해제하시겠습니까?`)) {
        // API 호출 로직 추가 (pick_consultant 해제)
        alert("해제되었습니다.");
        loadMyConsultants(); // 새로고침 시뮬레이션
    }
}

// -------------------------------------------------------------
// 2. 칼럼 아카이브 (4x2 Grid + Load More)
// -------------------------------------------------------------
function loadColumnArchive() {
    const container = document.getElementById('columnArchiveGrid');
    
    // [더미 데이터 생성]
    const dummyCols = Array.from({ length: 24 }, (_, i) => ({
        id: `arc_${i}`,
        title: `블랙 회원을 위한 시크릿 칼럼 ${i+1}탄: 입시의 본질`,
        author: 'StudyCrack Team',
        date: '2026.01.30',
        img: `https://placehold.co/300x150/222/FFF?text=Column+${i+1}`
    }));

    // 페이징 계산
    const start = (currentColumnPage - 1) * COLUMN_PER_PAGE;
    const end = start + COLUMN_PER_PAGE;
    const itemsToShow = dummyCols.slice(start, end);

    itemsToShow.forEach(col => {
        const div = document.createElement('div');
        div.className = 'archive-col-card';
        div.onclick = () => alert("칼럼 상세 모달 띄우기 (black_index와 동일 로직)");
        
        div.innerHTML = `
            <div class="ac-img">
                <img src="${col.img}" alt="thumbnail">
            </div>
            <div class="ac-body">
                <h4 class="ac-title">${col.title}</h4>
                <div class="ac-meta">
                    <span>${col.author}</span>
                    <span>${col.date}</span>
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    // 더보기 버튼 숨김 처리
    if (end >= dummyCols.length) {
        document.getElementById('btnLoadMoreCol').style.display = 'none';
    }
}

function loadMoreColumns() {
    currentColumnPage++;
    loadColumnArchive();
}

// -------------------------------------------------------------
// 3. 대학별 입시 뉴스
// -------------------------------------------------------------
function loadUnivNews() {
    const logoGrid = document.getElementById('univLogoGrid');
    const listContainer = document.getElementById('newsList');

    // [더미 데이터]
    const univs = ['서울대', '연세대', '고려대', '성균관대', '서강대', '한양대', '중앙대', '경희대'];
    allNewsData = [
        { univ: '서울대', title: '[속보] 2026 서울대 정시 모집요강 주요 변경사항', date: '2026.01.29' },
        { univ: '연세대', title: '연세대 논술전형 경쟁률 분석 및 예측', date: '2026.01.28' },
        { univ: '고려대', title: '고려대 교과전형 최저학력기준 완화 소식', date: '2026.01.25' },
        { univ: '성균관대', title: '성균관대 반도체시스템공학과 신설 안내', date: '2026.01.20' },
        { univ: '전체', title: '주요 15개대 정시 이월 인원 발표', date: '2026.01.19' },
        // ... 더미 데이터 추가 가능
    ];

    // 1) 로고 그리드 렌더링
    logoGrid.innerHTML = '';
    univs.forEach(univ => {
        const div = document.createElement('div');
        div.className = 'univ-tile';
        div.onclick = () => filterNewsByUniv(div, univ);
        // 로고 이미지는 placeholder 사용
        div.innerHTML = `
            <img src="https://placehold.co/50x50/fff/333?text=${univ[0]}" class="univ-logo-img">
            <span class="univ-name">${univ}</span>
        `;
        logoGrid.appendChild(div);
    });

    // 2) 초기 뉴스 리스트 (전체)
    renderNewsList(allNewsData);
}

function filterNewsByUniv(element, univName) {
    // 활성 상태 토글
    const tiles = document.querySelectorAll('.univ-tile');
    tiles.forEach(t => t.classList.remove('active'));
    element.classList.add('active');

    // 검색창 초기화
    document.getElementById('newsSearchInput').value = '';

    // 필터링
    const filtered = allNewsData.filter(n => n.univ === univName);
    // 데이터가 없으면 "관련 뉴스가 없습니다" 표시 (여기선 그냥 전체 보여주는 대신 필터링)
    renderNewsList(filtered.length > 0 ? filtered : allNewsData); 
}

function filterNews() {
    const keyword = document.getElementById('newsSearchInput').value.toLowerCase();
    
    // 로고 선택 해제
    document.querySelectorAll('.univ-tile').forEach(t => t.classList.remove('active'));

    const filtered = allNewsData.filter(n => 
        n.title.toLowerCase().includes(keyword) || 
        n.univ.includes(keyword)
    );
    renderNewsList(filtered);
}

function renderNewsList(data) {
    const list = document.getElementById('newsList');
    list.innerHTML = '';

    if (data.length === 0) {
        list.innerHTML = '<li style="padding:20px; text-align:center; color:#666;">검색 결과가 없습니다.</li>';
        return;
    }

    data.forEach(item => {
        const li = document.createElement('li');
        li.className = 'news-item';
        li.onclick = () => alert("뉴스 상세 페이지로 이동");
        li.innerHTML = `
            <div class="news-info">
                <span class="news-title">[${item.univ}] ${item.title}</span>
                <span class="news-meta">${item.date}</span>
            </div>
            <i class="fas fa-chevron-right news-arrow"></i>
        `;
        list.appendChild(li);
    });
}
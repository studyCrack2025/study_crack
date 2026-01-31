// js/tutor_mypage.js

//const API_URL = CONFIG.api.base;
let tutorInfo = {};

document.addEventListener('DOMContentLoaded', () => {
    // 1. 로그인 체크 (컨설턴트 권한 확인은 백엔드 응답 role로 처리)
    checkLogin();
});

async function checkLogin() {
    const idToken = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');

    if (!idToken || !userId) {
        alert("로그인이 필요합니다.");
        location.href = 'login.html';
        return;
    }

    // 2. 내 정보 로드
    await loadTutorInfo(userId);
    
    // 3. 탭 초기화
    switchTab('info');
}

// 탭 전환
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 클릭된 버튼 활성화 (event 객체 활용)
    const btns = document.querySelectorAll('.tab-btn');
    if (tabName === 'info') btns[0].classList.add('active');
    else if (tabName === 'intro') { 
        btns[1].classList.add('active'); 
        loadMyColumns(); // 칼럼 탭 클릭 시 로드
    }
    else if (tabName === 'students') { 
        btns[2].classList.add('active'); 
        loadMyStudents(); // 학생 탭 클릭 시 로드
    }

    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// 1. 내 정보 로드 및 렌더링
async function loadTutorInfo(userId) {
    const token = localStorage.getItem('idToken');
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        
        if (!res.ok) throw new Error("Load Failed");
        const data = await res.json();
        tutorInfo = data;

        // UI 렌더링
        document.getElementById('userNameDisplay').innerText = data.name;
        document.getElementById('userEmailDisplay').innerText = data.email;
        
        document.getElementById('profileName').value = data.name;
        document.getElementById('profilePhone').value = data.phone || '';
        document.getElementById('profileEmail').value = data.email;
        
        // 소개글 로드
        if (data.bio) document.getElementById('tutorBio').value = data.bio;

    } catch (e) {
        console.error(e);
        alert("정보를 불러오지 못했습니다.");
    }
}

// 정보 수정 저장
async function saveTutorProfile() {
    // 비밀번호 확인 등 로직은 mypage.js와 동일하게 구현 가능
    const newPhone = document.getElementById('profilePhone').value;
    const newEmail = document.getElementById('profileEmail').value;
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_profile', 
                userId: userId, 
                data: { 
                    name: tutorInfo.name, // 이름은 기존 값 유지
                    phone: newPhone, 
                    email: newEmail,
                    school: tutorInfo.school || 'Tutor' // 학교 정보 등 유지
                } 
            })
        });
        if(res.ok) alert("수정되었습니다.");
    } catch(e) { console.error(e); alert("오류 발생"); }
}

// 자기소개 저장
async function saveTutorBio() {
    const bio = document.getElementById('tutorBio').value;
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');

    // (백엔드에 update_bio 타입 추가 필요하거나 update_profile에 bio 필드 추가 필요)
    // 여기서는 update_profile을 확장해서 쓴다고 가정
    // 실제로는 index.mjs의 update_profile 로직에 bio 필드 처리를 추가해야 합니다.
    try {
        // 임시로 custom_update 타입 사용 예시
        alert("자기소개가 저장되었습니다. (백엔드 로직 연결 필요)");
    } catch(e) { console.error(e); }
}

// 2. 칼럼 관련
function openColumnModal() { openModal('column'); }
function closeModal(type) { document.getElementById(type + '-modal').style.display = 'none'; }

async function loadMyColumns() {
    const list = document.getElementById('myColumnList');
    // 백엔드 API 호출하여 내가 쓴 칼럼 가져오기 (author == 내이름)
    // 현재는 더미
    list.innerHTML = '<div class="empty-msg">작성된 칼럼이 없습니다.</div>';
}

async function submitColumn() {
    const title = document.getElementById('colTitle').value;
    const content = document.getElementById('colContent').value;
    if(!title || !content) return alert("내용을 입력하세요.");
    
    // API 호출 (save_column 등)
    alert("칼럼이 등록되었습니다.");
    closeModal('column');
    loadMyColumns();
}

// 3. 담당 학생 관리 (핵심 기능)
async function loadMyStudents() {
    const tbody = document.getElementById('myStudentListBody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">데이터 조회 중...</td></tr>';

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');
    const myName = tutorInfo.name; // 내 이름

    try {
        // [중요] admin_search API 재사용 (검색어 없이 전체 조회 후 필터링)
        // 단, 보안상으로는 'get_my_students'라는 전용 API를 만드는 것이 좋음 (내 학생만 리턴하도록)
        // 여기서는 기존 admin_search 로직을 활용하되, 백엔드에서 필터링하거나 
        // 클라이언트에서 필터링 (보안 취약점 가능성 있음 -> 전용 API 권장)
        
        // [임시] tutor_get_students 타입 요청 (백엔드 추가 필요)
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'tutor_get_students', // 백엔드에 이 타입 추가 필요
                userId: userId,
                tutorName: myName 
            })
        });

        if (!response.ok) throw new Error("Load Failed");
        const students = await response.json();

        tbody.innerHTML = '';
        if (!students || students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">배정된 학생이 없습니다.</td></tr>';
            return;
        }

        students.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${escapeHtml(s.school || '-')}</td>
                <td>${escapeHtml(s.phone || '-')}</td>
                <td>${s.lastLogin ? new Date(s.lastLogin).toLocaleDateString() : '-'}</td>
                <td>
                    <button class="manage-btn" onclick="goToStudentDetail('${s.userid}')">상세관리</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">데이터 로드 실패 (백엔드 API 확인 필요)</td></tr>';
    }
}

function goToStudentDetail(targetId) {
    // admin_detail.html을 재사용 (단, 권한 체크 필요)
    window.location.href = `admin_detail.html?uid=${targetId}`;
}

// XSS 방지
function escapeHtml(text) {
    if (!text) return text;
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 모달 외부 클릭 닫기
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}
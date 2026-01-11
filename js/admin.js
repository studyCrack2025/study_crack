// js/admin.js
const ADMIN_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
// ★ Lambda 함수 URL이 mypage.js와 동일합니다 (StudyCrack_API)

let currentModalUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. 관리자 권한 체크 (여기선 간단히 토큰 유무만 체크, 실제 권한은 서버가 검사)
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    // 2. 통계 로드
    loadAdminStats(userId);
});

// === [API] 통계 데이터 로드 ===
async function loadAdminStats(adminId) {
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'admin_stats', userId: adminId })
        });
        
        if (!response.ok) {
            if(response.status === 403) {
                alert("관리자 권한이 없습니다.");
                window.location.href = 'index.html';
                return;
            }
            throw new Error("서버 오류");
        }

        const data = await response.json();
        
        // 데이터 바인딩
        document.getElementById('totalUsers').innerText = `${data.totalUsers}명`;
        document.getElementById('totalRevenue').innerText = `${data.totalRevenue.toLocaleString()}원`;
        document.getElementById('monthlyRevenue').innerText = `${data.monthlyRevenue.toLocaleString()}원`;

        const list = document.getElementById('productStatsList');
        list.innerHTML = "";
        for (const [prod, amt] of Object.entries(data.productStats)) {
            list.innerHTML += `<li><strong>${prod}:</strong> ${amt.toLocaleString()}원</li>`;
        }

    } catch (error) {
        console.error(error);
        alert("통계 로드 실패");
    }
}

// === [API] 학생 검색 ===
async function searchStudents() {
    const adminId = localStorage.getItem('userId');
    const type = document.getElementById('searchType').value;
    const keyword = document.getElementById('searchInput').value;
    const tbody = document.getElementById('studentListBody');

    if(!keyword) { alert("검색어를 입력하세요"); return; }

    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>검색 중...</td></tr>";

    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_search',
                userId: adminId, // 요청자(관리자) ID
                data: { searchType: type, keyword: keyword }
            })
        });
        
        const students = await response.json();
        
        tbody.innerHTML = "";
        if (students.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>검색 결과가 없습니다.</td></tr>";
            return;
        }

        students.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.name || '이름 없음'}</td>
                <td>${s.email || '-'} (DynamoDB에 email필드 필요)</td>
                <td>${s.school || '-'}</td>
                <td>
                    ${s.payments ? '<span style="color:green;font-weight:bold">유료회원</span>' : '무료회원'}
                </td>
                <td><button class="btn-view" onclick="openStudentModal('${s.userid}')">상세보기</button></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        alert("검색 중 오류 발생");
    }
}

// === [API] 학생 상세 보기 (모달 열기) ===
async function openStudentModal(targetUserId) {
    const adminId = localStorage.getItem('userId');
    currentModalUserId = targetUserId;
    
    document.getElementById('studentModal').classList.remove('hidden');
    
    try {
        const response = await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_get_user_detail',
                userId: adminId,       // 요청자(관리자)
                data: { targetUserId } // 조회 대상(학생)
            })
        });

        const student = await response.json();
        renderStudentDetail(student);

    } catch (error) {
        alert("학생 정보 로드 실패");
    }
}

function renderStudentDetail(s) {
    document.getElementById('modalStudentName').innerText = `${s.name} 학생 상세 정보`;
    
    // 1. 관리자 메모 바인딩
    document.getElementById('adminMemoInput').value = s.adminMemo || '';

    // 2. 기본 정보
    document.getElementById('viewSchool').innerText = s.school || '-';
    document.getElementById('viewPhone').innerText = s.phone || '-';

    // 3. 정성 데이터
    const q = s.qualitative || {};
    document.getElementById('viewStatus').innerText = q.status || '-';
    document.getElementById('viewStream').innerText = q.stream || '-';
    document.getElementById('viewCareer').innerText = q.career || '-';
    document.getElementById('viewTargets').innerText = q.targets ? q.targets.join(', ') : '-';

    // 4. 성적표 (간단히 출력)
    const quan = s.quantitative || {};
    let scoreHtml = "<ul>";
    for(const [exam, data] of Object.entries(quan)) {
        scoreHtml += `<li><strong>${exam}:</strong> 국(${data.kor?.grd || '-'}), 수(${data.math?.grd || '-'}), 영(${data.eng?.grd || '-'})</li>`;
    }
    scoreHtml += "</ul>";
    document.getElementById('viewScoreTable').innerHTML = Object.keys(quan).length ? scoreHtml : '성적 데이터 없음';

    // 5. 결제 내역
    const payList = document.getElementById('viewPaymentList');
    payList.innerHTML = "";
    if (s.payments) {
        s.payments.forEach(p => {
            payList.innerHTML += `<li>${p.date} / ${p.product} / ${p.amount.toLocaleString()}원</li>`;
        });
    } else {
        payList.innerHTML = "결제 내역 없음";
    }
}

// === [API] 관리자 메모 저장 ===
async function saveAdminMemo() {
    const adminId = localStorage.getItem('userId');
    const memo = document.getElementById('adminMemoInput').value;

    if(!currentModalUserId) return;

    try {
        await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'admin_update_memo',
                userId: adminId,
                data: { targetUserId: currentModalUserId, memo: memo }
            })
        });
        alert("메모가 저장되었습니다.");
    } catch (error) {
        alert("저장 실패");
    }
}

function closeModal() {
    document.getElementById('studentModal').classList.add('hidden');
    currentModalUserId = null;
}

function switchModalTab(tabName) {
    document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('view_' + tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}
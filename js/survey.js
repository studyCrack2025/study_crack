// js/survey.js      
const DATA_FETCH_URL = CONFIG.api.analysis;   

let examScores = {}; 

// 💡 공통 apiFetch 함수 (accessToken 기반 통합 및 401 예외 처리)
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    options.headers = { ...defaultHeaders, ...options.headers };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                const currentPath = window.location.pathname;
                if (!['/login', '/signup', '/'].includes(currentPath)) {
                    alert("보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.");
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/login'; 
                }
                return Promise.reject(new Error("Auth expired")); 
            }
            throw new Error(`서버 통신 오류 (상태 코드: ${response.status})`);
        }
        return response;
    } catch (error) {
        console.error("API 통신 실패:", error);
        throw error; 
    }
}

// 💡 한층 더 강력해진 escapeHtml 적용 (XSS 방어)
function escapeHtml(text) {
    if (text === null || text === undefined) return ""; 
    return String(text) 
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    fetchUserData(userId);
    setupUI();
    
    setTimeout(checkQualitativeForm, 500);
    
    // 튜토리얼 3단계 (기초조사서 다단계 설명 및 이탈 방지)
    const pendingTutorial = localStorage.getItem('pending_tutorial');
    
    if (pendingTutorial === 'true') {
        
        // [방어 1] 브라우저 뒤로가기 / 새로고침 경고
        const warnTutorialExit = (e) => {
            if (localStorage.getItem('pending_tutorial') === 'true') {
                e.preventDefault();
                e.returnValue = '정말 튜토리얼을 종료하시겠습니까?'; 
            }
        };
        window.addEventListener('beforeunload', warnTutorialExit);

        // [방어 2] 로고, 마이페이지 등 내부 링크 클릭 시 경고 후 삭제
        document.querySelectorAll('.logo-link, .nav-btn').forEach(link => {
            link.addEventListener('click', (e) => {
                if (localStorage.getItem('pending_tutorial') === 'true') {
                    if (!confirm('현재 튜토리얼이 진행 중입니다.\n정말 튜토리얼을 종료하고 이동하시겠습니까?')) {
                        e.preventDefault(); // 이동 취소
                    } else {
                        // 동의 시 튜토리얼 신호 파기 및 이벤트 해제
                        localStorage.removeItem('pending_tutorial');
                        window.removeEventListener('beforeunload', warnTutorialExit);
                    }
                }
            });
        });

        // 다단계 UI 로직 실행
        setTimeout(() => {
            const overlay = document.getElementById('tutorialOverlay');
            const cloneContainer = document.getElementById('tutorialCloneContainer');
            const targetEl = document.querySelector('.survey-tabs'); // 복제할 원본 탭 영역
            
            if (targetEl) {
                overlay.classList.remove('hidden');
                
                // 원본 탭 영역의 위치 계산 및 클론(복제본) 생성
                const rect = targetEl.getBoundingClientRect();
                cloneContainer.style.top = `${rect.top}px`;
                cloneContainer.style.left = `${rect.left}px`;
                cloneContainer.style.width = `${rect.width}px`;
                cloneContainer.style.height = `${rect.height}px`;

                const clone = targetEl.cloneNode(true);
                cloneContainer.appendChild(clone);
                
                const tooltip = document.getElementById('tutorialTooltip');
                // 툴팁 위치 중앙 정렬
                tooltip.style.top = `${rect.bottom + 15}px`;
                tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
                tooltip.style.transform = `translateX(-50%)`;

                // 제어할 요소들 맵핑
                const msgEl = document.getElementById('tutorialMsg');
                const prevBtn = document.getElementById('tutPrevBtn');
                const nextBtn = document.getElementById('tutNextBtn');
                const skipBtn = document.getElementById('skipTutorialBtn');
                const cloneBtns = clone.querySelectorAll('.tab-btn');

                let tutStep = 0;
                const tutMsgs = [
                    '기초조사서는 총 두 영역으로 구성되어 있습니다.',
                    '정성 영역은 학생의 성향과 기본정보를 판단하는 기준으로 구성되어 있습니다.',
                    '정량 영역은 학생의 객관적인 현재위치를 판단하기 위해 성적을 작성하는 부분으로 구성되어 있습니다.',
                    '보다 세세한 분석을 위해 최대한 자세히 적어주세요. 작성이 완료되면 다음 단계로 넘어가겠습니다.'
                ];

                const updateStep = () => {
                    msgEl.innerText = tutMsgs[tutStep];
                    
                    // 스텝에 따른 탭(버튼) 강조(투명도) 처리
                    if(cloneBtns.length === 2) {
                        if (tutStep === 0 || tutStep === 3) {
                            cloneBtns[0].style.opacity = '1';
                            cloneBtns[1].style.opacity = '1';
                        } else if (tutStep === 1) {
                            cloneBtns[0].style.opacity = '1';
                            cloneBtns[1].style.opacity = '0.3';
                        } else if (tutStep === 2) {
                            cloneBtns[0].style.opacity = '0.3';
                            cloneBtns[1].style.opacity = '1';
                        }
                    }

                    // 버튼 텍스트 및 노출 상태 변경
                    prevBtn.style.display = tutStep > 0 ? 'block' : 'none';
                    nextBtn.innerText = tutStep === 3 ? '확인했습니다.' : '다음';
                };

                prevBtn.addEventListener('click', () => { tutStep--; updateStep(); });
                nextBtn.addEventListener('click', () => {
                    if (tutStep === 3) {
                        // '확인했습니다' 클릭 시 오버레이 해제 (작성 시작)
                        // 🚨 저장 후 다음 페이지(/analysis) 튜토리얼을 위해 localStorage는 지우지 않음!
                        overlay.classList.add('hidden');
                    } else {
                        tutStep++; updateStep();
                    }
                });

                // 건너뛰기 클릭 시 튜토리얼 강제 완전 종료
                skipBtn.addEventListener('click', () => {
                    localStorage.removeItem('pending_tutorial');
                    overlay.classList.add('hidden');
                    window.removeEventListener('beforeunload', warnTutorialExit);
                });

                updateStep(); // 최초 1단계 렌더링
            }
        }, 400);
    }
});

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetContent = document.getElementById(tabName);
    if (targetContent) targetContent.classList.add('active');
    
    const targetBtn = document.querySelector(`.tab-btn[onclick="openTab('${tabName}')"]`);
    if (targetBtn) targetBtn.classList.add('active');
}

// ============================================================
// 성적 자동 환산 요청
// ============================================================
async function requestScoreConversion(type) {
    const month = document.getElementById('examSelect').value;
    let subjectKey = type;
    let scoreVal = 0;
    let optVal = "";
    let subNameVal = "";
    
    // 원점수(rawId)와 표준점수(stdId) 매핑 변경
    let rawId = "", stdId = "", pctId = "", grdId = "";

    if (type === 'kor') {
        rawId = "korRaw"; stdId = "korStd"; pctId = "korPct"; grdId = "korGrd";
        optVal = document.getElementById('koreanOpt').value;
    } else if (type === 'math') {
        rawId = "mathRaw"; stdId = "mathStd"; pctId = "mathPct"; grdId = "mathGrd";
        optVal = document.getElementById('mathOpt').value;
    } else if (type === 'inq1') {
        rawId = "inq1Raw"; stdId = "inq1Std"; pctId = "inq1Pct"; grdId = "inq1Grd";
        subNameVal = document.getElementById('inq1Name').value;
    } else if (type === 'inq2') {
        rawId = "inq2Raw"; stdId = "inq2Std"; pctId = "inq2Pct"; grdId = "inq2Grd";
        subNameVal = document.getElementById('inq2Name').value;
    }

    const rawEl = document.getElementById(rawId);
    if (!rawEl || !rawEl.value) return; 
    scoreVal = parseInt(rawEl.value);

    // 원점수 방어 로직 (국수 최대 100점)
    if (scoreVal < 0 || scoreVal > 100) {
        alert("유효하지 않은 원점수입니다.");
        rawEl.value = "";
        return;
    }

    try {
        const stdEl = document.getElementById(stdId);
        const pctEl = document.getElementById(pctId);
        const grdEl = document.getElementById(grdId);
        
        if(stdEl) { stdEl.value = ""; stdEl.placeholder = "..."; }
        if(pctEl) { pctEl.value = ""; pctEl.placeholder = "..."; }
        if(grdEl) { grdEl.value = ""; grdEl.placeholder = "..."; }
        
        // 💡 apiFetch 적용
        const response = await apiFetch(DATA_FETCH_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'convert_score', 
                month: month,
                subject: subjectKey,
                score: scoreVal, // 이제 원점수가 전송됨
                opt: optVal,
                subName: subNameVal
            })
        });

        const data = await response.json(); 
        
        if (data.error || (!data.std && !data.pct && !data.grd)) {
            alert("입력하신 원점수에 해당하는 데이터가 없습니다.\n(선택과목을 먼저 지정했는지 확인해주세요)");
            rawEl.value = "";
            if(stdEl) stdEl.placeholder = "-";
            if(pctEl) pctEl.placeholder = "-";
            if(grdEl) grdEl.placeholder = "-";
            rawEl.focus();
            return;
        }
        
        if (data.std && stdEl) stdEl.value = data.std;
        if (data.pct && pctEl) pctEl.value = data.pct;
        if (data.grd && grdEl) grdEl.value = data.grd;

    } catch (e) {
        if (e.message !== "Auth expired") {
            console.error("환산 실패:", e);
            alert("점수 환산 중 오류가 발생했습니다.");
        }
    }
}

// === UI 설정 ===
function setupUI() {
    const radioGroup = document.getElementById('statusRadioGroup');
    const etcInput = document.getElementById('statusEtcInput');
    const qualTab = document.getElementById('qualitative');

    if(etcInput) {
        etcInput.style.display = 'none';
        etcInput.removeAttribute('required'); 
    }

    if (radioGroup) {
        radioGroup.addEventListener('change', (e) => {
            if (e.target.value === 'other') {
                etcInput.style.display = 'block';
                etcInput.setAttribute('required', 'true');
            } else {
                etcInput.style.display = 'none';
                etcInput.removeAttribute('required');
                etcInput.value = '';
            }
            checkQualitativeForm();
        });
    }

    if (qualTab) {
        qualTab.addEventListener('input', checkQualitativeForm);
        qualTab.addEventListener('change', checkQualitativeForm);
        qualTab.addEventListener('click', checkQualitativeForm);
    }
}

function checkQualitativeForm() {
    const saveBtn = document.getElementById('btnSaveQual');
    const container = document.getElementById('qualitative');
    if (!saveBtn || !container) return;

    const inputs = container.querySelectorAll('[required]');
    let isValid = true;

    for (const input of inputs) {
        if (input.offsetParent === null) continue; 
        if (input.type === 'radio') {
            if (!container.querySelector(`input[name="${input.name}"]:checked`)) {
                isValid = false; break; 
            }
        } else if (input.type === 'checkbox') {
            if (!input.checked) { isValid = false; break; }
        } else {
            if (!input.value || !input.value.trim()) { isValid = false; break; }
        }
    }

    saveBtn.disabled = !isValid;
    if (isValid) {
        saveBtn.innerText = "정성 데이터 저장";
        saveBtn.style.backgroundColor = "#2563EB"; 
        saveBtn.style.cursor = "pointer";
    } else {
        saveBtn.innerText = "필수 항목을 모두 입력해주세요";
        saveBtn.style.backgroundColor = "#cbd5e1"; 
        saveBtn.style.cursor = "not-allowed";
    }
}

// === 데이터 로드 ===
async function fetchUserData(userId) {
    try {
        // 💡 apiFetch 적용
        const response = await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user' })
        });
        const data = await response.json();

        if (data.qualitative) fillQualitativeForm(data.qualitative);
        if (data.quantitative) {
            examScores = data.quantitative;
            loadExamData(); 
        }
    } catch (error) { 
        if (error.message !== "Auth expired") console.error("데이터 로드 오류:", error); 
    }
}

function fillQualitativeForm(qual) {
    if (!qual) return;
    
    // 이전 영어 데이터를 한글로 매핑해주기 위한 호환성 딕셔너리
    const LEGACY_MAP = {
        'humanities': '인문사회', 'business': '상경계열', 'nature': '자연/공학', 'medical': '의치한약수', 'nursing': '간호', 'education': '사범/교대', 'art': '예체능', 'etc': '기타',
        'yes': '예 (필수)', 'no': '아니오 (재수 가능)',
        'univ': '대학 간판 중요', 'major': '학과 전공 중요', 'balance': '균형 있게 고려',
        'low': '낮음', 'mid': '중간', 'high': '높음'
    };

    if (qual.status) {
        const radio = document.querySelector(`input[name="studentStatus"][value="${qual.status}"]`);
        if (radio) radio.checked = true;
        else {
            const otherBtn = document.querySelector('input[name="studentStatus"][value="other"]');
            if(otherBtn) otherBtn.checked = true;
            const etc = document.getElementById('statusEtcInput');
            if(etc) { etc.style.display = 'block'; etc.value = qual.status; }
        }
    }
    
    const ids = {
        'highSchool': qual.school, 
        'targetStream': LEGACY_MAP[qual.stream] || qual.stream,
        'careerPath': qual.career,
        'mustGoCollege': LEGACY_MAP[qual.values?.mustGo] || qual.values?.mustGo,
        'priorityType': LEGACY_MAP[qual.values?.priority] || qual.values?.priority,
        'appStrategy': qual.values?.strategy, 'worstScenario': qual.values?.worst,
        'regionRange': qual.values?.region, 'crossApply': qual.values?.cross,
        'groupGa': qual.candidates?.ga, 'groupNa': qual.candidates?.na, 'groupDa': qual.candidates?.da,
        'mostWanted': qual.candidates?.most, 'leastWanted': qual.candidates?.least,
        'selfAssessment': qual.candidates?.self,
        'parentOpinion': qual.parents?.opinion, 'parentInfluence': LEGACY_MAP[qual.parents?.influence] || qual.parents?.influence,
        'transferPlan': qual.special?.transfer, 'teachingCert': qual.special?.teaching,
        'etcConsultingInfo': qual.special?.etc
    };
    
    for (const [id, val] of Object.entries(ids)) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }
    
    // [추가] 불러온 학교 이름이 '검정고시'면 체크박스 ON
    if (qual.school === '검정고시') {
        const gedCheck = document.getElementById('isGed');
        if(gedCheck) {
            gedCheck.checked = true;
            toggleSchoolInput();
        }
    }

    if (qual.targets) {
        qual.targets.forEach((val, idx) => {
            const input = document.getElementById(`target${idx+1}`);
            if(input) input.value = val;
        });
    }
    checkQualitativeForm();
}

function toggleSchoolInput() {
    const isGed = document.getElementById('isGed').checked;
    const hsInput = document.getElementById('highSchool');
    
    if (isGed) {
        hsInput.value = "검정고시";
        hsInput.disabled = true;
        hsInput.removeAttribute('required');
    } else {
        if (hsInput.value === "검정고시") hsInput.value = "";
        hsInput.disabled = false;
        hsInput.setAttribute('required', 'true');
    }
    checkQualitativeForm(); 
}

// 약관 모달 열기
window.openTermModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // 모달 떴을 때 배경 스크롤 방지
    }
};

// 약관 모달 닫기
window.closeTermModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = ''; // 배경 스크롤 복구
    }
};

async function saveQualitative() {
    let statusVal = document.querySelector('input[name="studentStatus"]:checked')?.value;
    if (statusVal === 'other') statusVal = document.getElementById('statusEtcInput').value;

    const data = {
        status: statusVal,
        school: document.getElementById('highSchool').value,
        stream: document.getElementById('targetStream').value,
        career: document.getElementById('careerPath').value,
        values: {
            mustGo: document.getElementById('mustGoCollege').value,
            priority: document.getElementById('priorityType').value,
            strategy: document.getElementById('appStrategy').value,
            worst: document.getElementById('worstScenario').value,
            region: document.getElementById('regionRange').value,
            cross: document.getElementById('crossApply').value,
        },
        candidates: {
            ga: document.getElementById('groupGa').value, na: document.getElementById('groupNa').value, da: document.getElementById('groupDa').value,
            most: document.getElementById('mostWanted').value, least: document.getElementById('leastWanted').value, self: document.getElementById('selfAssessment').value
        },
        targets: [1,2,3,4,5].map(i => document.getElementById(`target${i}`)?.value || ''),
        parents: { opinion: document.getElementById('parentOpinion').value, influence: document.getElementById('parentInfluence').value },
        special: { transfer: document.getElementById('transferPlan').value, teaching: document.getElementById('teachingCert').value, etc: document.getElementById('etcConsultingInfo').value }
    };

    try {
        // 💡 apiFetch 적용
        await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'update_qual', data: data })
        });
        
        alert("저장되었습니다! 다음으로 '성적 입력' 탭을 작성해주세요.");
        openTab('quantitative');
        window.scrollTo(0,0);
        
    } catch (e) { 
        if (e.message !== "Auth expired") alert("저장 중 일시적인 문제가 발생했습니다. 닫고 다시 시도해주세요."); 
    }
}

function loadExamData() {
    const month = document.getElementById('examSelect').value;
    const d = examScores[month] || {};
    
    const setVal = (id, val) => { 
        const el = document.getElementById(id); 
        if(el) {
            el.value = val || ''; 
        }
    };

    setVal('koreanOpt', d.kor?.opt || 'none');
    setVal('korRaw', d.kor?.raw); setVal('korStd', d.kor?.std); setVal('korPct', d.kor?.pct); setVal('korGrd', d.kor?.grd);
    
    setVal('mathOpt', d.math?.opt || 'none');
    setVal('mathRaw', d.math?.raw); setVal('mathStd', d.math?.std); setVal('mathPct', d.math?.pct); setVal('mathGrd', d.math?.grd);
    
    setVal('engGrd', d.eng?.grd); 
    setVal('histGrd', d.hist?.grd);
    
    setVal('inq1Name', d.inq1?.name); setVal('inq1Raw', d.inq1?.raw); setVal('inq1Std', d.inq1?.std); setVal('inq1Pct', d.inq1?.pct); setVal('inq1Grd', d.inq1?.grd);
    setVal('inq2Name', d.inq2?.name); setVal('inq2Raw', d.inq2?.raw); setVal('inq2Std', d.inq2?.std); setVal('inq2Pct', d.inq2?.pct); setVal('inq2Grd', d.inq2?.grd);
    
    setVal('foreignName', d.foreign?.name); setVal('foreignGrd', d.foreign?.grd);
}

// ============================================================
// 성적 저장
// ============================================================
async function saveQuantitative() {
    const month = document.getElementById('examSelect').value;
    
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : "";
    };

    const korOpt = getVal('koreanOpt');
    const mathOpt = getVal('mathOpt');
    const inq1Name = getVal('inq1Name');
    const inq2Name = getVal('inq2Name');

    const currentData = {
        kor: { opt: korOpt, raw: getVal('korRaw'), std: getVal('korStd'), pct: getVal('korPct'), grd: getVal('korGrd') },
        math: { opt: mathOpt, raw: getVal('mathRaw'), std: getVal('mathStd'), pct: getVal('mathPct'), grd: getVal('mathGrd') },
        eng: { grd: getVal('engGrd') }, 
        hist: { grd: getVal('histGrd') },
        inq1: { name: inq1Name, raw: getVal('inq1Raw'), std: getVal('inq1Std'), pct: getVal('inq1Pct'), grd: getVal('inq1Grd') },
        inq2: { name: inq2Name, raw: getVal('inq2Raw'), std: getVal('inq2Std'), pct: getVal('inq2Pct'), grd: getVal('inq2Grd') },
        foreign: { name: getVal('foreignName'), grd: getVal('foreignGrd') }
    };
    
    examScores[month] = currentData;

    try {
        const response = await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'update_quan', data: examScores })
        });
        
        // 💡 [해결] 응답 성공 여부를 확실히 체크
        if (!response.ok) throw new Error("서버 응답 오류");
        
        // 튜토리얼 여부에 따라 알림 메시지와 이동 경로 분기
        if (localStorage.getItem('pending_tutorial') === 'true') {
            alert("성적 데이터가 저장되었습니다.\n이어서 다음 튜토리얼을 진행합니다!");
            localStorage.setItem('pending_tutorial', 'step3');
            
            // 정상적인 페이지 이동이므로 이탈 경고 무시 처리
            window.isTutorialMoving = true; 
            window.location.href = '/analysis';
        } else {
            alert("성적 데이터가 저장되었습니다.\n(지원 가능 전형이 자동 계산되었습니다)\n\n솔루션 페이지로 이동합니다.");
            window.location.href = '/analysis'; 
        }
        
    } catch (e) { 
        if (e.message !== "Auth expired") alert("저장 실패: 다시 시도해주세요."); 
    }
}
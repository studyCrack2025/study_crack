let consultingDataReadinessBusy = false;
let consultingDataReadinessGeneration = 0;
const consultingDataCheckLabels = { data_release: '승인 입시자료', cut_reference: '가능성 기준선', calculator_mapping: '계산기 연결표' };
const consultingDataCheckCopy = {
    DATA_CONNECTED: ['활성 자료 연결을 확인했습니다.', '개별 학생의 응시 조건과 환산 결과는 별도로 검수합니다.'],
    DATA_NOT_CONFIGURED: ['승인 입시자료가 아직 연결되지 않았습니다.', '검수본 준비 후 자료 연결 설정을 확인해주세요.'],
    DATA_NOT_ACTIVE: ['현재 학년도의 활성 승인 자료가 없습니다.', '검수와 승인을 마친 자료의 연결이 필요합니다.'],
    DATA_UNAVAILABLE: ['자료 저장소의 상태를 확인하지 못했습니다.', '접근 상태를 확인한 뒤 다시 조회해주세요.'],
    REFERENCE_NOT_CONFIGURED: ['기준선 검수본이 연결되지 않았습니다.', '같은 연도·척도의 두 기준선과 출처를 준비해주세요.'],
    REFERENCE_REVIEW_REQUIRED: ['가능성 기준선이 검수 대기 중입니다.', '두 기준선의 출처·연도·척도와 올해 조정을 검수해주세요.'],
    REFERENCE_INVALID: ['기준선 검수본의 연결 조건이 맞지 않습니다.', '검수본의 승인·연도·출처·자료 버전을 다시 대조해주세요.'],
    REFERENCE_BINDING_UNCHECKED: ['입시자료가 연결되지 않아 기준선을 대조하지 못했습니다.', '승인 입시자료 연결 후 다시 확인해주세요.'],
    REFERENCE_SOURCE_UNAVAILABLE: ['기준선 출처를 확인하지 못했습니다.', '출처 접근 상태와 검수본의 자료 버전을 확인해주세요.'],
    REFERENCE_CHECKED: ['검수본과 등록된 출처의 일치를 확인했습니다.', '이 항목 수는 학생별 계산 가능 학과 수를 뜻하지 않습니다.'],
    MAPPING_NOT_CONFIGURED: ['계산기 연결표가 등록되지 않았습니다.', '대학·학과와 승인 모집단위의 연결표를 준비해주세요.'],
    MAPPING_REVIEW_REQUIRED: ['계산기 연결표가 검수 대기 중입니다.', '학과·캠퍼스·모집군과 승인 자료 버전을 대조해주세요.'],
    MAPPING_INVALID: ['계산기 연결표의 승인 조건이 맞지 않습니다.', '연결표의 검수 기록과 현재 자료 버전을 확인해주세요.'],
    MAPPING_BINDING_UNCHECKED: ['입시자료가 연결되지 않아 연결표를 대조하지 못했습니다.', '승인 입시자료 연결 후 다시 확인해주세요.'],
    MAPPING_REFERENCE_DISJOINT: ['연결표와 검수된 기준선에 공통 학과가 없습니다.', '동일한 모집단위로 연결되었는지 확인해주세요.'],
    MAPPING_CHECKED: ['승인 자료와 연결표의 일치를 확인했습니다.', '학생별 성적 환산과 지원 자격 확인은 별도로 필요합니다.'],
    DATA_CHANGED: ['확인 중 활성 자료가 변경되었습니다.', '현재 자료를 기준으로 다시 조회해주세요.'],
    CHECK_UNAVAILABLE: ['정해진 시간 안에 상태를 확인하지 못했습니다.', '잠시 후 다시 조회해주세요.']
};
function resetConsultingDataReadiness() {
    consultingDataReadinessGeneration++; consultingDataReadinessBusy = false;
    const panel = document.getElementById('consultingDataReadinessPanel'); panel?.setAttribute('aria-busy', 'false');
    const button = document.getElementById('consultingDataReadinessRefresh'); if (button) button.disabled = false;
    document.getElementById('consultingDataReadinessChecks')?.replaceChildren();
    document.getElementById('consultingDataReadinessMeta')?.replaceChildren();
    const status = document.getElementById('consultingDataReadinessStatus'); if (status) { status.textContent = ''; status.dataset.state = ''; }
    const details = document.getElementById('consultingDataReadinessDetails'); if (details) details.open = false;
}
function validConsultingDataReadiness(data) {
    const keys = Object.keys(consultingDataCheckLabels), count = n => n === null || Number.isSafeInteger(n) && n >= 0 && n <= 20000;
    const passedCodes = ['DATA_CONNECTED', 'REFERENCE_CHECKED', 'MAPPING_CHECKED'];
    if (!(data?.contractVersion === 'consulting-data-readiness-v1' && data.admissionYear === 2027 && ['DEV', 'PROD'].includes(data.environment)
        && data.canPublish === false && data.studentCalculationVerified === false && count(data.sharedUnitCount)
        && typeof data.checkedAt === 'string' && Number.isFinite(Date.parse(data.checkedAt))
        && ['needs_review', 'connections_checked', 'temporarily_unavailable'].includes(data.summaryState)
        && Array.isArray(data.checks) && data.checks.length === 3 && data.checks.every((c, i) => c?.key === keys[i] && ['passed', 'blocked', 'unavailable'].includes(c.status) && Object.hasOwn(consultingDataCheckCopy, c.code) && count(c.entryCount)
            && (c.status === 'passed') === (c.code === passedCodes[i]) && (c.status !== 'unavailable' || c.entryCount === null)))) return false;
    const expected = data.checks.some(c => c.status === 'unavailable') ? 'temporarily_unavailable' : data.checks.every(c => c.status === 'passed') ? 'connections_checked' : 'needs_review';
    return data.summaryState === expected && (expected !== 'connections_checked' || data.sharedUnitCount > 0);
}
async function loadConsultingDataReadiness() {
    if (consultingDataReadinessBusy) return;
    const generation = ++consultingDataReadinessGeneration, status = document.getElementById('consultingDataReadinessStatus');
    if (!status) return;
    consultingDataReadinessBusy = true; status.textContent = '자료 준비 상태를 확인하고 있습니다.'; status.dataset.state = '';
    document.getElementById('consultingDataReadinessPanel')?.setAttribute('aria-busy', 'true');
    document.getElementById('consultingDataReadinessRefresh').disabled = true;
    document.getElementById('consultingDataReadinessChecks').replaceChildren(); document.getElementById('consultingDataReadinessMeta').replaceChildren();
    try {
        const data = await requestConsultingAdmin('admin_get_consulting_data_readiness', {});
        if (generation !== consultingDataReadinessGeneration) return;
        if (!validConsultingDataReadiness(data)) throw new Error('Invalid readiness response');
        const labels = { passed: '연결 확인', blocked: '준비 필요', unavailable: '확인 불가' }, root = document.getElementById('consultingDataReadinessChecks');
        for (const c of data.checks) {
            const item = document.createElement('li'); item.dataset.ready = String(c.status === 'passed');
            const title = document.createElement('strong'); title.textContent = `${consultingDataCheckLabels[c.key]} · ${labels[c.status]}`; item.append(title);
            for (const text of consultingDataCheckCopy[c.code]) { const line = document.createElement('span'); line.textContent = text; item.append(line); }
            if (c.entryCount !== null) { const count = document.createElement('span'); count.textContent = `확인된 연결 항목 ${c.entryCount.toLocaleString('ko-KR')}개`; item.append(count); }
            root.append(item);
        }
        const meta = document.getElementById('consultingDataReadinessMeta');
        const at = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(data.checkedAt));
        meta.textContent = `2027학년도 · ${data.environment === 'DEV' ? '개발 환경' : '운영 환경'} · ${at} 확인${data.sharedUnitCount === null ? '' : ` · 공통 연결 학과 ${data.sharedUnitCount.toLocaleString('ko-KR')}개`}`;
        const summaries = { needs_review: '자료 준비가 남아 있습니다. 아래 항목의 다음 조치를 확인해주세요.', connections_checked: '기본 연결 조건을 확인했습니다. 학생별 자격·환산 검수와 보고서 승인은 별도로 필요합니다.', temporarily_unavailable: '확인하지 못한 항목이 있습니다. 미준비 상태와 조회 실패를 구분해 확인해주세요.' };
        status.textContent = summaries[data.summaryState]; status.dataset.state = data.summaryState === 'temporarily_unavailable' ? 'error' : data.summaryState === 'connections_checked' ? 'success' : '';
    } catch (_) { if (generation === consultingDataReadinessGeneration) { status.textContent = '준비 상태를 불러오지 못했습니다. 권한과 기능 적용 상태를 확인한 뒤 다시 조회해주세요.'; status.dataset.state = 'error'; } }
    finally { if (generation === consultingDataReadinessGeneration) { consultingDataReadinessBusy = false; document.getElementById('consultingDataReadinessPanel')?.setAttribute('aria-busy', 'false'); document.getElementById('consultingDataReadinessRefresh').disabled = false; } }
}
window.addEventListener('studycrack:session-ended', resetConsultingDataReadiness);

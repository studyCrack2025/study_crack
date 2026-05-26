#!/usr/bin/env node

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function weekKeyFromShiftedKstDate(dateObj) {
    const y = dateObj.getUTCFullYear();
    const mIdx = dateObj.getUTCMonth();
    const d = dateObj.getUTCDate();
    const start = new Date(Date.UTC(y, mIdx, 1));
    const offsetDate = d + start.getUTCDay() - 1;
    const week = String(Math.floor(offsetDate / 7) + 1).padStart(2, '0');
    return `${String(y).slice(2)}${String(mIdx + 1).padStart(2, '0')}${week}`;
}

function oldReportCoreKey(dateObjUtc) {
    // 과거 구현: Lambda UTC 런타임 로컬시간으로 계산
    const y = dateObjUtc.getUTCFullYear();
    const mIdx = dateObjUtc.getUTCMonth();
    const d = dateObjUtc.getUTCDate();
    const start = new Date(Date.UTC(y, mIdx, 1));
    const offsetDate = d + start.getUTCDay() - 1;
    const week = String(Math.floor(offsetDate / 7) + 1).padStart(2, '0');
    return `${String(y).slice(2)}${String(mIdx + 1).padStart(2, '0')}${week}`;
}

function newReportCoreKey(dateObjUtc) {
    // 패치 구현: KST 기준으로 고정
    return weekKeyFromShiftedKstDate(new Date(dateObjUtc.getTime() + KST_OFFSET_MS));
}

function reminderWeeklyTargetForMondayRun(runUtc) {
    const kstNow = new Date(runUtc.getTime() + KST_OFFSET_MS);
    const sundayKst = new Date(kstNow.getTime() - DAY_MS);
    return { sundayKst, weekId: weekKeyFromShiftedKstDate(sundayKst) };
}

function reminderProTargetForWednesdayRun(runUtc) {
    const kstNow = new Date(runUtc.getTime() + KST_OFFSET_MS);
    const sundayKst = new Date(kstNow.getTime() - 3 * DAY_MS);
    return { sundayKst, reportKey: weekKeyFromShiftedKstDate(sundayKst) };
}

function formatKstYmdFromUtc(rawUtc) {
    const d = new Date(rawUtc);
    const shifted = new Date(d.getTime() + KST_OFFSET_MS);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function assert(cond, message) {
    if (!cond) throw new Error(message);
}

function run() {
    const mondayRunsUtc = [
        new Date('2026-05-04T04:00:00Z'),
        new Date('2026-05-11T04:00:00Z'),
        new Date('2026-05-18T04:00:00Z'),
        new Date('2026-05-25T04:00:00Z')
    ];

    const wednesdayRunsUtc = [
        new Date('2026-05-06T04:00:00Z'),
        new Date('2026-05-13T04:00:00Z'),
        new Date('2026-05-20T04:00:00Z'),
        new Date('2026-05-27T04:00:00Z')
    ];

    for (const runUtc of mondayRunsUtc) {
        const { sundayKst, weekId } = reminderWeeklyTargetForMondayRun(runUtc);
        const earlySundaySubmitUtc = new Date(sundayKst.getTime() - 15 * 60 * 60 * 1000); // KST 03:00
        const noonSundaySubmitUtc = new Date(sundayKst.getTime() - 6 * 60 * 60 * 1000);   // KST 12:00

        assert(oldReportCoreKey(earlySundaySubmitUtc) !== weekId, `기존키가 mismatch여야 함: ${runUtc.toISOString()}`);
        assert(newReportCoreKey(earlySundaySubmitUtc) === weekId, `신규키가 match여야 함: ${runUtc.toISOString()}`);
        assert(newReportCoreKey(noonSundaySubmitUtc) === weekId, `일요일 낮 작성도 match여야 함: ${runUtc.toISOString()}`);
    }

    for (const runUtc of wednesdayRunsUtc) {
        const { sundayKst, reportKey } = reminderProTargetForWednesdayRun(runUtc);
        const earlySundayRequestUtc = new Date(sundayKst.getTime() - 15 * 60 * 60 * 1000); // KST 03:00

        assert(oldReportCoreKey(earlySundayRequestUtc) !== reportKey, `기존 PRO키가 mismatch여야 함: ${runUtc.toISOString()}`);
        assert(newReportCoreKey(earlySundayRequestUtc) === reportKey, `신규 PRO키가 match여야 함: ${runUtc.toISOString()}`);

        // Reminder fallback 판정 기준(기록 시각 KST 날짜 == 타겟 일요일)
        const targetYmd = formatKstYmdFromUtc(new Date(sundayKst.getTime() - KST_OFFSET_MS).toISOString());
        const itemYmd = formatKstYmdFromUtc(earlySundayRequestUtc.toISOString());
        assert(targetYmd === itemYmd, `fallback 날짜 판정이 true여야 함: ${runUtc.toISOString()}`);
    }

    console.log('PASS: weekKey alignment + legacy fallback simulation OK');
}

run();

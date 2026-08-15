import { Modal } from '../../components/Modal.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { useOverlayDialog } from '../../components/useOverlayDialog.js';
import { useState } from 'react';
import { defaultFormatHms } from './presentation.js';

const DEFAULT_MENU_ITEMS = [
  ['analysis', '분석'],
  ['strategy', '학습 코칭'],
  ['planner', '플래너'],
  ['weekly', '주간 점검'],
  ['report', '프로 보고서']
];

const DEFAULT_STUDY_SUBJECTS = ['국어', '수학', '영어', '탐구'];
const NOTIFICATION_PREVIEW_COUNT = 4;

function StudyStartActivity({ defaultValue = '', selectedSubject = '' }) {
  const [activity, setActivity] = useState(defaultValue);
  return <><label className="study-start-activity"><span>구체적인 학습 내용</span><input className="planner-input" data-field="studyStartActivity" value={activity} onChange={(event) => setActivity(event.currentTarget.value.slice(0, 80))} maxLength="80" placeholder="예: 미적분 기출 20문제 풀이" /><small>최대 80자 · 공부 완료 후 개별 기록에 저장됩니다.</small></label><button type="button" className="btn btn-primary study-start-confirm" data-action="confirmStudyStart" disabled={!selectedSubject || !activity.trim()}>공부 시작</button></>;
}

export function HomeStudyBreakdown({
  breakdownDetailMap = {},
  breakdownSubjects = [],
  expandedBreakdownSubject = '',
  formatHms = defaultFormatHms,
  showStudyBreakdown = false,
  todaySubjectsWithTimer = {}
}) {
  if (!showStudyBreakdown) return null;
  if (!breakdownSubjects.length) return <div className="home-breakdown-list"><p className="home-breakdown-empty">아직 과목별 공부 기록이 없습니다.</p></div>;
  return (
    <div className="home-breakdown-list">
      {breakdownSubjects.map((subject) => {
        const seconds = todaySubjectsWithTimer[subject] || 0;
        const rows = breakdownDetailMap[subject] || [];
        const expanded = expandedBreakdownSubject === subject;
        return (
          <div style={{ display: 'contents' }} key={subject}>
            <button type="button" className={`home-breakdown-item ${expanded ? 'expanded' : ''}`} data-action="toggleBreakdownSubject" data-breakdown-subject={subject}>
              <span className="home-breakdown-subject"><b>{subject}</b><small>{rows.length}개 항목</small></span><span className="home-breakdown-time">{formatHms(seconds)}</span>
            </button>
            {expanded ? (
              <div className="home-breakdown-detail">
                {rows.length ? rows.map((row, index) => {
                  const plannedSeconds = Math.round(row.plannedHour * 3600);
                  const actualSeconds = Math.round(row.actualHour * 3600);
                  const rate = plannedSeconds > 0 ? Math.min(100, Math.round((actualSeconds / plannedSeconds) * 100)) : 0;
                  return <div className="home-breakdown-detail-row" key={row.id || `${subject}-${index}`}><small>{row.content || '학습 항목'}</small><em>계획 {formatHms(plannedSeconds)} · 실제 {formatHms(actualSeconds)}</em><span>{rate}%</span></div>;
                }) : <p className="home-breakdown-empty">오늘 등록된 학습 계획이 없습니다.</p>}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function UniversityModal({
  analysisRecommended = [],
  analysisSearchList = [],
  analysisSearchTerm = '',
  analysisTargetList = [],
  universityModalOpen = false
}) {
  return (
    <Modal open={universityModalOpen} dismissAction="closeUniversityModal">
      <div className="analysis-search-head"><h4>희망 대학 선택</h4><button data-action="closeUniversityModal" aria-label="닫기">✕</button></div>
      <div className="analysis-search-inline"><input className="planner-input" data-field="analysisSearchTerm" defaultValue={analysisSearchTerm} placeholder="대학명 또는 학과명을 검색하세요" /><button type="button" className="btn btn-secondary mini analysis-search-btn" data-action="runUniversitySearch">검색</button></div>
      <div className="analysis-search-section recommend"><p>현재 성적 기준 추천</p><div className="analysis-search-rec-grid">{analysisRecommended.map((name, index) => <button className="analysis-rec-card" data-action="addAnalysisTarget" data-target-major={name} key={`${name}-${index}`}><div><strong>{name}</strong><span className="badge">추천</span></div><em>{analysisTargetList.includes(name) ? '추가됨' : '선택'}</em></button>)}</div></div>
      <div className="analysis-search-section"><p>검색 결과</p>{analysisSearchList.map((name, index) => <button className="analysis-search-row" data-action="addAnalysisTarget" data-target-major={name} key={`${name}-${index}`}>{name}<span>{analysisTargetList.includes(name) ? '추가됨' : '추가'}</span></button>)}</div>
    </Modal>
  );
}

export function TargetDeleteModal({
  targetDeleteCandidate = '',
  targetDeleteError = '',
  targetDeleteModalOpen = false,
  targetDeleteSaving = false
}) {
  return (
    <Modal open={targetDeleteModalOpen} dismissAction={targetDeleteSaving ? 'noopModal' : 'cancelTargetDelete'} panelClass="target-delete-modal">
      <div className="target-delete-modal-head"><span>목표 대학</span><h3>목표 대학에서 삭제할까요?</h3><p><b>{targetDeleteCandidate}</b>을 홈과 분석 탭의 지원학과 목록에서 함께 삭제합니다.</p></div>
      {targetDeleteError ? <p className="target-delete-error">{targetDeleteError}</p> : null}
      <div className="support-btns target-delete-actions"><button type="button" className="btn btn-secondary" data-action="cancelTargetDelete" disabled={targetDeleteSaving}>취소</button><button type="button" className="btn btn-primary danger" data-action="confirmTargetDelete" disabled={targetDeleteSaving}>{targetDeleteSaving ? '삭제 중...' : '삭제'}</button></div>
    </Modal>
  );
}

export function StudySubjectSheet({
  plannedScheduleOptions = [],
  studyStartDraft = {},
  studySubjectSheetOnlyPlanned = false,
  studySubjectSheetOpen = false
}) {
  const selectedSubject = String(studyStartDraft.subject || '');
  const selectedActivity = String(studyStartDraft.activity || '');
  return (
    <Sheet open={studySubjectSheetOpen} panelClass="study-subject-sheet" dismissAction="closeStudySubjectSheet">
      <div className="study-start-head"><span>공부 기록</span><h3>무엇을 공부할까요?</h3><p>과목과 구체적인 학습 내용을 남기면 오늘 기록에서 다시 확인할 수 있어요.</p></div>
      {plannedScheduleOptions.length ? <section className="study-start-section"><b>오늘 플래너에서 선택</b><div className="study-plan-options">{plannedScheduleOptions.map((row) => <button type="button" className={studyStartDraft.plannerItemId === row.id ? 'is-selected' : ''} data-action="selectStudySubject" data-study-subject={row.subject} data-study-activity={row.activity} data-study-item-id={row.id} key={row.id || row.label}><span>{row.subject}</span><b>{row.activity || row.label}</b></button>)}</div></section> : null}
      {!studySubjectSheetOnlyPlanned ? <section className="study-start-section"><b>직접 공부 선택</b><div className="study-subject-grid">{DEFAULT_STUDY_SUBJECTS.map((subject) => <button type="button" className={`planner-pill ${selectedSubject === subject && !studyStartDraft.plannerItemId ? 'active' : ''}`} data-action="selectStudySubject" data-study-subject={subject} key={subject}>{subject}</button>)}<button type="button" className={`planner-pill ${selectedSubject === '기타' && !studyStartDraft.plannerItemId ? 'active' : ''}`} data-action="selectStudySubject" data-study-subject="기타">기타</button></div>{selectedSubject === '기타' ? <input className="planner-input" data-field="studyStartCustomSubject" maxLength="30" placeholder="과목 또는 영역을 입력하세요" /> : null}</section> : null}
      {selectedSubject ? <StudyStartActivity defaultValue={selectedActivity} key={`${selectedSubject}-${studyStartDraft.plannerItemId || 'direct'}`} selectedSubject={selectedSubject} /> : <p className="study-start-guide">플래너 일정이나 과목을 먼저 선택해주세요.</p>}
    </Sheet>
  );
}

export function HomeDrawer({ drawerOpen = false, menuItems = DEFAULT_MENU_ITEMS }) {
  const { onKeyDown, overlayRef, panelRef } = useOverlayDialog({ dismissAction: 'closeDrawer', open: drawerOpen });
  if (!drawerOpen) return null;
  return (
    <div ref={overlayRef} className="sc-overlay home-modal-overlay drawer-overlay" data-action="closeDrawer">
      <aside ref={panelRef} className="side-drawer" data-action="noopModal" role="dialog" aria-modal="true" aria-label="메뉴" tabIndex={-1} onKeyDown={onKeyDown}><h3>메뉴</h3>{menuItems.map(([target, label]) => <button className="my-row" data-action="drawerGoto" data-target={target} key={target}>{label}<span aria-hidden="true">›</span></button>)}</aside>
    </div>
  );
}

export function NotificationPopover({ notifModalOpen = false, notiList = [], notiStatus = 'idle' }) {
  if (!notifModalOpen) return null;
  const previewItems = notiList.slice(0, NOTIFICATION_PREVIEW_COUNT);
  const moreCount = Math.max(0, notiList.length - NOTIFICATION_PREVIEW_COUNT);
  const emptyMessage = notiStatus === 'loading' ? '알림을 불러오는 중...' : notiStatus === 'error' ? '알림을 불러오지 못했습니다.' : '새로운 알림이 없습니다.';
  return (
    <div className="notif-popover-overlay" data-action="closeNotificationModal">
      <div className="notif-popover" data-action="noopModal">
        <div className="notif-popover-head"><b>알림</b><button type="button" className="qna-modal-close" data-action="closeNotificationModal" aria-label="닫기">✕</button></div>
        <div className="notif-popover-list">{previewItems.length ? previewItems.map((notification, index) => {
          const id = String(notification.notiId || notification.id || notification.notificationId || index);
          return <button type="button" className={`notif-popover-item ${notification.isRead ? '' : 'pro-notif-unread'}`} data-action="openNotificationList" data-noti-id={id} key={id}><b>{notification.title}</b><p>{notification.body || notification.message || ''}</p></button>;
        }) : <div className="notif-popover-empty"><p>{emptyMessage}</p></div>}</div>
        {notiList.length ? <button type="button" className="notif-popover-all" data-action="openNotificationList">{moreCount ? `알림 ${moreCount}건 더 보기` : '알림 전체 보기'}</button> : null}
      </div>
    </div>
  );
}

export function HomeOverlays(ctx) {
  return <><UniversityModal {...ctx} /><StudySubjectSheet {...ctx} /><TargetDeleteModal {...ctx} /><HomeDrawer {...ctx} /></>;
}

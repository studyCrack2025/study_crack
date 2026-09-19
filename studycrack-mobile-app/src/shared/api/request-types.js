export const USER_REQUEST_TYPES = Object.freeze({
  DELETE_ADMISSION_EVENT: 'delete_admission_calendar_event',
  GET_ADMISSION_CALENDAR: 'get_admission_calendar',
  GET_CURRENT_USER: 'get_user_analysis',
  GET_PRODUCT_GUIDE: 'get_product_guide',
  SAVE_PRODUCT_GUIDE: 'save_product_guide',
  GET_STUDY_RANKING: 'get_study_ranking',
  GET_STUDY_SUMMARY: 'get_study_summary',
  START_STUDY_SESSION: 'start_study_session',
  COMPLETE_STUDY_SESSION: 'complete_study_session',
  RECORD_STUDY_SESSION: 'record_study_session',
  UPDATE_MEMBER_INFO: 'update_member_info',
  UPDATE_QUALITATIVE: 'update_qual',
  UPDATE_QUANTITATIVE: 'update_quan',
  UPDATE_TARGET_UNIVERSITIES: 'update_target_univs',
  UPSERT_ADMISSION_EVENT: 'upsert_admission_calendar_event'
});

export const GAME_REQUEST_TYPES = Object.freeze({
  ACKNOWLEDGE_DRAW: 'acknowledge_fish_draw',
  CLAIM_STARTER_FISH: 'claim_starter_fish',
  CLAIM_STUDY_REWARD: 'claim_study_reward',
  DRAW_FISH: 'draw_fish',
  FEED_FISH: 'feed_fish',
  GET_CATALOG: 'get_fish_catalog',
  GET_FISH_DETAIL: 'get_fish_detail',
  GET_HABITAT: 'get_study_habitat',
  GET_PENDING_DRAW: 'get_pending_draw',
  GET_PROFILE: 'get_game_profile',
  RENAME_FISH: 'rename_fish',
  SET_ACTIVE_FISH: 'set_active_fish'
});

export const ANALYSIS_REQUEST_TYPES = Object.freeze({
  ANALYZE_TARGETS: 'analyze_my_targets',
  BACKTRACE_REQUIRED_RAW: 'backtrace_required_raw',
  CONVERT_SCORE: 'convert_score',
  GET_TUTORIAL_RECOMMENDATIONS: 'get_tutorial_recommendations',
  GET_UNIVERSITY_CATALOG: 'get_univ_list_only',
  SIMULATE_SCORE_RISE: 'simulate_score_rise'
});

export const NOTIFICATION_REQUEST_TYPES = Object.freeze({
  GET_STUDENT_NOTIFICATIONS: 'student_get_notifications',
  READ_STUDENT_NOTIFICATION: 'student_read_notification'
});

export const REPORT_REQUEST_TYPES = Object.freeze({
  GET_PRESIGNED_URL: 'get_presigned_url',
  GET_PRO_REPORTS: 'get_pro_reports',
  GET_WEEKLY_REPORTS: 'get_weekly_reports',
  REQUEST_PRO_REPORT: 'request_pro_report',
  SAVE_WEEKLY_CHECK: 'save_weekly_check'
});

export const SUPPORT_REQUEST_TYPES = Object.freeze({
  GET_QNA_LIST: 'get_qna_list',
  SAVE_QNA: 'save_qna'
});

export const AUTH_REQUEST_TYPES = Object.freeze({
  LOGOUT: 'logout',
  REGISTER_LOGIN_COOKIES: 'register_login_cookies',
  SEND_EMAIL_AUTH: 'send_email_auth',
  SEND_SMS_AUTH: 'send_sms_auth',
  UPDATE_PROFILE: 'update_profile',
  VERIFY_CODE: 'verify_code'
});

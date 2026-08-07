export const USER_REQUEST_TYPES = Object.freeze({
  DELETE_ADMISSION_EVENT: 'delete_admission_calendar_event',
  GET_ADMISSION_CALENDAR: 'get_admission_calendar',
  GET_CURRENT_USER: 'get_user_analysis',
  GET_STUDY_RANKING: 'get_study_ranking',
  RECORD_STUDY_SESSION: 'record_study_session',
  UPDATE_MEMBER_INFO: 'update_member_info',
  UPDATE_QUALITATIVE: 'update_qual',
  UPDATE_QUANTITATIVE: 'update_quan',
  UPDATE_TARGET_UNIVERSITIES: 'update_target_univs',
  UPSERT_ADMISSION_EVENT: 'upsert_admission_calendar_event'
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

import { AnalysisScreen } from '../screens/analysis/AnalysisScreen.jsx';
import { renderAddUniversityScreen } from '../screens/analysis/renderers.js';
import { CoachingScreen } from '../screens/coaching/CoachingScreen.jsx';
import { HomeScreen } from '../screens/home/HomeScreen.jsx';
import { AccountInfoScreen } from '../screens/mypage/AccountInfoScreen.jsx';
import { MyPageScreen } from '../screens/mypage/MyPageScreen.jsx';
import {
  renderCustomerSupportScreen,
  renderNotificationListScreen,
  renderNotificationSettingsScreen
} from '../screens/mypage/renderers.js';
import { PlannerAddScreen } from '../screens/planner/PlannerAddScreen.jsx';
import { PlannerScreen } from '../screens/planner/PlannerScreen.jsx';
import {
  renderQualInfoScreen,
  renderRankingScreen,
  renderScoreInfoScreen
} from '../screens/profile/renderers.js';
import {
  renderLockedFeatureScreen,
  renderPaymentCompleteScreen,
  renderPaymentScreen,
  renderProEliteScreen,
  renderProIntroScreen,
  renderReportDetailScreen,
  renderReportScreen,
  renderTutorScreen,
  renderWeeklyScreen
} from '../screens/service/renderers.js';

export const MOBILE_APP_SCREEN_COMPONENTS = {
  accountInfo: AccountInfoScreen,
  analysis: AnalysisScreen,
  strategy: CoachingScreen,
  home: HomeScreen,
  my: MyPageScreen,
  planner: PlannerScreen,
  plannerAdd: PlannerAddScreen
};

export function createAppScreenRenderers() {
  return {
    addUniversity: renderAddUniversityScreen,
    customerSupport: renderCustomerSupportScreen,
    lockedFeature: renderLockedFeatureScreen,
    notificationSettings: renderNotificationSettingsScreen,
    notificationList: renderNotificationListScreen,
    payment: renderPaymentScreen,
    paymentComplete: renderPaymentCompleteScreen,
    proElite: renderProEliteScreen,
    proIntro: renderProIntroScreen,
    qualInfo: renderQualInfoScreen,
    ranking: renderRankingScreen,
    report: renderReportScreen,
    reportDetail: renderReportDetailScreen,
    scoreInfo: renderScoreInfoScreen,
    tutor: renderTutorScreen,
    weekly: renderWeeklyScreen
  };
}

import { AnalysisScreen } from '../screens/analysis/AnalysisScreen.jsx';
import { AddUniversityScreen } from '../screens/analysis/AddUniversityScreen.jsx';
import { CoachingScreen } from '../screens/coaching/CoachingScreen.jsx';
import { HomeScreen } from '../screens/home/HomeScreen.jsx';
import { AccountInfoScreen } from '../screens/mypage/AccountInfoScreen.jsx';
import { MyPageScreen } from '../screens/mypage/MyPageScreen.jsx';
import { CustomerSupportScreen, NotificationListScreen, NotificationSettingsScreen } from '../screens/mypage/MyPageSecondaryScreens.jsx';
import { PlannerAddScreen } from '../screens/planner/PlannerAddScreen.jsx';
import { PlannerScreen } from '../screens/planner/PlannerScreen.jsx';
import { QualInfoScreen, RankingScreen, ScoreInfoScreen } from '../screens/profile/ProfileScreens.jsx';
import { ProEliteScreen, ReportDetailScreen, ReportScreen, TutorScreen, WeeklyScreen } from '../screens/service/ServiceContentScreens.jsx';
import { LockedFeatureScreen, PaymentCompleteScreen, PaymentScreen, ProIntroScreen } from '../screens/service/ServicePlanScreens.jsx';

export const MOBILE_APP_SCREEN_COMPONENTS = {
  accountInfo: AccountInfoScreen,
  addUniversity: AddUniversityScreen,
  analysis: AnalysisScreen,
  customerSupport: CustomerSupportScreen,
  strategy: CoachingScreen,
  home: HomeScreen,
  lockedFeature: LockedFeatureScreen,
  my: MyPageScreen,
  notificationList: NotificationListScreen,
  notificationSettings: NotificationSettingsScreen,
  planner: PlannerScreen,
  plannerAdd: PlannerAddScreen,
  payment: PaymentScreen,
  paymentComplete: PaymentCompleteScreen,
  proElite: ProEliteScreen,
  proIntro: ProIntroScreen,
  qualInfo: QualInfoScreen,
  ranking: RankingScreen,
  report: ReportScreen,
  reportDetail: ReportDetailScreen,
  scoreInfo: ScoreInfoScreen,
  tutor: TutorScreen,
  weekly: WeeklyScreen
};

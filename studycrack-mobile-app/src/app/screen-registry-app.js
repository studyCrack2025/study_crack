import '../styles/components/navigation.css';
import '../styles/components/sheets.css';
import '../styles/components/drawers.css';
import '../styles/components/context-header.css';
import '../styles/screens/home-overlays.css';
import '../styles/screens/home-base.css';
import '../styles/screens/home.css';
import '../styles/screens/timer.css';
import '../styles/screens/aquarium.css';
import '../styles/screens/analysis-base.css';
import '../styles/screens/analysis-unified.css';
import '../styles/screens/analysis.css';
import '../styles/screens/planner-calendar.css';
import '../styles/screens/planner.css';
import '../styles/screens/planner-add.css';
import '../styles/screens/coaching.css';
import '../styles/screens/reports.css';
import '../styles/screens/service.css';
import '../styles/screens/mypage-support.css';
import '../styles/screens/mypage-data.css';
import '../styles/screens/mypage.css';
import '../styles/screens/ranking.css';
import '../styles/screens/score-input.css';
import { AnalysisScreen } from '../screens/analysis/AnalysisScreen.jsx';
import { AquariumScreen } from '../screens/aquarium/AquariumScreen.jsx';
import { AddUniversityScreen } from '../screens/analysis/AddUniversityScreen.jsx';
import { CoachingScreen } from '../screens/coaching/CoachingScreen.jsx';
import { HomeScreen } from '../screens/home/HomeScreen.jsx';
import { TimerScreen } from '../screens/timer/TimerScreen.jsx';
import { AccountInfoScreen } from '../screens/mypage/AccountInfoScreen.jsx';
import { MyPageScreen } from '../screens/mypage/MyPageScreen.jsx';
import { CustomerSupportScreen, NotificationListScreen, NotificationSettingsScreen } from '../screens/mypage/MyPageSecondaryScreens.jsx';
import { PlannerAddScreen } from '../screens/planner/PlannerAddScreen.jsx';
import { PlannerScreen } from '../screens/planner/PlannerScreen.jsx';
import { QualInfoScreen, RankingScreen, ScoreInfoScreen } from '../screens/profile/ProfileScreens.jsx';
import { ProEliteScreen, ReportDetailScreen, ReportScreen, TutorScreen, WeeklyScreen } from '../screens/service/ServiceContentScreens.jsx';
import { LockedFeatureScreen, PaymentCompleteScreen, PaymentScreen, ProIntroScreen } from '../screens/service/ServicePlanScreens.jsx';

export const MOBILE_APP_SCREEN_COMPONENTS = {
  timer: TimerScreen,
  aquarium: AquariumScreen,
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

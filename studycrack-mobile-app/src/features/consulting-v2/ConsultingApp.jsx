import React from 'react';
import './styles/consulting-v2-shell.css';
import './styles/consulting-v2-home.css';
import { ConsultingStartScreen } from './screens/ConsultingStartScreen.jsx';
import { ConsultingHomeScreen } from './screens/ConsultingHomeScreen.jsx';
import { CONSULTING_ROUTES, navigateConsulting, resolveConsultingRoute } from './route-model.js';
import { getConsultingRuntimeContext } from '../../shared/browser/mobile-runtime.js';

function LoginScreen({ hasSession }) {
  React.useEffect(() => {
    if (hasSession) navigateConsulting(CONSULTING_ROUTES.home, { replace: true });
  }, [hasSession]);
  return <main className="consulting-v2-center"><section className="consulting-v2-card"><img className="consulting-v2-logo" src="/assets/images/studycrack_logo_wo_bg.png" alt="StudyCrack" /><p className="consulting-v2-kicker">2027 정시 컨설팅</p><h1>계정으로 시작하기</h1><p className="consulting-v2-status">StudyCrack 계정으로 로그인한 뒤 전용 화면으로 돌아옵니다.</p><div className="consulting-v2-actions"><a className="consulting-v2-primary" href={`/login?returnUrl=${encodeURIComponent(CONSULTING_ROUTES.home)}`}>로그인</a><a className="consulting-v2-secondary" href={`/signup?returnUrl=${encodeURIComponent(CONSULTING_ROUTES.home)}`}>회원가입</a></div></section></main>;
}

function PendingScreen({ label }) {
  return <main className="consulting-v2-center"><section className="consulting-v2-card"><p className="consulting-v2-kicker">2027 정시 컨설팅</p><h1>{label}</h1><p className="consulting-v2-status">이 단계의 입력 화면은 다음 구현 순서에서 연결됩니다.</p><button className="consulting-v2-secondary consulting-v2-wide" type="button" onClick={() => navigateConsulting(CONSULTING_ROUTES.home)}>진행 현황으로 돌아가기</button></section></main>;
}

const PENDING_LABELS = Object.freeze({ survey: '기초조사서', materials: '자료 확인', schedule: '상담 일정 선택', writtenSession: '서면 상담', report: '컨설팅 보고서', finalCall: '파이널 콜' });

export default function ConsultingApp() {
  const [pathname, setPathname] = React.useState(() => globalThis.location?.pathname || CONSULTING_ROUTES.home);
  const [sessionRevision, setSessionRevision] = React.useState(0);
  React.useEffect(() => {
    const routeChanged = () => setPathname(globalThis.location?.pathname || CONSULTING_ROUTES.home);
    const sessionChanged = () => setSessionRevision(value => value + 1);
    globalThis.addEventListener?.('popstate', routeChanged);
    globalThis.addEventListener?.('studycrack:session-ended', sessionChanged);
    return () => {
      globalThis.removeEventListener?.('popstate', routeChanged);
      globalThis.removeEventListener?.('studycrack:session-ended', sessionChanged);
    };
  }, []);
  const route = resolveConsultingRoute(pathname);
  const runtime = React.useMemo(getConsultingRuntimeContext, [sessionRevision]);
  const hasSession = runtime.hasClientSession();
  const binding = runtime;

  React.useEffect(() => {
    if (route.screen === 'unknown') navigateConsulting(CONSULTING_ROUTES.home, { replace: true });
    else if (route.protected && !hasSession) navigateConsulting(CONSULTING_ROUTES.login, { replace: true });
  }, [hasSession, route.protected, route.screen]);

  if (route.screen === 'start') return <ConsultingStartScreen binding={binding} hasSession={hasSession} />;
  if (route.screen === 'login' || (route.protected && !hasSession) || route.screen === 'unknown') return <LoginScreen hasSession={hasSession} />;
  if (route.screen === 'home') return <ConsultingHomeScreen binding={binding} />;
  return <PendingScreen label={PENDING_LABELS[route.screen] || '컨설팅'} />;
}

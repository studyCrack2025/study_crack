const { useState } = React;

const CRACKY_SRC = './assets/images/3A1D897F-252E-4096-AEF2-C4FA7CA6689D.png';
const LOGO_SRC = './assets/images/og-image.jpg';

function Layout({ children, bottom, showTabs = false, tab, onTab, title }) {
  return (
    <div className="phone-shell">
      <div className="main-layout bg-gray-100">
        <div className="content-scroll">
          {title ? <h1 className="text-base font-semibold text-gray-900 mb-3">{title}</h1> : null}
          {children}
          {showTabs ? (
            <div className="tab-row">
              {[
                ['home', '홈'],
                ['analysis', '분석'],
                ['strategy', '전략'],
                ['planner', '플래너']
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`tab-btn ${tab === key ? 'active' : ''}`}
                  onClick={() => onTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {bottom ? <div className="fixed-bottom">{bottom}</div> : null}
      </div>
    </div>
  );
}

function BottomButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full h-14 rounded-xl bg-blue-600 text-white font-semibold"
    >
      {children}
    </button>
  );
}

function ChartLine() {
  return (
    <svg viewBox="0 0 320 94" className="w-full h-[92px]" fill="none" aria-hidden>
      <path d="M0 86H320" stroke="#E2E8F0" strokeWidth="2" />
      <path
        d="M12 78C35 74 48 61 68 60C90 58 106 67 128 61C150 55 162 42 182 40C202 38 214 46 236 35C256 25 274 22 308 10"
        stroke="#2563EB"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="308" cy="10" r="4" fill="#2563EB" />
    </svg>
  );
}

function ChartBar() {
  return (
    <div className="relative h-[92px] mt-2">
      <div className="absolute inset-x-1 bottom-0 flex items-end gap-2">
        {[28, 40, 56, 76].map((h, idx) => (
          <div
            key={h}
            style={{ height: `${h}px` }}
            className={`w-6 rounded-t-md ${idx === 3 ? 'bg-blue-600' : 'bg-blue-300'}`}
          />
        ))}
      </div>
      <svg viewBox="0 0 320 94" className="absolute inset-0 w-full h-full" fill="none" aria-hidden>
        <path
          d="M22 80C50 75 92 69 130 60C168 50 204 39 240 27C262 20 282 15 302 10"
          stroke="#2563EB"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function SpeechBubble({ text }) {
  return (
    <div className="w-full bg-white rounded-[18px] shadow-sm h-20 px-3 flex items-center gap-3">
      <img src={CRACKY_SRC} alt="크랙이" className="w-[70px] h-[70px] object-contain shrink-0" />
      <p className="text-[13px] font-semibold text-slate-700 leading-5">{text}</p>
    </div>
  );
}

function OnboardingCard({ variant }) {
  if (variant === 1) {
    return (
      <div className="bg-white rounded-2xl h-[180px] shadow-sm p-4">
        <p className="text-sm text-gray-500">합격 가능성</p>
        <p className="text-4xl font-bold text-blue-600 leading-none mt-1">72%</p>
        <div className="mt-3"><ChartLine /></div>
      </div>
    );
  }
  if (variant === 2) {
    return (
      <div className="bg-white rounded-2xl h-[180px] shadow-sm p-4">
        <p className="text-sm text-gray-500">수학 +12점</p>
        <p className="text-sm text-gray-500 mt-1">합격 가능성 +18%</p>
        <ChartBar />
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {['플래너 & 주간 점검', 'Sky튜터 1:1 피드백', '프로 보고서 (2주 1회)'].map((item) => (
        <div key={item} className="bg-white rounded-xl h-14 shadow-sm px-4 flex items-center">
          <div className="w-7 h-7 rounded-lg border border-blue-100 bg-blue-50 mr-3" />
          <p className="text-sm font-semibold text-gray-800">{item}</p>
        </div>
      ))}
    </div>
  );
}

function OnboardingPage({ step, title, desc, bubble, onNext }) {
  return (
    <Layout
      bottom={
        <div>
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3].map((n) => (
              <i key={n} className={`indicator-dot ${step === n ? 'active' : ''}`} />
            ))}
          </div>
          <BottomButton onClick={onNext}>{step === 3 ? '시작하기' : '다음'}</BottomButton>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center">
        <img src={LOGO_SRC} alt="StudyCrack 로고" className="w-12 h-12 object-contain mb-5" />
        <h2 className="text-xl font-semibold text-gray-900 whitespace-pre-line leading-7">{title}</h2>
        <p className="text-sm text-gray-400 whitespace-pre-line mt-3">{desc}</p>
      </div>
      <div className="mt-6"><OnboardingCard variant={step} /></div>
      <div className="mt-6"><SpeechBubble text={bubble} /></div>
    </Layout>
  );
}

function HomePage({ onNavigate, tab, onTab }) {
  return (
    <Layout
      title="홈 대시보드"
      showTabs
      tab={tab}
      onTab={onTab}
      bottom={<BottomButton onClick={() => onNavigate('pro')}>프로 플랜 보기</BottomButton>}
    >
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <p className="text-sm text-gray-500">합격 가능성</p>
        <div className="flex justify-between items-center mt-1">
          <p className="text-4xl font-bold text-blue-600">68%</p>
          <div className="w-20 h-20 rounded-full" style={{ background: 'conic-gradient(#2563EB 0 68%, #DBEAFE 68% 100%)' }} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-gray-500">
          <div><p className="text-lg font-bold text-gray-900">323</p>현재 점수</div>
          <div><p className="text-lg font-bold text-gray-900">335</p>합격 컷</div>
          <div><p className="text-lg font-bold text-rose-500">-12</p>부족 점수</div>
        </div>
      </div>
      <div className="bg-red-50 border border-red-100 rounded-xl p-3 mt-3 text-sm text-red-700">
        수학이 합격 가능성을 제한하고 있어요.
      </div>
      <div className="disclaimer mt-3">예시 데이터 기반 화면입니다. 데이터 입력 후 정확 분석을 제공합니다.</div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <button className="h-11 rounded-xl bg-white border border-gray-200 text-sm font-semibold" onClick={() => onNavigate('analysis')}>분석</button>
        <button className="h-11 rounded-xl bg-white border border-gray-200 text-sm font-semibold" onClick={() => onNavigate('strategy')}>전략</button>
        <button className="h-11 rounded-xl bg-white border border-gray-200 text-sm font-semibold" onClick={() => onNavigate('planner')}>플래너</button>
      </div>
    </Layout>
  );
}

function AnalysisPage({ onNavigate, tab, onTab }) {
  return (
    <Layout
      title="분석 화면"
      showTabs
      tab={tab}
      onTab={onTab}
      bottom={<BottomButton onClick={() => onNavigate('strategy')}>전략 보기</BottomButton>}
    >
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm text-gray-500">연세대학교 경영학과</p>
        <p className="text-4xl font-bold text-blue-600 mt-1">68%</p>
        <p className="text-xs text-gray-400 mt-2">예시 데이터 기반</p>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm mt-3 space-y-3">
        {[['수학', '88%'], ['탐구', '72%'], ['영어', '64%']].map(([name, value]) => (
          <div key={name}>
            <div className="flex justify-between text-sm mb-1"><span>{name}</span><span>{value}</span></div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600" style={{ width: value }} /></div>
          </div>
        ))}
      </div>
      <div className="disclaimer mt-3">데이터 입력 후 과목별 기여도를 정확하게 분석해드립니다.</div>
    </Layout>
  );
}

function StrategyPage({ onNavigate, tab, onTab }) {
  return (
    <Layout
      title="전략 화면"
      showTabs
      tab={tab}
      onTab={onTab}
      bottom={<BottomButton onClick={() => onNavigate('planner')}>플래너 실행하기</BottomButton>}
    >
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <ol className="space-y-3 text-sm text-gray-700 font-medium">
          <li>1. 수학 2등급 → 1등급</li>
          <li>2. 탐구 1과목 집중</li>
          <li>3. 영어 유지</li>
        </ol>
      </div>
      <div className="disclaimer mt-3">예시 데이터 기반 추천 전략입니다.</div>
    </Layout>
  );
}

function PlannerPage({ onNavigate, tab, onTab }) {
  return (
    <Layout
      title="플래너"
      showTabs
      tab={tab}
      onTab={onTab}
      bottom={<BottomButton onClick={() => onNavigate('pro')}>프로 플랜으로 관리 강화</BottomButton>}
    >
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm text-gray-500">날짜 선택</p>
        <div className="grid grid-cols-7 gap-1 mt-2 text-xs text-center text-gray-600">
          {['월','화','수','목','금','토','일'].map((d) => <div key={d}>{d}</div>)}
          {[12,13,14,15,16,17,18].map((d) => (
            <div key={d} className={`py-1 rounded ${d===14 ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>{d}</div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm mt-3 text-sm text-gray-700">
        <p className="font-semibold">일정 카드</p>
        <p className="mt-2">수학 개념 학습 10:00-12:00</p>
        <p>영어 독해 문제 풀이 13:00-14:30</p>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm mt-3">
        <p className="text-sm text-gray-500">공부 타이머</p>
        <p className="text-4xl font-bold text-blue-600 mt-1">01:25:30</p>
        <p className="text-sm text-gray-500 mt-2">오늘 요약: 총 6시간 30분 / 목표 달성률 82%</p>
      </div>
    </Layout>
  );
}

function ProPlanPage({ onNavigate }) {
  return (
    <Layout
      title="프로 플랜"
      bottom={<BottomButton onClick={() => onNavigate('home')}>홈으로 이동</BottomButton>}
    >
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm text-gray-500">기능 리스트</p>
        <ul className="mt-2 text-sm text-gray-700 space-y-2">
          <li>• 합격 가능성/전략 무제한</li>
          <li>• 플래너/주간 점검 무제한</li>
          <li>• 프로 보고서 2주 1회</li>
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm font-semibold">Standard</p>
          <p className="text-xl font-bold mt-2">월 149,000원</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-blue-600">
          <p className="text-sm font-semibold text-blue-600">Pro</p>
          <p className="text-xl font-bold mt-2">월 299,000원</p>
        </div>
      </div>
      <div className="disclaimer mt-3">가격/분석 화면은 예시 데이터 기준입니다. 실제 데이터 입력 후 정확 결과를 제공합니다.</div>
    </Layout>
  );
}

function App() {
  const [screen, setScreen] = useState('on1');
  const [tab, setTab] = useState('home');

  const go = (next) => {
    setScreen(next);
    if (['home', 'analysis', 'strategy', 'planner'].includes(next)) setTab(next);
  };

  if (screen === 'on1') {
    return (
      <OnboardingPage
        step={1}
        title={'데이터 기반으로\n내 합격 가능성을 분석해요'}
        desc={'흔들리지 않는 방향을\n제시해드립니다.'}
        bubble={'데이터로 방향을 잡아드릴게요'}
        onNext={() => go('on2')}
      />
    );
  }

  if (screen === 'on2') {
    return (
      <OnboardingPage
        step={2}
        title={'나에게 최적화된\n점수 상승 전략을 제공해요'}
        desc={'과목별 효율과 목표 도달 시간을\n정확하게 예측해 드려요.'}
        bubble={'수학만 올려도 합격 확률이 크게 올라요'}
        onNext={() => go('on3')}
      />
    );
  }

  if (screen === 'on3') {
    return (
      <OnboardingPage
        step={3}
        title={'실행부터 관리까지\n끝까지 함께해요'}
        desc={'플래너, 주간 점검, Sky튜터 피드백,\n프로 보고서로 관리합니다.'}
        bubble={'전략부터 실행까지 같이 갈게요'}
        onNext={() => go('home')}
      />
    );
  }

  if (screen === 'analysis') return <AnalysisPage onNavigate={go} tab={tab} onTab={go} />;
  if (screen === 'strategy') return <StrategyPage onNavigate={go} tab={tab} onTab={go} />;
  if (screen === 'planner') return <PlannerPage onNavigate={go} tab={tab} onTab={go} />;
  if (screen === 'pro') return <ProPlanPage onNavigate={go} />;

  return <HomePage onNavigate={go} tab={tab} onTab={go} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

import { SecondaryIntro, SecondaryScreenShell } from '../../components/SecondaryScreen.jsx';
import { TermsModal } from '../../components/TermsModal.jsx';
import { TERMS_CONTENT } from '../../constants/terms.js';

const TERM_ROWS = [
  ['standard', '표준 이용약관'],
  ['privacy', '개인정보 처리방침'],
  ['service', '서비스 이용약관'],
  ['refund', '환불규정'],
  ['marketing', '마케팅 수신 정보 동의']
];

export function SettingsTermsPickerScreen(ctx) {
  const { openTermsType = '', termsContent = TERMS_CONTENT } = ctx;
  return (
    <SecondaryScreenShell screen="settingsTermsPicker" title="약관 보기" overlays={openTermsType ? <TermsModal openTermsType={openTermsType} termsContent={termsContent} /> : null}>
      <div className="sc-secondary-page terms-picker-page">
        <SecondaryIntro eyebrow="LEGAL" title="약관 및 정책" description="서비스 이용과 개인정보 처리 기준을 확인할 수 있어요." />
        <div className="sc-secondary-list settings-list">
          {TERM_ROWS.map(([key, label]) => (
            <button type="button" className="sc-secondary-row" data-action="openTermsModal" data-terms-type={key} key={key}>
              <span className="sc-secondary-row-main"><b>{label}</b><p>전문 보기</p></span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>
    </SecondaryScreenShell>
  );
}

function ReadingScreen({ content, description, eyebrow, screen }) {
  return (
    <SecondaryScreenShell screen={screen} title={content.title}>
      <div className="sc-reading-page">
        <SecondaryIntro eyebrow={eyebrow} title={content.title} description={description} />
        <div className="sc-reading-content">{content.body}</div>
      </div>
    </SecondaryScreenShell>
  );
}

export function PrivacyPolicyScreen({ termsContent = TERMS_CONTENT }) {
  const content = termsContent.privacy || TERMS_CONTENT.privacy;
  return <ReadingScreen screen="privacyPolicy" eyebrow="PRIVACY" content={content} description="개인정보의 수집·이용·보관 기준을 안내합니다." />;
}

export function TermsScreen({ termsContent = TERMS_CONTENT }) {
  const content = termsContent.service || TERMS_CONTENT.service;
  return <ReadingScreen screen="termsScreen" eyebrow="TERMS" content={content} description="서비스 이용 조건과 책임 범위를 확인해주세요." />;
}

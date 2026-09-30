# Legal content maintenance

`legacy.json` is the shared source for five general-member documents shown in mobile, standard signup, social signup, and standalone policy pages. The filename is retained for continuity; schema 2 distinguishes unchanged `legacy` snapshots from owner-approved wording clarifications (`clarified`).

- `revision` is a content fingerprint, not evidence of consent or a historical effective date.
- Unknown effective dates remain `null`; no retroactive consent is inferred.
- Do not edit generated copies in `signup.html`, `js/social-callback.js`, or `studycrack-mobile-app/src/constants/terms.js` by hand.
- Run `node tools/legal-content.mjs generate`, then `node tools/legal-content.mjs check` and `node --test tools/test/legal-content.test.mjs` from the repository root. CI also checks drift.
- The generator only replaces marked legal regions in the existing web files. HTML is escaped, and mobile/social rendering receives text rather than executable markup.

Schema 2 adds `clarified` documents with a `clarified-*` fingerprint and `revisedAt` editorial date. Service/refund wording follows the existing pre-analysis full-refund rule. Privacy wording reflects the confirmed contact, external services and general-data deletion/statutory-record separation principle. These three documents were clarified on 2026-09-27 at the owner's request. This is not a legal-review certification, an effective date, or evidence that existing users consented. Effective dates remain null. Other documents remain unchanged legacy snapshots. Formal effective-date, notice and consent recording require separate review.

`terms.html`, `privacy.html`, `refund.html`, and `delete-account.html` are generated too. Homepage/analysis no longer maintain policy copies: their links and legacy modal entry points lead to these pages. Published support contacts are used for deletion requests; no form, automatic deletion, completion deadline, or complete cleanup is promised.

Tutor contracts remain separate. Purchase-specific notices distinguish one-off products from four-week plans. The service text refers to the canonical refund policy instead of a conflicting no-refund/automatic-renewal policy. FAQ and support replies must preserve the pre-analysis full-refund rule and statutory/company-fault exceptions. Prices, entitlements and payment/refund processing are unchanged. No new partial-refund formula or retrospective consent is inferred.

Only public-facing policy content belongs here. Never add personal records, credentials, internal infrastructure, or private compliance evidence.

The privacy clarification is not final submission clearance. Provider legal entities/contracts, cross-border disclosures, active analytics tags and operational retention/deletion verification still require confirmation. Do not turn unknown settings into categorical claims of no transfer, no outsourcing, complete deletion or a made-up retention period. Keep unconfirmed operational details in the internal review, not as placeholders in published text.

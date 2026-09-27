# Legal content maintenance

`legacy.json` is the shared source for the five existing general-member documents shown in mobile, standard signup, social signup, and standalone policy pages. It is a migration snapshot, not a newly approved legal policy.

- `revision` is a content fingerprint, not evidence of consent or a historical effective date.
- Unknown effective dates remain `null`; no retroactive consent is inferred.
- Do not edit generated copies in `signup.html`, `js/social-callback.js`, or `studycrack-mobile-app/src/constants/terms.js` by hand.
- Run `node tools/legal-content.mjs generate`, then `node tools/legal-content.mjs check` and `node --test tools/test/legal-content.test.mjs` from the repository root. CI also checks drift.
- The generator only replaces marked legal regions in the existing web files. HTML is escaped, and mobile/social rendering receives text rather than executable markup.

This initial format deliberately supports only legacy snapshots. An approved policy release requires an explicit format/version transition, effective-date and notice review, and corresponding tests. Changing a fingerprint is not policy approval.

`terms.html`, `privacy.html`, `refund.html`, and `delete-account.html` are generated too. Homepage/analysis no longer maintain policy copies: their links and legacy modal entry points lead to these pages. Published support contacts are used for deletion requests; no form, automatic deletion, completion deadline, or complete cleanup is promised.

Tutor contracts remain separate. Purchase-specific notices distinguish one-off products from four-week plans; this does not change prices, entitlements, refunds, or payment processing. Corrected legal wording and consent-version storage remain separate from this migration. Do not treat publication of the legacy pages as a new legal approval.

Only public-facing policy content belongs here. Never add personal records, credentials, internal infrastructure, or private compliance evidence.

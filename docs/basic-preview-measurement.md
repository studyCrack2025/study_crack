# Basic preview measurement — dev integration

This branch starts from dev, which does not yet contain measurement-v2.js. It preserves dev's four dataLayer event names while restricting parameters to known states and records the unauthenticated login redirect. If SCTrack V2 is present, the bridge uses the established analysis_view/score_impact_view/cta_click semantics and forwards preview start/state.

This PR alone does not complete the production measurement rollout. When V2 is integrated through dev, its event/field allowlists must accept basic_preview_start, basic_preview_state and preview_state; GTM must map and allow those fields, and GA4 needs the preview_state event-scoped dimension. Existing production V2 adapter and regression changes are retained in closed draft PR #373 for that integration. Do not import unrelated main history to make this branch work.

Local verification: node tools/test-basic-preview-measurement.cjs and node --check js/basic-preview.js. Tests use no network and do not demonstrate GTM/GA4 receipt. Google administrative access remains blocked (GTM container unavailable to the service account; GA4 custom-dimension creation denied). Merge target is dev. Any production main change must come through dev, with coordinated settings and live receipt verification.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [profileScreens, profileHandlers, scoreResources, universityResources, packageSource] = await Promise.all([
  readFile(new URL('../src/screens/profile/ProfileScreens.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/handlers/profile-handlers.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/analysis/use-score-resources.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/analysis/use-university-resources.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);

assert.match(profileScreens, /data-action="retryRanking"/);
assert.match(profileHandlers, /retryRanking\(\)/);
assert.match(profileHandlers, /refreshStudyRanking\?\.\(\)/);
assert.match(profileScreens, /scoreInfoSubjects\.length\s*\?/);
assert.match(profileScreens, /아직 저장된 시험 성적이 없어요/);

assert.match(scoreResources, /createAnalysisSession/);
assert.match(scoreResources, /ownerOf\(current\) !== owner/);
assert.match(scoreResources, /resolveAnalysisExamMode\(current\) !== exam/);
const sessionSource = await readFile(new URL('../src/features/analysis/analysis-session.js', import.meta.url), 'utf8');
assert.match(sessionSource, /entries\.get\(exam\) === entry && !entry\.controller\.signal\.aborted/);
assert.match(sessionSource, /previous && \(!forced \|\| previous\.busy\)/);
assert.match(universityResources, /catalogRequestRef\.current !== requestKey/);
assert.match(universityResources, /recommendationRequestRef\.current !== requestKey/);
assert.match(packageSource, /check-phase-three-auth-onboarding-tracer\.mjs && node scripts\/check-phase-three-analysis-profile-tracer\.mjs && node scripts\/check-phase-three-service-tracer\.mjs/);

console.log('phase 3 analysis/profile tracer contract ok');

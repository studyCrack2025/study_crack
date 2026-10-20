export function validateDevSmokeConfig(env) {
  const email = String(env.STUDYCRACK_DEV_SMOKE_EMAIL || '').trim();
  const password = String(env.STUDYCRACK_DEV_SMOKE_PASSWORD || '');
  const expectedCommit = String(env.STUDYCRACK_DEV_SMOKE_COMMIT || '');
  const baseUrl = String(env.STUDYCRACK_DEV_MOBILE_URL || 'https://dev.studycrack.co.kr/studycrack-mobile.html');
  if (!email || !password || !/^[a-f0-9]{40}$/.test(expectedCommit)) throw new Error('A test account and full expected dev commit are required.');
  const url = new URL(baseUrl);
  if (url.origin !== 'https://dev.studycrack.co.kr' || url.username || url.password || url.search || url.hash
    || !['/studycrack-mobile', '/studycrack-mobile.html'].includes(url.pathname)) throw new Error('Use the approved dev mobile URL.');
  return { email, password, baseUrl: url.href, expectedCommit };
}

export function assertDevReleaseIdentity(identity, expectedCommit) {
  if (identity?.schema !== 1 || identity.commit !== expectedCommit || identity.release !== `dev-${expectedCommit.slice(0, 8)}`) throw new Error('The expected dev release is not deployed.');
}

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertPublicReferences, assertSafePath, buildSiteRelease, cacheControlFor, createPublishCommands, IMMUTABLE, isBuildPath, loadPublicPolicy, NO_CACHE, verifySiteRelease } from '../site-release.mjs';

const commit = 'a'.repeat(40);
const release = 'dev-aaaaaaaa';
const dist = 'studycrack-mobile-app/dist';
const policy = {
  files: ['index.html', 'studycrack-mobile.html', 'studycrack-mobile.webmanifest', 'css/main.css', 'js/config.js', 'js/shared/api.js', 'js/client-diagnostics.js', 'assets/pwa/icon.png'],
  aliases: { 'promotion/kcc01': 'index.html' }
};
async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'studycrack-release-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'source');
  const output = path.join(directory, 'artifact');
  async function put(name, content) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), content);
  }
  await put('tools/public-site-files.json', JSON.stringify(policy));
  await put('tools/bump_asset_version.sh', await readFile(new URL('../bump_asset_version.sh', import.meta.url)));
  const html = '<html><head><link href="/css/main.css?v=old" rel="stylesheet"></head><script src="/js/config.js?v=old"></script></html>';
  for (const file of policy.files) await put(file, file.endsWith('.html') ? html : file.endsWith('.css') ? 'body{background:url(/assets/pwa/icon.png)}' : 'fixture');
  await put(`${dist}/studycrack-mobile.bundle.js`, 'import "./chunks/view-12345678.js";');
  await put(`${dist}/studycrack-mobile.css`, 'body{display:block}');
  await put(`${dist}/chunks/view-12345678.js`, 'export const artwork="/studycrack-mobile-app/dist/assets/fish-12345678.webp";');
  await put(`${dist}/assets/fish-12345678.webp`, 'fixture artwork');
  for (const file of ['docs/private.md', 'backend-backup/private.js', '.env', 'css/main.css.bak', 'js/dev-mock.local.js', 'studycrack-mobile-app/src/secret.js', 'studycrack-mobile-app/package.json']) await put(file, 'must stay outside deployment');
  return { root, output, put, html };
}

test('only approved files are copied, versioned and sealed without changing source', async (t) => {
  const ctx = await fixture(t);
  const { digest, manifest } = await buildSiteRelease({ ...ctx, commit, release });
  assert.equal(manifest.files.length, policy.files.length + 7);
  assert.equal(await readFile(path.join(ctx.root, 'index.html'), 'utf8'), ctx.html);
  const publicHtml = await readFile(path.join(ctx.output, 'site/index.html'), 'utf8');
  assert.match(publicHtml, /main\.css\?v=dev-aaaaaaaa/);
  assert.match(publicHtml, /config\.js\?v=dev-aaaaaaaa/);
  assert.equal(await readFile(path.join(ctx.output, 'site/promotion/kcc01'), 'utf8'), publicHtml);
  assert.equal((await verifySiteRelease({ ...ctx, commit, expectedDigest: digest })).digest, digest);
  assert.ok(manifest.files.every(({ path: file }) => !/private|secret|\.env|\.bak|dev-mock/.test(file)));
  await assert.rejects(buildSiteRelease({ ...ctx, commit, release }), /EEXIST/);
  assert.equal(await readFile(path.join(ctx.output, 'site/index.html'), 'utf8'), publicHtml);
});

test('identical inputs produce identical manifest identities', async (t) => {
  const ctx = await fixture(t);
  const first = await buildSiteRelease({ ...ctx, commit, release });
  const second = await buildSiteRelease({ ...ctx, output: `${ctx.output}-second`, commit, release });
  assert.equal(first.digest, second.digest);
});

test('public release identity is generated consistently without exposing the file manifest', async (t) => {
  const ctx = await fixture(t);
  await buildSiteRelease({ ...ctx, commit, release });
  const identity = JSON.parse(await readFile(path.join(ctx.output, 'site/release.json'), 'utf8'));
  assert.deepEqual(identity, { schema: 1, release, commit });
  const html = await readFile(path.join(ctx.output, 'site/index.html'), 'utf8');
  assert.match(html, /<meta name="studycrack-release" content="dev-aaaaaaaa">/);
  assert.match(html, /src="\/js\/release\.js\?v=dev-aaaaaaaa"/);
  assert.match(html, /<script async src="\/js\/release\.js/);
  const runtime = await readFile(path.join(ctx.output, 'site/js/release.js'), 'utf8');
  assert.match(runtime, /Object\.freeze/);
  assert.match(runtime, /STUDYCRACK_RELEASE/);
  assert.doesNotMatch(runtime, /files|sha256|token|email/);
  assert.equal(await readFile(path.join(ctx.root, 'index.html'), 'utf8'), ctx.html);
});

for (const mutation of ['bytes', 'extra', 'missing', 'manifest', 'source-commit', 'digest', 'symlink']) {
  test(`verification rejects ${mutation} changes after verification`, async (t) => {
    const ctx = await fixture(t);
    const { digest } = await buildSiteRelease({ ...ctx, commit, release });
    const file = path.join(ctx.output, 'site/js/config.js');
    let expectedDigest = digest;
    let expectedCommit = commit;
    if (mutation === 'bytes') await writeFile(file, 'changed');
    if (mutation === 'extra') await writeFile(path.join(ctx.output, 'site/leaked.html'), 'unlisted');
    if (mutation === 'missing') await rename(file, path.join(ctx.root, 'saved.js'));
    if (mutation === 'manifest') await writeFile(path.join(ctx.output, 'manifest.json'), '{}');
    if (mutation === 'source-commit') expectedCommit = 'b'.repeat(40);
    if (mutation === 'digest') expectedDigest = '0'.repeat(64);
    if (mutation === 'symlink') { await rename(file, path.join(ctx.root, 'saved.js')); await symlink(path.join(ctx.root, 'saved.js'), file); }
    await assert.rejects(verifySiteRelease({ ...ctx, commit: expectedCommit, expectedDigest }));
  });
}

test('unsafe paths, metadata, source maps and development files fail closed', async (t) => {
  const ctx = await fixture(t);
  for (const name of ['../index.html', '/index.html', '.env', 'assets/.secret/image.png', 'a//b.js', 'a\\b.js', 'a%2fb.js']) assert.throws(() => assertSafePath(name));
  for (const name of [`${dist}/chunks/app-12345678.js.map`, `${dist}/package.json`, `${dist}/src/main.js`]) assert.equal(isBuildPath(name), false);
  await ctx.put(`${dist}/chunks/app-12345678.js.map`, '{}');
  await assert.rejects(buildSiteRelease({ ...ctx, commit, release }), /Unexpected build output/);
  await ctx.put('tools/public-site-files.json', JSON.stringify({ files: [...policy.files, 'js/dev-mock.local.js'] }));
  await assert.rejects(loadPublicPolicy(ctx.root), /Development file/);
  await ctx.put('tools/public-site-files.json', JSON.stringify({ files: [...policy.files, 'docs/private.md'] }));
  await assert.rejects(loadPublicPolicy(ctx.root), /Non-public file/);
});

test('source directory symlinks cannot leak files into an approved path', async (t) => {
  const ctx = await fixture(t);
  await rename(path.join(ctx.root, 'js'), path.join(ctx.root, 'saved-js'));
  await symlink(path.join(ctx.root, 'saved-js'), path.join(ctx.root, 'js'));
  await assert.rejects(buildSiteRelease({ ...ctx, commit, release }), /Symlink/);
});

test('missing HTML, stylesheet and split-bundle dependencies fail before upload', () => {
  for (const [owner, content] of [
    ['index.html', '<script src="/js/missing.js"></script>'],
    ['css/main.css', 'body{background:url(../assets/missing.png)}'],
    [`${dist}/studycrack-mobile.bundle.js`, 'import "./chunks/missing-12345678.js";']
  ]) assert.throws(() => assertPublicReferences(new Map([[owner, Buffer.from(content)]])), /Missing public dependency/);
  assert.doesNotThrow(() => assertPublicReferences(new Map([['index.html', Buffer.from('<img src="data:image/png;base64,AA"><link href="https://fonts.example/font.css">')]])));
});

test('publication uploads dependencies before entrypoints and never deletes remote data', () => {
  const commands = createPublishCommands('/safe/artifact/site', 'test.example', policy.aliases);
  assert.ok(commands.every((args) => !args.includes('--delete') && args[1] !== 'rm'));
  assert.ok(commands.every((args) => args[2].startsWith('/safe/artifact/site')));
  assert.ok(commands[0][2].endsWith('/dist/chunks'));
  assert.ok(commands[0].includes(IMMUTABLE));
  for (const file of ['js/config.js', 'js/shared/api.js', `${dist}/studycrack-mobile.bundle.js`, `${dist}/studycrack-mobile.css`]) {
    assert.ok(commands.some((args) => args[2].endsWith(`/${file}`) && args.includes(NO_CACHE)));
  }
  assert.ok(commands.some((args) => args.includes('promotion/kcc01') && args.includes('text/html; charset=utf-8')));
  assert.ok(commands.some((args) => args.includes('application/manifest+json; charset=utf-8')));
  assert.ok(commands.at(-1)[2].endsWith('/release.json'), 'release marker must be published last');
  for (const file of ['release.json', 'js/release.js']) {
    assert.equal(cacheControlFor(file), NO_CACHE);
    assert.ok(commands.some((args) => args[1] === 'cp' && args[2].endsWith(`/${file}`) && args.includes(NO_CACHE)));
  }
  assert.throws(() => createPublishCommands('/safe/site', 'bucket/other', {}), /Invalid static bucket/);
});

test('a retained artifact is verified without rebuilding or changing its source identity', async (t) => {
  const ctx = await fixture(t);
  const old = await buildSiteRelease({ ...ctx, commit, release });
  const oldManifest = await readFile(path.join(ctx.output, 'manifest.json'));
  await ctx.put('index.html', '<html><head></head><body>new source</body></html>');
  const result = await verifySiteRelease({ ...ctx, commit, expectedDigest: old.digest });
  assert.equal(result.manifest.commit, commit);
  assert.ok((await readFile(path.join(ctx.output, 'manifest.json'))).equals(oldManifest));
  await ctx.put('tools/public-site-files.json', JSON.stringify({ ...policy, files: [...policy.files, 'new-required.html'] }));
  await assert.rejects(verifySiteRelease({ ...ctx, commit, expectedDigest: old.digest }), /Missing public file/);
});

test('pre-identity artifacts fail closed rather than being silently rewritten for rollback', async (t) => {
  const ctx = await fixture(t);
  await buildSiteRelease({ ...ctx, commit, release });
  const manifestPath = path.join(ctx.output, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.schema = 1;
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(verifySiteRelease({ ...ctx, commit }), /Unsupported release manifest/);
});

test('manual rollback stays in the deployment workflow and cannot bypass verification or rebuild old code', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const rollback = workflow.slice(workflow.indexOf('  rollback:'), workflow.indexOf('  deploy:'));
  const deploy = workflow.slice(workflow.indexOf('  deploy:'));
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(rollback, /github.event_name == 'workflow_dispatch'/);
  assert.match(rollback, /actions: read/);
  assert.doesNotMatch(rollback, /id-token: write|configure-aws-credentials|npm (?:ci|install|run build)|site-release\.mjs publish/);
  assert.ok(rollback.indexOf('rollback-source.mjs') < rollback.indexOf('actions/download-artifact@v4'));
  assert.match(rollback, /artifact-ids: .*steps\.source\.outputs\.artifactId/);
  assert.ok(rollback.indexOf('site-release.mjs verify') < rollback.indexOf('actions/upload-artifact@v4'));
  assert.match(deploy, /needs: \[verify, rollback\]/);
  assert.match(deploy, /always\(\) && !cancelled\(\)/);
  assert.match(deploy, /needs\.verify\.result == 'success'/);
  assert.match(deploy, /needs\.rollback\.result == 'success'/);
  assert.match(deploy, /publish release-artifact "\$RELEASE_COMMIT" "\$VERIFIED_DIGEST"/);
  assert.doesNotMatch(deploy, /publish release-artifact "\$GITHUB_SHA"/);
  assert.ok(deploy.indexOf('invalidation-completed') < deploy.indexOf('smoke-site-release.mjs'));
  assert.ok(deploy.indexOf('smoke-site-release.mjs') < deploy.indexOf('Record published release'));
  assert.doesNotMatch(workflow, /run:.*\$\{\{ inputs\./);
});

test('workflow passes the tested artifact and independent digest to a non-building deploy job', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const verify = workflow.slice(workflow.indexOf('  verify:'), workflow.indexOf('  deploy:'));
  const deploy = workflow.slice(workflow.indexOf('  deploy:'));
  assert.match(verify, /STUDYCRACK_PREVIEW_ROOT: .*release-artifact\/site/);
  assert.ok(verify.indexOf('Test the public artifact') < verify.indexOf('Seal verified artifact identity'));
  assert.ok(verify.indexOf('Seal verified artifact identity') < verify.indexOf('Upload verified public artifact'));
  assert.match(deploy, /actions\/download-artifact@v4/);
  assert.match(deploy, /needs\.verify\.outputs\.artifact-name/);
  assert.match(deploy, /needs\.verify\.outputs\.manifest-digest/);
  assert.doesNotMatch(deploy, /npm (?:ci|install|run build)|bump_asset_version|aws s3 sync \./);
  assert.ok(deploy.indexOf('site-release.mjs verify') < deploy.indexOf('Configure AWS credentials'));
  assert.match(deploy, /site-release\.mjs publish/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(verify, /if-no-files-found: error/);
});

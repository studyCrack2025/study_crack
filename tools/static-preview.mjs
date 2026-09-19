// 로컬 프리뷰 전용 정적 서버 (개발 검증용). 배포와 무관.
import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheControlFor } from './site-release.mjs';

// 검증 산출물을 지정하지 않으면 실행 cwd와 무관하게 저장소 루트를 사용한다.
const ROOT = await realpath(process.env.STUDYCRACK_PREVIEW_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0]);
    if (path === '/') path = process.env.STUDYCRACK_PREVIEW_ROOT ? '/index.html' : '/studycrack-mobile.html';
    if (path === '/studycrack-mobile' || path === '/studycrack-mobile/') {
      path = '/studycrack-mobile.html';
    }
    if (path.split('/').some((part) => part.startsWith('.')) || path.includes('\\')) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const requested = resolve(ROOT, `.${path}`);
    let filePath;
    try { filePath = await realpath(requested); }
    catch (error) {
      if (error.code !== 'ENOENT' || extname(path)) throw error;
      filePath = await realpath(`${requested}.html`);
    }
    const inside = relative(ROOT, filePath);
    if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath)] || (!extname(filePath) ? 'text/html; charset=utf-8' : 'application/octet-stream'),
      'Cache-Control': process.env.STUDYCRACK_PREVIEW_ROOT ? cacheControlFor(inside.split(sep).join('/')) : 'no-store'
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`StudyCrack mobile: http://localhost:${PORT}/studycrack-mobile`);
});

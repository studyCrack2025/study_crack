import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../src/', import.meta.url);
const files = [];

async function collect(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dirUrl);
    if (entry.isDirectory()) {
      await collect(child);
    } else if (entry.name.endsWith('.js')) {
      // .js만 node --check로 문법 검증. .jsx는 node가 파싱 못 하므로 제외하고
      // vite build(esbuild 트랜스파일)가 문법 검증을 담당한다(JSX 점진 이관).
      files.push(child);
    }
  }
}

function check(fileUrl) {
  return new Promise((resolve, reject) => {
    const filePath = fileURLToPath(fileUrl);
    const child = spawn(process.execPath, ['--check', filePath], { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`node --check failed: ${filePath}`));
    });
  });
}

await collect(root);
for (const file of files) {
  await check(file);
}

console.log(`checked ${files.length} source files`);

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
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
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

import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function summarizeResults(report) {
  const files = new Map();
  function visit(suites) {
    for (const suite of suites) {
      for (const spec of suite.specs || []) {
        const row = files.get(spec.file) || { file: spec.file, tests: 0, duration: 0, unexpected: 0, flaky: 0 };
        for (const test of spec.tests) {
          row.tests += 1;
          row.duration += test.results.reduce((total, result) => total + result.duration, 0);
          row.unexpected += Number(test.status === 'unexpected');
          row.flaky += Number(test.status === 'flaky');
        }
        files.set(spec.file, row);
      }
      visit(suite.suites || []);
    }
  }
  visit(report.suites);
  return { stats: report.stats, files: [...files.values()].sort((a, b) => b.duration - a.duration) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = summarizeResults(JSON.parse(await readFile(process.argv[2], 'utf8')));
  const seconds = ms => (ms / 1000).toFixed(1);
  const lines = [
    '### Browser verification timing',
    `Wall time: ${seconds(summary.stats.duration)}s; passed ${summary.stats.expected}, failed ${summary.stats.unexpected}, flaky ${summary.stats.flaky}, skipped ${summary.stats.skipped}.`,
    '', '| File | Cases | Test time (s) | Failed | Flaky |', '|---|---:|---:|---:|---:|',
    ...summary.files.slice(0, 15).map(row => `| ${row.file.replace(/[|\r\n]/g, ' ')} | ${row.tests} | ${seconds(row.duration)} | ${row.unexpected} | ${row.flaky} |`),
    '', 'Test time is cumulative; it is not runner queue or deployment time.', ''
  ].join('\n');
  console.log(lines);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, lines);
}

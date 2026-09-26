import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = path.join(root, 'docs/reports');
fs.mkdirSync(report, { recursive: true });
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-concurrency=1', 'tests/workflow.test.mjs'], {
  cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024,
});
const output = (result.stdout ?? '') + (result.stderr ?? '');
fs.writeFileSync(path.join(report, 'workflow-tests.tap'), output);
const files = ['starter/scripts/workflow.mjs', 'tests/workflow.test.mjs', 'scripts/init-project.mjs',
  'scripts/demo-fixtures.mjs', 'package-lock.json'];
fs.writeFileSync(path.join(report, 'workflow-tests.json'), JSON.stringify({
  executedAt: new Date().toISOString(), node: process.version, openspec: '1.13.1',
  exitCode: result.status, error: result.error?.message ?? null,
  command: ['node', '--test', '--test-reporter=tap', '--test-concurrency=1', 'tests/workflow.test.mjs'],
  tests: Number(/^# tests (\d+)\s*$/m.exec(output)?.[1] ?? 0),
  failures: Number(/^# fail (\d+)\s*$/m.exec(output)?.[1] ?? -1),
  inputHashes: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')])),
}, null, 2) + '\n');
console.log(output);
process.exitCode = result.status ?? 1;

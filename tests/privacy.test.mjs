import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { redact, pathIssues, scan, installHooks, pushTips } from '../starter/scripts/privacy.mjs';
import { readWorkflowConfig, runWorkflow } from '../starter/scripts/workflow.mjs';
import { initProject } from '../scripts/init-project.mjs';
import { appFixture, fillChange, put } from '../scripts/demo-fixtures.mjs';

const parent = fs.mkdtempSync(path.resolve('.sandbox/privacy-'));
const hash = data => createHash('sha256').update(data).digest('hex');
const source = path.resolve('starter/scripts/privacy.mjs');
let counter = 0;
function git(root, args, success = true) {
  const result = spawnSync('git', ['-c', 'user.name=Privacy Test', '-c', 'user.email=test@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], { cwd: root, encoding: 'utf8', timeout: 60000 });
  if (success) assert.equal(result.status, 0, result.stderr + result.stdout);
  return result;
}
function repo() {
  const root = path.join(parent, 'repo-' + ++counter);
  fs.mkdirSync(root); git(root, ['init', '-q']);
  fs.mkdirSync(path.join(root, 'scripts')); fs.copyFileSync(source, path.join(root, 'scripts/privacy.mjs'));
  // The checker itself contains regexes for paths, not personal path literals.
  put(root, '.gitignore', 'workflow.local.json\n.workflow/private/\n.workflow/imports/\n');
  return root;
}

test('Path redaction handles runtime, JSON, file URLs and encoded forms without changing input', () => {
  const root = parent, original = root + path.sep + 'tests' + path.sep + 'feature.py';
  const forms = [original, original.replaceAll('\\', '/'), JSON.stringify(original),
    new URL('file:///' + original.replaceAll('\\', '/')).href, encodeURIComponent(original)];
  for (const value of forms) {
    assert.ok(pathIssues(value, root).length, 'scanner should catch a private path form');
    const publicText = redact(value, root);
    assert.ok(publicText.includes('<PROJECT_ROOT>'), publicText);
    assert.deepEqual(pathIssues(publicText, root), []);
  }
  assert.equal(redact('tests/feature.py and https://example.invalid/docs', root), 'tests/feature.py and https://example.invalid/docs');
  const fake = ['C:', 'Users', 'Example User', 'file.py'].join('\\');
  assert.ok(pathIssues(fake, root).length);
  assert.deepEqual(pathIssues(redact(fake, root), root), []);
  const unicodeRoot = path.join(parent, '私人目錄');
  assert.ok(pathIssues(encodeURI(unicodeRoot + '/file.txt'), unicodeRoot).length);
  assert.deepEqual(pathIssues('python tool available', root, ['python']), []);
});

test('Staged scan reads the index, not later worktree changes; emits no private content', () => {
  const root = repo();
  put(root, 'note.md', root); git(root, ['add', 'note.md']); put(root, 'note.md', 'clean');
  const dirty = scan(root);
  assert.equal(dirty.passed, false);
  assert.ok(!JSON.stringify(dirty).includes(root));
  git(root, ['add', 'note.md']); put(root, 'note.md', root);
  assert.equal(scan(root).passed, true);
});

test('Forced local files are blocked and exact reviewed binary exceptions expire', () => {
  const root = repo();
  put(root, 'workflow.local.json', '{}'); git(root, ['add', '-f', 'workflow.local.json']);
  assert.ok(scan(root).findings.some(item => item.reason === 'private-file-must-stay-local'));
  git(root, ['rm', '--cached', 'workflow.local.json']);
  const data = Buffer.from([0, 1, 2, 3]); put(root, 'asset.bin', data); git(root, ['add', 'asset.bin']);
  assert.equal(scan(root).passed, false);
  put(root, 'privacy-allowlist.json', JSON.stringify([{ file: 'asset.bin', sha256: hash(data), reason: 'reviewed test asset' }]));
  // Unstaged exceptions must not silently authorize a commit.
  assert.equal(scan(root).passed, false);
  git(root, ['add', 'privacy-allowlist.json']); assert.equal(scan(root).passed, true);
  put(root, 'asset.bin', Buffer.from([0, 4])); git(root, ['add', 'asset.bin']);
  assert.equal(scan(root).passed, false);
});

test('Hooks preserve existing tools and block actual commits, commit messages and pushes', () => {
  const root = repo();
  put(root, '.git/hooks/pre-push', '#!/bin/sh\n# existing tool\n');
  assert.throws(() => installHooks(root), /Existing pre-push/);
  assert.equal(fs.existsSync(path.join(root, '.git/hooks/pre-commit')), false);
  fs.unlinkSync(path.join(root, '.git/hooks/pre-push'));
  assert.equal(installHooks(root).installed, true); assert.equal(installHooks(root).installed, true);
  put(root, 'note.md', root); git(root, ['add', 'note.md']);
  assert.notEqual(git(root, ['commit', '-m', 'private file'], false).status, 0);
  put(root, 'note.md', 'clean'); git(root, ['add', 'note.md']);
  assert.notEqual(git(root, ['commit', '-m', root], false).status, 0);
  git(root, ['add', '.']); git(root, ['commit', '-m', 'clean']);
  const remote = path.join(parent, 'remote-' + ++counter); fs.mkdirSync(remote); git(remote, ['init', '--bare', '-q']);
  git(root, ['remote', 'add', 'test', remote]);
  git(root, ['push', 'test', 'HEAD:refs/heads/clean']);
  // Simulate an old bypass: tip becomes clean again, but leaked historical blob remains reachable.
  put(root, 'note.md', root); git(root, ['add', 'note.md']); git(root, ['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'old leak']);
  put(root, 'note.md', 'clean again'); git(root, ['add', 'note.md']); git(root, ['commit', '-m', 'clean tip']);
  assert.equal(scan(root).passed, true);
  assert.equal(scan(root, 'history').passed, false);
  assert.notEqual(git(root, ['push', 'test', 'HEAD:refs/heads/must-not-arrive'], false).status, 0);
  assert.equal(git(remote, ['for-each-ref', '--format=%(refname)', 'refs/heads/must-not-arrive']).stdout.trim(), '');
});

test('History scans tag text and deleted files; custom hooksPath is never overwritten', () => {
  const root = repo(); put(root, 'file.md', 'clean'); git(root, ['add', 'file.md']); git(root, ['commit', '-m', 'base']);
  git(root, ['tag', '-a', 'private-tag', '-m', root]);
  assert.equal(scan(root, 'history').passed, false);
  git(root, ['config', 'core.hooksPath', '.my-hooks']);
  assert.throws(() => installHooks(root), /hooksPath/);
  assert.equal(git(root, ['config', '--get', 'core.hooksPath']).stdout.trim(), '.my-hooks');
  assert.deepEqual(pushTips('refs/heads/main ' + '0'.repeat(40) + ' refs/heads/main ' + '1'.repeat(40) + '\n'), []);
  assert.throws(() => pushTips('invalid'), /Invalid/);
});

test('History inspects every filename for reused blobs and preserves whitespace names', () => {
  const root = repo(); put(root, 'safe.txt', '{}'); git(root, ['add', 'safe.txt']); git(root, ['commit', '-m', 'base']);
  put(root, '.workflow/private/raw.json', '{}'); git(root, ['add', '-f', '.workflow/private/raw.json']); git(root, ['commit', '-m', 'same blob under private name']);
  git(root, ['rm', '.workflow/private/raw.json']); git(root, ['commit', '-m', 'removed from tip']);
  const report = scan(root, 'history');
  assert.ok(report.findings.some(item => item.file === '.workflow/private/raw.json' && item.reason === 'private-file-must-stay-local'));
  const spaced = 'file with spaces.txt'; put(root, spaced, root); git(root, ['add', spaced]); git(root, ['commit', '-m', 'whitespace name']);
  assert.ok(scan(root, 'history').findings.some(item => item.file === spaced));
});

test('Hook installer also works for an onboarded .integration layout', () => {
  const root = repo();
  put(root, '.integration/scripts/privacy.mjs', fs.readFileSync(source));
  installHooks(root);
  assert.ok(fs.readFileSync(path.join(root, '.git/hooks/pre-commit'),'utf8').includes('.integration/scripts/privacy.mjs'));
  put(root, 'file.txt', root); git(root, ['add', 'file.txt']);
  assert.notEqual(git(root, ['commit', '-m', 'blocked'], false).status, 0);
});

test('Oversized objects and malformed allowances fail closed; encoded foreign paths are detected', () => {
  const root = repo();
  const foreign = ['D:', 'Users', 'Example', 'note.txt'].join('/');
  for (const value of [foreign, encodeURIComponent(foreign), JSON.stringify(foreign.replaceAll('/', '\\'))]) {
    put(root, 'file.txt', value); git(root, ['add', 'file.txt']); assert.equal(scan(root).passed, false);
  }
  put(root, 'file.txt', 'clean'); git(root, ['add', 'file.txt']);
  put(root, 'privacy-allowlist.json', '{}'); git(root, ['add', 'privacy-allowlist.json']);
  assert.throws(() => scan(root), /Allowlist/);
  put(root, 'privacy-allowlist.json', '[]'); git(root, ['add', 'privacy-allowlist.json']);
  put(root, 'large.txt', Buffer.alloc(8 * 1024 * 1024 + 1, 65)); git(root, ['add', 'large.txt']);
  assert.throws(() => scan(root), /oversized/);
});

test('Local Python executable remains executable config, never a public placeholder', () => {
  const root = repo();
  put(root, 'workflow.config.json', JSON.stringify({ schema: 'integrated', testRunner: 'python-unittest', pythonExecutable: 'python', testFiles: ['tests/test_feature.py'] }));
  const executable = process.env.WORKFLOW_PYTHON || process.execPath;
  put(root, 'workflow.local.json', JSON.stringify({ pythonExecutable: executable }));
  assert.equal(readWorkflowConfig(root).pythonExecutable, executable);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'workflow.config.json'))).pythonExecutable, 'python');
});

test('Real workflow executes with real paths, hashes public logs, preserves raw debugging and archives', () => {
  const root = path.join(parent, 'workflow'); initProject(root); appFixture(root);
  const id = 'privacy-evidence'; runWorkflow(root, 'new', id); fillChange(root, id);
  fs.appendFileSync(path.join(root, 'test/order.test.mjs'), '\nconsole.log(process.cwd());\n');
  const evidence = runWorkflow(root, 'verify', id);
  const bytes = fs.readFileSync(path.join(root, evidence.log));
  assert.equal(evidence.passed, true); assert.equal(evidence.tests, 10);
  assert.equal(evidence.logHash, hash(bytes));
  assert.deepEqual(pathIssues(JSON.stringify(evidence), root), []);
  assert.deepEqual(pathIssues(bytes.toString(), root), []);
  assert.ok(pathIssues(fs.readFileSync(path.join(root, '.workflow/private/' + id + '.log'), 'utf8'), root).length);
  assert.ok(bytes.toString().includes('<PROJECT_ROOT>'));
  put(root, 'workflow.local.json', JSON.stringify({ privateRoots: [parent] }));
  assert.throws(() => runWorkflow(root, 'archive', id), /stale verification/);
  runWorkflow(root, 'verify', id);
  assert.ok(runWorkflow(root, 'archive', id).archive);
  // Newline conversion cannot invalidate the public evidence once staged.
  git(root, ['init', '-q']); git(root, ['config', 'core.autocrlf', 'true']);
  git(root, ['add', '.']);
  const staged = spawnSync('git', ['show', ':' + evidence.log], { cwd: root });
  const latest = JSON.parse(fs.readFileSync(path.join(root, '.workflow/evidence/' + id + '.json')));
  assert.equal(hash(staged.stdout), latest.logHash);
  assert.equal(scan(root).passed, true);
});

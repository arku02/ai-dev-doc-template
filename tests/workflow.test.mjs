import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { initProject } from '../scripts/init-project.mjs';
import { runWorkflow, openspec } from '../starter/scripts/workflow.mjs';
import { appFixture, fillChange, changeLabel, workspace, put } from '../scripts/demo-fixtures.mjs';

const runs = path.join(workspace, '.sandbox');
fs.mkdirSync(runs, { recursive: true });
const root = fs.mkdtempSync(path.join(runs, 'gates-'));
// initProject refuses an existing destination; keep the temporary parent for evidence.
const project = path.join(root, 'project');
const id = 'add-order-lookup';
const relative = name => 'openspec/changes/' + id + '/' + name;
const read = file => fs.readFileSync(path.join(project, file), 'utf8');
const replace = (file, from, to) => put(project, file, read(file).replace(from, to));

test('Integrated workflow: real CLI plus failure and delivery paths', async t => {
  initProject(project);
  appFixture(project);
  runWorkflow(project, 'new', id);
  const emptyStatus = JSON.parse(openspec(project, ['status', '--change', id, '--json']));
  await t.test('OpenSpec sees the custom review dependency before authoring', () => {
    assert.equal(emptyStatus.schemaName, 'integrated');
    assert.equal(emptyStatus.artifacts.find(a => a.id === 'review').status, 'blocked');
    const instructions = JSON.parse(openspec(project, ['instructions', 'proposal', '--change', id, '--json']));
    assert.match(JSON.stringify(instructions), /BMAD|產品|成功標準/);
  });
  fillChange(project, id);
  await t.test('a valid reviewed change is ready', () => {
    assert.equal(runWorkflow(project, 'check', id).requirements, 4);
  });
  await t.test('missing verification cannot archive', () => {
    assert.throws(() => runWorkflow(project, 'archive', id), /Missing verification/);
    assert.ok(fs.existsSync(path.join(project, relative('proposal.md'))));
  });
  await t.test('unresolved questions block implementation check', () => {
    const file = relative('review.md'), original = read(file);
    put(project, file, original.replace('"openQuestions": []', '"openQuestions": ["Who may see historical orders?"]'));
    assert.throws(() => runWorkflow(project, 'check', id), /Unresolved questions/);
    put(project, file, original);
  });
  await t.test('uncovered requirements block the gate', () => {
    const file = relative('review.md'), original = read(file);
    const block = /```json\n([\s\S]*?)\n```/.exec(original);
    const review = JSON.parse(block[1]);
    review.coverage.pop();
    put(project, file, original.replace(block[1], JSON.stringify(review, null, 2)));
    assert.throws(() => runWorkflow(project, 'check', id), /Uncovered requirement/);
    put(project, file, original);
  });
  await t.test('unfinished tasks cannot be verified', () => {
    const file = relative('tasks.md'), original = read(file);
    put(project, file, original.replace('[x]', '[ ]'));
    assert.throws(() => runWorkflow(project, 'verify', id), /Incomplete tasks/);
    put(project, file, original);
  });
  await t.test('real failing test invalidates success and leaves baseline untouched', () => {
    const before = openspec(project, ['list', '--specs', '--json']);
    const file = 'src/orders.mjs', original = read(file);
    put(project, file, original.replace('> 60 * MINUTE', '>= 60 * MINUTE'));
    assert.throws(() => runWorkflow(project, 'verify', id), /Tests failed/);
    assert.equal(JSON.parse(read('.workflow/evidence/' + id + '.json')).passed, false);
    assert.equal(JSON.parse(read('.workflow/evidence/' + id + '.json')).tests, 10);
    assert.throws(() => runWorkflow(project, 'archive', id), /failed or stale/);
    assert.equal(openspec(project, ['list', '--specs', '--json']), before);
    put(project, file, original);
  });
  await t.test('an empty suite cannot create passing evidence', () => {
    const file = 'test/order.test.mjs', original = read(file);
    put(project, file, '// no tests\n');
    assert.throws(() => runWorkflow(project, 'verify', id), /Tests failed/);
    put(project, file, original);
  });
  await t.test('skipped tests cannot create passing evidence', () => {
    const file = 'test/order.test.mjs', original = read(file);
    put(project, file, original.replaceAll('test(', 'test.skip('));
    assert.throws(() => runWorkflow(project, 'verify', id), /Tests failed/);
    put(project, file, original);
  });
  await t.test('changing specs after verification makes evidence stale', () => {
    assert.equal(runWorkflow(project, 'verify', id).tests, 10);
    const file = relative('specs/order-lookup/spec.md'), original = read(file);
    put(project, file, original + '\nReview note: changed requirement input.\n');
    assert.throws(() => runWorkflow(project, 'archive', id), /stale verification/);
    put(project, file, original);
  });
  await t.test('changing implementation after verification makes evidence stale', () => {
    const file = 'src/orders.mjs', original = read(file);
    put(project, file, original + '\n// changed since verification\n');
    assert.throws(() => runWorkflow(project, 'archive', id), /stale verification/);
    put(project, file, original);
  });
  await t.test('altered test evidence cannot be used for archive', () => {
    const file = '.workflow/evidence/' + id + '.tap', original = read(file);
    put(project, file, original + 'changed');
    assert.throws(() => runWorkflow(project, 'archive', id), /log changed/);
    put(project, file, original);
  });
  await t.test('another active change to the same requirement blocks archive', () => {
    runWorkflow(project, 'new', 'conflicting-label');
    fillChange(project, 'conflicting-label', { lite: true });
    assert.throws(() => runWorkflow(project, 'archive', id), /Active spec conflict/);
    const source = path.join(project, 'openspec/changes/conflicting-label');
    const destination = path.join(project, '.workflow/held-conflicting-label');
    fs.renameSync(source, destination);
  });
  await t.test('verified full change archives through OpenSpec and creates a main spec', () => {
    const receipt = runWorkflow(project, 'archive', id);
    assert.match(receipt.archive, /archive\/\d{4}-\d{2}-\d{2}-add-order-lookup$/);
    assert.equal(fs.existsSync(path.join(project, 'openspec/changes/' + id)), false);
    assert.match(read('openspec/specs/order-lookup/spec.md'), /## Requirements/);
    assert.match(read('openspec/specs/order-lookup/spec.md'), /R1 - Order ownership/);
    assert.doesNotMatch(read('openspec/specs/order-lookup/spec.md'), /TBD/);
    openspec(project, ['validate', '--specs', '--strict', '--json', '--no-interactive']);
  });
  const lite = 'clarify-shipment-label';
  runWorkflow(project, 'new', lite);
  fillChange(project, lite, { lite: true });
  changeLabel(project);
  await t.test('baseline changes require rebase and a fresh substantive review', () => {
    const file = 'openspec/specs/order-lookup/spec.md';
    put(project, file, read(file) + '\nBaseline editorial correction.\n');
    assert.throws(() => runWorkflow(project, 'check', lite), /Baseline changed/);
    runWorkflow(project, 'rebase', lite);
    assert.throws(() => runWorkflow(project, 'check', lite), /not marked ready/);
    replace('openspec/changes/' + lite + '/review.md', '"decision": "pending"', '"decision": "ready"');
    assert.throws(() => runWorkflow(project, 'archive', lite), /failed or stale/);
  });
  await t.test('lite change keeps prior requirements, verifies and archives', () => {
    assert.equal(runWorkflow(project, 'verify', lite).tests, 10);
    runWorkflow(project, 'archive', lite);
    const main = read('openspec/specs/order-lookup/spec.md');
    assert.match(main, /物流資訊更新時間/);
    assert.doesNotMatch(main, /最後更新/);
    assert.match(main, /R1 - Order ownership/);
    assert.match(main, /R3 - Stale shipment warning/);
  });
  await t.test('path traversal and accidental overwrite are refused', () => {
    assert.throws(() => runWorkflow(project, 'new', '../escape'), /kebab-case/);
    assert.throws(() => initProject(project), /overwrite/);
  });
  await t.test('invalid synchronized main spec cannot produce a success receipt', () => {
    const invalid = 'short-purpose';
    runWorkflow(project, 'new', invalid);
    fillChange(project, invalid);
    const prefix = 'openspec/changes/' + invalid;
    const original = read(prefix + '/specs/order-lookup/spec.md');
    fs.renameSync(path.join(project, prefix + '/specs/order-lookup'), path.join(project, prefix + '/specs/short-purpose'));
    put(project, prefix + '/specs/short-purpose/spec.md', original.replace(/## Purpose\n[^\n]+/, '## Purpose\nToo short.').replaceAll('最後更新','物流資訊更新時間'));
    const proposal = prefix + '/proposal.md';
    put(project, proposal, read(proposal).replaceAll('order-lookup', 'short-purpose'));
    runWorkflow(project, 'verify', invalid);
    assert.throws(() => runWorkflow(project, 'archive', invalid), /Purpose section is too brief/);
    assert.equal(fs.existsSync(path.join(project, '.workflow/receipts/' + invalid + '.json')), false);
    assert.equal(fs.existsSync(path.join(project, prefix)), false);
  });
  console.log('Evidence retained at ' + project);
});

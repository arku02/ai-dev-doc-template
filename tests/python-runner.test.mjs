import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { executeTests, runWorkflow, openspec } from '../starter/scripts/workflow.mjs';
import { initProject } from '../scripts/init-project.mjs';
import { fillChange, put, workspace } from '../scripts/demo-fixtures.mjs';

const parent = fs.mkdtempSync(path.join(workspace, '.sandbox/python-'));
const root = path.join(parent, 'project');
const pythonExecutable = process.env.WORKFLOW_PYTHON || 'python';
const config = {schema:'integrated', openspecVersion:'1.13.1', testRunner:'python-unittest',
  pythonExecutable, testFiles:['tests/test_contract.py']};
const caseText = body => 'import unittest\nclass Contract(unittest.TestCase):\n' + body + '\n';
const pass = caseText('    def test_R1_pass(self):\n        self.assertEqual(2 + 2, 4)');
const run = source => {put(root, config.testFiles[0], source); return executeTests(root, config, ['R1']);};

test('Python unittest runner rejects false success', async t => {
  initProject(root);
  put(root, 'workflow.config.json', JSON.stringify(config));
  await t.test('real passing, tagged test supplies evidence', () => {
    const r = run(pass);
    assert.equal(r.passed, true, r.output + r.error);
    assert.equal(r.count, 1);
    assert.deepEqual(r.executedIds, ['R1']);
    assert.match(r.runnerReport.python, /3\./);
  });
  const cases = [
    ['assertion failure', caseText('    def test_R1_fail(self):\n        self.fail("intentional")')],
    ['skipped test', caseText('    @unittest.skip("intentional")\n    def test_R1_skip(self):\n        pass')],
    ['expected failure', caseText('    @unittest.expectedFailure\n    def test_R1_expected(self):\n        self.fail("intentional")')],
    ['unexpected success', caseText('    @unittest.expectedFailure\n    def test_R1_unexpected(self):\n        pass')],
    ['empty suite', '# no cases\n'],
    ['passing case without requirement ID', caseText('    def test_unlinked(self):\n        pass')],
    ['import error', 'raise ImportError("intentional")\n'],
    ['failing subtest', caseText('    def test_R1_sub(self):\n        with self.subTest(value=1):\n            self.assertEqual(1, 2)')],
    ['exit zero without runner report', 'import sys\nsys.exit(0)\n'],
  ];
  for (const [name, source] of cases) await t.test(name + ' cannot pass', () => assert.equal(run(source).passed, false));
  await t.test('missing executable cannot pass', () => {
    put(root, config.testFiles[0], pass);
    assert.equal(executeTests(root, {...config, pythonExecutable:path.join(parent,'missing-python')}, ['R1']).passed, false);
  });
  await t.test('Python files pass actual workflow validation and archive with stale checks', () => {
    const id = 'python-contract';
    runWorkflow(root, 'new', id);
    fillChange(root, id);
    for (const file of ['review.md', 'tasks.md']) {
      const name = 'openspec/changes/' + id + '/' + file;
      put(root, name, fs.readFileSync(path.join(root,name),'utf8').replaceAll('test/order.test.mjs',config.testFiles[0]));
    }
    put(root, config.testFiles[0], caseText([1,2,3,4].map(i => `    def test_R${i}_contract(self):\n        self.assertTrue(True)`).join('\n')));
    assert.equal(runWorkflow(root, 'check', id).requirements, 4);
    const evidence = runWorkflow(root, 'verify', id);
    assert.equal(evidence.passed, true);
    assert.equal(evidence.tests, 4);
    assert.equal(evidence.runnerReport.passed, 4);
    put(root, 'source.py', '# changed\n');
    assert.throws(() => runWorkflow(root, 'archive', id), /stale verification/);
    runWorkflow(root, 'verify', id);
    const receipt = runWorkflow(root, 'archive', id);
    assert.ok(fs.existsSync(path.join(root, receipt.archive)));
    openspec(root, ['validate', '--specs', '--strict', '--json', '--no-interactive']);
  });
  console.log('Python adapter evidence: ' + root);
});

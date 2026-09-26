import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const command = ['--test','--test-reporter=tap','tests/python-runner.test.mjs'];
const r = spawnSync(process.execPath, command, {encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
const output = (r.stdout ?? '') + (r.stderr ?? '');
fs.writeFileSync('docs/reports/python-tests.tap',output);
const files = ['starter/scripts/workflow.mjs','starter/scripts/unittest_runner.py','tests/python-runner.test.mjs'];
fs.writeFileSync('docs/reports/python-tests.json',JSON.stringify({
  executedAt:new Date().toISOString(),command:[process.execPath,...command],exitCode:r.status,error:r.error?.message??null,
  tests:Number(/^# tests (\d+)/m.exec(output)?.[1]??0),failures:Number(/^# fail (\d+)/m.exec(output)?.[1]??-1),
  inputHashes:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))
},null,2)+'\n');
console.log(output);
process.exitCode = r.status ?? 1;

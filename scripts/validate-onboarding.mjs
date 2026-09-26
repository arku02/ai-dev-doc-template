import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const command=['--test','--test-reporter=tap','tests/onboarding.test.mjs'];
const r=spawnSync(process.execPath,command,{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
const output=(r.stdout??'')+(r.stderr??'');
fs.writeFileSync('docs/reports/onboarding-tests.tap',output);
const files=['scripts/onboard.mjs','tests/onboarding.test.mjs','starter/scripts/workflow.mjs','starter/scripts/doctor.mjs'];
fs.writeFileSync('docs/reports/onboarding-tests.json',JSON.stringify({executedAt:new Date().toISOString(),exitCode:r.status,error:r.error?.message??null,
  command:[process.execPath,...command],tests:Number(/^# tests (\d+)/m.exec(output)?.[1]??0),failures:Number(/^# fail (\d+)/m.exec(output)?.[1]??-1),
  inputHashes:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))},null,2)+'\n');
console.log(output);process.exitCode=r.status??1;

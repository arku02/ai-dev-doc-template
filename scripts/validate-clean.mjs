// Reproduce documented onboarding with fresh local dependencies and a fresh venv.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {appFixture, fillChange, put} from './demo-fixtures.mjs';

const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(workspace);
const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--python'))throw new Error('Use --python EXECUTABLE');
const basePython=args[1]||process.env.WORKFLOW_PYTHON||'python';
const parent=fs.mkdtempSync(path.join(workspace,'.sandbox/clean-'));
const cache=path.join(workspace,'.npm-cache');
const npmCLI=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
if(!fs.existsSync(npmCLI))throw new Error('Run through npm run test:clean or provide npm installation');
const npmrc=path.join(parent,'empty-npmrc');fs.writeFileSync(npmrc,'');
const environment={...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONUTF8:'1',OPENSPEC_TELEMETRY:'0',DO_NOT_TRACK:'1',NPM_CONFIG_USERCONFIG:npmrc};
for(const key of Object.keys(environment))if(key.startsWith('NODE_TEST_')||['NODE_PATH','PYTHONPATH','PYTHONHOME'].includes(key))delete environment[key];
const report={startedAt:new Date().toISOString(),node:process.version,root:parent,steps:[],passed:false};
const run=(label,cwd,command,parameters=[])=>{
  const result=spawnSync(command,parameters,{cwd,env:environment,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
  const output=(result.stdout??'')+(result.stderr??'');
  const log=path.join(parent,`${report.steps.length+1}-${label}.log`);fs.writeFileSync(log,output);
  report.steps.push({label,cwd,command:[command,...parameters],exitCode:result.status,error:result.error?.message??null,log});
  console.log(label+': '+(result.status===0?'passed':'FAILED'));
  if(result.status!==0)throw new Error(label+': '+(result.error?.message??'')+output);
  return result.stdout;
};
const install=root=>run('install-local-tools',root,process.execPath,[npmCLI,'ci','--offline','--ignore-scripts','--no-audit','--no-fund','--cache',cache]);
const onboard=(root,runner,testFile,python)=>{
  const plan=path.join(parent,path.basename(root)+'-plan.json');
  run('plan-'+path.basename(root),workspace,process.execPath,['scripts/onboard.mjs','plan','--target',root,'--runner',runner,'--test',testFile,'--out',plan,...(python?['--python',python]:[])]);
  run('apply-'+path.basename(root),workspace,process.execPath,['scripts/onboard.mjs','apply',plan]);
};
const workflow=(root,isolated,action,id)=>JSON.parse(run(action+'-'+id,root,process.execPath,[(isolated?'.integration/':'')+'scripts/workflow.mjs',action,id]));
function inspect(root,isolated) {
  const result=JSON.parse(run('doctor-'+path.basename(root),root,process.execPath,[(isolated?'.integration/':'')+'scripts/doctor.mjs']));
  if(!result.ready)throw new Error('Doctor was not ready');
  report[path.basename(root)+'Environment']=result;
}
function nodeFlow(root,isolated) {
  const id='add-order-lookup';
  workflow(root,isolated,'new',id);fillChange(root,id);
  workflow(root,isolated,'check',id);
  const evidence=workflow(root,isolated,'verify',id);
  if(evidence.tests!==10)throw new Error('Expected 10 real tests');
  const receipt=workflow(root,isolated,'archive',id);
  if(receipt.validation.summary.totals.failed!==0)throw new Error('Main spec invalid');
}
function pythonDocs(root,id,lite=false) {
  const p='openspec/changes/'+id+'/';
  put(root,p+'proposal.md',`# Label cleanup\n\n## Why\nUser-entered labels need consistent whitespace${lite?' and case':''}.\n\n## What Changes\nTrim surrounding whitespace${lite?' and lowercase the result':''}.\n\n## Capabilities\n### ${lite?'Modified':'New'} Capabilities\n- label-cleanup: text normalization\n\n## Impact\nformatter.py and tests/test_formatter.py; offline standard-library fixture.\n`);
  put(root,p+'design.md','# Design\n\nUse a pure Python function; no network, database, packages or secrets. Fixed input assertions cover whitespace and empty values. This is a synthetic integration fixture, not a production feature.\n');
  put(root,p+'specs/label-cleanup/spec.md',(lite?'':'## Purpose\nProvide a deterministic local label normalization capability so users can verify Python workflow integration without any external libraries, services, or credentials.\n\n')+`## ${lite?'MODIFIED':'ADDED'} Requirements\n\n### Requirement: R1 - Normalize label\nThe system SHALL trim surrounding whitespace${lite?' and lowercase the result':''}. An all-whitespace string SHALL become empty.\n\n#### Scenario: Normalize whitespace\n- **WHEN** the input is "  Example  "\n- **THEN** the result is "${lite?'example':'Example'}"\n\n#### Scenario: Empty label\n- **WHEN** the input is only spaces\n- **THEN** the result is an empty string\n`);
  put(root,p+'tasks.md','# Tasks\n\n## 1. Implementation\n- [x] 1.1 Implement and verify R1 with tests/test_formatter.py\n');
  put(root,p+'review.md','# Review\n\n```json\n'+JSON.stringify({mode:lite?'lite':'full',decision:'ready',reviewer:'Integration fixture maintainer',rationale:'Explicitly bounded local fixture; assertions cover the stated string transformations with no external effects.',openQuestions:[],coverage:[{requirement:'R1',task:'1.1',test:'tests/test_formatter.py'}]},null,2)+'\n```\n');
}
try {
  const fresh=path.join(parent,'fresh-node');fs.cpSync(path.join(workspace,'starter'),fresh,{recursive:true});
  appFixture(fresh);install(fresh);inspect(fresh,false);nodeFlow(fresh,false);

  const existing=path.join(parent,'existing-node');fs.mkdirSync(existing);
  const originals={'README.md':'Existing app documentation\n','package.json':'{"name":"existing-cjs","type":"commonjs","scripts":{"test":"custom-test-command"}}\n','package-lock.json':'{"name":"existing-cjs","lockfileVersion":3,"packages":{}}\n','index.js':'module.exports = "existing application";\n'};
  for(const [f,text] of Object.entries(originals))put(existing,f,text);
  onboard(existing,'node','test/order.test.mjs');appFixture(existing);
  install(path.join(existing,'.integration'));inspect(existing,true);nodeFlow(existing,true);
  for(const [f,text] of Object.entries(originals))if(fs.readFileSync(path.join(existing,f),'utf8')!==text)throw new Error('Existing file changed: '+f);
  report.existingApplicationPreserved=true;

  const py=path.join(parent,'existing-python');fs.mkdirSync(py);
  put(py,'README.md','# Existing Python project\n');put(py,'requirements.txt','# Standard library only\n');
  put(py,'formatter.py','def normalize_label(value):\n    return value.strip()\n');
  const testSource='import unittest\nfrom formatter import normalize_label\nclass Labels(unittest.TestCase):\n    def test_R1_trim(self):\n        self.assertEqual(normalize_label("  Example  "), "Example")\n    def test_R1_empty(self):\n        self.assertEqual(normalize_label("   "), "")\n';
  put(py,'tests/test_formatter.py',testSource);
  run('create-empty-venv',py,basePython,['-I','-B','-m','venv','--without-pip','.venv']);
  const relativePython=process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python';
  run('verify-venv-isolation',py,path.join(py,relativePython),['-I','-B','-c','import sys,importlib.util; assert sys.prefix != sys.base_prefix; assert importlib.util.find_spec("requests") is None; assert importlib.util.find_spec("pymysql") is None; print(sys.version)']);
  onboard(py,'python-unittest','tests/test_formatter.py',relativePython);
  install(path.join(py,'.integration'));inspect(py,true);
  for(const [id,lite] of [['normalize-label',false],['lowercase-label',true]]) {
    workflow(py,true,'new',id);pythonDocs(py,id,lite);
    if(lite){put(py,'formatter.py','def normalize_label(value):\n    return value.strip().lower()\n');put(py,'tests/test_formatter.py',testSource.replace('), "Example")','), "example")'));}
    workflow(py,true,'check',id);
    const evidence=workflow(py,true,'verify',id);if(evidence.tests!==2)throw new Error('Expected two Python tests');
    workflow(py,true,'archive',id);
  }
  // Exercise the exact convenient command documented for users.
  run('documented-test-entry',py,process.execPath,['.integration/scripts/run-tests.mjs']);
  const main=fs.readFileSync(path.join(py,'openspec/specs/label-cleanup/spec.md'),'utf8');
  if(!main.includes('lowercase')||!main.includes('Empty label'))throw new Error('Follow-up did not preserve scenarios');
  report.pythonStandardLibraryOnly=true;report.completedChanges=4;report.passed=true;
}catch(e){report.error=e.message;process.exitCode=1;console.error(e.message);}
finally {
  report.finishedAt=new Date().toISOString();
  const files=['scripts/onboard.mjs','scripts/validate-clean.mjs','starter/scripts/workflow.mjs','starter/scripts/doctor.mjs','starter/scripts/unittest_runner.py','starter/package-lock.json'];
  report.inputHashes=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
  fs.writeFileSync('docs/reports/clean-environment.json',JSON.stringify(report,null,2)+'\n');
  console.log('Clean environment report: '+(report.passed?'PASS':'FAIL'));
}

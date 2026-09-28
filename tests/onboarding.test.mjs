import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {planOnboarding,applyOnboarding,rollbackOnboarding} from '../scripts/onboard.mjs';
import {doctor} from '../starter/scripts/doctor.mjs';
const parent=fs.mkdtempSync(path.resolve('.sandbox/onboarding-'));
const options={runner:'node',tests:['tests/feature.test.mjs']};
let number=0;
function existing() {
  const root=path.join(parent,'existing-'+(++number));fs.mkdirSync(root);
  fs.writeFileSync(path.join(root,'README.md'),'User documentation\n');
  fs.writeFileSync(path.join(root,'package.json'),'{"type":"commonjs","scripts":{"test":"custom"}}\n');
  fs.writeFileSync(path.join(root,'package-lock.json'),'original lock\n');
  fs.writeFileSync(path.join(root,'.gitignore'),'# custom\r\nprivate/\r\n');
  return root;
}
function snapshot(root) {
  return Object.fromEntries(['README.md','package.json','package-lock.json','.gitignore'].map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
}
test('Reusable onboarding, conflicts and recovery',async t=>{
  await t.test('new project plan does not create the target',()=>{
    const root=path.join(parent,'new');const p=planOnboarding(root,options);
    assert.equal(fs.existsSync(root),false);assert.equal(p.body.existed,false);
    const result=applyOnboarding(p);
    assert.ok(fs.existsSync(result.manifest));
    assert.ok(fs.existsSync(path.join(root,'.integration/scripts/workflow.mjs')));
    assert.match(fs.readFileSync(path.join(root,'openspec/schemas/integrated/schema.yaml'),'utf8'),/node \.integration\/scripts\/workflow/);
    assert.equal(fs.existsSync(path.join(root,'package.json')),false);
  });
  await t.test('existing application files and package configuration are preserved',()=>{
    const root=existing(),before=snapshot(root),p=planOnboarding(root,options);
    assert.deepEqual(snapshot(root),before);
    const result=applyOnboarding(p),after=snapshot(root);
    for(const f of ['README.md','package.json','package-lock.json'])assert.equal(after[f],before[f]);
    assert.ok(after['.gitignore'].startsWith(before['.gitignore']));
    assert.equal(fs.readFileSync(path.join(path.dirname(result.manifest),'backup/.gitignore'),'utf8'),before['.gitignore']);
  });
  await t.test('privacy tools, local exclusions and byte-preserving attributes survive onboarding and rollback',()=>{
    const root=existing(),original='*.txt text eol=crlf\r\n';
    fs.writeFileSync(path.join(root,'.gitattributes'),original);
    const r=applyOnboarding(planOnboarding(root,options));
    assert.ok(fs.existsSync(path.join(root,'.integration/scripts/privacy.mjs')));
    assert.ok(fs.existsSync(path.join(root,'.integration/PRIVACY.md')));
    const ignore=fs.readFileSync(path.join(root,'.gitignore'),'utf8');
    for(const name of ['.workflow/private/','.workflow/imports/','workflow.local.json'])assert.ok(ignore.includes(name));
    const attributes=fs.readFileSync(path.join(root,'.gitattributes'),'utf8');
    assert.ok(attributes.startsWith(original));assert.ok(attributes.includes('.workflow/evidence/** -text'));
    rollbackOnboarding(r.manifest);
    assert.equal(fs.readFileSync(path.join(root,'.gitattributes'),'utf8'),original);
  });
  for(const name of ['openspec','.integration','workflow.config.json'])await t.test('collision '+name+' is refused without edits',()=>{
    const root=existing();fs.writeFileSync(path.join(root,name),'existing');const before=snapshot(root);
    assert.throws(()=>planOnboarding(root,options),/Conflict/);assert.deepEqual(snapshot(root),before);
    assert.equal(fs.existsSync(path.join(root,'.workflow')),false);
  });
  await t.test('changed target invalidates the review plan before writes',()=>{
    const root=existing(),p=planOnboarding(root,options);
    fs.appendFileSync(path.join(root,'.gitignore'),'new-rule\n');
    assert.throws(()=>applyOnboarding(p),/Stale plan/);assert.equal(fs.existsSync(path.join(root,'.integration')),false);
  });
  await t.test('edited plan is refused',()=>{
    const root=existing(),p=planOnboarding(root,options);p.body.operations[0].file='../escape';
    assert.throws(()=>applyOnboarding(p),/edited plan/);
  });
  await t.test('second application cannot overwrite installed files',()=>{
    const root=existing(),p=planOnboarding(root,options);applyOnboarding(p);
    assert.throws(()=>applyOnboarding(p),/Conflict/);
  });
  await t.test('rollback restores original bytes and removes only imported files',()=>{
    const root=existing(),before=snapshot(root),r=applyOnboarding(planOnboarding(root,options));
    fs.writeFileSync(path.join(root,'notes.txt'),'new user work');
    rollbackOnboarding(r.manifest);assert.deepEqual(snapshot(root),before);
    assert.equal(fs.existsSync(path.join(root,'.integration')),false);
    assert.equal(fs.existsSync(path.join(root,'openspec')),false);
    assert.equal(fs.readFileSync(path.join(root,'notes.txt'),'utf8'),'new user work');
    assert.equal(JSON.parse(fs.readFileSync(r.manifest)).status,'rolled-back');
  });
  await t.test('edited imported file blocks the entire rollback',()=>{
    const root=existing(),r=applyOnboarding(planOnboarding(root,options));
    fs.appendFileSync(path.join(root,'workflow.config.json'),' ');
    assert.throws(()=>rollbackOnboarding(r.manifest),/Modified after/);
    assert.ok(fs.existsSync(path.join(root,'.integration/scripts/workflow.mjs')));
  });
  await t.test('changed backup blocks rollback before removing files',()=>{
    const root=existing(),r=applyOnboarding(planOnboarding(root,options));
    fs.writeFileSync(path.join(path.dirname(r.manifest),'backup/.gitignore'),'changed');
    assert.throws(()=>rollbackOnboarding(r.manifest),/Backup changed/);
    assert.ok(fs.existsSync(path.join(root,'workflow.config.json')));
  });
  await t.test('workflow work prevents automatic rollback',()=>{
    const root=existing(),r=applyOnboarding(planOnboarding(root,options));
    fs.mkdirSync(path.join(root,'openspec/changes/new-work'),{recursive:true});
    assert.throws(()=>rollbackOnboarding(r.manifest),/Workflow work exists/);
  });
  await t.test('interrupted import can restore completed writes',()=>{
    const root=existing(),before=snapshot(root),r=applyOnboarding(planOnboarding(root,options));
    // Model an interruption after some file writes: these files never landed.
    const m=JSON.parse(fs.readFileSync(r.manifest));m.status='applying';
    fs.unlinkSync(path.join(root,'workflow.config.json'));
    fs.writeFileSync(r.manifest,JSON.stringify(m));
    rollbackOnboarding(r.manifest);assert.deepEqual(snapshot(root),before);
  });
  await t.test('linked target is refused',()=>{
    const root=existing(),link=path.join(parent,'linked');
    fs.symlinkSync(root,link,process.platform==='win32'?'junction':'dir');
    assert.throws(()=>planOnboarding(link,options),/Linked paths/);
  });
  await t.test('linked ignore file is refused before reading it',()=>{
    const root=path.join(parent,'linked-ignore');fs.mkdirSync(root);
    const outside=path.join(parent,'outside');fs.mkdirSync(outside);
    fs.symlinkSync(outside,path.join(root,'.gitignore'),process.platform==='win32'?'junction':'dir');
    assert.throws(()=>planOnboarding(root,options),/Linked paths/);
  });
  await t.test('doctor refuses missing isolated dependencies despite parent installation',()=>{
    const root=existing();applyOnboarding(planOnboarding(root,options));
    const result=doctor(root);assert.equal(result.ready,false);
    assert.ok(result.issues.some(s=>s.includes('Install local tools')));
  });
  await t.test('unsupported runner and traversal paths are refused',()=>{
    assert.throws(()=>planOnboarding(existing(),{...options,runner:'shell'}),/Choose/);
    assert.throws(()=>planOnboarding(existing(),{...options,tests:['tests/../escape.test.mjs']}),/test path/);
  });
  console.log('Onboarding evidence: '+parent);
});

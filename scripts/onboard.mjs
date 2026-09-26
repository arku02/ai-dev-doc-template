import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../starter');
const hash=data=>createHash('sha256').update(data).digest('hex');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const stringify=value=>JSON.stringify(value,null,2)+'\n';
const fail=message=>{throw new Error(message);};
function noLinks(full) {
  full=path.resolve(full);
  let at=path.parse(full).root;
  for(const part of path.relative(at,full).split(path.sep).filter(Boolean)) {
    at=path.join(at,part);
    // lstat also detects dangling links, unlike existsSync alone.
    try {if(fs.lstatSync(at).isSymbolicLink())fail('Linked paths are unsupported: '+at);}
    catch(e){if(e.code!=='ENOENT')throw e;}
  }
  return full;
}
function inside(root,relative) {
  if(typeof relative!=='string'||relative.includes('\\'))fail('Invalid relative path');
  const full=path.resolve(root,relative);
  if(!full.startsWith(root+path.sep))fail('Path escapes target');
  return noLinks(full);
}
function files(relative) {
  return fs.readdirSync(path.join(source,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    if(e.isSymbolicLink())fail('Linked template');
    const name=relative+'/'+e.name;
    return e.isDirectory()?files(name):[name];
  });
}
function desired(options) {
  if(!['node','python-unittest'].includes(options.runner))fail('Choose node or python-unittest');
  if(!Array.isArray(options.tests)||!options.tests.length)fail('Specify at least one --test');
  const pattern=options.runner==='node'?/^tests?\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.test\.m?js$/:/^tests?\/(?:[a-zA-Z0-9_-]+\/)*test_[a-zA-Z0-9_]+\.py$/;
  if(options.tests.some(t=>typeof t!=='string'||!pattern.test(t)))fail('Unsupported test path');
  if(options.runner==='python-unittest' && (typeof options.python!=='string'||!options.python.trim()))fail('Specify Python executable');
  const data=new Map();
  for(const name of files('scripts'))data.set('.integration/'+name,fs.readFileSync(path.join(source,name)));
  for(const name of files('openspec'))data.set(name,Buffer.from(fs.readFileSync(path.join(source,name),'utf8').replaceAll('scripts/workflow.mjs','.integration/scripts/workflow.mjs')));
  const pkg=json(path.join(source,'package.json'));delete pkg.scripts;
  data.set('.integration/package.json',Buffer.from(stringify(pkg)));
  data.set('.integration/package-lock.json',fs.readFileSync(path.join(source,'package-lock.json')));
  data.set('.integration/PROJECT-RULES.md',Buffer.from(fs.readFileSync(path.join(source,'PROJECT-RULES.md'),'utf8').replaceAll('npm run workflow --','node .integration/scripts/workflow.mjs')));
  data.set('.integration/GUIDE.md',fs.readFileSync(path.join(source,'ONBOARDING.md')));
  const config={schema:'integrated',openspecVersion:'1.13.1',testRunner:options.runner,testFiles:options.tests};
  if(options.runner==='python-unittest')config.pythonExecutable=options.python;
  data.set('workflow.config.json',Buffer.from(stringify(config)));
  return data;
}
function build(target,options) {
  target=noLinks(target);
  if(target===path.parse(target).root)fail('Filesystem root is not a project');
  if(target===path.dirname(source)||target===source||source.startsWith(target+path.sep)||target.startsWith(source+path.sep))fail('Do not onboard the template source');
  if(fs.existsSync(target)&&!fs.statSync(target).isDirectory())fail('Target must be a directory');
  for(const name of ['.integration','openspec','workflow.config.json']) {
    const full=inside(target,name);
    if(fs.existsSync(full))fail('Conflict; no files changed: '+name);
  }
  const data=desired(options);
  const ignore=inside(target,'.gitignore');
  const previous=fs.existsSync(ignore)?fs.readFileSync(ignore):null;
  const eol=previous?.includes(Buffer.from('\r\n'))?'\r\n':'\n';
  const suffix=['','# Integrated workflow 0.2.0','.integration/node_modules/','.workflow/lock','.workflow/onboarding.lock',''].join(eol);
  data.set('.gitignore',Buffer.concat([previous??Buffer.alloc(0),Buffer.from(suffix)]));
  const operations=[...data].map(([file,content])=>{
    const full=inside(target,file),exists=fs.existsSync(full);
    if(exists&&file!=='.gitignore')fail('Conflict: '+file);
    return {file,kind:exists?'modify':'add',before:exists?hash(fs.readFileSync(full)):null,after:hash(content)};
  });
  return {body:{format:1,version:'0.2.0',target,existed:fs.existsSync(target),options,operations},data};
}
export function planOnboarding(target,options) {
  const {body}=build(target,options);
  return {id:randomUUID(),createdAt:new Date().toISOString(),body,digest:hash(JSON.stringify(body))};
}
function validatePlan(plan) {
  if(!/^[a-f0-9-]{36}$/.test(plan.id??'')||plan.body?.format!==1||plan.digest!==hash(JSON.stringify(plan.body)))fail('Invalid or edited plan');
}
function write(file,value) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringify(value));}
function locked(root,fn) {
  const file=inside(root,'.workflow/onboarding.lock');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const fd=fs.openSync(file,'wx');
  try{return fn();}finally{fs.closeSync(fd);fs.unlinkSync(file);}
}
export function applyOnboarding(plan) {
  validatePlan(plan);
  const {body,data}=build(plan.body.target,plan.body.options);
  if(hash(JSON.stringify(body))!==plan.digest)fail('Stale plan; target or templates changed. Generate a new plan.');
  const root=body.target;
  fs.mkdirSync(root,{recursive:true});
  return locked(root,()=>{
    const folder=inside(root,'.workflow/imports/'+plan.id);
    if(fs.existsSync(folder))fail('Plan has already been used');
    const manifest={...plan,status:'applying',createdDirectories:[]};
    const manifestFile=path.join(folder,'manifest.json');
    fs.mkdirSync(folder,{recursive:true});
    for(const op of body.operations.filter(op=>op.kind==='modify')) {
      const original=fs.readFileSync(inside(root,op.file));
      if(hash(original)!==op.before)fail('Target changed: '+op.file);
      const backup=inside(root,'.workflow/imports/'+plan.id+'/backup/'+op.file);
      fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,original);
    }
    write(manifestFile,manifest);
    try {
      for(const op of body.operations) {
        const full=inside(root,op.file);
        const missing=[];let parent=path.dirname(full);
        while(parent!==root&&!fs.existsSync(parent)){missing.push(parent);parent=path.dirname(parent);}
        manifest.createdDirectories.push(...missing.map(d=>path.relative(root,d).replaceAll('\\','/')));
        write(manifestFile,manifest);
        fs.mkdirSync(path.dirname(full),{recursive:true});
        if(op.kind==='modify'&&hash(fs.readFileSync(full))!==op.before)fail('Target changed: '+op.file);
        fs.writeFileSync(full,data.get(op.file),{flag:op.kind==='add'?'wx':'w'});
        if(hash(fs.readFileSync(full))!==op.after)fail('Write verification failed: '+op.file);
      }
      manifest.status='applied';manifest.finishedAt=new Date().toISOString();write(manifestFile,manifest);
      return {target:root,id:plan.id,files:body.operations.length,manifest:manifestFile};
    }catch(e){manifest.status='failed';manifest.error=e.message;write(manifestFile,manifest);throw e;}
  });
}
export function rollbackOnboarding(manifestFile) {
  manifestFile=noLinks(manifestFile);
  const manifest=json(manifestFile);validatePlan(manifest);
  const root=noLinks(manifest.body.target);
  if(manifestFile!==inside(root,'.workflow/imports/'+manifest.id+'/manifest.json'))fail('Manifest location mismatch');
  if(!['applied','failed','applying'].includes(manifest.status))fail('Import is not eligible for rollback');
  return locked(root,()=>{
    for(const name of ['openspec/changes','.workflow/baselines']) {
      const full=inside(root,name);
      if(fs.existsSync(full)&&fs.readdirSync(full).length)fail('Workflow work exists; use a reviewed manual recovery instead');
    }
    // Preflight EVERY file and backup before restoring or removing anything.
    const actions=manifest.body.operations.map(op=>{
      const full=inside(root,op.file);
      const current=fs.existsSync(full)?hash(fs.readFileSync(full)):null;
      if(current===op.before)return {...op,action:'none'};
      if(current!==op.after)fail('Modified after onboarding; rollback refused: '+op.file);
      if(op.kind==='modify') {
        const backup=inside(root,'.workflow/imports/'+manifest.id+'/backup/'+op.file);
        if(hash(fs.readFileSync(backup))!==op.before)fail('Backup changed: '+op.file);
      }
      return {...op,action:op.kind==='add'?'remove':'restore'};
    });
    for(const op of actions) {
      const full=inside(root,op.file);
      if(op.action==='remove')fs.unlinkSync(full);
      if(op.action==='restore')fs.copyFileSync(inside(root,'.workflow/imports/'+manifest.id+'/backup/'+op.file),full);
    }
    for(const dir of [...new Set(manifest.createdDirectories)].sort((a,b)=>b.length-a.length)) {
      const full=inside(root,dir);
      if(fs.existsSync(full)&&fs.readdirSync(full).length===0)fs.rmdirSync(full);
    }
    manifest.status='rolled-back';manifest.rolledBackAt=new Date().toISOString();write(manifestFile,manifest);
    return {target:root,status:manifest.status,manifest:manifestFile};
  });
}
function args(argv) {
  const result={tests:[]};
  for(let i=0;i<argv.length;i+=2) {
    const key=argv[i],value=argv[i+1];
    if(!value||!['--target','--runner','--test','--python','--out'].includes(key))fail('Invalid arguments');
    if(key==='--test')result.tests.push(value);else result[key.slice(2)]=value;
  }
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [action,...rest]=process.argv.slice(2);let result;
    if(action==='plan') {
      const a=args(rest);if(!a.target||!a.out)fail('Specify --target and --out');
      const plan=planOnboarding(a.target,{runner:a.runner??'node',tests:a.tests,...(a.runner==='python-unittest'?{python:a.python??'python'}:{})});
      const out=noLinks(a.out);
      if(out===plan.body.target||out.startsWith(plan.body.target+path.sep))fail('Save the review plan outside the target');
      fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,stringify(plan),{flag:'wx'});
      result={plan:out,target:plan.body.target,operations:plan.body.operations};
    }else if(action==='apply'&&rest.length===1)result=applyOnboarding(json(rest[0]));
    else if(action==='rollback'&&rest.length===1)result=rollbackOnboarding(rest[0]);
    else fail('Use plan --target PATH --test FILE --out PLAN | apply PLAN | rollback MANIFEST');
    console.log(stringify(result));
  }catch(e){console.error(e.message);process.exitCode=1;}
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openspec } from '../starter/scripts/workflow.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function initProject(target) {
  target = path.resolve(target);
  if (!target.startsWith(workspace + path.sep)) throw new Error('Choose a fresh directory inside this workspace');
  let parent = path.dirname(target);
  while (parent !== workspace) {
    if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) throw new Error('Linked parent directories are unsupported');
    parent = path.dirname(parent);
  }
  if (fs.existsSync(target)) throw new Error('Refusing to overwrite existing directory: ' + target);
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(path.join(workspace, 'starter'), target, { recursive: true, dereference: false });
  // An explicit local initialization with no agent plugin or global config changes.
  const output = openspec(target, ['init', '--tools', 'none', '--no-animation', '--no-copilot-cloud']);
  fs.writeFileSync(path.join(target, 'openspec/config.yaml'), fs.readFileSync(path.join(workspace, 'starter/openspec/config.yaml')));
  openspec(target, ['schema', 'validate', 'integrated', '--json']);
  return { target, output };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2]) throw new Error('Usage: npm run starter:init -- <new-directory>');
    console.log(JSON.stringify(initProject(process.argv[2]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

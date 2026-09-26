import { executeTests, readWorkflowConfig } from './workflow.mjs';
const root = process.cwd();
const config = readWorkflowConfig(root);
// This is a convenient test command, not a substitute for workflow verify/archive.
const result = executeTests(root, config, []);
process.stdout.write(result.output);
if (result.error) console.error(result.error);
process.exitCode = result.passed ? 0 : 1;

import fs from 'node:fs';
import path from 'node:path';
import { initProject } from './init-project.mjs';
import { runWorkflow, openspec } from '../starter/scripts/workflow.mjs';
import { appFixture, fillChange, changeLabel, workspace, put } from './demo-fixtures.mjs';

const requested = process.argv[2];
const root = requested ? path.resolve(workspace, requested) : path.join(workspace, '.sandbox', 'replay-' + Date.now());
if (fs.existsSync(root)) {
  // Only finish the untouched, already initialized demonstration directory.
  if (root !== path.join(workspace, 'examples/order-lookup') || fs.existsSync(path.join(root, 'src')))
    throw new Error('Replay requires a fresh target; use npm run demo:replay');
  fs.cpSync(path.join(workspace, 'starter'), root, { recursive: true });
} else initProject(root);
appFixture(root, { source: false });
put(root, 'README.md', '# 訂單查詢示範\n\n使用假資料與呼叫端注入的可信身份；無 HTTP 認證、真實物流、客服查詢或正式部署。\n\n執行 `npm test` 檢查本地行為。變更歷史位於 openspec/changes/archive；驗證及封存證據位於 .workflow。\n');
put(root, 'docs/adr/0001-local-fixtures.md', '# ADR 0001：使用本地假資料驗證流程\n\n狀態：示範已採納。\n\n目的為驗證文件到測試及封存的流程，使用純函式與注入時鐘，避免外部服務干擾可重現性。\n替代方案為資料庫加真實物流 API，需要額外憑證與服務假設，本輪不採用。\n代價是無法評估真實認證、網路、容量或新鮮度承諾；接正式專案時應重新評估。\n');
put(root, 'CHANGELOG.md', '# 示範變更紀錄\n\n待驗證後寫入交付內容。\n');
const events = [];
const record = (step, result) => { events.push({ step, result }); console.log(step); };
record('schema-validated', JSON.parse(openspec(root, ['schema', 'validate', 'integrated', '--json'])));
const first = 'add-order-lookup';
record('create-full-change', runWorkflow(root, 'new', first));
record('initial-artifact-status', JSON.parse(openspec(root, ['status', '--change', first, '--json'])));
record('custom-proposal-instructions', JSON.parse(openspec(root, ['instructions', 'proposal', '--change', first, '--json'])));
fillChange(root, first, { done: false });
record('pre-implementation-check', runWorkflow(root, 'check', first));
appFixture(root);
put(root, 'docs/ARCHITECTURE.md', '# 已實作架構\n\n`src/orders.mjs` 提供 lookupOrder 與 renderOrder 純函式；身份、資料及時間由呼叫端注入。\n`test/order.test.mjs` 使用固定時間及假訂單驗證權限隔離、空物流、60 分鐘邊界與 HTML 跳脫。\n沒有資料庫、HTTP 伺服器或排程；此示範不證明生產系統的認證或物流 SLA。\n');
// Implementation and tests are copied from the reproducible fixture; mark work present,
// then require actual verification before accepting or archiving it.
const tasks = path.join(root, 'openspec/changes/' + first + '/tasks.md');
fs.writeFileSync(tasks, fs.readFileSync(tasks, 'utf8').replaceAll('- [ ]', '- [x]'));
put(root, 'CHANGELOG.md', '# 示範變更紀錄\n\n## 本次交付候選\n- 本地訂單查詢、物流更新時間與陳舊提示；完成狀態以封存回條為準。\n');
record('verify-full-change', runWorkflow(root, 'verify', first));
record('archive-full-change', runWorkflow(root, 'archive', first));
const second = 'clarify-shipment-label';
record('create-lite-change', runWorkflow(root, 'new', second));
fillChange(root, second, { lite: true, done: false });
record('pre-implementation-lite-check', runWorkflow(root, 'check', second));
changeLabel(root);
const liteTasks = path.join(root, 'openspec/changes/' + second + '/tasks.md');
fs.writeFileSync(liteTasks, fs.readFileSync(liteTasks, 'utf8').replaceAll('- [ ]', '- [x]'));
put(root, 'CHANGELOG.md', '# 示範變更紀錄\n\n## 已封存\n- add-order-lookup：本地查詢、物流更新時間及陳舊提示，見 .workflow/receipts。\n\n## 本次交付候選\n- clarify-shipment-label：更新時間標籤改為「物流資訊更新時間」，完成狀態以封存回條為準。\n');
record('verify-lite-change', runWorkflow(root, 'verify', second));
record('archive-lite-change', runWorkflow(root, 'archive', second));
record('validate-final-specs', JSON.parse(openspec(root, ['validate', '--specs', '--strict', '--json', '--no-interactive'])));
put(root, '.workflow/replay.json', JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version, openspec: '1.13.1', root, events }, null, 2) + '\n');
console.log('Replay complete: ' + root);

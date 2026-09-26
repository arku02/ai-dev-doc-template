import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const purpose = 'Provide a deterministic local order lookup demonstration with ownership isolation, shipment freshness, and a visible synchronization timestamp, using synthetic data only.';
export const titles = {
  R1: 'R1 - Order ownership', R2: 'R2 - Shipment information',
  R3: 'R3 - Stale shipment warning', R4: 'R4 - Shipment update label',
};
export const blocks = {
  R1: `### Requirement: ${titles.R1}
The system SHALL return 401 without a trusted customer identity and SHALL expose only the caller's own order. Another customer's order and a missing order SHALL both return an identical 404 response. Internal fields SHALL be excluded.

#### Scenario: Owner lookup
- **WHEN** customer A requests A's order
- **THEN** the result has status 200 and public order fields only

#### Scenario: Foreign or absent order
- **WHEN** customer B requests A's order or any customer requests a missing order
- **THEN** the result has the same status 404 and error body

#### Scenario: No trusted identity
- **WHEN** the caller supplies no trusted identity
- **THEN** the result has status 401
`,
  R2: `### Requirement: ${titles.R2}
The system SHALL return the supplied shipment status and synchronization timestamp. Missing shipment data SHALL return null status and timestamp with a preparing message, without an exception.

#### Scenario: Shipment exists
- **WHEN** a shipment record exists for the caller's order
- **THEN** its status and unchanged timestamp are returned

#### Scenario: Shipment not ready
- **WHEN** no shipment record exists
- **THEN** null values and the message 物流資訊準備中 are returned, with stale false
`,
  R3: `### Requirement: ${titles.R3}
The system SHALL mark available shipment data stale only when the supplied current time is more than 60 minutes after synchronization. Stale data SHALL remain visible with the warning 物流資訊可能已過期.

#### Scenario: Boundary
- **WHEN** the shipment was synchronized exactly 60 minutes ago
- **THEN** stale is false and no warning is rendered

#### Scenario: Older data
- **WHEN** the shipment was synchronized 60 minutes and one second ago
- **THEN** stale is true and the warning is rendered
`,
  R4: `### Requirement: ${titles.R4}
The system SHALL render the label 最後更新 with the original synchronization timestamp when shipment information is available. All order and shipment values SHALL be HTML escaped.

#### Scenario: Timestamp label
- **WHEN** available shipment information is rendered
- **THEN** the label 最後更新 and the original timestamp are visible

#### Scenario: Untrusted shipment text
- **WHEN** shipment text contains HTML markup
- **THEN** the markup is escaped rather than executed
`,
};
export function put(root, relative, text) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
export function appFixture(root, { source = true } = {}) {
  fs.cpSync(path.join(workspace, 'fixtures/order-lookup/test'), path.join(root, 'test'), { recursive: true });
  if (source) fs.cpSync(path.join(workspace, 'fixtures/order-lookup/src'), path.join(root, 'src'), { recursive: true });
  put(root, 'workflow.config.json', JSON.stringify({ schema: 'integrated', openspecVersion: '1.13.1', testFiles: ['test/order.test.mjs'] }, null, 2) + '\n');
}
export function fillChange(root, id, { lite = false, done = true } = {}) {
  const prefix = 'openspec/changes/' + id + '/';
  const refs = lite ? ['R4'] : Object.keys(blocks);
  put(root, prefix + 'proposal.md', `# ${id}\n\n## Why\n${lite ? 'Clarify which information the timestamp describes.' : 'Demonstrate the integrated workflow with a deliberately limited, synthetic order lookup.'}\n\n## What Changes\n${lite ? 'Replace the timestamp label while preserving ownership, shipment values and stale behavior.' : 'Add local order ownership, shipment freshness and escaped HTML rendering.'}\n\n## Non-goals\nNo HTTP authentication, support access, real logistics API, database, performance SLA, production deployment or business metrics.\n\n## Capabilities\n### ${lite ? 'Modified' : 'New'} Capabilities\n- order-lookup: ${lite ? 'R4 label only' : 'R1 through R4'}\n\n## Impact\nLocal src/orders.mjs and test/order.test.mjs. Mode: ${lite ? 'lite' : 'full'}.\n`);
  put(root, prefix + 'design.md', `# 技術設計\n\n## 已知事實\n示範使用 Node 原生測試與假資料；actor 為呼叫端已信任的身份，沒有 HTTP 認證。\n\n## 示範假設\n只提供消費者單筆查詢，無客服或歷史清單；超過 60 分鐘顯示陳舊提示。這些是示範政策，不是原始範例已解決的 Q1～Q7。\n\n## 擬採方案與取捨\n${lite ? '只改顯示標籤及其規格與斷言；無模組或長期決策改變。' : '使用純函式與呼叫端注入時鐘，資料留在記憶體，回傳明確狀態及經跳脫的 HTML。避免為流程試跑引入外部服務。'}\n\n## 驗證與回復\nnode --test test/order.test.mjs；使用固定時間測試邊界。示範失敗時回到檔案修訂，無資料遷移。\n\n## 文件影響\n${lite ? '架構及 ADR 不變，不適用；交付後更新示範變更紀錄。' : '已實作後記錄架構現況與 ADR，並以測試結果支持完成結論。'}\n`);
  const delta = refs.map(ref => lite ? blocks[ref].replaceAll('最後更新', '物流資訊更新時間') : blocks[ref]).join('\n');
  put(root, prefix + 'specs/order-lookup/spec.md', (lite ? '' : '## Purpose\n' + purpose + '\n\n') + '## ' + (lite ? 'MODIFIED' : 'ADDED') + ' Requirements\n\n' + delta);
  put(root, prefix + 'tasks.md', '# 任務\n\n## 1. 實作與驗證\n' + refs.map((ref, i) => `- [${done ? 'x' : ' '}] 1.${i + 1} 實作並驗證 ${ref}；測試 test/order.test.mjs`).join('\n') + '\n');
  const review = { mode: lite ? 'lite' : 'full', decision: 'ready', reviewer: '示範流程維護者（AI）',
    rationale: lite ? '僅 R4 文案改動，保留時間、權限及陳舊行為；完整回歸測試仍執行。' : '已核對限定示範政策、R1～R4 與實際測試對應；未將原電商範例未決項目當成已核准。',
    openQuestions: [], coverage: refs.map((ref, i) => ({ requirement: ref, task: `1.${i + 1}`, test: 'test/order.test.mjs' })) };
  put(root, prefix + 'review.md', '# 審查紀錄\n\n```json\n' + JSON.stringify(review, null, 2) + '\n```\n\n## 實際驗證\n見 .workflow/evidence/' + id + '.json；此文件只記審查，不手填測試通過。\n');
}
export function changeLabel(root) {
  for (const file of ['src/orders.mjs', 'test/order.test.mjs']) {
    const full = path.join(root, file);
    fs.writeFileSync(full, fs.readFileSync(full, 'utf8').replaceAll('最後更新', '物流資訊更新時間'));
  }
}

# 整合流程操作手冊

對應模板 0.2.0、OpenSpec 1.13.1 與 integrated schema。文件責任見 [整合約定](INTEGRATION.md)，最新實測見 [第二版驗證](reports/RELEASE-0.2-VALIDATION.md)。[原版手冊](WORKFLOW.manual.md) 保留供比較。

## 一、導入

新／舊專案優先依 [通用導入手冊](ONBOARDING.md) 使用 plan／apply，工具放在 .integration，保留產品套件設定。
如果選用新專案的平面 starter，在樣板庫根目錄：

```text
npm ci --ignore-scripts --no-audit --no-fund
npm run starter:init -- examples/my-project
```

進入新專案後，讓 AI 讀取 README.md 和 PROJECT-RULES.md，填入實際技術背景、指令、授權邊界及架構來源。設定 workflow.config.json 的 testFiles，建立存在且會執行的測試。Node 為預設；Python 設定 testRunner 為 python-unittest 並填 pythonExecutable，見 [Python 設定](../starter/README.md)。初始 example 路徑只是待填欄位。

已有程式先盤點實際行為，不能把舊「實作中」規格搬成現行基準。初始化不安裝全域工具或 AI 外掛；本輪驗證範圍是本地 CLI、模板及檢查入口。

## 二、每個變更的循環

以下命令在目標專案根目錄執行，以平面 starter 為例。接入型專案把每個 `npm run workflow --` 換成 `node .integration/scripts/workflow.mjs`，工作規則改讀 `.integration/PROJECT-RULES.md`。兩種佈局共用同一檢查與模板，勿混用套件安裝位置。

### 1. 建立與分流

```text
npm run workflow -- new add-feature
```

建立 OpenSpec 變更與現行規格快照。明確低影響修改使用 lite；權限、持久化資料契約、跨元件行為邊界或重大未知使用 full。多個檔案改動本身不是升級條件；若調查後涉及資料完整性，應擴充分析並重審。詳細判準見 [第二版分流](RELEASE-0.2.md)。兩者同一 schema，lite 減少論述與獨立 PRD，不省略驗證。

### 2. 寫文件並審查

依 openspec/schemas/integrated/templates 填入提案、規格、設計、任務、審查。可以交給 AI：

```text
先讀 PROJECT-RULES.md 與本次變更，按 integrated 模板起草。
區分已知事實、工作假設及未決問題。
需求用穩定 R 編號，技術檢查用 D 編號。
建立需求／檢查、任務、測試對應；只維護一份 tasks.md。
檢查產品範圍、規格、設計及任務是否一致，不預填測試通過。
```

review.md 的 JSON 包含 mode、decision、reviewer、rationale、openQuestions 和 coverage。審查前為 pending；真正審查且沒有關鍵待決項目後才改 ready。測試檔可以先建立，但空測試不算驗證。

Node 測試名稱以 `R1: 情境` 或 `D1: 情境` 開頭；Python unittest 方法以 `test_R1_情境` 或 `test_D1_情境` 開頭。verify 會核對案例確實執行；標題匹配不能代替檢查斷言內容。

```text
npm run workflow -- check add-feature
```

check 核對結構、覆蓋連結、基準及衝突，並呼叫 OpenSpec 驗證。人與 AI 仍須判斷測試是否在語意上涵蓋需求；check 通過不是功能驗收通過。

### 3. 實作與驗證

照唯一 tasks.md 實作並更新任務。未定義的產品行為回規格處理，內部方案變更回設計，重要選擇補 ADR。必要架構現況與交付候選紀錄在最後驗證前更新，納入輸入快照。

```text
npm run workflow -- verify add-feature
```

真正執行測試並生成證據。失敗、零有效通過測試、跳過／待辦／取消項目，或測試期間檔案改動，都不能通過。證據是工具產物，不手動補 passed 欄位。

### 4. 收尾

```text
npm run workflow -- archive add-feature
```

先要求最新通過證據，再重跑測試，才呼叫 OpenSpec 同步與封存；同步後的正式規格也通過嚴格驗證，才產生成功回條。以 .workflow/receipts 的回條和 archive 目錄為完成依據。若最後的正式規格驗證失敗，檔案可能已封存；先檢查與修訂正式規格，再以後續變更完成驗證，不盲目重跑原 archive，也不直接執行原生 archive 繞過。

tasks.md 隨變更保存，不沿用 PLAN 完成即刪的政策。產品使用率、客服工單等成效需要上線後觀測，不能用本地測試代替。

## 三、變更與回流

| 情況 | 處理 |
|---|---|
| 活動變更的規格或程式改了 | 檢查差異，更新相關文件與測試，重新 verify |
| 現行主規格改了 | 比對新基準，執行 rebase，重新審查與 verify |
| 兩個活動變更修改同領域同名需求 | 協調範圍及順序；不強行覆蓋 |
| 已封存功能再改 | 開新變更，保留舊歷史 |

```text
npm run workflow -- rebase add-feature
```

rebase 只刷新基準、使證據失效、將 review 重設 pending，不替你修訂差異。第一版對任一主規格改動保守要求 rebase，尚未做細粒度自動合併。

## 四、重播與排錯

在樣板庫根目錄：

```text
npm test
npm run demo:test
npm run demo:replay
```

replay 印出新目錄位置；其 .workflow/replay.json 保存 schema、初始依賴、模板指引、驗證、封存及最終規格結果。

| 錯誤 | 處理 |
|---|---|
| 找不到 OpenSpec | 在本庫或獨立 starter 依 lockfile 執行 npm ci |
| 測試路徑不存在 | 設定真實測試路徑與內容 |
| Unresolved questions | 決定並回寫問題，不只清空列表 |
| Uncovered requirement/task | 補齊或修正需求—任務—測試對照 |
| stale verification evidence | 檢查改動，重新 verify |
| Baseline changed | 比對新規格、rebase、重審、重驗 |
| Active spec conflict | 協調兩個變更範圍或順序 |
| lock 已存在 | 確認沒有同專案檢查仍在執行，再檢查中斷遺留；不自動搶鎖 |

## 五、原版遷移

一次遷移一個功能：PRD 保留產品目的；docs/spec 分清現行基準與待實作需求後轉入 OpenSpec；PLAN 任務移入唯一 tasks。原文件標明歷史／新位置，停止雙邊更新。

原訂單 PRD／SPEC／ADR 與 .example 仍是原版參考。示範採明確限定的假政策，不表示原始範例七個待決項目已獲真實產品批准。其他語言、純文件變更等限制見 [starter 說明](../starter/README.md)。

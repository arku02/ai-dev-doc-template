# 整合流程第一版試跑報告

本頁保留第一輪 Node 訂單示範的歷史結果與當時限制。後續已新增 Python unittest 與封存後正式規格檢查，最新結果見 [arxiv-digest 試用報告](ARXIV-TRIAL.md)；workflow-tests 檔案會隨目前版本重跑更新，目前為 18 個案例（含外層共 19 項）。

| 項目 | 結果 |
|---|---|
| 日期 | 2026-09-18（Asia/Taipei） |
| 環境 | Windows、Node.js v24.18.0、OpenSpec 1.13.1 |
| 整合測試 | 17 個案例全部通過；Node 報表含外層測試共 18 項，0 失敗 |
| 示範功能測試 | 10 項全部通過，0 跳過／待辦／取消 |
| 真實流程 | 初始化 → 自訂 schema → 完整功能 → 驗證／封存 → 小修改 → 驗證／封存 → 主規格驗證 |
| 結論 | 第一版可在已測環境重播；限制與未驗證範圍見下文 |

這是實際 CLI、程式及測試的結果，與 [先前文件演練](../examples/integration-order-lookup.md) 分開。沒有將原始電商範例的產品政策當成真實批准。

## 1. 可交付內容

- [starter](../../starter/README.md)：可複製起始專案，含固定依賴與 lockfile。
- [integrated schema](../../starter/openspec/schemas/integrated/schema.yaml)：五份產物及依賴。
- [workflow 入口](../../starter/scripts/workflow.mjs)：new／check／verify／archive／rebase。
- [訂單查詢示範](../../examples/order-lookup/README.md)：純函式、本地假資料與 HTML 文字輸出。
- [操作手冊](../WORKFLOW.md)：導入、日常使用、排錯與原版遷移。

模板吸收 BMAD 的產品／架構規劃與 Spec Kit 的澄清／一致性檢查方法。沒有執行它們的原生指令，也未宣稱是三個工具的完整串接。

## 2. 原始證據

| 證據 | 記錄內容 |
|---|---|
| [整合測試摘要](workflow-tests.json) | 執行時間、版本、退出碼、測試總數、關鍵輸入雜湊 |
| [整合測試輸出](workflow-tests.tap) | 每個成功／失敗路徑的實際斷言結果 |
| [完整重播紀錄](../../examples/order-lookup/.workflow/replay.json) | schema 驗證、工具指引、產物狀態及兩個變更的實際流程 |
| [完整功能測試證據](../../examples/order-lookup/.workflow/evidence/add-order-lookup.json) | 10 項測試結果、輸入快照、執行案例編號與輸出雜湊 |
| [小修改測試證據](../../examples/order-lookup/.workflow/evidence/clarify-shipment-label.json) | lite 模式仍執行全部 10 項回歸測試 |
| [完整功能封存回條](../../examples/order-lookup/.workflow/receipts/add-order-lookup.json) | 初版同步及封存結果 |
| [小修改封存回條](../../examples/order-lookup/.workflow/receipts/clarify-shipment-label.json) | 修改 1 條需求，其餘需求保留 |
| [最後的現行規格](../../examples/order-lookup/openspec/specs/order-lookup/spec.md) | R1～R4，標籤已更新為「物流資訊更新時間」 |

回條是當時交付紀錄，雜湊不是對未來所有版本的永久保證。原始整合測試的臨時專案保留在 TAP 輸出所列的 .sandbox 目錄；該目錄不納入版控，可由 npm test 重建。

## 3. 已驗證的案例

| # | 案例 | 實際結果 |
|---|---|---|
| 1 | 尚未寫文件時讀取自訂 schema／指引 | review 依賴為 blocked；讀到自訂提案方法與模板 |
| 2 | 文件齊全、審查 ready、覆蓋完整 | check 通過 |
| 3 | 沒有驗證證據就封存 | 拒絕，活動變更仍在 |
| 4 | 審查有未決問題 | check 拒絕 |
| 5 | 需求缺測試／任務對應 | check 拒絕 |
| 6 | 任務未完成 | verify 拒絕 |
| 7 | 刻意將 stale 邊界由 > 改成 >= | 真實功能測試失敗，不能封存，主規格不變 |
| 8 | 測試檔為空 | 拒絕產生通過證據 |
| 9 | 所有功能測試被標記 skip | 拒絕產生通過證據 |
| 10 | 驗證後改動變更規格 | archive 拒絕過期證據 |
| 11 | 驗證後改動程式 | archive 拒絕過期證據 |
| 12 | 修改已保存的測試輸出 | archive 拒絕不一致輸出 |
| 13 | 兩個活動變更修改同領域同名需求 | 拒絕，指出衝突變更 |
| 14 | 完整功能通過驗證 | 真正執行 OpenSpec archive，產生無 TBD 的現行規格，移入歷史 |
| 15 | 主規格改變後繼續工作 | 要求 rebase，重設 review 為 pending，舊證據失效 |
| 16 | 小修改更新顯示標籤 | 完整回歸通過；保留 R1／R3 等既有需求，R4 更新並封存 |
| 17 | 越界名稱與覆蓋既有目錄 | 拒絕建立 |

這些測試驗證的是指定入口的行為。直接修改檔案或使用其他工具繞過入口，不屬於「已阻擋」的範圍。

## 4. 試跑發現並修正的問題

1. **巢狀測試環境干擾。** 外層 Node 測試的 NODE_TEST_* 環境會使內層測試被略過。啟動獨立測試時移除該環境，並要求有真實案例結果；不是只看退出碼。
2. **空檔案也被算作一個通過測試。** Node 會對空測試檔產生 file-test。現在要求規格／技術檢查的 R／D 編號出現在實際案例名稱，並拒絕 skipped、todo、cancelled 與失敗結果。
3. **工具驗證不等於功能驗收。** OpenSpec 的檔案存在與結構檢查不判斷業務正確性。本版加入實際測試證據、輸入雜湊及封存前重驗；內容是否合理仍由審查負責。

先前失敗的實驗紀錄留在 .sandbox，正式 reports 與 examples 使用修正後的版本。

## 5. 重播方式

在樣板庫根目錄：

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run demo:test
npm run demo:replay
```

前兩項會依 lockfile 安裝及產生新的整合報表。demo:test 檢查交付示範；replay 使用新目錄，依已知範例產生產物與程式，不呼叫外部模型或真實物流服務。

重播是可重現的整合驗證，不是證明 AI 對任意自然語言需求都能正確規劃。新需求仍需內容審查。

## 6. 已知限制

- **版本範圍：** 實測 Node 24.18.0 和 OpenSpec 1.13.1；套件允許 Node 20.19 以上，其他版本仍需重跑測試。未測其他作業系統。
- **測試介面：** 第一版只執行 Node 原生測試與具 R／D 前綴的案例。覆蓋連結及名稱存在不能證明斷言語意充分。
- **功能範圍：** 沒有真正的 HTTP 認證、客服權限、資料庫、物流服務、容量／效能測試或生產部署；actor 是呼叫端注入的可信身份。
- **操作入口：** 使用原生 archive 可以繞過本地關卡；需要團隊強制約束時，必須在受保護 CI／合併流程重跑。這不是防竄改系統。
- **並行：** 本入口的 lock 只防止自身同時執行；不能阻止外部編輯器與工具。主規格改動保守要求 rebase，同名需求衝突阻擋，不提供語意衝突自動解決。
- **規格操作：** 暫不支援 RENAMED、純文件零 delta、獨立 store、巢狀變更名稱；不要為符合工具限制捏造產品需求。
- **回復：** 實測失敗關卡未修改主規格；未做磁碟故障或強制斷電的交易回復測試，不宣稱所有中斷均可自動復原。
- **隔離：** 專用目錄與假資料用於避免污染工作成果；不等同容器或作業系統安全沙盒。

完整功能與小修改已實際跑通，下一個合理使用方式是從 starter 建立一個真實的小專案，再依技術棧擴充測試介面，而非直接把此示範當正式服務。

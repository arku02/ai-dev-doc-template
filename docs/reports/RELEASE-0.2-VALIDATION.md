# 0.2.0 可重複導入驗證報告

測試日期：2026-09-18；交付核對：2026-09-19。版本：本地交付 0.2.0，OpenSpec 1.13.1。此輪完成的是整合模板，未繼續擴充 arxiv-digest。

交付核對已確認四份驗證摘要的程式雜湊與目前原始碼一致；無新增程式變更，沿用已通過的測試證據。

## 結論

已提供不依賴特定產品的 plan／apply／rollback 入口。新專案與既有專案可依 [導入手冊](../ONBOARDING.md) 完成接入、設定測試與交付，不需另寫專用接入腳本。
三個臨時專案分別安裝自己的工具依賴，Python 另建無第三方套件的虛擬環境，完整執行四次變更與封存。這是實際 CLI 結果，不是只核對文件存在。

## 測試結果

| 類別 | 案例 | 結果與原始紀錄 |
|---|---:|---|
| 通用接入、衝突與復原 | 17 | 全通過；[摘要](onboarding-tests.json)、[輸出](onboarding-tests.tap) |
| 原有整合流程回歸 | 18 | 全通過；[摘要](workflow-tests.json)、[輸出](workflow-tests.tap) |
| Python 執行器回歸 | 12 | 全通過；[摘要](python-tests.json)、[輸出](python-tests.tap) |
| 新／舊專案獨立依賴驗證 | 3 個專案、4 次變更 | 全通過；[逐步命令與紀錄位置](clean-environment.json) |

前三組共 47 個案例；Node 各包含一個外層測試，原始報表分別顯示 18、19、13，合計 50 項。未把預期拒絕的案例當成意外失敗，也沒有跳過測試。

## 實際跑過的三種情境

| 專案 | 準備方式 | 驗證 |
|---|---|---|
| 全新 Node 平面 starter | 複製模板、依自身 lockfile 安裝 | doctor、新變更、10 個訂單案例、正式規格及封存 |
| 既有 Node／CommonJS 專案 | 通用清單導入 .integration，獨立工具套件 | 原 README、package.json、lockfile 與程式逐位元組保留；完整交付通過 |
| 既有 Python 專案 | 全新 venv，不安裝 pip 或第三方套件，使用相對 Python 路徑 | doctor 確認 venv；初版文字整理與第二輪大小寫需求均通過測試、規格及封存 |

Python 情境每輪執行兩個真實 unittest 案例；第二輪保留原有空字串情境，再修改文字大小寫行為。標準函式庫案例是通用驗證用的小型專案，不是 arxiv-digest 的正式功能。

## 原檔保護與恢復

已驗證 plan 不建立目標、原產品設定不變、已有 openspec／.integration／workflow.config.json 時拒絕接入、清單過期與被編輯時拒絕寫入、重複套用拒絕覆蓋。
apply 保存原 .gitignore 備份與操作 manifest；rollback 在全部檔案及備份檢查通過後才修改。工具檔已改、備份被改或已有工作變更時會拒絕復原；其他新建筆記保留。另測試連結路徑拒絕與可辨識的部分寫入恢復。
導入不執行原產品、不合併根目錄套件設定、不修改全域 AI 指令；沒有「遇到衝突就強制覆蓋」的模式。

## 從第一次試用帶回模板的改善

- 將 arxiv-digest 專用接入操作整理成通用清單、套用與復原流程。
- 工具套件放入 .integration，避免改動既有 Node 專案的 CommonJS／ESM 設定、指令與鎖檔。
- 接入型專案拒絕借用上層 OpenSpec 安裝，避免在樣板庫能跑、搬出去卻缺依賴。
- Python 執行檔支援專案相對路徑，執行器從自身位置尋找，兩種佈局均可使用。
- 補充 doctor、分流判準、失敗回流、導入恢復與正式規格驗證失敗的處理方式。
- 將產品完成與模板完成分開，不以 Telegram、真實 MySQL 或新的產品功能作為本版完成條件。

## 可重播方式

在樣板庫根目錄：

```text
npm ci --ignore-scripts --no-audit --no-fund --cache .npm-cache
npm test
npm run test:onboarding
npm run test:python
npm run test:clean -- --python python
```

若 python 不在 PATH，test:clean 的 --python 改填實際執行檔；test:python 使用 WORKFLOW_PYTHON 環境變數指定。乾淨環境腳本每次建立新的 .sandbox/clean-*，使用離線快取安裝，不覆蓋前次證據或產品。
摘要內含執行時間、關鍵程式雜湊、逐步命令與輸出位置。臨時專案及大量日誌保留在 .sandbox，不納入版控，可按上述步驟重建。

## 實際限制

本輪使用 Windows、Node 24.18.0、Python 3.13.7；乾淨是指重新安裝專案工具及新建隔離 Python 套件環境，並非重新安裝作業系統。未測 macOS／Linux，也未重建 arxiv-digest 的第三方依賴或驗證外部服務。
既有流程升級、任意測試框架與純文件零 delta 尚不支援；本地檢查不是防竄改或完整交易系統。更多邊界見 [完成標準與範圍](../RELEASE-0.2.md)。

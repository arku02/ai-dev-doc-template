# AI 開發文件與整合流程樣板 0.2.0

這是一套協助你與 AI 合作開發軟體的起始模板，涵蓋需求整理、任務拆解、測試驗證與變更紀錄。可用於新專案，也能導入既有專案。

模板提供文件範本與流程檢查工具，幫助你確認每次修改的需求、工作進度與驗證結果。

第二版提供通用接入清單、原檔保留、衝突阻擋、備份與復原。從 [導入手冊](docs/ONBOARDING.md) 開始；支援範圍及完成標準見 [0.2.0 說明](docs/RELEASE-0.2.md)。

## 先看哪裡

- [操作手冊](docs/WORKFLOW.md)：如何導入、開發、驗收與封存。
- [第二版驗證](docs/reports/RELEASE-0.2-VALIDATION.md)：通用接入、乾淨環境與回歸結果。
- [試跑報告](docs/reports/INTEGRATION-TRIAL.md)：成功／失敗案例、證據與限制。
- [整合工作約定](docs/INTEGRATION.md)：文件責任與修改回流。
- [可複製起始專案](starter/README.md)：工具、模板、規則。
- [已完成示範](examples/order-lookup/README.md)：真實本地程式、測試、現行規格與封存紀錄。
- [原版手動流程](docs/WORKFLOW.manual.md)：保留原有 Markdown 做法；同一功能不要同時維護兩套任務。

## 快速驗證

在本庫根目錄執行，需 Node.js 20.19 以上及 npm：

```text
npm ci --ignore-scripts --no-audit --no-fund --cache .npm-cache
npm test
npm run test:onboarding
npm run test:python
npm run test:clean -- --python python
npm run demo:test
npm run demo:replay
```

npm test 產生 docs/reports/workflow-tests.*。test:onboarding 檢查通用接入；Python 執行器測試可用 WORKFLOW_PYTHON 指定執行檔。test:clean 的 --python 可填完整路徑，會建立自己的 venv 和三個臨時專案，使用 .npm-cache 離線快取；首次在本庫安裝時可增加 `--cache .npm-cache` 準備快取。
demo:test 執行已交付示範的 10 個行為測試；demo:replay 保留平面結構示範，每次另建目錄，不覆蓋既有成果。

## 接入自己的專案

目標可為新目錄或既有專案；先產生清單，再核對套用：

```text
npm run onboard -- plan --target .sandbox/my-project --runner node --test test/feature.test.mjs --out .sandbox/my-plan.json
npm run onboard -- apply .sandbox/my-plan.json
```

接著在目標根目錄執行 `npm ci --prefix .integration --ignore-scripts --no-audit --no-fund`。工具有自己的套件設定，不改產品 README／package.json。Python、衝突及復原見 [導入手冊](docs/ONBOARDING.md)。

若想用原平面結構建立新專案，仍可：

```text
npm run starter:init -- examples/my-project
```

這會從 starter 建立新目錄，初始化 OpenSpec 並驗證 schema；已有目錄會拒絕覆蓋。接著讀取新專案 README，設定真實背景及測試檔，不要帶入電商示範的假政策。

也可將 starter 整份複製到另一個新目錄，執行其 npm ci。starter 的 lockfile 固定依賴；工作區內示範可使用父層已安裝的套件。

## 內容

| 位置 | 用途 |
|---|---|
| starter/ | 可複製工具、五份模板、專案規則與固定依賴 |
| examples/order-lookup/ | 已試跑示範、規格、封存／驗證證據 |
| fixtures/order-lookup/ | 重播用的初版程式與測試 |
| scripts/、tests/ | 初始化、重播、真實 CLI 整合與失敗路徑測試 |
| docs/ | 手冊、整合約定、文件演練與試跑報告 |

原 docs/prd、docs/spec、docs/adr 及 .example 檔保留作原版參考。它們含虛構資料，不是本庫現行規格；原版虛構交付紀錄另存於 [CHANGELOG 範例](docs/examples/CHANGELOG.sample.md)。

## 公開版內容

公開版提供通用模板、工具、測試與訂單查詢示範。Python 實際專案的歷史試用結果見 [試用摘要](docs/reports/ARXIV-TRIAL.md)；完整試驗副本、專用腳本與原始日誌已另行備份，不隨公開版提供。

`_local-backups/` 是維護者的本機備份區，已加入 `.gitignore`，不要上傳或打包進公開版。報告及示範驗證紀錄中的個人路徑已替換成通用標記；這些公開副本供閱讀，原始紀錄另存備份。整理範圍與檢查結果見 [公開版整理說明](docs/PUBLIC-RELEASE.md)。

## 使用邊界

接入型專案交付使用 `node .integration/scripts/workflow.mjs archive <change>`；平面 starter 使用 `npm run workflow -- archive <change>`。直接執行 OpenSpec archive 能繞過本地證據關卡。工具能核對結構、覆蓋連結、測試結果與輸入新鮮度，無法自動證明需求合理或測試語意完整。

目前已驗證 Node 原生測試與 Python unittest、帶行為差異的變更及本地單專案；不宣稱支援任意測試框架、獨立 store、純文件零差異或生產環境。詳細限制見 [起始專案說明](starter/README.md)。

# 0.2.0：接入新專案或既有專案

此入口讓新／舊專案共用一套導入方式，保留產品程式、README、package.json、套件鎖檔與 AI 設定。若已有 openspec、workflow.config.json 或 .integration，會停止；本版不自動合併或升級既有流程。

## 1. 產生接入清單

在 **ai-dev-doc-template 根目錄**執行。目標可以尚不存在，也可換成既有專案的絕對路徑；有空白時加引號。plan 不會建立或修改目標，清單必須放在目標以外的新檔案。

Node 專案：

```text
npm run onboard -- plan --target .sandbox/my-node-project --runner node --test test/feature.test.mjs --out .sandbox/my-node-plan.json
```

Python 專案：

```text
npm run onboard -- plan --target .sandbox/my-python-project --runner python-unittest --python .venv/Scripts/python.exe --test tests/test_feature.py --out .sandbox/my-python-plan.json
```

--test 可重複指定。測試檔可以尚未建立，但 doctor 與交付驗證會要求真實檔案和案例。Node 使用 test/ 或 tests/ 下的 *.test.js／*.test.mjs；Python 使用 test_*.py。
Python 範例為 Windows；其他系統改用 .venv/bin/python。也可指定 PATH 中的 python，不必把個人電腦路徑寫入模板。

查看清單的 target、options、operations：確認目標、測試方式、將新增的檔案及 .gitignore 的前後雜湊。沒有 --force 選項；已有流程時先比對內容，不覆蓋解決。

## 2. 核對後套用

```text
npm run onboard -- apply .sandbox/my-node-plan.json
```

Python 使用對應的 my-python-plan.json。工具重新核對目標與模板；若 .gitignore 或模板已改變，需重建清單。原產品檔案可以繼續編輯，因為接入不會修改它們。

| 位置 | 用途 |
|---|---|
| .integration/ | 獨立 package／lockfile、流程執行器、GUIDE.md、PRIVACY.md 與 PROJECT-RULES.md |
| openspec/ | 自訂 schema、模板與之後的規格／變更 |
| workflow.config.json | 測試方式、Python 執行檔與測試清單 |
| .gitignore | 保留原內容並追加工具依賴、鎖檔、本機設定與私人原始資料忽略規則 |
| .gitattributes | 保留原內容並追加證據位元組保留規則，避免換行轉換破壞雜湊 |
| .workflow/imports/導入編號/ | manifest、套用狀態及被修改檔案的備份 |

套用不執行產品程式、不安裝套件、不連資料庫、不修改全域 AI 設定。目標位於執行環境允許寫入的工作區之外時，仍可能要求檔案權限；接入工具不會繞過。

plan／manifest 保留實際路徑供套用與復原，屬於本機資料，不上傳。新版 `.gitignore` 排除 `.workflow/imports/` 與 `.workflow/private/`；已被追蹤的檔案仍需人工處理。

## 3. 安裝與環境檢查

切到 **目標專案根目錄**：

```text
npm ci --prefix .integration --ignore-scripts --no-audit --no-fund
node .integration/scripts/doctor.mjs
```

工具固定 OpenSpec 1.13.1，由自己的 lockfile 安裝；不能借用樣板庫或產品的上層安裝。doctor 檢查 Node、工具版本、測試檔存在與 Python 執行環境，不代表功能測試已通過。

Python 專案建議建立自己的虛擬環境，再依**該專案**的依賴管理方式安裝。例如 Windows：

```text
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

只有專案真的有 requirements.txt 才執行第二行；純標準函式庫專案不需安裝套件。請將 .venv 加入產品的 .gitignore；工具不推測依賴或自動升級版本。

### 啟用上傳前的本機保護

Git 倉庫建立後，在目標專案根目錄執行：

```text
node .integration/scripts/privacy.mjs install
node .integration/scripts/privacy.mjs history
```

每個 clone 都需啟用。原有 Git hooks 會被保留，遇到衝突需整合；只導入模板不代表已啟用攔截。詳見目標專案 `.integration/PRIVACY.md`；個人 Python 完整路徑可移到不公開的 `workflow.local.json`，共用設定保留可執行的相對路徑或 PATH 命令。

## 4. 第一個變更

先讀 .integration/GUIDE.md 與 .integration/PROJECT-RULES.md，讓協作 AI 也讀取它們。

```text
node .integration/scripts/workflow.mjs new add-feature
```

依 openspec/schemas/integrated/templates 撰寫 proposal、specs、design、tasks、review。既有專案先建立本次涉及的能力規格，分清原有與新增行為，不必重寫整個專案的 PRD。
Node 案例名稱用 R1: 情境；Python unittest 方法用 test_R1_情境。審查 ready 後 check，實作與任務完成後 verify、archive：

```text
node .integration/scripts/workflow.mjs check add-feature
node .integration/scripts/run-tests.mjs
node .integration/scripts/workflow.mjs verify add-feature
node .integration/scripts/workflow.mjs archive add-feature
```

成功以 .workflow/receipts 回條為準。只有文件齊全、doctor ready 或原生 archive 成功，都不能代替驗收。

## 5. 導入復原

尚未開始工作時，回到**樣板庫根目錄**，使用 apply 印出的 manifest 絕對路徑：

```text
npm run onboard -- rollback "目標專案/.workflow/imports/導入編號/manifest.json"
```

先核對全部檔案與備份，再移除此次新增檔案、還原 .gitignore。其他檔案與導入紀錄保留，不遞迴刪除目錄。已安裝的 node_modules 會留下；這不是套件解除安裝器。
若工具檔被改動、備份不符或已有變更／基準，會整批拒絕自動復原，需人工比對備份、版本控制與現有工作。
部分寫入失敗時 manifest 留下 applying／failed，可檢查後使用同一 rollback。測試涵蓋可辨識的部分寫入狀態，不保證磁碟損壞或斷電時自動復原。

## 平面 starter 與舊安裝

新專案仍可整份複製 starter，再執行 npm ci；平面結構用 npm run workflow。接入型 .integration 結構用本頁的 node 指令。不要混用兩種入口。
舊訂單示範保留交付當時的結構，第二版不批次覆蓋。arxiv-digest 試驗副本已另行備份，公開版僅保留 [試用摘要](reports/ARXIV-TRIAL.md)，不需要安裝該專案。支援範圍、分流及完成標準見 [0.2.0 說明](RELEASE-0.2.md)。

# 整合流程起始專案 0.2.0（平面佈局）

本目錄供全新專案整份複製。既有專案請使用樣板庫 docs/ONBOARDING.md 的通用入口，不把此目錄覆蓋到舊專案。本目錄 ONBOARDING.md 是接入型 .integration/GUIDE.md 的來源，命令與平面佈局不同。

這份起始專案採 OpenSpec 1.13.1 管理規格，使用改編的 BMAD 規劃方法與 Spec Kit 審查方法。沒有安裝後兩者的原生工具。

流程工具需要 Node.js 20.19 以上。測試支援 Node 原生測試或 Python unittest；Python 適配器已用 Python 3.13.7 驗證，其他測試框架需另外接入。

## 開始

1. 在此目錄執行 `npm ci --ignore-scripts --no-audit --no-fund`。
2. 閱讀 `PROJECT-RULES.md`，讓執行工作的 AI 也讀取它。
3. 將 `workflow.config.json` 的 `testFiles` 改為實際測試檔路徑，建立對應程式與測試。初始 example 路徑只是待填欄位。
4. 執行 `npm run workflow -- new <change-name>` 建立變更與現行規格快照。
5. 讓 AI 依 `openspec/schemas/integrated/templates/` 寫出提案、規格、設計、任務及審查；或用本地 OpenSpec 的 instructions 指令讀取該模板。初始化刻意未安裝全域 AI 指令。

`schema.yaml` 定義文件依賴；它不會自己呼叫模型、寫程式或判斷需求是否合理。AI／人負責內容與實作，工具負責結構及可機械檢查的交付條件。

填好設定與測試檔後可執行 `npm run doctor` 檢查環境；doctor 不代表測試已通過。

Git 倉庫建立後，執行 `npm run privacy:install` 啟用本機提交／推送前攔截，再執行 `npm run privacy:history` 檢查既有歷史。每個 clone 都要啟用一次；複製模板不會自動安裝 hooks。操作、本機 Python 設定及精確審查例外見 [路徑隱私保護](PRIVACY.md)。

## 日常操作

```text
npm run workflow -- new add-feature
npm run workflow -- check add-feature
（實作並更新 tasks.md）
npm run workflow -- verify add-feature
npm run workflow -- archive add-feature
```

- `check`：審查已 ready、沒有待決問題、需求／技術檢查及任務都有測試對應、沒有活動規格衝突，並通過 OpenSpec schema 與變更驗證。
- `verify`：任務全完成後真正執行指定測試，保存輸入雜湊、測試輸出、執行版本及結果。
- `archive`：要求最新通過證據，再重跑測試，呼叫 OpenSpec 同步規格與封存；正式規格也通過嚴格驗證後才產生成功回條。
- `rebase`：現行規格改變後，明確刷新本變更基準、使證據失效並把 review 重設 pending。必須先對照新基準修訂需求，再重審與驗證。

所有任務只放在活動變更的 `tasks.md`。`review.md` 保存審查與覆蓋關係，不另建進度表。`mode` 為 full 或 lite：兩者用同一 schema，lite 縮短內容、不新增獨立 PRD，但不省略驗證。

## 證據

- `.workflow/baselines/`：建立變更時的現行規格快照。
- `.workflow/evidence/`：verify 生成的 JSON 與 TAP 測試輸出。
- `.workflow/receipts/`：成功同步／封存的回條。
- `openspec/changes/archive/`：歷史變更；不回頭修改它來做新工作。

證據、基準與回條經隱私檢查後可納入版控；lock 不納入。新驗證日誌先去識別化再計算雜湊，原始日誌留在本機 `.workflow/private/`；新封存回條及命令列公開輸出也處理路徑。工具不會回頭改寫舊證據；歷史資料依 [專案規則](PROJECT-RULES.md) 的「歷史證據與隱私」處理。手動修改過的歷史副本須標明修改範圍與原雜湊限制，不能冒充原始證據。輸入雜湊涵蓋專案檔案、目前變更和現行規格，排除 node_modules、.git、.workflow、.npm-cache、.venv／venv／env、Python 快取、根目錄 config.ini／.env／workflow.local.json，以及其他活動／封存變更；有效執行設定另計入新鮮度雜湊，不公開私人路徑。若測試依賴真實設定或服務，需另外建立驗證機制。

## Python 專案

保留既有 Python 專案，另安裝本地 OpenSpec 工具依賴。把設定改為：

```json
{
  "schema": "integrated",
  "openspecVersion": "1.13.1",
  "testRunner": "python-unittest",
  "pythonExecutable": "python",
  "testFiles": ["tests/test_feature.py"]
}
```

pythonExecutable 可填 Python 的完整路徑或專案相對路徑；不得把參數串在路徑中。測試採 unittest.TestCase，方法以 `test_R1_情境` 或 `test_D1_情境` 命名。路徑限 test/ 或 tests/ 下的 test_*.py，逐檔載入，不自動擴大搜尋範圍。
`npm test` 執行設定的測試，正式交付仍需 verify／archive。Python 原始輸出為 .log，JSON 證據含 Python 版本、案例及計數。
Python 依賴沿用專案管理方式；本模板不會自動建立虛擬環境或安裝 requirements。

## 第一版限制

- 這是本地流程檢查，不是防竄改安全系統。可寫入專案的人也可改檢查程式、審查或證據；部署到團隊流程時應在受保護 CI 重跑。
- 直接執行 OpenSpec 原生 archive 能繞過本地關卡，因此交付須使用本入口。lock 只防止同一入口同時運作，不阻止編輯器或外部工具改檔。
- 封存後的正式規格驗證若失敗，不產生成功回條；此時檔案可能已同步／封存，需檢查結果、修正正式規格並建立後續變更驗證，不能盲目重跑同一 archive。尚未提供交易式回滾。
- 程式驗證覆蓋連結的存在，無法證明某測試在語意上完整覆蓋需求；必須實際審查。文件矛盾也不會全部自動識別。
- 同領域同名需求的活動變更會被保守阻擋；不同名稱但語意相同的衝突須由審查發現。任一現行規格改動均需明確 rebase，暫不做細粒度自動合併。
- 只接受平面 kebab-case 變更名、穩定 R 編號與 ADDED/MODIFIED/REMOVED；不支援 RENAMED、純文件無 delta 或獨立 store。
- Node 任一 fail／cancelled／skipped／todo 或零測試均不算通過。Python 任一失敗／錯誤／skip／expectedFailure／unexpectedSuccess、零測試或缺乏有效報表均不通過。測試 60 秒逾時需修正執行器後重新驗證。
- Node 名稱以 `R1: ...` 或 `D1: ...` 開頭；Python 方法以 `test_R1_` 或 `test_D1_` 開頭。每個 coverage 編號都必須出現在實際結果；Python 只計入成功案例。名稱匹配仍不能代替語意審查。
- 只用假資料和本地檔案；資料遷移、外部服務與部署不由此樣板自動授權。目錄分開不等於作業系統沙盒，仍需沿用執行環境權限。

新專案先跑通一個小變更，再加自己的規則；不要直接帶入示範電商政策。

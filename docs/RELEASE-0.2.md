# 第二版 0.2.0：完成標準與範圍

本版完成對象是 ai-dev-doc-template 的可重複導入能力；arxiv-digest 的 Telegram、MySQL 實機驗證與產品開發另行安排。

公開版整理補註（2026-09-26）：下文記錄 0.2.0 交付當時的狀態。arxiv-digest 試驗副本與原始紀錄已另行備份，公開版保留 [歷史試用摘要](reports/ARXIV-TRIAL.md)；訂單查詢示範仍隨庫提供。

## 完成標準

| 項目 | 可驗證條件 | 證據 |
|---|---|---|
| 通用接入 | 新／舊專案共用 plan／apply，保留原文件與套件設定 | onboarding-tests.* |
| 衝突與過期清單 | 既有流程、重複接入、修改後清單拒絕寫入 | onboarding-tests.* |
| 備份與復原 | 備份原 .gitignore；復原前核對全部檔案；不覆蓋新工作 | onboarding-tests.* |
| 自有依賴 | 每個乾淨專案依本地 lockfile 安裝工具，不借用上層套件 | clean-environment.json |
| Node 新／舊專案 | 實際執行 new → check → verify → archive | clean-environment.json |
| Python 環境 | 新建無第三方套件的 venv，使用專案相對 Python 路徑 | clean-environment.json |
| 後續變更 | 第二輪 MODIFIED 保留舊情境並通過正式規格驗證 | clean-environment.json |
| 回歸 | 原工作流程與 Python 執行器測試通過 | workflow-tests.*、python-tests.* |

實際結果見 [第二版驗證報告](reports/RELEASE-0.2-VALIDATION.md)。未通過的項目不能只靠文件填寫視為完成。

## full 或 lite

兩者共用五份文件和相同驗證關卡，差別在分析深度。

| 情境 | 選擇 |
|---|---|
| 已知行為的小修正、文案或局部顯示，無新增權限／持久化契約 | lite；可引用既有背景，簡短說明設計 |
| 新功能、資料遷移、權限、外部服務、跨元件契約或重大未知 | full；展開資料流、失敗情境、驗收與必要 ADR |
| 小修正調查後涉及資料完整性或新契約 | 擴充 proposal／design，改 full 並重審，不另起第二套任務 |

修改多個檔案本身不是 full 的判斷條件；跨元件契約與風險才是。工具只檢查 mode 是否有效，不替人判斷分流是否恰當。arxiv-digest 的 lite 試用保留歷史，本版不回頭改寫封存審查。

## 支援範圍

- 工具固定 OpenSpec 1.13.1；BMAD／Spec Kit 採方法與模板，沒有三套原生指令互通保證。
- 本輪驗證 Windows、Node 24.18.0、Python 3.13.7。環境檢查最低門檻為 Node 20.19、Python 3.10；其他版本及作業系統尚未經本輪驗證。
- 只支援 Node 原生測試與 Python unittest、明確檔案清單及 R／D 案例；未接入 pytest、Jest 或任意 shell 測試指令。
- 適用新專案或尚無 openspec／workflow.config.json／.integration 的既有專案；舊版自動升級、覆蓋或自動合併尚未支援。
- 變更支援 ADDED／MODIFIED／REMOVED 與平面名稱；不支援 RENAMED、獨立 store 或純文件零 delta。

## 完成工具不等於完成產品

本版證明模板能導入與執行，不保證需求正確、測試斷言充分、應用依賴版本全相容或外部服務可用。乾淨 Python 案例只使用標準函式庫，不代表重建了 arxiv-digest 的依賴環境。
本地鎖與雜湊防止意外覆蓋，不能抵禦可修改工具與檔案的操作者。團隊強制流程需要受保護 CI；封存後失敗可能需人工修復，沒有完整交易回滾。
0.2.0 是本地交付版本；本輪未修改既有產品、建立排程、提交 Git 或發布遠端套件。舊訂單與 arxiv-digest 的工具副本保留當時版本。

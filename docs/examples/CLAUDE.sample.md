<!-- ⚠️ 這是【參考範例】，不是你的專案設定。技術棧、禁區、地雷全是虛構的。
     不要複製這份，要複製的是根目錄的 CLAUDE.md.example（空白骨架）。
     這份的用途只有一個：讓你看出每一欄該寫到多具體。 -->

# 範例：CLAUDE.md（虛構的電商專案）

## 技術棧
- 執行環境：Node.js 22 / TypeScript（strict）
- 框架：Next.js 15（App Router）
- 資料層：PostgreSQL + Prisma
- 測試：Vitest（單元）／Playwright（E2E）
- 套件管理：pnpm

## 指令
```bash
pnpm dev          # 本機開發
pnpm build        # 建置（提交前必須通過）
pnpm test         # 全部測試
pnpm test <file>  # 單檔測試，改動後優先跑這個
pnpm lint         # ESLint + Prettier
pnpm typecheck    # tsc --noEmit
```

## 程式碼慣例
- 錯誤一律回傳 `Result<T, E>`，**不 throw**（例外：framework 要求的邊界）
- 非同步一律 `async/await`，不用 `.then()` 鏈
- 對外函式必須標註回傳型別，不依賴推斷
- 檔名 `kebab-case`，型別與元件 `PascalCase`，其餘 `camelCase`
- 註解寫「為什麼」，不寫「做了什麼」

## 禁區（未經明確指示不得觸碰）
- `prisma/migrations/` — 只能透過 `pnpm prisma migrate dev` 產生，禁止手改
- `src/legacy/` — 唯讀，有新需求請在 `src/` 下新寫
- `.env*` — 禁止讀取內容、禁止寫入
- 不得新增第三方依賴，要加先問
- 不得執行 DB migration、刪除資料、或任何碰到金流的操作

## 工作方式
- **先讀 `docs/spec/` 對應的 SPEC 再動手。** SPEC 沒定義到的情況，停下來問，不要自行假設
- 東西放哪、模組能不能互相 import，看 `docs/ARCHITECTURE.md`
- 做了「以後有人會質疑」的技術選擇，在 `docs/adr/` 補一份 ADR
- 改完必須自己跑過 `pnpm typecheck` 與相關測試，通過才回報完成

## 已知地雷
<!-- 這一段會隨著踩坑逐漸變長，是這份文件最有價值的部分 -->
- `src/lib/date.ts` 的所有函式都以 UTC 運算，顯示層才轉時區。不要在 domain 層轉
- Prisma 的 `findMany` 預設沒有 `take`，查列表時務必給上限

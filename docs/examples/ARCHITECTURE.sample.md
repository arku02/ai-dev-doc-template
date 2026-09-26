<!-- ⚠️ 這是【參考範例】，不是你的專案架構。目錄與規則全是虛構的。
     不要複製這份，要複製的是 docs/ARCHITECTURE.md（空白骨架）。 -->

# 範例：ARCHITECTURE.md（虛構的電商專案）

## 模組結構

```
src/
├── domain/        純業務邏輯與型別。不得 import 任何 infra 或框架
│   ├── order/
│   └── shipment/
├── infra/         對外界的實作：DB、第三方 API、檔案系統、佇列
│   ├── db/            Prisma client 與 repository 實作
│   ├── shipping/      物流商 API client
│   └── cache/
├── app/           Next.js 路由、Server Actions、頁面組裝
├── components/    可重用 UI 元件（無業務邏輯）
├── lib/           跨層的純工具函式（日期、字串、驗證）
└── legacy/        唯讀，勿動
```

## 依賴規則

```
app  ──▶  domain  ◀──  infra
 │                       ▲
 └───────────────────────┘（只在組裝層注入實作）

lib 可被任何層 import；lib 不得 import 任何其他層
```

- `domain` **不知道 `infra` 存在**。需要外部資料時，在 `domain` 定義介面，由 `app` 注入 `infra` 的實作（依賴反轉）
- `infra` 可以 import `domain` 的型別與介面
- `components` 不得 import `infra`
- 任何跨模組呼叫都走各模組的 `index.ts`，不得深層 import 別人的內部檔案

## 東西該放哪

| 你要加的東西 | 放這裡 |
|---|---|
| 一條業務規則、一個計算 | `src/domain/<領域>/` |
| 呼叫外部 API、讀寫 DB | `src/infra/<類別>/` |
| 一個新頁面或 API endpoint | `src/app/` |
| 沒有業務語意的純函式 | `src/lib/` |
| 一個沒有業務邏輯的 UI 元件 | `src/components/` |

> 找不到對應的那一列時，**先問，不要自己開新資料夾**。新資料夾代表架構有變，應該先補 ADR。

## 資料契約

- DB schema 的唯一真實來源是 `prisma/schema.prisma`，型別由 `pnpm prisma generate` 產生，**不得手寫重複的型別定義**
- 對外 API 的契約在 `openapi.yaml`，request/response 型別由它生成
- 契約改了，先改來源檔再重新產生，不要直接改產生出來的檔案

# SPEC 0001: 訂單查詢

| | |
|---|---|
| 狀態 | 實作中 |
| 對應 PRD | `docs/prd/0001-order-lookup.md` |
| 相關 ADR | `docs/adr/0001-shipment-status-cache.md` |

## Actor

| Actor | 權限範圍 |
|---|---|
| 消費者（已登入） | 只能存取 `order.customerId` 等於自己的訂單 |
| 客服人員（role=`support`） | 可存取任一訂單，但看不到完整信用卡號（僅末四碼） |

## 行為定義

### 1. 訂單清單
- 系統應回傳當前使用者近 12 個月內的訂單，依 `createdAt` 由新到舊排序
- 每筆包含：訂單編號、下單時間、訂單狀態、商品項數、總金額
- 每頁 20 筆，以 cursor 分頁
- 可傳入 `status` 參數篩選，允許值：`processing` / `shipped` / `delivered` / `cancelled`

### 2. 訂單明細
- 系統應回傳單筆訂單的商品清單、收件資訊、金額明細
- 若訂單狀態為 `shipped` 或 `delivered`，額外回傳物流狀態與**該狀態的最後同步時間**
- 物流狀態允許落後真實狀態，上限 15 分鐘（見 ADR 0001）；回應中必須揭露 `shipmentStatusUpdatedAt` 讓前端顯示「最後更新：X 分鐘前」

### 3. 客服查詢
- `role=support` 的使用者可用訂單編號或消費者 email 查詢
- 以 email 查詢時回傳該 email 名下所有訂單，不受 12 個月限制
- 每一次客服查詢都必須寫入稽核紀錄（查詢者、被查訂單、時間）

## 執行時序

```
消費者          API            訂單DB         物流狀態快取表      物流商API
  │              │               │                 │                │
  │─ GET 明細 ──▶│               │                 │                │
  │              │─── 查訂單 ───▶│                 │                │
  │              │◀── 訂單資料 ──│                 │                │
  │              │─────── 查物流狀態 ─────────────▶│                │
  │              │◀────── 狀態 + 同步時間 ─────────│                │
  │◀─ 200 ───────│               │                 │                │
                                                   │                │
              （背景排程，與請求無關）              │◀─ 每15分同步 ──│
```

> 查詢路徑**不會**即時呼叫物流商 API。理由見 ADR 0001。

## 邊界情況

| 情況 | 預期行為 |
|---|---|
| 查無訂單（清單為空） | 200 + 空陣列，不是 404 |
| 訂單存在但不屬於此使用者 | **404**（不是 403，避免洩漏訂單編號是否存在） |
| 訂單狀態為 `shipped` 但快取表尚無該筆物流資料 | 回傳 `shipmentStatus: null`，前端顯示「物流資訊準備中」，不報錯 |
| 物流狀態同步時間超過 60 分鐘 | 照常回傳，但加上 `stale: true`，前端顯示提示 |
| `status` 參數傳入非允許值 | 400 + 錯誤訊息列出允許值 |
| cursor 無效或過期 | 400，不要靜默退回第一頁 |
| 客服以 email 查詢但該 email 不存在 | 200 + 空陣列（不透露帳號是否存在） |

## Acceptance Criteria

| # | Given | When | Then | 測試檔 |
|---|---|---|---|---|
| AC-1 | 消費者 A 有 3 筆訂單 | GET `/api/orders` | 200，回傳 3 筆，依時間由新到舊 | `order-list.test.ts` |
| AC-2 | 消費者 A 有 25 筆訂單 | GET `/api/orders` | 200，回傳 20 筆且含 `nextCursor` | `order-list.test.ts` |
| AC-3 | 消費者 A 有 2 筆 `shipped`、1 筆 `delivered` | GET `/api/orders?status=shipped` | 200，僅回傳 2 筆 | `order-list.test.ts` |
| AC-4 | 訂單 X 屬於消費者 B | 消費者 A GET `/api/orders/X` | **404** | `order-detail.test.ts` |
| AC-5 | 訂單 X 狀態為 `shipped`，快取表有 10 分鐘前的資料 | GET `/api/orders/X` | 200，含 `shipmentStatus` 與 `shipmentStatusUpdatedAt`，`stale` 為 false | `order-detail.test.ts` |
| AC-6 | 訂單 X 狀態為 `shipped`，快取表最後同步為 90 分鐘前 | GET `/api/orders/X` | 200 且 `stale: true` | `order-detail.test.ts` |
| AC-7 | 訂單 X 狀態為 `shipped`，快取表無該筆資料 | GET `/api/orders/X` | 200 且 `shipmentStatus: null`，**不得回 500** | `order-detail.test.ts` |
| AC-8 | 使用者 role 為 `support` | GET `/api/orders?email=someone@example.com` | 200，且稽核表新增一筆紀錄 | `support-lookup.test.ts` |
| AC-9 | 使用者 role 為 `customer` | GET `/api/orders?email=other@example.com` | 403 | `support-lookup.test.ts` |
| AC-10 | 任一使用者 | GET `/api/orders?status=unknown` | 400，訊息含允許值清單 | `order-list.test.ts` |

## 非功能需求

- 效能：清單與明細端點 P95 < 500ms（以 1000 筆訂單的帳號測量）
- 安全：所有端點需通過認證；跨使用者存取一律回 404；回應中信用卡號僅末四碼
- 資料量：單一帳號訂單數上限以 cursor 分頁處理，任何查詢不得無上限撈取

## 明確不做

- 不做退換貨、訂單修改、推播通知（承 PRD Non-goals）
- 不做訪客查詢（PRD 開放問題未決，法務尚未回覆）
- 不做 12 個月以前的歷史訂單
- 不做即時物流查詢（技術決策見 ADR 0001）

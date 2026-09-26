# 已實作架構

`src/orders.mjs` 提供 lookupOrder 與 renderOrder 純函式；身份、資料及時間由呼叫端注入。
`test/order.test.mjs` 使用固定時間及假訂單驗證權限隔離、空物流、60 分鐘邊界與 HTML 跳脫。
沒有資料庫、HTTP 伺服器或排程；此示範不證明生產系統的認證或物流 SLA。

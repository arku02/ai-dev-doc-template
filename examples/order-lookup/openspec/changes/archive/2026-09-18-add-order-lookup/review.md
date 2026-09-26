# 審查紀錄

```json
{
  "mode": "full",
  "decision": "ready",
  "reviewer": "示範流程維護者（AI）",
  "rationale": "已核對限定示範政策、R1～R4 與實際測試對應；未將原電商範例未決項目當成已核准。",
  "openQuestions": [],
  "coverage": [
    {
      "requirement": "R1",
      "task": "1.1",
      "test": "test/order.test.mjs"
    },
    {
      "requirement": "R2",
      "task": "1.2",
      "test": "test/order.test.mjs"
    },
    {
      "requirement": "R3",
      "task": "1.3",
      "test": "test/order.test.mjs"
    },
    {
      "requirement": "R4",
      "task": "1.4",
      "test": "test/order.test.mjs"
    }
  ]
}
```

## 實際驗證
見 .workflow/evidence/add-order-lookup.json；此文件只記審查，不手填測試通過。

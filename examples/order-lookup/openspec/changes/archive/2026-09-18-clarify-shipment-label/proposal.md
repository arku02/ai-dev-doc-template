# clarify-shipment-label

## Why
Clarify which information the timestamp describes.

## What Changes
Replace the timestamp label while preserving ownership, shipment values and stale behavior.

## Non-goals
No HTTP authentication, support access, real logistics API, database, performance SLA, production deployment or business metrics.

## Capabilities
### Modified Capabilities
- order-lookup: R4 label only

## Impact
Local src/orders.mjs and test/order.test.mjs. Mode: lite.

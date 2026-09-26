# add-order-lookup

## Why
Demonstrate the integrated workflow with a deliberately limited, synthetic order lookup.

## What Changes
Add local order ownership, shipment freshness and escaped HTML rendering.

## Non-goals
No HTTP authentication, support access, real logistics API, database, performance SLA, production deployment or business metrics.

## Capabilities
### New Capabilities
- order-lookup: R1 through R4

## Impact
Local src/orders.mjs and test/order.test.mjs. Mode: full.

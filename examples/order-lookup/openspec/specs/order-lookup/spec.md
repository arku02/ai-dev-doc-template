# order-lookup Specification

## Purpose
Provide a deterministic local order lookup demonstration with ownership isolation, shipment freshness, and a visible synchronization timestamp, using synthetic data only.

## Requirements

### Requirement: R1 - Order ownership
The system SHALL return 401 without a trusted customer identity and SHALL expose only the caller's own order. Another customer's order and a missing order SHALL both return an identical 404 response. Internal fields SHALL be excluded.

#### Scenario: Owner lookup
- **WHEN** customer A requests A's order
- **THEN** the result has status 200 and public order fields only

#### Scenario: Foreign or absent order
- **WHEN** customer B requests A's order or any customer requests a missing order
- **THEN** the result has the same status 404 and error body

#### Scenario: No trusted identity
- **WHEN** the caller supplies no trusted identity
- **THEN** the result has status 401

### Requirement: R2 - Shipment information
The system SHALL return the supplied shipment status and synchronization timestamp. Missing shipment data SHALL return null status and timestamp with a preparing message, without an exception.

#### Scenario: Shipment exists
- **WHEN** a shipment record exists for the caller's order
- **THEN** its status and unchanged timestamp are returned

#### Scenario: Shipment not ready
- **WHEN** no shipment record exists
- **THEN** null values and the message 物流資訊準備中 are returned, with stale false

### Requirement: R3 - Stale shipment warning
The system SHALL mark available shipment data stale only when the supplied current time is more than 60 minutes after synchronization. Stale data SHALL remain visible with the warning 物流資訊可能已過期.

#### Scenario: Boundary
- **WHEN** the shipment was synchronized exactly 60 minutes ago
- **THEN** stale is false and no warning is rendered

#### Scenario: Older data
- **WHEN** the shipment was synchronized 60 minutes and one second ago
- **THEN** stale is true and the warning is rendered

### Requirement: R4 - Shipment update label
The system SHALL render the label 物流資訊更新時間 with the original synchronization timestamp when shipment information is available. All order and shipment values SHALL be HTML escaped.

#### Scenario: Timestamp label
- **WHEN** available shipment information is rendered
- **THEN** the label 物流資訊更新時間 and the original timestamp are visible

#### Scenario: Untrusted shipment text
- **WHEN** shipment text contains HTML markup
- **THEN** the markup is escaped rather than executed

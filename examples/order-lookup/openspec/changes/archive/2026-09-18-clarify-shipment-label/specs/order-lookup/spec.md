## MODIFIED Requirements

### Requirement: R4 - Shipment update label
The system SHALL render the label 物流資訊更新時間 with the original synchronization timestamp when shipment information is available. All order and shipment values SHALL be HTML escaped.

#### Scenario: Timestamp label
- **WHEN** available shipment information is rendered
- **THEN** the label 物流資訊更新時間 and the original timestamp are visible

#### Scenario: Untrusted shipment text
- **WHEN** shipment text contains HTML markup
- **THEN** the markup is escaped rather than executed

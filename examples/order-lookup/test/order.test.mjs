import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupOrder, renderOrder } from '../src/orders.mjs';

const now = Date.parse('2026-09-17T08:00:00Z');
const actor = { customerId: 'customer-a' };
const fixture = (age = 10) => [{ id: 'order-1', customerId: 'customer-a', internalNote: 'private',
  shipment: { status: '運送中', updatedAt: new Date(now - age * 60_000).toISOString() } }];

test('R1: unauthenticated caller receives 401', () => {
  assert.equal(lookupOrder(null, 'order-1', fixture(), now).status, 401);
});
test('R1: customer can retrieve own order without internal fields', () => {
  const result = lookupOrder(actor, 'order-1', fixture(), now);
  assert.equal(result.status, 200);
  assert.equal(result.body.id, 'order-1');
  assert.equal('internalNote' in result.body, false);
  assert.equal('customerId' in result.body, false);
});
test('R1: other customer and missing order have identical responses', () => {
  const foreign = lookupOrder({ customerId: 'customer-b' }, 'order-1', fixture(), now);
  const missing = lookupOrder(actor, 'missing', fixture(), now);
  assert.equal(foreign.status, 404);
  assert.deepEqual(foreign, missing);
});
test('R2: returns shipment status and original synchronization time', () => {
  const result = lookupOrder(actor, 'order-1', fixture(), now);
  assert.equal(result.body.shipmentStatus, '運送中');
  assert.equal(result.body.shipmentStatusUpdatedAt, '2026-09-17T07:50:00.000Z');
});
test('R2: absent shipment has null status and a preparing message', () => {
  const result = lookupOrder(actor, 'order-1', [{ id: 'order-1', customerId: 'customer-a' }], now);
  assert.equal(result.body.shipmentStatus, null);
  assert.equal(result.body.shipmentStatusUpdatedAt, null);
  assert.equal(result.body.stale, false);
  assert.match(renderOrder(result), /物流資訊準備中/);
});
test('R3: exactly 60 minutes is not stale', () => {
  assert.equal(lookupOrder(actor, 'order-1', fixture(60), now).body.stale, false);
});
test('R3: over 60 minutes is stale and shows a warning', () => {
  const result = lookupOrder(actor, 'order-1', fixture(60 + 1 / 60), now);
  assert.equal(result.body.stale, true);
  assert.match(renderOrder(result), /物流資訊可能已過期/);
});
test('R3: fresh data has no stale warning', () => {
  assert.doesNotMatch(renderOrder(lookupOrder(actor, 'order-1', fixture(), now)), /可能已過期/);
});
test('R4: HTML displays the agreed label and timestamp', () => {
  const html = renderOrder(lookupOrder(actor, 'order-1', fixture(), now));
  assert.match(html, /物流資訊更新時間：<time>2026-09-17T07:50:00.000Z<\/time>/);
});
test('R4: rendered shipment data is escaped', () => {
  const data = fixture();
  data[0].shipment.status = '<script>alert("x")</script>';
  const html = renderOrder(lookupOrder(actor, 'order-1', data, now));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

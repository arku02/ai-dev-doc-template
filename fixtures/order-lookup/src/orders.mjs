export const UPDATE_LABEL = '最後更新';
const MINUTE = 60_000;

// actor is a trusted application identity supplied by the caller, not a request parameter.
// This local demo deliberately does not implement HTTP authentication or support access.
export function lookupOrder(actor, orderId, orders, now) {
  if (!actor?.customerId) return { status: 401, body: { error: 'Authentication required' } };
  const order = orders.find(item => item.id === orderId && item.customerId === actor.customerId);
  if (!order) return { status: 404, body: { error: 'Order not found' } };
  const shipment = order.shipment;
  return {
    status: 200,
    body: {
      id: order.id,
      shipmentStatus: shipment?.status ?? null,
      shipmentStatusUpdatedAt: shipment?.updatedAt ?? null,
      stale: shipment ? now - Date.parse(shipment.updatedAt) > 60 * MINUTE : false,
    },
  };
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function renderOrder(result) {
  if (result.status !== 200) return '<p role="alert">' + escapeHtml(result.body.error) + '</p>';
  const order = result.body;
  if (order.shipmentStatus === null) return '<p>物流資訊準備中</p>';
  return '<section><h1>訂單 ' + escapeHtml(order.id) + '</h1><p>' + escapeHtml(order.shipmentStatus)
    + '</p><p>' + UPDATE_LABEL + '：<time>' + escapeHtml(order.shipmentStatusUpdatedAt)
    + '</time></p>' + (order.stale ? '<p role="status">物流資訊可能已過期</p>' : '') + '</section>';
}

type ReceiptItem = {
  title: string;
  quantity: number;
  price: number;
};

type ReceiptOrder = {
  id: string;
  orderNumber?: string | null;
  createdAt: string;
  billingEmail?: string | null;
  billingName?: string | null;
  shippingAddress?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  } | null;
  status?: string | null;
  totalAmount: number;
  items: ReceiptItem[];
};

const escapeHtml = (value: string): string =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildReceiptFileName = (order: ReceiptOrder): string => {
  const base = String(order.orderNumber || order.id || 'receipt')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-');
  return `${base || 'receipt'}.html`;
};

export const downloadReceiptHtml = (order: ReceiptOrder): void => {
  const buyerName =
    String(order.billingName || '').trim() ||
    String(order.shippingAddress?.name || '').trim() ||
    [order.shippingAddress?.firstName, order.shippingAddress?.lastName].filter(Boolean).join(' ').trim() ||
    'Customer';
  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Unknown';

  const shippingLines = [
    buyerName,
    order.shippingAddress?.address,
    order.shippingAddress?.address2,
    [order.shippingAddress?.city, order.shippingAddress?.state, order.shippingAddress?.zip].filter(Boolean).join(', ').replace(/, ([^,]+)$/, ' $1'),
    order.shippingAddress?.country,
  ].filter(Boolean);

  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td style="text-align:center;">${item.quantity}</td>
          <td style="text-align:right;">$${Number(item.price).toFixed(2)}</td>
          <td style="text-align:right;">$${(Number(item.price) * Math.max(1, Number(item.quantity || 1))).toFixed(2)}</td>
        </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt ${escapeHtml(String(order.orderNumber || order.id || ''))}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
    h1, h2, p { margin: 0; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .muted { color:#6b7280; }
    .card { border:1px solid #e5e7eb; border-radius:12px; padding:20px; margin-bottom:20px; }
    table { width:100%; border-collapse:collapse; margin-top:12px; }
    th, td { border-bottom:1px solid #e5e7eb; padding:10px 8px; text-align:left; }
    th { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:#6b7280; }
    .total { font-size:20px; font-weight:700; text-align:right; margin-top:16px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Beezio Receipt</h1>
      <p class="muted">Saved purchase confirmation</p>
    </div>
    <div style="text-align:right;">
      <p><strong>Order:</strong> ${escapeHtml(String(order.orderNumber || order.id || ''))}</p>
      <p><strong>Date:</strong> ${escapeHtml(orderDate)}</p>
      <p><strong>Status:</strong> ${escapeHtml(String(order.status || 'completed'))}</p>
    </div>
  </div>

  <div class="card">
    <h2>Buyer</h2>
    <p>${escapeHtml(buyerName)}</p>
    ${order.billingEmail ? `<p class="muted">${escapeHtml(String(order.billingEmail))}</p>` : ''}
  </div>

  <div class="card">
    <h2>Shipping</h2>
    ${shippingLines.length ? shippingLines.map((line) => `<p>${escapeHtml(String(line))}</p>`).join('') : '<p class="muted">No shipping address saved.</p>'}
  </div>

  <div class="card">
    <h2>Items</h2>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Unit Price</th>
          <th style="text-align:right;">Line Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">Total Paid: $${Number(order.totalAmount || 0).toFixed(2)}</div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildReceiptFileName(order);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

type OrderItemLine = {
  name: string;
  quantity: number;
  amount: number;
};

const provider = String(process.env.EMAIL_PROVIDER || 'resend').trim().toLowerCase();
const fromAddress = String(process.env.EMAIL_FROM || 'Beezio <no-reply@beezio.co>').trim();
const siteUrl = String(process.env.SITE_URL || process.env.URL || '').trim().replace(/\/$/, '');

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const money = (value: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);

export async function sendTransactionalEmail(payload: EmailPayload): Promise<{ sent: boolean; reason?: string }> {
  const to = String(payload.to || '').trim();
  if (!to || !to.includes('@')) return { sent: false, reason: 'invalid_recipient' };

  if (provider === 'resend') {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) return { sent: false, reason: 'missing_resend_key' };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { sent: false, reason: `resend_error_${res.status}:${body.slice(0, 200)}` };
    }

    return { sent: true };
  }

  return { sent: false, reason: 'unsupported_provider' };
}

export function buildOrderConfirmationEmail(params: {
  orderId: string;
  buyerName?: string | null;
  currency?: string | null;
  items: OrderItemLine[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}) {
  const currency = String(params.currency || 'USD').toUpperCase();
  const buyerName = String(params.buyerName || 'there').trim();
  const orderId = String(params.orderId || '').trim();
  const lines = params.items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;">${escapeHtml(item.name)} x${item.quantity}</td><td style="padding:6px 0;text-align:right;">${money(
          item.amount,
          currency
        )}</td></tr>`
    )
    .join('');

  const orderUrl = siteUrl ? `${siteUrl}/dashboard` : '#';
  const subject = `Beezio order confirmed: ${orderId}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
      <h2 style="margin:0 0 12px;">Thanks for your order, ${escapeHtml(buyerName)}.</h2>
      <p style="margin:0 0 16px;">Order <strong>${escapeHtml(orderId)}</strong> has been paid and is now in fulfillment.</p>
      <table style="width:100%;border-collapse:collapse;margin:8px 0 12px;">${lines}</table>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td>Subtotal</td><td style="text-align:right;">${money(params.subtotal, currency)}</td></tr>
        <tr><td>Shipping</td><td style="text-align:right;">${money(params.shipping, currency)}</td></tr>
        <tr><td>Tax</td><td style="text-align:right;">${money(params.tax, currency)}</td></tr>
        <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>${money(params.total, currency)}</strong></td></tr>
      </table>
      <p style="margin:18px 0 0;"><a href="${escapeHtml(orderUrl)}">View order dashboard</a></p>
    </div>
  `;
  return { subject, html };
}

export function buildShipmentEmail(params: {
  orderId: string;
  buyerName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrier?: string | null;
}) {
  const buyerName = String(params.buyerName || 'there').trim();
  const orderId = String(params.orderId || '').trim();
  const trackingNumber = String(params.trackingNumber || '').trim();
  const trackingUrl = String(params.trackingUrl || '').trim();
  const carrier = String(params.carrier || 'Carrier').trim();

  const subject = `Beezio shipment update: ${orderId}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
      <h2 style="margin:0 0 12px;">Your order has shipped, ${escapeHtml(buyerName)}.</h2>
      <p style="margin:0 0 12px;">Order <strong>${escapeHtml(orderId)}</strong> is now in transit.</p>
      <p style="margin:0 0 6px;"><strong>Carrier:</strong> ${escapeHtml(carrier)}</p>
      <p style="margin:0 0 14px;"><strong>Tracking:</strong> ${escapeHtml(trackingNumber || 'Pending')}</p>
      ${
        trackingUrl
          ? `<p style="margin:0;"><a href="${escapeHtml(trackingUrl)}">Track package</a></p>`
          : `<p style="margin:0;">Tracking link will appear in your buyer dashboard shortly.</p>`
      }
    </div>
  `;
  return { subject, html };
}

export function buildInsuranceLeadAgentEmail(params: {
  agentName?: string | null;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  vertical?: string | null;
  listingName?: string | null;
  state?: string | null;
  statusLabel?: string | null;
  notes?: string | null;
}) {
  const agentName = String(params.agentName || 'there').trim();
  const leadName = String(params.leadName || 'New lead').trim();
  const leadEmail = String(params.leadEmail || '').trim();
  const leadPhone = String(params.leadPhone || '').trim();
  const vertical = String(params.vertical || 'insurance').trim();
  const listingName = String(params.listingName || 'your insurance listing').trim();
  const state = String(params.state || '').trim();
  const statusLabel = String(params.statusLabel || 'submitted').trim();
  const notes = String(params.notes || '').trim();
  const dashboardUrl = siteUrl ? `${siteUrl}/dashboard?role=seller` : '#';

  const subject = `Beezio insurance lead: ${leadName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
      <h2 style="margin:0 0 12px;">New insurance lead for ${escapeHtml(agentName)}</h2>
      <p style="margin:0 0 12px;">A ${escapeHtml(vertical)} lead was captured from <strong>${escapeHtml(listingName)}</strong>.</p>
      <p style="margin:0 0 6px;"><strong>Status:</strong> ${escapeHtml(statusLabel)}</p>
      ${state ? `<p style="margin:0 0 6px;"><strong>State:</strong> ${escapeHtml(state)}</p>` : ''}
      <p style="margin:0 0 6px;"><strong>Name:</strong> ${escapeHtml(leadName)}</p>
      <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(leadEmail || 'Not provided')}</p>
      <p style="margin:0 0 14px;"><strong>Phone:</strong> ${escapeHtml(leadPhone || 'Not provided')}</p>
      ${notes ? `<p style="margin:0 0 14px;"><strong>Review note:</strong> ${escapeHtml(notes)}</p>` : ''}
      <p style="margin:0;"><a href="${escapeHtml(dashboardUrl)}">Open seller dashboard</a></p>
    </div>
  `;
  return { subject, html };
}

export function buildInsuranceLeadCustomerEmail(params: {
  customerName?: string | null;
  agentName?: string | null;
  vertical?: string | null;
  statusLabel?: string | null;
  listingName?: string | null;
  notes?: string | null;
}) {
  const customerName = String(params.customerName || 'there').trim();
  const agentName = String(params.agentName || 'our team').trim();
  const vertical = String(params.vertical || 'insurance').trim();
  const statusLabel = String(params.statusLabel || 'received').trim();
  const listingName = String(params.listingName || 'Beezio').trim();
  const notes = String(params.notes || '').trim();

  const subject = `Beezio insurance request update`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
      <h2 style="margin:0 0 12px;">Your request has been ${escapeHtml(statusLabel)}, ${escapeHtml(customerName)}.</h2>
      <p style="margin:0 0 12px;">Your ${escapeHtml(vertical)} request from <strong>${escapeHtml(listingName)}</strong> is being handled by ${escapeHtml(agentName)}.</p>
      ${notes ? `<p style="margin:0 0 12px;"><strong>Update:</strong> ${escapeHtml(notes)}</p>` : ''}
      <p style="margin:0;">You can reply directly to the licensed agent when they contact you.</p>
    </div>
  `;
  return { subject, html };
}

export function buildInsuranceLowFundsEmail(params: {
  agentName?: string | null;
  listingName?: string | null;
  balanceCents?: number | null;
  leadCostCents?: number | null;
}) {
  const agentName = String(params.agentName || 'there').trim();
  const listingName = String(params.listingName || 'your campaign').trim();
  const balanceCents = Number(params.balanceCents || 0);
  const leadCostCents = Number(params.leadCostCents || 0);
  const dashboardUrl = siteUrl ? `${siteUrl}/dashboard?role=seller` : '#';

  const subject = 'Beezio insurance wallet needs funding';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
      <h2 style="margin:0 0 12px;">Insurance campaign funding alert</h2>
      <p style="margin:0 0 12px;">${escapeHtml(agentName)}, your insurance wallet does not have enough balance to keep delivering leads for <strong>${escapeHtml(listingName)}</strong>.</p>
      <p style="margin:0 0 6px;"><strong>Current balance:</strong> ${money(balanceCents / 100)}</p>
      <p style="margin:0 0 14px;"><strong>Lead cost:</strong> ${money(leadCostCents / 100)}</p>
      <p style="margin:0;"><a href="${escapeHtml(dashboardUrl)}">Open seller dashboard</a></p>
    </div>
  `;
  return { subject, html };
}

type EmailType =
  | 'welcome'
  | 'password_reset'
  | 'account_verification';

const postTransactionalEmail = async (payload: {
  to: string;
  subject: string;
  html: string;
  type: EmailType;
  userId?: string;
  metadata?: Record<string, unknown>;
}) => {
  const response = await fetch('/.netlify/functions/transactional-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(String(data?.error || 'Failed to send transactional email'));
  }

  return true;
};

export const sendWelcomeEmail = async (userId: string, email: string, name: string) => {
  const safeName = String(name || email.split('@')[0] || 'there').trim();
  const dashboardUrl = `${window.location.origin}/dashboard`;
  return postTransactionalEmail({
    to: email,
    type: 'welcome',
    userId,
    subject: `Welcome to Beezio, ${safeName}!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px;">Welcome to Beezio, ${safeName}.</h2>
        <p style="margin:0 0 12px;">Your account has been created. If your sign-up flow requires email confirmation, use the confirmation link we emailed you to activate the account.</p>
        <p style="margin:0 0 12px;">Once confirmed, your buyer, seller, or affiliate dashboard will be ready.</p>
        <p style="margin:18px 0 0;"><a href="${dashboardUrl}">Open Beezio dashboard</a></p>
      </div>
    `,
    metadata: { name: safeName, dashboardUrl },
  });
};

export const sendPasswordResetEmail = async (userId: string, email: string, resetData: { resetUrl: string }) => {
  const resetUrl = String(resetData?.resetUrl || '').trim();
  return postTransactionalEmail({
    to: email,
    type: 'password_reset',
    userId,
    subject: 'Reset your Beezio password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px;">Reset your password</h2>
        <p style="margin:0 0 12px;">We received a request to reset your Beezio password.</p>
        <p style="margin:0 0 12px;"><a href="${resetUrl}">Reset password</a></p>
        <p style="margin:0 0 12px;">If you did not request this, you can ignore this email.</p>
      </div>
    `,
    metadata: { resetUrl },
  });
};

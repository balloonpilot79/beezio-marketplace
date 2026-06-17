const postJson = async (url: string, body: Record<string, unknown>) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String((data as any)?.details || (data as any)?.error || 'Request failed'));
  }
  return data;
};

export const sendSignupVerificationEmail = async (params: {
  userId: string;
  email: string;
  fullName?: string;
}) =>
  postJson('/api/signup/send-verification', {
    userId: params.userId,
    email: params.email,
    fullName: params.fullName || '',
  });

export const confirmSignupEmail = async (token: string) =>
  postJson('/api/signup/confirm-email', {
    token,
  });

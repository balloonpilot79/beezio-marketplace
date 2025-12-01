export type GPTMode = 'support_bot' | 'product_copy' | 'affiliate_content' | 'pricing_assistant';

interface GPTRequest {
  mode?: GPTMode;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

export async function callGPT(req: GPTRequest): Promise<string> {
  const resp = await fetch('/.netlify/functions/gpt-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GPT request failed: ${text}`);
  }

  const data = await resp.json();
  return data.reply || '';
}

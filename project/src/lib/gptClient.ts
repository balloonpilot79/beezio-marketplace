export type GPTMode = 'support_bot' | 'product_copy' | 'affiliate_content' | 'pricing_assistant';

interface GPTRequest {
  mode?: GPTMode;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

const GPT_PROXY_ENDPOINT =
  import.meta.env.VITE_GPT_PROXY_ENDPOINT || '/.netlify/functions/gpt-proxy';

// Calls the GPT proxy and returns the assistant message text
export async function callGPT(req: GPTRequest): Promise<string> {
  if (!GPT_PROXY_ENDPOINT) {
    throw new Error('GPT proxy endpoint is not configured');
  }

  const payload = {
    messages: req.messages,
    model: 'gpt-4o-mini',
    mode: req.mode,
  };

  const resp = await fetch(GPT_PROXY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`GPT request failed: ${resp.status} ${resp.statusText}${text ? ` - ${text}` : ''}`);
  }

  const data = await resp.json();
  const message = data?.choices?.[0]?.message?.content;
  if (typeof message !== 'string' || !message.trim()) {
    throw new Error('GPT request returned an empty response');
  }
  return message.trim();
}

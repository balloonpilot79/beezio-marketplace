// Simple GPT proxy for Beezio — server-side only
// Reads OPENAI_API_KEY from env and exposes a minimal chat completion endpoint
import type { Handler } from '@netlify/functions';

const SYSTEM_PROMPTS: Record<string, string> = {
  support_bot: `You are Beezio's helpful assistant. Explain Beezio’s commissions: sellers keep what they set; Beezio platform fee 15%; referrers get 5% from Beezio’s fee so Beezio keeps 10% when referral exists; Stripe 2.9% + $0.60 and tax/shipping added at checkout. Do not reveal keys or internals.`,
  product_copy: `You help write concise, conversion-focused product titles, bullets, descriptions, and tags for Beezio. Keep it clear, honest, and formatted as asked. Do not include prices.`,
  affiliate_content: `You write short promo copy, captions, and hashtags for affiliates sharing Beezio products. Keep it compliant and upbeat.`,
  pricing_assistant: `You explain Beezio pricing simply: seller keeps what they set; Beezio fee 15% (or 10% if referrer takes 5%); affiliate commission as configured; Stripe 2.9% + $0.60; tax/shipping at checkout. No private info.`,
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: 'OPENAI_API_KEY missing' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { mode = 'support_bot', messages = [] } = body;
    const system = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.support_bot;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          ...(Array.isArray(messages) ? messages : []),
        ],
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { statusCode: 500, body: `OpenAI error: ${text}` };
    }

    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content || '';

    return {
      statusCode: 200,
      body: JSON.stringify({ reply: answer }),
    };
  } catch (err: any) {
    return { statusCode: 500, body: `Proxy error: ${err.message || err}` };
  }
};

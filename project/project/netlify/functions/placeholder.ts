import type { Handler } from '@netlify/functions';

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseSizeParam(size: string | null): { w: number; h: number } {
  const raw = String(size || '').trim();
  const parts = raw.split('/').filter(Boolean);
  const w = clampInt(parts[0], 600, 16, 4000);
  const h = clampInt(parts[1] ?? parts[0], w, 16, 4000);
  return { w, h };
}

const handler: Handler = async (event) => {
  const { w, h } = parseSizeParam(event.queryStringParameters?.size ?? null);
  const label = `${w}×${h}`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>` +
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#f1f5f9"/>` +
    `<stop offset="1" stop-color="#e2e8f0"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<rect x="1" y="1" width="${Math.max(0, w - 2)}" height="${Math.max(0, h - 2)}" fill="none" stroke="#cbd5e1"/>` +
    `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="${Math.max(12, Math.round(Math.min(w, h) / 8))}" fill="#64748b">` +
    `${label}` +
    `</text>` +
    `</svg>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // Cache aggressively; filename is param-based and non-sensitive.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: svg,
  };
};

export { handler };

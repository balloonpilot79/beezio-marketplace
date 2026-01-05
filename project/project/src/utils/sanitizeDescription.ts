const decodeEntities = (input: string): string => {
  const raw = String(input || '');
  if (!raw) return '';

  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    });
};

const stripHtmlToText = (input: string): string => {
  let raw = String(input || '');
  if (!raw) return '';

  raw = decodeEntities(raw);
  raw = raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  raw = decodeEntities(raw);
  raw = raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return raw.replace(/\s+/g, ' ').trim();
};

export const sanitizeDescriptionForDisplay = (raw: unknown, lineage?: string): string => {
  const input = String(raw || '');
  if (!input) return '';

  const decoded = decodeEntities(input);
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(decoded);
  const looksLikeUrl = /https?:\/\//i.test(decoded) || /\bwww\./i.test(decoded);
  const isCJ = String(lineage || '').toUpperCase() === 'CJ';

  const base = looksLikeHtml || looksLikeUrl || isCJ ? stripHtmlToText(decoded) : decoded.trim();
  if (!base) return '';

  const withoutUrls = base
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.[^\s]+/gi, ' ');

  return withoutUrls
    .replace(/cj\s*dropshipping/gi, '')
    .replace(/cjdropshipping/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};


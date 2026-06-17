import type { Handler } from '@netlify/functions';
import { requireAdmin } from './_lib/auth';
import { assertPost, json, parseJson } from './_lib/http';

type RequestBody = {
  url?: string;
};

type VariantSummary = {
  label: string;
  url: string | null;
  externalVariantId: string | null;
  attributes: Record<string, string>;
  sku: string | null;
};

const decodeHtmlEntities = (value: string) =>
  String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

const stripTags = (value: string) =>
  decodeHtmlEntities(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const toAbsoluteUrl = (value: string, base: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('//')) return `https:${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw, base).toString();
  } catch {
    return raw;
  }
};

const unique = (values: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

const normalizeImageKey = (value: string, baseUrl: string) => {
  const absolute = toAbsoluteUrl(value, baseUrl);
  if (!absolute) return '';
  try {
    const url = new URL(absolute);
    return `${url.origin}${url.pathname}`.toLowerCase();
  } catch {
    return absolute.split(/[?#]/)[0].toLowerCase();
  }
};

const uniqueImageUrls = (values: string[], baseUrl: string) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const absolute = toAbsoluteUrl(value, baseUrl);
    const key = normalizeImageKey(absolute, baseUrl);
    if (!absolute || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(absolute);
  }
  return out;
};

const extractMetaContent = (html: string, key: string) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexes = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
  ];

  for (const regex of regexes) {
    const match = html.match(regex);
    if (match?.[1]) return stripTags(match[1]);
  }

  return '';
};

const extractByClass = (html: string, className: string) => {
  const match = html.match(new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\/[^>]+>`, 'i'));
  return match?.[1] ? stripTags(match[1]) : '';
};

const extractProductId = (html: string) => {
  const titleMatch = html.match(/class=["'][^"']*prod_info_title[^"']*["'][^>]*data-sn=["']([^"']+)["']/i);
  if (titleMatch?.[1]) return String(titleMatch[1]).trim();
  const fallbackMatch = html.match(/[?&]products_id=(\d+)/i) || html.match(/data-sn=["']([^"']+)["']/i);
  return fallbackMatch?.[1] ? String(fallbackMatch[1]).trim() : '';
};

const cleanLabelValue = (value: string) =>
  stripTags(value)
    .replace(/^(sku|item code|itemcode|product code|code)\s*:?\s*/i, '')
    .trim();

const compactWhitespace = (value: string) =>
  String(value || '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const normalizeSectionHeading = (value: string) => {
  const raw = cleanLabelValue(value).replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (/^packagecontents$/i.test(raw)) return 'Package Contents';
  return raw;
};

const formatSectionBody = (title: string, rawHtml: string) => {
  const cleaned = compactWhitespace(
    stripTags(rawHtml)
      .replace(/^Specifications\s*/i, '')
      .replace(/^Note\s*:?/i, 'Notes:')
  );

  if (!cleaned) return '';

  if (/^specification/i.test(title) || /^package contents/i.test(title)) {
    const lines = cleaned
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (line.startsWith('- ') ? line : `- ${line.replace(/^-+\s*/, '')}`));
    return lines.join('\n');
  }

  return cleaned;
};

const extractStructuredDescription = (html: string) => {
  const containerMatch = html.match(/<div[^>]+class=["'][^"']*prod_description[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]+class=["'][^"']*module-login-mask/i);
  const containerHtml = containerMatch?.[1] || '';
  if (!containerHtml) return '';

  const titles: string[] = [];
  const titleRegex = /<li[^>]*>\s*<span[^>]*data=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/span>\s*<\/li>/gi;
  let titleMatch: RegExpExecArray | null;
  while ((titleMatch = titleRegex.exec(containerHtml)) !== null) {
    const index = Number.parseInt(String(titleMatch[1] || ''), 10);
    const title = normalizeSectionHeading(titleMatch[2]);
    if (Number.isFinite(index) && title) {
      titles[index] = title;
    }
  }

  const sections: Array<{ index: number; title: string; body: string }> = [];
  const sectionRegex = /<div[^>]+class=["'][^"']*desc(?:\s+hide)?[^"']*["'][^>]*data-number=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/div>/gi;
  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionRegex.exec(containerHtml)) !== null) {
    const index = Number.parseInt(String(sectionMatch[1] || ''), 10);
    const title = titles[index] || `Section ${index + 1}`;
    const body = formatSectionBody(title, sectionMatch[2]);
    if (body) {
      sections.push({ index, title, body });
    }
  }

  if (sections.length === 0) return '';

  sections.sort((left, right) => left.index - right.index);
  return sections
    .map((section) => `${section.title}\n${section.body}`)
    .join('\n\n');
};

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const extractVariantSummaries = (html: string, baseUrl: string, skuSeed: string): VariantSummary[] => {
  const variants = new Map<string, VariantSummary>();
  const regex = /<a[^>]*href=["']([^"']*_p\d+_s\d+\.html[^"']*)["'][^>]*title=["']([^"']+)["'][^>]*?(?:value|data-value|data-id)?=?["']?([^"' >]*)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const href = toAbsoluteUrl(match[1], baseUrl);
    const label = stripTags(match[2]);
    const token = String(match[3] || '').trim();
    if (!href || !label) continue;
    if (label.length > 80) continue;
    const normalizedKey = `${label.toLowerCase()}::${href.toLowerCase()}`;
    if (variants.has(normalizedKey)) continue;
    variants.set(normalizedKey, {
      label,
      url: href,
      externalVariantId: token || href || null,
      attributes: { Option: label },
      sku: skuSeed ? `${skuSeed}-${slugify(label) || 'option'}` : null,
    });
  }

  return Array.from(variants.values());
};

const extractImageUrls = (html: string, baseUrl: string) => {
  const matches = html.match(/(?:https?:)?\/\/[^"'\s<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi) || [];
  return uniqueImageUrls(
    matches
      .map((value) => toAbsoluteUrl(value, baseUrl))
      .filter((value) => /eggracks\.com|u_file|media/i.test(value)),
    baseUrl
  );
};

const extractDescription = (html: string, metaDescription: string) => {
  const structured = extractStructuredDescription(html);
  if (structured && structured.length >= Math.max(120, metaDescription.length)) {
    return structured;
  }
  return metaDescription;
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event);

    const body = parseJson<RequestBody>(event.body);
    const targetUrl = String(body?.url || '').trim();
    if (!targetUrl) return json(400, { ok: false, error: 'Missing url' });
    if (!/^https?:\/\//i.test(targetUrl)) return json(400, { ok: false, error: 'URL must start with http/https' });

    let hostname = '';
    try {
      hostname = new URL(targetUrl).hostname.toLowerCase();
    } catch {
      hostname = '';
    }

    if (!hostname.includes('eggracks.com')) {
      return json(400, { ok: false, error: 'Please use a valid EggRacks product link.' });
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.eggracks.com/',
      },
    });

    if (!response.ok) {
      return json(response.status, { ok: false, error: `EggRacks request failed (${response.status})` });
    }

    const html = await response.text();
    const title = extractByClass(html, 'prod_info_title') || extractMetaContent(html, 'og:title') || extractMetaContent(html, 'twitter:title');
    const sku = cleanLabelValue(extractByClass(html, 'prod_info_sku'));
    const itemCode = cleanLabelValue(extractByClass(html, 'prod_info_number'));
    const productId = extractProductId(html);
    const metaDescription = extractMetaContent(html, 'description') || extractMetaContent(html, 'og:description');
    const description = extractDescription(html, metaDescription);
    const images = uniqueImageUrls([
      toAbsoluteUrl(extractMetaContent(html, 'og:image'), targetUrl),
      ...extractImageUrls(html, targetUrl),
    ], targetUrl).filter(Boolean);
    const variants = extractVariantSummaries(html, targetUrl, sku || itemCode || productId || 'eggracks');

    if (!title) {
      return json(422, { ok: false, error: 'Could not extract a product title from this EggRacks page.' });
    }

    return json(200, {
      ok: true,
      data: {
        title,
        description,
        url: targetUrl,
        sku: sku || itemCode || null,
        itemCode: itemCode || sku || null,
        productId: productId || null,
        images,
        variants,
      },
    });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode) || 500;
    return json(statusCode, { ok: false, error: error instanceof Error ? error.message : 'Unexpected error' });
  }
};

export default handler;

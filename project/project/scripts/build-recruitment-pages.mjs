import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Social crawlers need metadata in the initial HTML, before React runs.
// Static route pages also avoid a runtime function invocation for every share.
const base = new URL('../dist/', import.meta.url);
const template = await readFile(new URL('index.html', base), 'utf8');
const image = 'https://beezio.co/share/beezio-ambassador-v1.jpg';
const escape = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pages = [
  ['ambassadors', 'Beezio Ambassador Program | Beezio', 'Become a Beezio Ambassador. Refer sellers and affiliates and earn from qualifying sales. Free to join; no inventory required. Earnings are not guaranteed.'],
  ['earn-by-referring', 'Earn Extra Income by Referring | Beezio', 'Introduce sellers and affiliates to Beezio. When they make qualifying sales, you can earn too. Free to join; earnings are not guaranteed.'],
];
for (const [route, title, description] of pages) {
  const url = `https://beezio.co/${route}`;
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    ...Object.entries({ 'og:type': 'website', 'og:site_name': 'Beezio', 'og:title': title, 'og:description': description, 'og:url': url, 'og:image': image, 'og:image:secure_url': image, 'og:image:type': 'image/jpeg', 'og:image:width': '1734', 'og:image:height': '907', 'og:image:alt': 'Beezio Ambassador Program: refer sellers and affiliates and earn on qualifying sales.' }).map(([key, value]) => `<meta property="${key}" content="${escape(value)}" />`),
    ...Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:title': title, 'twitter:description': description, 'twitter:image': image, 'twitter:image:alt': 'Beezio Ambassador Program: earn on qualifying sales.' }).map(([key, value]) => `<meta name="${key}" content="${escape(value)}" />`),
  ].join('\n');
  const html = template.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|og:[^"']*|twitter:[^"']*)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace('</head>', `${tags}\n</head>`);
  await mkdir(new URL(`${route}/`, base), { recursive: true });
  await writeFile(new URL(`${route}/index.html`, base), html);
}
console.log('Built recruitment pages with JPEG social previews.');

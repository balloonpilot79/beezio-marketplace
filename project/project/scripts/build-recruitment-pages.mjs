import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Serve the route's title and real entry points even before React starts.
const base = new URL('../dist/', import.meta.url);
const template = await readFile(new URL('index.html', base), 'utf8');
const pages = JSON.parse(await readFile(new URL('../shared/publicLandingPages.json', import.meta.url), 'utf8'));
const origin = 'https://beezio.co';
const escape = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const preloadCard = /(<div class="beezio-preload-card">)[\s\S]*?(?=\n        <\/div>\n      <\/div>\n    <\/div>)/;
if (!preloadCard.test(template)) throw new Error('Unable to locate the initial public page content');

for (const [path, { title, heading, description, links, ambassadorShare }] of Object.entries(pages)) {
  const url = origin + path;
  const image = origin + (ambassadorShare ? '/share/beezio-ambassador-v1.jpg' : '/bzobee.png');
  const imageAlt = ambassadorShare ? 'Beezio Ambassador Program' : 'Beezio';
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    ...Object.entries({
      'og:type': 'website', 'og:site_name': 'Beezio', 'og:title': title,
      'og:description': description, 'og:url': url, 'og:image': image, 'og:image:alt': imageAlt,
      ...(ambassadorShare ? {
        'og:image:secure_url': image, 'og:image:type': 'image/jpeg',
        'og:image:width': '1734', 'og:image:height': '907',
      } : {}),
    }).map(([key, value]) => `<meta property="${key}" content="${escape(value)}" />`),
    ...Object.entries({
      'twitter:card': ambassadorShare ? 'summary_large_image' : 'summary', 'twitter:title': title,
      'twitter:description': description, 'twitter:image': image, 'twitter:image:alt': imageAlt,
    }).map(([key, value]) => `<meta name="${key}" content="${escape(value)}" />`),
  ].join('\n');
  const linkList = links.map(([label, href]) => `<a href="${escape(href)}">${escape(label)}</a>`).join(' · ');
  const html = template.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|og:[^"']*|twitter:[^"']*)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace('</head>', () => `${tags}\n</head>`)
    .replace(preloadCard, (_, card) => `${card}
          <h1 class="beezio-preload-title">${escape(heading)}</h1>
          <p>${escape(description)}</p>
          <p>${linkList}</p>
          <p class="beezio-preload-subtitle" role="status"></p>`);

  const directory = new URL(path === '/' ? './' : path.slice(1) + '/', base);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(path === '/' ? 'home-entry.html' : 'index.html', directory), html);
}
console.log('Built crawlable public landing pages and social previews.');

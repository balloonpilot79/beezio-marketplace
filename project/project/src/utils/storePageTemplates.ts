export type PageBlock =
  | { id: string; type: 'heading'; level: 1 | 2 | 3; text: string }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; src: string; alt: string }
  | { id: string; type: 'button'; label: string; href: string }
  | { id: string; type: 'divider' };

export type PageTemplate = {
  id: string;
  title: string;
  slug: string;
  description: string;
  createBlocks: () => PageBlock[];
};

export const makeId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `bzo_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};

const escapeHtml = (value: string) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const blocksToHtml = (blocks: PageBlock[]) => {
  const body = blocks
    .map((block) => {
      switch (block.type) {
        case 'heading': {
          const tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
          return `<section class="bzo-block bzo-block-heading"><${tag} style="margin: 0 0 12px 0; font-weight: 800;">${escapeHtml(block.text)}</${tag}></section>`;
        }
        case 'text':
          return `<section class="bzo-block bzo-block-text"><p style="margin: 0 0 16px 0; line-height: 1.6;">${escapeHtml(block.text).replaceAll('\n', '<br />')}</p></section>`;
        case 'image':
          return `<section class="bzo-block bzo-block-image"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="width: 100%; border-radius: 12px; display: block; margin: 0 0 16px 0;" /></section>`;
        case 'button':
          return `<section class="bzo-block bzo-block-button" style="text-align: center; margin: 12px 0 20px 0;"><a href="${escapeHtml(block.href)}" style="display: inline-block; background: #ffcb05; color: #101820; padding: 12px 18px; border-radius: 10px; font-weight: 800; text-decoration: none;">${escapeHtml(block.label)}</a></section>`;
        case 'divider':
          return `<section class="bzo-block bzo-block-divider"><hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 18px 0;" /></section>`;
        default:
          return '';
      }
    })
    .join('\n');

  return `<div class="bzo-page" style="max-width: 1200px; margin: 0 auto; padding: 24px 16px;">\n${body}\n</div>`;
};

export const defaultPageTemplate: PageTemplate = {
  id: 'starter-home',
  title: 'Homepage Promo',
  slug: 'home',
  description: 'Hero, quick value props, and a CTA to shop.',
  createBlocks: () => [
    { id: makeId(), type: 'heading', level: 1, text: 'Welcome to our store' },
    { id: makeId(), type: 'text', text: 'Discover new arrivals, best sellers, and seasonal picks. Everything is curated for quality and fast delivery.' },
    { id: makeId(), type: 'button', label: 'Shop the collection', href: '/marketplace' },
    { id: makeId(), type: 'divider' },
    { id: makeId(), type: 'heading', level: 2, text: 'Why customers shop here' },
    { id: makeId(), type: 'text', text: 'Trusted brands, clear product details, and secure checkout. We focus on great products and a smooth buying experience.' },
  ],
};

export const pageTemplates: PageTemplate[] = [
  defaultPageTemplate,
  {
    id: 'about',
    title: 'About',
    slug: 'about',
    description: 'Store story, values, and mission.',
    createBlocks: () => [
      { id: makeId(), type: 'heading', level: 1, text: 'About our store' },
      { id: makeId(), type: 'text', text: 'Share your story, what you sell, and what makes your brand unique.' },
      { id: makeId(), type: 'divider' },
      { id: makeId(), type: 'heading', level: 2, text: 'Our promise' },
      { id: makeId(), type: 'text', text: 'Quality products, fast shipping, and support that feels human.' },
    ],
  },
  {
    id: 'faq',
    title: 'FAQ',
    slug: 'faq',
    description: 'Answer common customer questions.',
    createBlocks: () => [
      { id: makeId(), type: 'heading', level: 1, text: 'Frequently asked questions' },
      { id: makeId(), type: 'heading', level: 3, text: 'When will my order ship?' },
      { id: makeId(), type: 'text', text: 'Most orders ship within 2-3 business days. You will receive tracking as soon as it is available.' },
      { id: makeId(), type: 'heading', level: 3, text: 'What is your return policy?' },
      { id: makeId(), type: 'text', text: 'Returns are accepted within 30 days of delivery. Items must be unused and in original condition.' },
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping',
    slug: 'shipping',
    description: 'Shipping zones, timelines, and costs.',
    createBlocks: () => [
      { id: makeId(), type: 'heading', level: 1, text: 'Shipping information' },
      { id: makeId(), type: 'text', text: 'We ship to the US and select international regions. Shipping costs and delivery times appear at checkout.' },
      { id: makeId(), type: 'divider' },
      { id: makeId(), type: 'heading', level: 3, text: 'Processing time' },
      { id: makeId(), type: 'text', text: 'Orders are processed within 1-2 business days.' },
    ],
  },
  {
    id: 'returns',
    title: 'Returns',
    slug: 'returns',
    description: 'Return and refund policy page.',
    createBlocks: () => [
      { id: makeId(), type: 'heading', level: 1, text: 'Returns & refunds' },
      { id: makeId(), type: 'text', text: 'Return items within 30 days for a full refund. Items must be unused and include original packaging.' },
      { id: makeId(), type: 'divider' },
      { id: makeId(), type: 'heading', level: 3, text: 'Start a return' },
      { id: makeId(), type: 'text', text: 'Contact us with your order number and we will provide next steps.' },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    slug: 'contact',
    description: 'How customers reach your store.',
    createBlocks: () => [
      { id: makeId(), type: 'heading', level: 1, text: 'Contact us' },
      { id: makeId(), type: 'text', text: 'We respond within 1 business day. Use the store contact form or email us directly.' },
      { id: makeId(), type: 'button', label: 'Message the store', href: '#' },
    ],
  },
  {
    id: 'fashion',
    title: 'Fashion Lookbook',
    slug: 'lookbook',
    description: 'Seasonal drop layout for apparel and accessories.',
    createBlocks: () => [
      { id: makeId(), type: 'heading', level: 1, text: 'Seasonal Lookbook' },
      { id: makeId(), type: 'text', text: 'Showcase new arrivals, signature pieces, and styling tips.' },
      { id: makeId(), type: 'image', src: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80', alt: 'Seasonal collection' },
      { id: makeId(), type: 'heading', level: 2, text: 'Shop the drop' },
      { id: makeId(), type: 'button', label: 'Browse apparel', href: '/marketplace' },
    ],
  },
  {
    id: 'electronics',
    title: 'Tech Specs',
    slug: 'tech-specs',
    description: 'Feature-rich layout for electronics and gadgets.',
    createBlocks: () => [
      { id: makeId(), type: 'heading', level: 1, text: 'Tech highlights' },
      { id: makeId(), type: 'text', text: 'Compare specs, compatibility, and performance details in one place.' },
      { id: makeId(), type: 'divider' },
      { id: makeId(), type: 'heading', level: 2, text: 'Why customers choose us' },
      { id: makeId(), type: 'text', text: 'Verified products, clear compatibility notes, and fast shipping.' },
      { id: makeId(), type: 'button', label: 'Shop tech', href: '/marketplace' },
    ],
  },
  {
    id: 'cafe',
    title: 'Cafe Menu',
    slug: 'menu',
    description: 'Menu-style layout for coffee, food, and specialty goods.',
    createBlocks: () => [
      { id: makeId(), type: 'heading', level: 1, text: 'Cafe favorites' },
      { id: makeId(), type: 'text', text: 'Highlight your best sellers, seasonal drinks, and gift sets.' },
      { id: makeId(), type: 'image', src: 'https://images.unsplash.com/photo-1481391032119-d89fee407e44?auto=format&fit=crop&w=1600&q=80', alt: 'Coffee menu' },
      { id: makeId(), type: 'button', label: 'Shop blends', href: '/marketplace' },
    ],
  },
  {
    id: 'digital',
    title: 'Digital Goods',
    slug: 'digital',
    description: 'Launch layout for courses, templates, and downloads.',
    createBlocks: () => [
      { id: makeId(), type: 'heading', level: 1, text: 'Digital products, instant access' },
      { id: makeId(), type: 'text', text: 'Sell templates, courses, and tools with instant delivery.' },
      { id: makeId(), type: 'divider' },
      { id: makeId(), type: 'heading', level: 2, text: 'Start learning today' },
      { id: makeId(), type: 'button', label: 'Explore downloads', href: '/marketplace' },
    ],
  },
];

export const starterPackTemplates: PageTemplate[] = [
  pageTemplates.find((t) => t.id === 'about')!,
  pageTemplates.find((t) => t.id === 'faq')!,
  pageTemplates.find((t) => t.id === 'shipping')!,
  pageTemplates.find((t) => t.id === 'returns')!,
  pageTemplates.find((t) => t.id === 'contact')!,
];

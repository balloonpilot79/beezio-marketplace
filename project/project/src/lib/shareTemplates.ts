export type ShareTargetType = 'product' | 'store' | 'collection' | 'fundraiser';

export type ShareChannel = 'copy' | 'facebook' | 'sms' | 'email' | 'x' | 'whatsapp';

export type ShareTemplate = {
  id: string;
  label: string;
  text: string; // must include {link}
};

export type ShareTemplatesByChannel = Partial<Record<ShareChannel, ShareTemplate[]>>;

export type ShareTemplatesByType = Record<ShareTargetType, ShareTemplatesByChannel>;

export const SHARE_TEMPLATES: ShareTemplatesByType = {
  product: {
    copy: [
      { id: 'p1', label: 'Solid deal', text: 'I found a solid deal on this — check it out: {link}' },
      { id: 'p2', label: 'Support my link', text: 'If you grab this through my link, it helps me earn a little. Thank you! {link}' },
      { id: 'p3', label: 'Beezio intro', text: 'Trying a new marketplace called Beezio — this looks awesome: {link}' },
      { id: 'p4', label: 'Quick share', text: 'Quick share: this is worth a look → {link}' },
    ],
    facebook: [
      { id: 'p1', label: 'Solid deal', text: 'I found a solid deal on this — check it out: {link}' },
      { id: 'p4', label: 'Quick share', text: 'Quick share: this is worth a look → {link}' },
    ],
    sms: [
      { id: 'p4', label: 'Quick share', text: 'Quick share: this is worth a look → {link}' },
      { id: 'p1', label: 'Solid deal', text: 'I found a solid deal on this — check it out: {link}' },
    ],
    email: [
      { id: 'p1', label: 'Solid deal', text: 'I found a solid deal on this — check it out: {link}' },
      { id: 'p2', label: 'Support my link', text: 'If you grab this through my link, it helps me earn a little. Thank you! {link}' },
    ],
    x: [
      { id: 'p4', label: 'Quick share', text: 'Quick share: this is worth a look → {link}' },
      { id: 'p3', label: 'Beezio intro', text: 'Trying a new marketplace called Beezio — this looks awesome: {link}' },
    ],
    whatsapp: [
      { id: 'p4', label: 'Quick share', text: 'Quick share: this is worth a look → {link}' },
      { id: 'p2', label: 'Support my link', text: 'If you grab this through my link, it helps me earn a little. Thank you! {link}' },
    ],
  },
  store: {
    copy: [
      { id: 's1', label: 'Store live', text: 'My Beezio storefront is live! Take a look: {link}' },
      { id: 's2', label: 'Support my shop', text: 'Support my shop (and find something you like): {link}' },
      { id: 's3', label: 'Favorites', text: 'I’m building my store—here are my favorites: {link}' },
    ],
    facebook: [
      { id: 's1', label: 'Store live', text: 'My Beezio storefront is live! Take a look: {link}' },
      { id: 's2', label: 'Support my shop', text: 'Support my shop (and find something you like): {link}' },
    ],
    sms: [
      { id: 's1', label: 'Store live', text: 'My Beezio storefront is live! Take a look: {link}' },
    ],
    email: [
      { id: 's2', label: 'Support my shop', text: 'Support my shop (and find something you like): {link}' },
      { id: 's3', label: 'Favorites', text: 'I’m building my store—here are my favorites: {link}' },
    ],
    x: [
      { id: 's1', label: 'Store live', text: 'My Beezio storefront is live! Take a look: {link}' },
    ],
    whatsapp: [
      { id: 's2', label: 'Support my shop', text: 'Support my shop (and find something you like): {link}' },
    ],
  },
  collection: {
    copy: [
      { id: 'c1', label: 'Top picks', text: 'My top picks right now (all in one place): {link}' },
      { id: 'c2', label: 'Gift ideas', text: 'Gift ideas list I put together: {link}' },
    ],
    facebook: [
      { id: 'c1', label: 'Top picks', text: 'My top picks right now (all in one place): {link}' },
    ],
    sms: [
      { id: 'c1', label: 'Top picks', text: 'My top picks right now (all in one place): {link}' },
    ],
    email: [
      { id: 'c2', label: 'Gift ideas', text: 'Gift ideas list I put together: {link}' },
    ],
    x: [
      { id: 'c1', label: 'Top picks', text: 'My top picks right now (all in one place): {link}' },
    ],
    whatsapp: [
      { id: 'c2', label: 'Gift ideas', text: 'Gift ideas list I put together: {link}' },
    ],
  },
  fundraiser: {
    copy: [
      { id: 'f1', label: 'Support cause', text: 'Support this cause in seconds — here’s the link: {link}' },
      { id: 'f2', label: 'Small purchase helps', text: 'Even a small purchase helps. Sharing too: {link}' },
    ],
    facebook: [
      { id: 'f1', label: 'Support cause', text: 'Support this cause in seconds — here’s the link: {link}' },
    ],
    sms: [
      { id: 'f2', label: 'Small purchase helps', text: 'Even a small purchase helps. Sharing too: {link}' },
    ],
    email: [
      { id: 'f1', label: 'Support cause', text: 'Support this cause in seconds — here’s the link: {link}' },
    ],
    x: [
      { id: 'f1', label: 'Support cause', text: 'Support this cause in seconds — here’s the link: {link}' },
    ],
    whatsapp: [
      { id: 'f2', label: 'Small purchase helps', text: 'Even a small purchase helps. Sharing too: {link}' },
    ],
  },
};

export function fillTemplate(template: string, link: string): string {
  return template.replace('{link}', link);
}

export function getDefaultTemplate(type: ShareTargetType, channel: ShareChannel): ShareTemplate {
  const list =
    SHARE_TEMPLATES[type]?.[channel] ||
    SHARE_TEMPLATES[type]?.copy ||
    SHARE_TEMPLATES.product.copy;
  return list[0];
}


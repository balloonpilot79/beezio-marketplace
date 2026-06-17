export function getSiteUrl() {
  const raw =
    String(process.env.URL || '').trim() ||
    String(process.env.DEPLOY_URL || '').trim() ||
    String(process.env.SITE_URL || '').trim();
  return raw || '';
}

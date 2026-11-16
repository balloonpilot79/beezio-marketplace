import { useEffect } from 'react';
import { injectSearchPage } from '../../shared/searchMetadata';

// Keep client-side navigation consistent with the server-rendered search head.
export function useSearchHead(page: Parameters<typeof injectSearchPage>[1] | null) {
  const serialized = page ? JSON.stringify(page) : '';
  useEffect(() => {
    if (!serialized) return;
    const metadata = JSON.parse(serialized);
    const apply = (next: typeof metadata) => {
      const parser = new DOMParser();
      const nextHead = parser.parseFromString(injectSearchPage('<html><head></head><body></body></html>',next),'text/html').head;
      document.head.querySelectorAll('title,meta[name="description"],meta[name="robots"],link[rel="canonical"],meta[property^="og:"],#beezio-search-schema').forEach(tag => tag.remove());
      [...nextHead.children].forEach(tag => document.head.appendChild(document.importNode(tag,true)));
    };
    apply(metadata);
    return () => {
      document.head.querySelectorAll('link[rel="canonical"],#beezio-search-schema,meta[name="robots"],meta[property^="og:"]').forEach(tag => tag.remove());
      document.title = 'Beezio | Free Websites. More Ways to Sell & Earn.';
    };
  },[serialized]);
}

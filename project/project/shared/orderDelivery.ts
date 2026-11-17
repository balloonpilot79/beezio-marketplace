export type DigitalAccess = {
  access_status?: string | null;
  first_access_at?: string | null;
  download_count?: number | null;
  download_limit?: number | null;
};

export function digitalDeliveryLabel(access?: DigitalAccess | null): string {
  if (!access) return 'Preparing download';
  const status = String(access.access_status || '').toLowerCase();
  if (status === 'revoked') return 'Download access revoked';
  if (status === 'exhausted' || (Number(access.download_limit) > 0 && Number(access.download_count) >= Number(access.download_limit))) return 'Download limit reached';
  if (status !== 'active') return 'Download unavailable';
  return access.first_access_at || Number(access.download_count) > 0 ? 'Downloaded' : 'Download available';
}

export function isDigitalOnlyOrder(order: { fulfillmentMethod?: string | null; items?: Array<{ isDigital?: boolean }> }): boolean {
  if (order.items?.length) return order.items.every(item => item.isDigital === true);
  return order.fulfillmentMethod === 'digital';
}

export function fulfillmentQueueBucket(item: any): 'needs_ordering' | 'ordered' | 'shipped' | 'digital' {
  if (isDigitalOnlyOrder(item)) return 'digital';
  const vendor = String(item.vendorStatus || '').toLowerCase();
  const fulfillment = String(item.fulfillmentStatus || '').toLowerCase();
  const status = String(item.orderStatus || '').toLowerCase();
  if (item.pickedUpAt || vendor === 'shipped' || fulfillment === 'shipped' || status === 'shipped' || status === 'delivered') return 'shipped';
  return vendor === 'ordered' || vendor === 'processing' ? 'ordered' : 'needs_ordering';
}

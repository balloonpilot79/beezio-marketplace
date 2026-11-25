import { getProductTerms } from '../src/utils/productTerms';

type DeliveryPeriod = { days: number; businessDays: boolean };
type Product = { is_digital?: boolean | null; shipping_options?: unknown };

function reviewPeriod(value: string): DeliveryPeriod | null {
  const match = value.trim().match(/^(?:up to\s+)?(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?\s*(business\s+)?(days?|weeks?)?(?:\s+(?:before shipping|after shipping))?$/i);
  if (!match) return null;
  const days = Math.max(Number(match[1]), Number(match[2] || 0));
  const businessDays = Boolean(match[3]);
  const daysPerWeek = businessDays ? 5 : 7;
  return { days: days * (/^week/i.test(match[4] || '') ? daysPerWeek : 1), businessDays };
}

export function reviewDeliveryWindows(
  products: Product[],
  pickup: boolean,
  carrierEstimate?: string | null
): DeliveryPeriod[][] | null {
  if (!products.length) return null;
  const windows = products.map((product) => {
    if (product.is_digital) return [];
    const terms = getProductTerms(product.shipping_options);
    const handling = terms.processing_time ? reviewPeriod(terms.processing_time) : null;
    if (terms.processing_time && !handling) return null;
    if (pickup) return handling ? [handling] : null;
    const transit = reviewPeriod(terms.estimated_days || carrierEstimate || '3-5 business days');
    return transit ? (handling ? [handling, transit] : [transit]) : null;
  });
  return windows.every((window) => window !== null) ? windows : null;
}

export function reviewDeliveryDate(paidAt: string, windows: DeliveryPeriod[][] | undefined): string | null {
  const paid = new Date(paidAt);
  if (!windows?.length || !Number.isFinite(paid.getTime())) return null;
  const deliveryTimes = windows.map((window) => {
    if (!Array.isArray(window) || window.length > 2) return NaN;
    const date = new Date(paid);
    for (const period of window) {
      if (!Number.isInteger(period?.days) || period.days < 0 || period.days > 693) return NaN;
      if (!period.businessDays) {
        date.setUTCDate(date.getUTCDate() + period.days);
        continue;
      }
      for (let daysLeft = period.days; daysLeft > 0;) {
        date.setUTCDate(date.getUTCDate() + 1);
        if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) daysLeft -= 1;
      }
    }
    return date.getTime();
  });
  const latest = Math.max(...deliveryTimes);
  return Number.isFinite(latest) ? new Date(latest).toISOString().slice(0, 10) : null;
}

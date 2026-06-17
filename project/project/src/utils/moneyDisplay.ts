const roundMoneyAmount = (value: number): number => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return 0;
  return Math.round((normalized + Number.EPSILON) * 100) / 100;
};

export const formatMoneyDisplay = (value: number, currency = 'USD'): string => {
  const amount = roundMoneyAmount(value);

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

export const isFreeShippingValue = (value: number): boolean => roundMoneyAmount(value) <= 0;

export const formatShippingDisplay = (value: number, currency = 'USD'): string =>
  isFreeShippingValue(value) ? 'Free shipping' : formatMoneyDisplay(value, currency);

export const formatShippingLineItem = (value: number, currency = 'USD'): string =>
  isFreeShippingValue(value) ? 'Free shipping' : `+ ${formatMoneyDisplay(value, currency)} shipping`;

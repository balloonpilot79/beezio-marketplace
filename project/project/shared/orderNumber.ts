const ORDER_NUMBER_PREFIX = 'BZO';

const pad = (value: number) => String(value).padStart(2, '0');

const formatDatePart = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  return `${year}${month}${day}`;
};

const sanitizeSeed = (value: string): string => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const fallbackSeed = (): string => {
  try {
    return sanitizeSeed(crypto.randomUUID());
  } catch {
    return sanitizeSeed(`${Date.now()}${Math.random().toString(36)}`);
  }
};

export const createBeezioOrderNumber = (seed?: string | null, createdAt: Date = new Date()): string => {
  const cleanedSeed = sanitizeSeed(String(seed || ''));
  const suffix = (cleanedSeed || fallbackSeed()).slice(-8).padStart(8, '0');
  return `${ORDER_NUMBER_PREFIX}-${formatDatePart(createdAt)}-${suffix}`;
};

const DEFAULT_PAYOUT_TIMEZONE = process.env.PAYOUT_TIMEZONE || 'America/Chicago';

const pad2 = (value: number) => String(value).padStart(2, '0');

const getDatePartsInTimeZone = (date: Date, timeZone = DEFAULT_PAYOUT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0');
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
};

const getTimeZoneOffsetMs = (date: Date, timeZone = DEFAULT_PAYOUT_TIMEZONE) => {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
  const wholeSecondEpoch = Math.trunc(date.getTime() / 1000) * 1000;
  return asUtc - wholeSecondEpoch;
};

const zonedDateTimeToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone = DEFAULT_PAYOUT_TIMEZONE,
) => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
};

const parseYmd = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

const formatYmd = (year: number, month: number, day: number) => `${year}-${pad2(month)}-${pad2(day)}`;

export const isSupportedPayday = (ymd: string) => {
  const parts = parseYmd(ymd);
  return Boolean(parts && (parts.day === 1 || parts.day === 15));
};

export const getTimeZoneDateString = (date: Date, timeZone = DEFAULT_PAYOUT_TIMEZONE) => {
  const parts = getDatePartsInTimeZone(date, timeZone);
  return formatYmd(parts.year, parts.month, parts.day);
};

export const getNextScheduledPayday = (from: Date, timeZone = DEFAULT_PAYOUT_TIMEZONE) => {
  const today = parseYmd(getTimeZoneDateString(from, timeZone));
  if (!today) throw new Error('Failed to determine payout date');
  if (today.day < 1) return formatYmd(today.year, today.month, 1);
  if (today.day < 15) return formatYmd(today.year, today.month, 15);
  if (today.day === 15) return formatYmd(today.year, today.month, 15);

  const nextMonth = today.month === 12 ? 1 : today.month + 1;
  const nextYear = today.month === 12 ? today.year + 1 : today.year;
  return formatYmd(nextYear, nextMonth, 1);
};

export const getScheduledPaydayOnOrAfter = (eligibleAt: string | null | undefined, timeZone = DEFAULT_PAYOUT_TIMEZONE) => {
  const date = eligibleAt ? new Date(eligibleAt) : new Date();
  if (Number.isNaN(date.getTime())) return getNextScheduledPayday(new Date(), timeZone);
  return getNextScheduledPayday(date, timeZone);
};

export const getPayoutCutoffIso = (payoutDate: string, timeZone = DEFAULT_PAYOUT_TIMEZONE) => {
  const parts = parseYmd(payoutDate);
  if (!parts) throw new Error('Invalid payout_date. Expected YYYY-MM-DD.');
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 23, 59, 59, 999, timeZone).toISOString();
};

export const resolveRequestedPayoutDate = (
  requestedDate: string | null | undefined,
  now = new Date(),
  timeZone = DEFAULT_PAYOUT_TIMEZONE,
) => {
  const payoutDate = String(requestedDate || '').trim() || getNextScheduledPayday(now, timeZone);
  if (!isSupportedPayday(payoutDate)) {
    throw new Error(`Unsupported payout_date ${payoutDate}. Beezio pays on the 1st and 15th of each month.`);
  }
  return { payoutDate, cutoffIso: getPayoutCutoffIso(payoutDate, timeZone), timeZone };
};

export const isTodayScheduledPayday = (now = new Date(), timeZone = DEFAULT_PAYOUT_TIMEZONE) => {
  return isSupportedPayday(getTimeZoneDateString(now, timeZone));
};

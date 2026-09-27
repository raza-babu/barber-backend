import moment from 'moment-timezone';
import config from '../../config';

export const DEFAULT_TIMEZONE = config.timezone || 'Europe/London';

/**
 * Checks if a string is a valid IANA timezone identifier
 */
export const isValidTimezone = (zone?: string | null): boolean => {
  if (!zone || typeof zone !== 'string') return false;
  return !!moment.tz.zone(zone);
};

/**
 * Resolves a timezone safely, falling back to DEFAULT_TIMEZONE (Europe/London)
 */
export const resolveTimezone = (zone?: string | null): string => {
  if (zone && isValidTimezone(zone)) {
    return zone;
  }
  return DEFAULT_TIMEZONE;
};

/**
 * Resolves the timezone from a SaloonOwner object or falls back to DEFAULT_TIMEZONE
 */
export const getSalonTimezone = (
  salon?: { timezone?: string | null } | Record<string, any> | null,
): string => {
  return resolveTimezone(salon?.timezone);
};

/**
 * Returns current Moment in the specified timezone
 */
export const getNowInZone = (zone?: string | null): moment.Moment => {
  return moment.tz(resolveTimezone(zone));
};

/**
 * Returns today's ISO date string (YYYY-MM-DD) in the specified timezone
 */
export const getTodayISODate = (zone?: string | null): string => {
  return getNowInZone(zone).format('YYYY-MM-DD');
};

/**
 * Parses an ISO date string (YYYY-MM-DD or full ISO), Date, or Moment in the specified timezone
 */
export const parseDateInZone = (
  dateInput: string | Date | moment.Moment | any,
  zone?: string | null,
): moment.Moment => {
  const targetZone = resolveTimezone(zone);
  if (!dateInput) return moment.tz(targetZone);
  if (moment.isMoment(dateInput)) {
    return dateInput.clone().tz(targetZone);
  }
  if (dateInput instanceof Date) {
    return moment.tz(dateInput, targetZone);
  }
  return moment.tz(dateInput, targetZone);
};

/**
 * Parses a 12-hour or 24-hour time string on a given date into a Moment in the given timezone
 * e.g., timeStr = "10:30 AM", dateStr = "2026-09-26" or "2026-09-26T00:00:00.000Z"
 */
export const parseDateTimeInZone = (
  dateStr: string,
  timeStr: string,
  zone?: string | null,
): moment.Moment => {
  const targetZone = resolveTimezone(zone);
  const trimmedTime = timeStr.trim();
  const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();

  // Try 12-hour format: "YYYY-MM-DD hh:mm A" or "YYYY-MM-DD h:mm A"
  let m = moment.tz(
    `${cleanDateStr} ${trimmedTime}`,
    [
      'YYYY-MM-DD hh:mm A',
      'YYYY-MM-DD h:mm A',
      'YYYY-MM-DD hh:mma',
      'YYYY-MM-DD h:mma',
      'YYYY-MM-DD HH:mm',
      'YYYY-MM-DD H:mm',
    ],
    targetZone,
  );
  if (m.isValid()) return m;

  // Try ISO parsing directly
  m = moment.tz(timeStr, targetZone);
  if (m.isValid()) return m;

  return moment.tz(targetZone);
};

/**
 * Returns all IANA timezone identifiers supported by moment-timezone
 */
export const getTimezoneList = (): string[] => {
  return moment.tz.names();
};

/**
 * Converts a Moment to UTC JavaScript Date for Prisma storage
 */
export const toUTCJSDate = (m: moment.Moment): Date => {
  return m.toDate();
};

/**
 * Calculates start of day and end of day in UTC for Prisma queries (e.g. gte / lte)
 * given a date in the salon's local timezone.
 */
export const getDayBoundsInZone = (
  dateInput: string | Date | moment.Moment | any,
  zone?: string | null,
): {
  startOfDayUTC: Date;
  endOfDayUTC: Date;
  dayName: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
} => {
  const targetZone = resolveTimezone(zone);
  let m: moment.Moment;

  if (typeof dateInput === 'string') {
    m = moment.tz(dateInput, targetZone);
  } else if (dateInput instanceof Date) {
    m = moment.tz(dateInput, targetZone);
  } else if (moment.isMoment(dateInput)) {
    m = dateInput.clone().tz(targetZone);
  } else if (dateInput && typeof (dateInput as any).toDate === 'function') {
    m = moment.tz((dateInput as any).toDate(), targetZone);
  } else if (dateInput && typeof (dateInput as any).toJSDate === 'function') {
    m = moment.tz((dateInput as any).toJSDate(), targetZone);
  } else {
    m = moment.tz(targetZone);
  }

  const startOfDay = m.clone().startOf('day');
  const endOfDay = m.clone().endOf('day');

  return {
    startOfDayUTC: startOfDay.toDate(),
    endOfDayUTC: endOfDay.toDate(),
    dayName: m.format('dddd').toLowerCase(),
    dayOfWeek: m.day(), // 0=Sunday, 1=Monday, ..., 6=Saturday
  };
};

/**
 * Formats a Date or Moment into a string in the specified timezone
 */
export const formatInZone = (
  date: Date | moment.Moment | string | any,
  formatStr: string,
  zone?: string | null,
): string => {
  const targetZone = resolveTimezone(zone);
  let m: moment.Moment;

  if (typeof date === 'string') {
    m = moment.tz(date, targetZone);
  } else if (date instanceof Date) {
    m = moment.tz(date, targetZone);
  } else if (moment.isMoment(date)) {
    m = date.clone().tz(targetZone);
  } else if (date && typeof (date as any).toDate === 'function') {
    m = moment.tz((date as any).toDate(), targetZone);
  } else if (date && typeof (date as any).toJSDate === 'function') {
    m = moment.tz((date as any).toJSDate(), targetZone);
  } else {
    m = moment.tz(targetZone);
  }

  return m.format(formatStr);
};

export { moment };

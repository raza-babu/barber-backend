// saloonScheduleValidation.ts
import { z } from 'zod';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import exp from 'constants';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const timeRange12hRegex =
  /^((0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM))\s*-\s*((0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM))$/i;

function convertToUTCWithDisplay(timeRange: string) {
  const [opening, closing] = timeRange.split('-').map(t => t.trim());
  const today = dayjs().format('YYYY-MM-DD');

  const openingUTC = dayjs(`${today} ${opening}`, 'YYYY-MM-DD hh:mm A').utc().toDate();
  const closingUTC = dayjs(`${today} ${closing}`, 'YYYY-MM-DD hh:mm A').utc().toDate();

  // Keep original 12h display format
  const openingTimeDisplay = dayjs(`${today} ${opening}`, 'YYYY-MM-DD hh:mm A').format('hh:mm A');
  const closingTimeDisplay = dayjs(`${today} ${closing}`, 'YYYY-MM-DD hh:mm A').format('hh:mm A');

  return {
    openingUTC,
    closingUTC,
    openingTime: openingTimeDisplay,
    closingTime: closingTimeDisplay,
  };
}

const daysMap: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const singleDayBaseSchema = z.object({
  dayName: z
    .string()
    .min(1, 'Day name is required')
    .refine(val => daysMap[val.toLowerCase()] !== undefined, 'Invalid day name'),
  time: z.string().regex(timeRange12hRegex, 'Time must be in format "hh:mm AM - hh:mm PM"'),
  isActive: z.boolean(),
});

const singleDaySchema = singleDayBaseSchema.transform(data => {
  const { openingUTC, closingUTC, openingTime, closingTime } =
    convertToUTCWithDisplay(data.time);

  return {
    dayName: data.dayName,
    dayOfWeek: daysMap[data.dayName.toLowerCase()],
    openingDateTime: openingUTC,
    closingDateTime: closingUTC,
    openingTime,
    closingTime,
    isActive: data.isActive,
  };
});

const createSaloonScheduleSchema = z.object({
  body: z
    .array(singleDaySchema)
    .length(7, 'Exactly 7 days required')
    .refine(days => {
      const names = days.map(d => d.dayName.toLowerCase());
      return new Set(names).size === 7;
    }, 'Must have all days of the week'),
});

const updateSaloonScheduleSchema = z.object({
  body: singleDayBaseSchema.partial(),
});

export const saloonScheduleValidation = {
  createSaloonScheduleSchema,
  updateSaloonScheduleSchema,
};

import { z } from 'zod';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

// Map day names to dayOfWeek numbers
const daysMap: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// Regex to validate 12-hour time range
const timeRange12hRegex =
  /^((0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM))\s*-\s*((0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM))$/i;

// Convert 12h time to UTC Date object
function convertToUTC(timeRange: string) {
  const [opening, closing] = timeRange.split('-').map(t => t.trim());
  const today = dayjs().format('YYYY-MM-DD');

  const openingUTC = dayjs(`${today} ${opening}`, 'YYYY-MM-DD hh:mm A')
    .utc()
    .toDate();
  const closingUTC = dayjs(`${today} ${closing}`, 'YYYY-MM-DD hh:mm A')
    .utc()
    .toDate();

  const openingTime = dayjs(`${today} ${opening}`, 'YYYY-MM-DD hh:mm A').format(
    'hh:mm A',
  );
  const closingTime = dayjs(`${today} ${closing}`, 'YYYY-MM-DD hh:mm A').format(
    'hh:mm A',
  );

  return { openingUTC, closingUTC, openingTime, closingTime };
}

// Single schedule validation & transformation
const singleBarberScheduleBaseSchema = z.object({
  dayName: z
    .string()
    .min(1, 'Day name is required')
    .refine(
      val => daysMap[val.toLowerCase()] !== undefined,
      'Invalid day name',
    ),
  time: z
    .string()
    .regex(timeRange12hRegex, 'Time must be in format "hh:mm AM - hh:mm PM"'),
  isActive: z.boolean(),
});

const singleBarberScheduleSchema = singleBarberScheduleBaseSchema.transform(
  data => {
    const { openingUTC, closingUTC, openingTime, closingTime } = convertToUTC(
      data.time,
    );

    return {
      dayName: data.dayName,
      dayOfWeek: daysMap[data.dayName.toLowerCase()],
      openingDateTime: openingUTC,
      closingDateTime: closingUTC,
      openingTime,
      closingTime,
      isActive: data.isActive,
    };
  },
);

// Main schema for Postman input
const createBarberScheduleSchema = z.object({
  body: z.object({
    barberId: z.string({
      required_error: 'Barber ID is required!',
    }),
    schedules: z
      .array(singleBarberScheduleSchema)
      .length(7, 'Exactly 7 days of schedule are required')
      .refine(days => {
        const names = days.map(d => d.dayName.toLowerCase());
        return new Set(names).size === 7;
      }, 'Must have all days of the week'),
  }),
});

// Schema for updating a single day
const updateBarberScheduleSchema = z.object({
  body: singleBarberScheduleBaseSchema.partial(),
});

export const barberScheduleValidation = {
  createBarberScheduleSchema,
  updateBarberScheduleSchema,
};

import { z } from 'zod';
import moment from 'moment-timezone';
import { DEFAULT_TIMEZONE } from '../../utils/timezone.helper';

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
function convertToUTC(timeRange: string, timezone: string = DEFAULT_TIMEZONE) {
  const [opening, closing] = timeRange.split('-').map(t => t.trim());
  const today = moment.tz(timezone).format('YYYY-MM-DD');

  const openingM = moment.tz(
    `${today} ${opening}`,
    [
      'YYYY-MM-DD hh:mm A',
      'YYYY-MM-DD h:mm A',
      'YYYY-MM-DD hh:mma',
      'YYYY-MM-DD h:mma',
    ],
    timezone,
  );
  const closingM = moment.tz(
    `${today} ${closing}`,
    [
      'YYYY-MM-DD hh:mm A',
      'YYYY-MM-DD h:mm A',
      'YYYY-MM-DD hh:mma',
      'YYYY-MM-DD h:mma',
    ],
    timezone,
  );

  const openingUTC = openingM.isValid() ? openingM.toDate() : new Date();
  const closingUTC = closingM.isValid() ? closingM.toDate() : new Date();

  const openingTime = openingM.isValid() ? openingM.format('hh:mm A') : opening;
  const closingTime = closingM.isValid() ? closingM.format('hh:mm A') : closing;

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
  type: z.enum(['BOOKING', 'QUEUE'], {
    required_error: 'Schedule type is required!',
  }),
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
    type: z.enum(['BOOKING', 'QUEUE'], {
      required_error: 'Schedule type is required!',
    }),
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

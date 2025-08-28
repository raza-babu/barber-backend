import { BookingStatus } from '@prisma/client';
import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    bookingId: z.string({
      required_error: 'Booking ID is required!',
    }),
    status: z.nativeEnum(BookingStatus),
  }),
});

const updateSchema = z.object({
  body: z.object({
    bookingId: z.string({
      required_error: 'Booking ID is required!',
    }),
    status: z.nativeEnum(BookingStatus),
  }),
});

function convertToUTC(date: string, time: string): string {
  // Combine into a single string
  const combined = `${date} ${time}`;

  // Parse as local time (system’s local timezone)
  const localDate = new Date(combined);

  if (isNaN(localDate.getTime())) {
    throw new Error('Invalid date or time format');
  }

  // Convert to UTC string (ISO)
  return localDate.toISOString();
}

const availableBarbersSchema = z.object({
 query: z.object({
  // salonId: z.string().min(1),
  date: z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.coerce.string().regex(/^\d{1,2}:\d{2}(\s?(AM|PM))?$/),
  // totalServiceTime: z.coerce.number().int().positive(),

  }).transform(({  date, time }) => ({
    // salonId,
    utcDateTime: convertToUTC(date, time),
    // totalServiceTime,
  })),
});

export const saloonValidation = {
  createSchema,
  updateSchema,
  availableBarbersSchema,
};

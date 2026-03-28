import { z } from 'zod';

const createBookingSchema = z.object({
  body: z.object({
    barberId: z.string().min(1, 'Barber ID is required').optional(),
    saloonOwnerId: z.string().min(1, 'Saloon Owner ID is required'),
    appointmentAt: z
      .string()
      .min(1, 'Appointment date-time is required')
      .optional(), // e.g., "2025-08-20T11:00:00"
    date: z.string().min(1, 'Date is required'), // e.g., "2025-08-20"
    services: z.array(z.string()).min(1, 'At least one service is required'),
    // totalPrice: z.number({ required_error: 'Total price is required' }),
    notes: z.string().optional(),
    loyaltySchemeId: z.string().optional(),
    isInQueue: z.boolean().optional(),
    type: z.enum(['BOOKING', 'QUEUE'], {
      required_error: 'Booking type is required',
    }),
    remoteQueue: z.boolean().optional(),
    fullName: z.string().min(1, 'Full name is required').optional(),
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().min(1, 'Phone number is required').optional(),
  }),
});

const updateBookingSchema = z.object({
  body: z.object({
    barberId: z.string().min(1, 'Barber ID is required').optional(),
    appointmentAt: z.string().optional(), // e.g., "2025-08-20T11:00:00"
    date: z.string().optional(), // e.g., "2025-08-20"
    startDateTime: z.string().optional(), // e.g., "2025-08-20T11:00:00"
    endDateTime: z.string().optional(), // e.g., "2025-08-20T11:30:00"
    startTime: z.string().optional(), // e.g., "11:00 AM"
    endTime: z.string().optional(), // e.g., "11:30 AM"
    notes: z.string().optional(),
    loyaltySchemeId: z.string().optional(),
    type: z
      .enum(['BOOKING', 'QUEUE'], {
        required_error: 'Booking type is required',
      })
      .optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Booking ID is required').optional(), // ID of the booking to update
  }),
});
const updateBookingStatusSchema = z.object({
  body: z.object({
    bookingId: z.string().min(1, 'Booking ID is required'),
    status: z.enum(['PENDING', 'CONFIRMED', 'RESCHEDULED'], {
      required_error: 'Status is required',
    }),
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
  query: z
    .object({
      saloonOwnerId: z.string().min(1),
      date: z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, {
        message: 'Time must be in hh:mm AM/PM format',
      }),
      totalServiceTime: z.coerce.number().int().positive(),
      type: z
        .enum(['BOOKING', 'QUEUE'], {
          required_error: 'Booking type is required',
        })
        .optional(),
    })
    .transform(({ saloonOwnerId, date, time, totalServiceTime, type }) => ({
      saloonOwnerId,
      utcDateTime: convertToUTC(date, time),
      date,
      totalServiceTime,
      type,
    })),
});

const walkingInBarbersSchema = z.object({
  body: z.object({
    saloonOwnerId: z.string().min(1),
    date: z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

export const bookingValidation = {
  createBookingSchema,
  updateBookingSchema,
  updateBookingStatusSchema,
  availableBarbersSchema,
  walkingInBarbersSchema,
};

import { log } from 'node:console';
import { query } from 'express';
import { number, z } from 'zod';

const createBookingSchema = z.object({
  body: z.object({
    barberId: z.string().min(1, 'Barber ID is required'),
    saloonOwnerId: z.string().min(1, 'Saloon Owner ID is required'),
    appointmentAt: z.string().min(1, 'Appointment date-time is required'), // e.g., "2025-08-20T11:00:00"
    date: z.string().min(1, 'Date is required'), // e.g., "2025-08-20"
    services: z.array(z.string()).min(1, 'At least one service is required'),
    // totalPrice: z.number({ required_error: 'Total price is required' }),
    notes: z.string().optional(),
    isInQueue: z.boolean().optional(),
  }),
});

const updateBookingSchema = z.object({
  body: z.object({
    appointmentAt: z.string().optional(), // e.g., "2025-08-20T11:00:00"
    date: z.string().optional(), // e.g., "2025-08-20"
    startDateTime: z.string().optional(), // e.g., "2025-08-20T11:00:00"
    endDateTime: z.string().optional(), // e.g., "2025-08-20T11:30:00"
    startTime: z.string().optional(), // e.g., "11:00 AM"
    endTime: z.string().optional(),   // e.g., "11:30 AM"
    totalPrice: z.number().optional(),
    notes: z.string().optional(),
    isInQueue: z.boolean().optional(),
    barberName: z.string().optional(),
    barberImage: z.string().optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Booking ID is required'),
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
  salonId: z.string().min(1),
  date: z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.coerce.string().regex(/^\d{1,2}:\d{2}(\s?(AM|PM))?$/),
  totalServiceTime: z.coerce.number().int().positive(),

  }).transform(({ salonId, date, time, totalServiceTime }) => ({
    salonId,
    utcDateTime: convertToUTC(date, time),
    totalServiceTime,
  })),
});


export const bookingValidation = {
  createBookingSchema,
  updateBookingSchema,
  availableBarbersSchema,
};

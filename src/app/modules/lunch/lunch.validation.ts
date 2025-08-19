import { z } from 'zod';

const createLunchSchema = z.object({
  body: z.object({
    // barberId: z.string().min(1, 'Barber ID is required'),
    // date: z.string().min(1, 'Date is required'), // e.g., "2025-08-20"
    startTime: z.string()
      .min(1, 'Start time is required')
      .regex(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'Start time must be in "hh:mm AM/PM" format'), // e.g., "01:00 PM"
    endTime: z.string()
      .min(1, 'End time is required')
      .regex(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'End time must be in "hh:mm AM/PM" format'), // e.g., "02:00 PM"
    status: z.boolean().optional().default(true),
  }),
});
const updateLunchSchema = z.object({
  body: z.object({
    // date: z.string().min(1, 'Date is required'), // e.g., "2025-08-20"
    startTime: z.string()
      .min(1, 'Start time is required')
      .regex(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'Start time must be in "hh:mm AM/PM" format'), // e.g., "01:00 PM"
    endTime: z.string()
      .min(1, 'End time is required')
      .regex(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'End time must be in "hh:mm AM/PM" format'), // e.g., "02:00 PM"
    status: z.boolean().optional().default(true),
  }),
});

export const lunchValidation = {
  createLunchSchema,
  updateLunchSchema,
};

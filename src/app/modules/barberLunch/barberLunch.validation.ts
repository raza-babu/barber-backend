import { z } from 'zod';

const createBarberLunchSchema = z.object({
  body: z.object({
    barberId: z.string().min(1, 'Barber ID is required'),
    date: z.string().min(1, 'Date is required'), // e.g., "2025-08-20"
    startTime: z.string().min(1, 'Start time is required'), // e.g., "12:00 PM"
    endTime: z.string().min(1, 'End time is required')      // e.g., "01:00 PM"
  }),
});

const updateBarberLunchSchema = z.object({
  body: z.object({
    barberId: z.string().optional(),
    date: z.string().optional(), // e.g., "2025-08-20"
    startTime: z.string().optional(), // e.g., "12:00 PM"
    endTime: z.string().optional(),   // e.g., "01:00 PM"
  }),
})
    

export const barberLunchValidation = {
createBarberLunchSchema,
updateBarberLunchSchema,
};
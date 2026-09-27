import { z } from 'zod';

export const barberDayOffSchema = z.object({
  barberId: z
    .string({ required_error: 'Barber ID is required' })
    .min(1, 'Barber ID cannot be empty'),

  date: z
    .string({ required_error: 'Date is required' })
    .refine(val => !isNaN(Date.parse(val)), 'Invalid date format'),

  reason: z
    .string()
    .max(255, 'Reason cannot exceed 255 characters')
    .optional(),

  isAllDay: z.boolean().optional().default(true),
});

const createBarberDayOffSchema = z.object({
  body: barberDayOffSchema,
});


const updateBarberDayOffSchema = z.object({
  body: barberDayOffSchema.partial(),
});

export const barberHolidayValidation = {
createBarberDayOffSchema,
updateBarberDayOffSchema,
};
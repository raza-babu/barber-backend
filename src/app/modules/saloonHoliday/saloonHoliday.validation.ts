import { z } from 'zod';

const createSaloonHolidaySchema = z.object({
  body: z.object({
    saloonId: z.string().optional(),
    date: z.string().datetime({ offset: true }), // ISO 8601 format
    holidayName: z.string().min(1, 'Holiday name is required'),
    description: z.string().optional(),
    isRecurring: z.boolean().default(false)
  })
});

const updateSaloonHolidaySchema = z.object({
  body: z.object({
    date: z.string().datetime({ offset: true }).optional(),
    holidayName: z.string().min(1).optional(),
    description: z.string().optional(),
    isRecurring: z.boolean().optional()
  })
});
export const saloonHolidayValidation = {
  createSaloonHolidaySchema,
  updateSaloonHolidaySchema
};
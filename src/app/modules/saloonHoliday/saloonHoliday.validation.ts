import { z } from 'zod';

const createSaloonHolidaySchema = z.object({
  body: z.object({
    saloonId: z.string().optional(),
    date: z.string()
      .refine(
        (val) => !isNaN(Date.parse(val)),
        { message: 'Invalid date format' }
      )
      .transform((val) => new Date(val).toISOString()),
    holidayName: z.string().min(1, 'Holiday name is required'),
    description: z.string().optional(),
    isRecurring: z.boolean().default(false)
  })
});

const updateSaloonHolidaySchema = z.object({
  body: z.object({
    date: z.string()
      .refine(
        (val) => val === undefined || !isNaN(Date.parse(val)),
        { message: 'Invalid date format' }
      )
      .transform((val) => val === undefined ? val : new Date(val).toISOString())
      .optional(),
    holidayName: z.string().min(1, 'Holiday name is required').optional(),
    description: z.string().optional(),
    isRecurring: z.boolean().optional()
  })
});
export const saloonHolidayValidation = {
  createSaloonHolidaySchema,
  updateSaloonHolidaySchema
};
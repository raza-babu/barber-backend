import { z } from 'zod';

const singleBarberScheduleSchema = z.object({
  dayOfWeek: z
    .number({
      required_error: 'Day of week is required!',
      invalid_type_error: 'Day of week must be a number between 0 and 6!',
    })
    .int()
    .min(0, 'Day of week cannot be less than 0 (Sunday)')
    .max(6, 'Day of week cannot be greater than 6 (Saturday)'),
  openingTime: z
    .string({
      required_error: 'Opening time is required!',
    })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Opening time must be in HH:mm format'),
  closingTime: z
    .string({
      required_error: 'Closing time is required!',
    })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Closing time must be in HH:mm format'),
  isActive: z.boolean().optional().default(true),
});

const createBarberSchedulesSchema = z.object({
  body: z
    .array(singleBarberScheduleSchema)
    .length(7, 'Exactly 7 days of schedule are required'),
});
const updateBarberSchedulesSchema = z.object({
  body: z.object({
    dayOfWeek: z
      .number({
        required_error: 'Day of week is required!',
        invalid_type_error: 'Day of week must be a number between 0 and 6!',
      })
      .int()
      .min(0, 'Day of week cannot be less than 0 (Sunday)')
      .max(6, 'Day of week cannot be greater than 6 (Saturday)')
      .optional(),
    openingTime: z
      .string({
        required_error: 'Opening time is required!',
      })
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Opening time must be in HH:mm format')
      .optional(),
    closingTime: z
      .string({
        required_error: 'Closing time is required!',
      })
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Closing time must be in HH:mm format')
      .optional(),
    isActive: z.boolean().optional(),  
    }),
});

export const barberScheduleValidation = {
createBarberSchedulesSchema,
updateBarberSchedulesSchema,
};
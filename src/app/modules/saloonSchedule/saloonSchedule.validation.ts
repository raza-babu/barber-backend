import { z } from 'zod';

// Enhanced time format validation
const timeFormatRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/; // 00:00 to 23:59

export const singleDayScheduleSchema = z.object({
  saloonId: z.string().optional(),
  userId: z.string().optional(),
  dayOfWeek: z.number()
    .int()
    .min(0)
    .max(6),
  openingTime: z.string()
    .regex(timeFormatRegex, 'Invalid time format (HH:MM, 24-hour)'),
  closingTime: z.string()
    .regex(timeFormatRegex, 'Invalid time format (HH:MM, 24-hour)'),
  isActive: z.boolean(),
}).superRefine((data, ctx) => {
  // When salon is active for the day
  if (data.isActive) {
    // Cannot be 00:00-00:00 when active
    if (data.openingTime === '00:00' && data.closingTime === '00:00') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cannot have 00:00-00:00 when active',
        path: ['isActive']
      });
      return;
    }
    
    // Opening must be before closing
    if (data.openingTime >= data.closingTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Opening time must be before closing time',
        path: ['openingTime']
      });
    }
  }
  
  // When salon is inactive
  if (!data.isActive) {
    // If inactive, should have 00:00-00:00
    if (data.openingTime !== '00:00' || data.closingTime !== '00:00') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inactive days must have 00:00-00:00 times',
        path: ['openingTime']
      });
    }
  }
});

export const createSaloonScheduleSchema = z.object({
  body: z.array(singleDayScheduleSchema)
    .length(7)
    .refine(days => {
      const dayNumbers = days.map(d => d.dayOfWeek);
      return new Set(dayNumbers).size === 7;
    }, 'Must have exactly one entry for each day (0-6)')
});

const updateSaloonScheduleSchema = z.object({
  body: z.object({
    dayOfWeek: z
      .number({
        invalid_type_error: 'Day of week must be a number between 0 and 6!',
      })
      .int()
      .min(0, 'Day of week cannot be less than 0 (Sunday)')
      .max(6, 'Day of week cannot be greater than 6 (Saturday)')
      .optional(),
    openingTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Opening time must be in HH:mm format').optional(),
    closingTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Closing time must be in HH:mm format').optional(),
    isActive: z.boolean().optional(),
  }),
  // params: z.object({
  //   id: z.string({
  //     required_error: 'Schedule ID is required!',
  //   }),
  // }),
});

export const saloonScheduleValidation = {
  createSaloonScheduleSchema,
  updateSaloonScheduleSchema,
};
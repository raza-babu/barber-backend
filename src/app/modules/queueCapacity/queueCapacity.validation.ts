import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    barberId: z.string().min(1, 'barberId is required'),
    maxCapacity: z.number().min(1, 'Minimum capacity must be at least 1'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    barberId: z.string().min(1, 'barberId is required').optional(),
    maxCapacity: z
      .number()
      .min(1, 'Minimum capacity must be at least 1')
      .optional(),
  }),
});

export const queueCapacityValidation = {
  createSchema,
  updateSchema,
};

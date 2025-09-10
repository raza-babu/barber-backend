import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    serviceId: z.string().min(1, 'Service ID is required'),
    points: z.number().min(1, 'Points must be at least 1'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    serviceId: z.string().min(1, 'Service ID is required').optional(),
    points: z.number().min(1, 'Points must be at least 1').optional(),
  }),
});

export const loyaltyProgramValidation = {
  createSchema,
  updateSchema,
};

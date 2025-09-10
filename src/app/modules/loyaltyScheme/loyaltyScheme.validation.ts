import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    pointThreshold: z.number().min(1, 'Point threshold must be at least 1'),
    percentage: z.number().min(1, 'Percentage must be at least 1').max(100, 'Percentage cannot exceed 100'),
    }),
});

const updateSchema = z.object({
  body: z.object({
    pointThreshold: z.number().min(1, 'Point threshold must be at least 1').optional(),
    percentage: z.number().min(1, 'Percentage must be at least 1').max(100, 'Percentage cannot exceed 100').optional(),
    }),
});

export const loyaltySchemeValidation = {
createSchema,
updateSchema,
};
import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    }),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    }),
});

const checkInSchema = z.object({
  body: z.object({
    latitude: z.union([z.string(), z.number()]).pipe(z.coerce.number({
      invalid_type_error: 'Latitude must be a valid number',
      required_error: 'Latitude is required',
    })),
    longitude: z.union([z.string(), z.number()]).pipe(z.coerce.number({
      invalid_type_error: 'Longitude must be a valid number',
      required_error: 'Longitude is required',
    })),
  }),
});

const analyzeSaloonSchema = z.object({
  body: z.object({
    imageDescription: z.string().optional(),
    latitude: z.string({required_error: 'Latitude is required'}).pipe(z.coerce.number()),
    longitude: z.string({required_error: 'Longitude is required'}).pipe(z.coerce.number()),
  }),
});

export const customerValidation = {
createSchema,
updateSchema,
checkInSchema,
analyzeSaloonSchema,
};
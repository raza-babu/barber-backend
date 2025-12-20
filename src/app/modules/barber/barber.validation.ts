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

const updateBookingStatusSchema = z.object({
  body: z.object({
    status: z.enum(['STARTED', 'ENDED'], {
      required_error: 'Status is required',
    }),
  }),
});

export const barberValidation = {
createSchema,
updateSchema,
updateBookingStatusSchema,
};
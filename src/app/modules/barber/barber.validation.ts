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

const getAllSaloons = z.object({
  query: z.object({
    page: z.coerce
      .number({
        message: 'Page  should be a number',
      })
      .transform(val => Number(val)),
    limit: z.coerce
      .number({
        message: 'Limit  should be a number',
      })
      .transform(val => Number(val)),
    searchTerm: z.string({
      message: 'Searchterm is required!',
      invalid_type_error: 'Searchterm should be string!',
    }),
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
  getAllSaloons,
};

export type TGetAllSaloonsType = z.infer<typeof getAllSaloons.shape.query>;

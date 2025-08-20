import { BookingStatus } from '@prisma/client';
import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    bookingId: z.string({
      required_error: 'Booking ID is required!',
    }),
    status: z.nativeEnum(BookingStatus),
  }),
});

const updateSchema = z.object({
  body: z.object({
    bookingId: z.string({
      required_error: 'Booking ID is required!',
    }),
    status: z.nativeEnum(BookingStatus),
  }),
});

export const saloonValidation = {
  createSchema,
  updateSchema,
};

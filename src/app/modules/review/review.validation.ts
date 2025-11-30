import { z } from 'zod';

const createReviewSchema = z.object({
  body: z.object({
    barberId: z.string().min(1, 'Barber ID is required'),
    saloonOwnerId: z.string().min(1, 'Saloon Owner ID is required'),
    bookingId: z.string().min(1, 'Booking ID is required'),
    rating: z.preprocess(
      val => {
        if (typeof val === 'number') return Math.round(val);
        if (typeof val === 'string' && val.trim() !== '')
          return Math.round(Number(val));
        return val;
      },
      z
        .number()
        .int()
        .min(1, 'Rating must be at least 1')
        .max(5, 'Rating cannot exceed 5'),
    ),
    comment: z.string().optional(),
  }),
});

const updateReviewSchema = z.object({
  body: z.object({
    rating: z.preprocess(
      val => {
        if (typeof val === 'number') return Math.round(val);
        if (typeof val === 'string' && val.trim() !== '')
          return Math.round(Number(val));
        return val;
      },
      z
        .number()
        .int()
        .min(1, 'Rating must be at least 1')
        .max(5, 'Rating cannot exceed 5'),
    ),
    comment: z.string().optional(),
  }),
});

export const reviewValidation = {
  createReviewSchema,
  updateReviewSchema,
};

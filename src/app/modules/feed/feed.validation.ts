import { z } from 'zod';

const createFeedSchema = z.object({
  body: z.object({
    // userId: z.string({
    //   required_error: 'User ID is required!',
    // }),
    // SaloonOwnerId: z.string().optional(),
    caption: z.string({
      required_error: 'Caption is required!',
    }),
    images: z
      .array(z.string(), {
        invalid_type_error: 'Images must be an array of strings!',
      })
      .min(1, 'At least one image is required!'),
    //   favoriteCount: z
    //     .number()
    //     .int()
    //     .nonnegative()
    //     .default(0)
    //     .optional(),
  }),
});
const updateFeedSchema = z.object({
  body: z.object({
    caption: z.string().optional(),
    images: z
      .array(z.string(), {
        invalid_type_error: 'Images must be an array of strings!',
      })
      .optional(),
    // favoriteCount: z
    //   .number()
    //   .int()
    //   .nonnegative()
    //   .optional(),
  }),
});

export const feedValidation = {
  createFeedSchema,
  updateFeedSchema,
};

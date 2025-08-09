import { z } from 'zod';

const createAdsSchema = z.object({
  body: z.object({
    startDate: z
      .string({
        required_error: 'Start date is required!',
      })
      .datetime({ message: 'Start date must be a valid ISO date string!' }),
    endDate: z
      .string({
        required_error: 'End date is required!',
      })
      .datetime({ message: 'End date must be a valid ISO date string!' }),
    description: z.string({
      required_error: 'Description is required!',
    }),
    images: z
      .array(z.string(), {
        invalid_type_error: 'Images must be an array of strings!',
      })
      .min(1, 'At least one image is required!'),
    duration: z.string({
      required_error: 'Duration is required!',
    }),
  }),
});
const updateAdsSchema = z.object({
  body: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    description: z.string().optional(),
    images: z
      .array(z.string(), {
        invalid_type_error: 'Images must be an array of strings!',
      })
      .optional(),
    duration: z.string().optional(),
  }),
});
export const adsValidation = {
  createAdsSchema,
  updateAdsSchema,
};
import { z } from 'zod';

const createAdsSchema = z.object({
  body: z.object({
    startDate: z
      .string({
        required_error: 'Start date is required!',
      }),
    endDate: z
      .string({
        required_error: 'End date is required!',
      }),
    description: z.string({
      required_error: 'Description is required!',
    }),
    // duration: z.string({
    //   required_error: 'Duration is required!',
    // }),
  }),
});
const updateAdsSchema = z.object({
  body: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    description: z.string().optional(),
    existingImages: z.array(z.string()).optional() // Array of strings
  }),
});


export const adsValidation = {
  createAdsSchema,
  updateAdsSchema,
};
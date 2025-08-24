import { SubscriptionType } from '@prisma/client';
import { z } from 'zod';

const createSubscriptionOfferSchema = z.object({
  body: z.object({
    title: z.string({
      required_error: 'Title is required!',
    }),
    description: z.string().optional(),
    price: z.number({
      required_error: 'Price is required!',
      invalid_type_error: 'Price must be a number!',
    }),
    currency: z.string().optional().default('usd'),
    duration: z.nativeEnum(SubscriptionType, {
      required_error: 'Duration is required!',
      invalid_type_error: 'Duration must be a valid enum value!', 
    }),
  }),
});

const updateSubscriptionOfferSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    // duration: z.nativeEnum(SubscriptionType, {
    //   required_error: 'Duration is required!',
    //   invalid_type_error: 'Duration must be a valid enum value!', 
    // }).optional(),
  }),
});
export const subscriptionOfferValidation = {
  createSubscriptionOfferSchema,
  updateSubscriptionOfferSchema,
};
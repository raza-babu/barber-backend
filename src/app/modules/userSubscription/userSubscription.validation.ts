import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    paymentMethodId: z.string({
      required_error: 'Payment Method Id is required!',
    }),
    subscriptionOfferId: z.string({
      required_error: 'Subscription Offer Id is required!',
    }),
  }),
});

const updateSchema = z.object({
  body: z.object({
    paymentMethodId: z.string({
      required_error: 'Payment Method Id is required!',
    }),
    subscriptionOfferId: z.string({
      required_error: 'Subscription Offer Id is required!',
    }),
  }),
});

export const userSubscriptionValidation = {
  createSchema,
  updateSchema,
};

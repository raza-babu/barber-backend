import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    productId: z.string({
      required_error: 'Product ID is required!',
    }),
    subscriptionOfferId: z.string({
      required_error: 'Subscription Offer ID is required!',
    }),
    receiptData: z.string({
      required_error: 'Receipt Data is required!',
    }),
  }),
});

const updateSchema = z.object({
  body: z.object({
    productId: z.string({
      required_error: 'Product ID is required!',
    }),
    subscriptionOfferId: z.string({
      required_error: 'Subscription Offer ID is required!',
    }),
    receiptData: z.string({
      required_error: 'Receipt Data is required!',
    }),
  }),
});

const verifyAppleReceiptSchema = z.object({
  body: z.object({
    receiptData: z.string({
      required_error: 'Receipt Data is required!',
    }),
    productId: z.string({
      required_error: 'Product ID is required!',
    }),
  }),
});

export const userSubscriptionValidation = {
  createSchema,
  updateSchema,
  verifyAppleReceiptSchema,
};

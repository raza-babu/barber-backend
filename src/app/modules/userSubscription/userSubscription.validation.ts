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

// ===== Google Play IAP Schemas =====

const verifyGooglePlayPurchaseSchema = z.object({
  body: z.object({
    packageName: z.string({
      required_error: 'Package name is required!',
    }),
    purchaseToken: z.string({
      required_error: 'Purchase token is required!',
    }),
    subscriptionId: z.string({
      required_error: 'Subscription ID is required!',
    }),
    productId: z.string({
      required_error: 'Product ID is required!',
    }),
    platform: z.string({
      required_error: 'Platform is required!',
    }),
  }),
});

const createGooglePaySubscriptionSchema = z.object({
  body: z.object({
    packageName: z.string({
      required_error: 'Package name is required!',
    }).default('com.barberstime.barber_time_app'),
    purchaseToken: z.string({
      required_error: 'Purchase token is required!',
    }),
    subscriptionId: z.string({
      required_error: 'Subscription ID is required!',
      // Format: com.barberstime.barber_time_app.monthly, etc
    }),
    subscriptionOfferId: z.string({
      required_error: 'Subscription Offer ID is required!',
    }),
    productId: z.string({
      required_error: 'Product ID is required!',
      // Plan type: silver, gold, diamond
    }),
    platform: z.string({
      required_error: 'Platform is required!',
    }).default('android'),
  }),
});

const checkGoogleSubscriptionStatusSchema = z.object({
  body: z.object({
    packageName: z.string({
      required_error: 'Package name is required!',
    }).default('com.barberstime.barber_time_app'),
    purchaseToken: z.string({
      required_error: 'Purchase token is required!',
    }),
    subscriptionId: z.string({
      required_error: 'Subscription ID is required!',
    }),
  }),
});

export const userSubscriptionValidation = {
  createSchema,
  updateSchema,
  verifyAppleReceiptSchema,
  verifyGooglePlayPurchaseSchema,
  createGooglePaySubscriptionSchema,
  checkGoogleSubscriptionStatusSchema,
};

import { z } from 'zod';

// Zod schemas
const AddressSchema = z.object({
  city: z.string({ required_error: 'City is required' }),
  postal_code: z.string({ required_error: 'Postal Code is required' }),
  country: z.string({ required_error: 'Country is required' }),
});

const UserSchema = z.object({
  name: z.string({ required_error: 'Name is required' }),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format'),
});

export const TStripeSaveWithCustomerInfoPayloadSchema = z.object({
  body: z.object({
    paymentMethodId: z.string({
      required_error: 'Payment Method ID is required',
    }),
  }),
});

export const AuthorizedPaymentPayloadSchema = z.object({
  // customerId: z.string({ required_error: 'Customer ID is required' }),
  // amount: z.number({ required_error: 'Amount is required' }),
  body: z.object({
    paymentMethodId: z.string({
      required_error: 'Payment Method ID is required',
    }),
    bookingId: z.string({ required_error: 'Parcel ID is required' }),
  }),
});

export const capturedPaymentPayloadSchema = z.object({
  body: z.object({
    bookingId: z.string({ required_error: 'booking ID is required' }),
    status: z.enum(['CANCELLED', 'COMPLETED'], {
      required_error: 'Status is required',
    }),
  }),
});

export const saveNewCardWithExistingCustomerPayloadSchema = z.object({
  body: z.object({
    customerId: z.string({ required_error: 'Customer ID is required' }),
    paymentMethodId: z.string({
      required_error: 'Payment Method ID is required',
    }),
  }),
});

export const refundPaymentPayloadSchema = z.object({
  paymentIntentId: z.string({
    required_error: 'Payment Intent ID is required',
  }),
});

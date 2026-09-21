import { z } from 'zod';
import { DiscountType } from '@prisma/client';

const createDiscountOfferSchema = z.object({
  body: z
    .object({
      name: z
        .string({ required_error: 'Offer name is required' })
        .min(1, 'Name cannot be empty'),
      description: z.string().optional(),
      code: z.string().trim().toUpperCase().optional(),
      discountType: z.nativeEnum(DiscountType, {
        required_error: 'Discount type is required (PERCENTAGE or FIXED)',
      }),
      discountValue: z
        .number({ required_error: 'Discount value is required' })
        .positive('Discount value must be greater than zero'),
      maxDiscountAmount: z.number().positive().optional().nullable(),
      minBookingAmount: z.number().nonnegative().optional().default(0),
      startDate: z.string({ required_error: 'Start date is required' }),
      endDate: z.string({ required_error: 'End date is required' }),
      isActive: z.boolean().optional().default(true),
      usageLimit: z.number().int().positive().optional().nullable(),
      perUserLimit: z.number().int().positive().optional().default(1),
    })
    .refine(
      data => {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return end >= start;
      },
      {
        message: 'End date must be greater than or equal to start date',
        path: ['endDate'],
      },
    )
    .refine(
      data => {
        if (data.discountType === DiscountType.PERCENTAGE) {
          return data.discountValue > 0 && data.discountValue <= 100;
        }
        return true;
      },
      {
        message: 'Percentage discount value must be between 1 and 100',
        path: ['discountValue'],
      },
    ),
});

const updateDiscountOfferSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      code: z.string().trim().toUpperCase().optional().nullable(),
      discountType: z.nativeEnum(DiscountType).optional(),
      discountValue: z.number().positive().optional(),
      maxDiscountAmount: z.number().positive().optional().nullable(),
      minBookingAmount: z.number().nonnegative().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isActive: z.boolean().optional(),
      usageLimit: z.number().int().positive().optional().nullable(),
      perUserLimit: z.number().int().positive().optional(),
    })
    .refine(
      data => {
        if (data.startDate && data.endDate) {
          return new Date(data.endDate) >= new Date(data.startDate);
        }
        return true;
      },
      {
        message: 'End date must be greater than or equal to start date',
        path: ['endDate'],
      },
    )
    .refine(
      data => {
        if (
          data.discountType === DiscountType.PERCENTAGE &&
          data.discountValue !== undefined
        ) {
          return data.discountValue > 0 && data.discountValue <= 100;
        }
        return true;
      },
      {
        message: 'Percentage discount value must be between 1 and 100',
        path: ['discountValue'],
      },
    ),
});

const validateDiscountOfferSchema = z.object({
  body: z
    .object({
      saloonOwnerId: z.string({ required_error: 'Salon owner ID is required' }),
      discountOfferId: z.string().optional(),
      code: z.string().optional(),
      subtotal: z
        .number({ required_error: 'Subtotal is required' })
        .nonnegative(),
    })
    .refine(data => !!data.discountOfferId || !!data.code, {
      message: 'Either discountOfferId or code must be provided',
      path: ['discountOfferId'],
    }),
});

export const salonDiscountOfferValidation = {
  createDiscountOfferSchema,
  updateDiscountOfferSchema,
  validateDiscountOfferSchema,
};

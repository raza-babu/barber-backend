import { QRCodeType } from '@prisma/client';
import { z } from 'zod';

const createQrCodeSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(1, 'QR Code is required')
      .regex(
        /^[a-f0-9]{24}-[a-z0-9]+@[a-z0-9-]+\.[a-z]{2,}-\d{13}$/i,
        'QR Code must match format: <24hex>-<alnum>@<domain>-<timestamp13>',
      ),
    metadata: z.record(z.any()).optional(), // JSON field
  }),
});

const updateQrCodeSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(1, 'QR Code is required')
      .regex(
        /^[a-f0-9]{24}-[a-z0-9]+@[a-z0-9-]+\.[a-z]{2,}-\d{13}$/i,
        'QR Code must match format: <24hex>-<alnum>@<domain>-<timestamp13>',
      )
      .optional(),
    metadata: z.record(z.any()).optional(), // JSON field
  }),
});

export const qrCodeValidation = {
  createQrCodeSchema,
  updateQrCodeSchema,
};

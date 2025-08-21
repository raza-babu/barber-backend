import { QRCodeType } from '@prisma/client';
import { z } from 'zod';

const createQrCodeSchema = z.object({
  body: z.object({
    code: z.string().min(1, "QR Code is required"),
    metadata: z.record(z.any()).optional(), // JSON field
  }),
});

const updateQrCodeSchema = z.object({
  body: z.object({
    code: z.string().min(1, "QR Code is required").optional(),
    metadata: z.record(z.any()).optional(), // JSON field
    }),
});

export const qrCodeValidation = {
createQrCodeSchema,
updateQrCodeSchema,
};
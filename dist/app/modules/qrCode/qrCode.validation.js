"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qrCodeValidation = void 0;
const zod_1 = require("zod");
const createQrCodeSchema = zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z
            .string()
            .min(1, 'QR Code is required')
            .regex(/^[a-f0-9]{24}-[a-z0-9]+@[a-z0-9-]+\.[a-z]{2,}-\d{13}$/i, 'QR Code must match format: <24hex>-<alnum>@<domain>-<timestamp13>'),
        metadata: zod_1.z.record(zod_1.z.any()).optional(), // JSON field
    }),
});
const updateQrCodeSchema = zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z
            .string()
            .min(1, 'QR Code is required')
            .regex(/^[a-f0-9]{24}-[a-z0-9]+@[a-z0-9-]+\.[a-z]{2,}-\d{13}$/i, 'QR Code must match format: <24hex>-<alnum>@<domain>-<timestamp13>')
            .optional(),
        metadata: zod_1.z.record(zod_1.z.any()).optional(), // JSON field
    }),
});
exports.qrCodeValidation = {
    createQrCodeSchema,
    updateQrCodeSchema,
};

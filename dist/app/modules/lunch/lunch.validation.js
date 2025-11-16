"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lunchValidation = void 0;
const zod_1 = require("zod");
const createLunchSchema = zod_1.z.object({
    body: zod_1.z.object({
        // barberId: z.string().min(1, 'Barber ID is required'),
        // date: z.string().min(1, 'Date is required'), // e.g., "2025-08-20"
        startTime: zod_1.z.string()
            .min(1, 'Start time is required')
            .regex(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'Start time must be in "hh:mm AM/PM" format'), // e.g., "01:00 PM"
        endTime: zod_1.z.string()
            .min(1, 'End time is required')
            .regex(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'End time must be in "hh:mm AM/PM" format'), // e.g., "02:00 PM"
        status: zod_1.z.boolean().optional().default(true),
    }),
});
const updateLunchSchema = zod_1.z.object({
    body: zod_1.z.object({
        // date: z.string().min(1, 'Date is required'), // e.g., "2025-08-20"
        startTime: zod_1.z.string()
            .min(1, 'Start time is required')
            .regex(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'Start time must be in "hh:mm AM/PM" format'), // e.g., "01:00 PM"
        endTime: zod_1.z.string()
            .min(1, 'End time is required')
            .regex(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'End time must be in "hh:mm AM/PM" format'), // e.g., "02:00 PM"
        status: zod_1.z.boolean().optional().default(true),
    }),
});
exports.lunchValidation = {
    createLunchSchema,
    updateLunchSchema,
};

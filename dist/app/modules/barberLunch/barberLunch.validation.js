"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.barberLunchValidation = void 0;
const zod_1 = require("zod");
const createBarberLunchSchema = zod_1.z.object({
    body: zod_1.z.object({
        barberId: zod_1.z.string().min(1, 'Barber ID is required'),
        date: zod_1.z.string().min(1, 'Date is required'), // e.g., "2025-08-20"
        startTime: zod_1.z.string().min(1, 'Start time is required'), // e.g., "12:00 PM"
        endTime: zod_1.z.string().min(1, 'End time is required') // e.g., "01:00 PM"
    }),
});
const updateBarberLunchSchema = zod_1.z.object({
    body: zod_1.z.object({
        barberId: zod_1.z.string().optional(),
        date: zod_1.z.string().optional(), // e.g., "2025-08-20"
        startTime: zod_1.z.string().optional(), // e.g., "12:00 PM"
        endTime: zod_1.z.string().optional(), // e.g., "01:00 PM"
    }),
});
exports.barberLunchValidation = {
    createBarberLunchSchema,
    updateBarberLunchSchema,
};

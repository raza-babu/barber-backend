"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.barberHolidayValidation = exports.barberDayOffSchema = void 0;
const zod_1 = require("zod");
exports.barberDayOffSchema = zod_1.z.object({
    barberId: zod_1.z
        .string({ required_error: 'Barber ID is required' })
        .min(1, 'Barber ID cannot be empty'),
    date: zod_1.z
        .string({ required_error: 'Date is required' })
        .refine(val => {
        const parsed = Date.parse(val);
        return !isNaN(parsed) && new Date(val).toISOString() === new Date(parsed).toISOString();
    }, 'Invalid date format')
        .transform(val => new Date(val).toISOString()),
    reason: zod_1.z
        .string()
        .max(255, 'Reason cannot exceed 255 characters')
        .optional(),
    isAllDay: zod_1.z.boolean().optional().default(true),
});
const createBarberDayOffSchema = zod_1.z.object({
    body: exports.barberDayOffSchema,
});
const updateBarberDayOffSchema = zod_1.z.object({
    body: exports.barberDayOffSchema.partial(),
});
exports.barberHolidayValidation = {
    createBarberDayOffSchema,
    updateBarberDayOffSchema,
};

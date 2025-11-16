"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nonRegisteredBookingValidation = void 0;
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().min(1, 'Full name is required'),
        email: zod_1.z.string().email('Invalid email format'),
        phoneNumber: zod_1.z.string().min(1, 'Phone number is required').optional(),
        notes: zod_1.z.string().optional(),
        barberId: zod_1.z.string().min(1, 'Barber ID is required'),
        appointmentAt: zod_1.z.string().min(1, 'Appointment date-time is required'),
        date: zod_1.z.string().min(1, 'Date is required'),
        services: zod_1.z.array(zod_1.z.string()).min(1, 'At least one service is required'),
        isInQueue: zod_1.z.boolean().optional(),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().optional(),
        email: zod_1.z.string().email('Invalid email format').optional(),
        phoneNumber: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        appointmentAt: zod_1.z.string().optional(),
        date: zod_1.z.string().optional(),
        services: zod_1.z.array(zod_1.z.string()).optional(),
        isInQueue: zod_1.z.boolean().optional(),
    }),
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Booking ID is required'), // ID of the booking to update
    }),
});
exports.nonRegisteredBookingValidation = {
    createSchema,
    updateSchema,
};

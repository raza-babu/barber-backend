"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingValidation = void 0;
const zod_1 = require("zod");
const createBookingSchema = zod_1.z.object({
    body: zod_1.z.object({
        barberId: zod_1.z.string().min(1, 'Barber ID is required').optional(),
        saloonOwnerId: zod_1.z.string().min(1, 'Saloon Owner ID is required'),
        appointmentAt: zod_1.z
            .string()
            .min(1, 'Appointment date-time is required')
            .optional(), // e.g., "2025-08-20T11:00:00"
        date: zod_1.z.string().min(1, 'Date is required'), // e.g., "2025-08-20"
        services: zod_1.z.array(zod_1.z.string()).min(1, 'At least one service is required'),
        // totalPrice: z.number({ required_error: 'Total price is required' }),
        notes: zod_1.z.string().optional(),
        loyaltySchemeId: zod_1.z.string().optional(),
        isInQueue: zod_1.z.boolean().optional(),
        bookingType: zod_1.z.enum(['BOOKING', 'QUEUE'], {
            required_error: 'Booking type is required',
        }),
        fullName: zod_1.z.string().min(1, 'Full name is required').optional(),
        email: zod_1.z.string().email('Invalid email address').optional(),
        phone: zod_1.z.string().min(1, 'Phone number is required').optional(),
    }),
});
const updateBookingSchema = zod_1.z.object({
    body: zod_1.z.object({
        appointmentAt: zod_1.z.string().optional(), // e.g., "2025-08-20T11:00:00"
        date: zod_1.z.string().optional(), // e.g., "2025-08-20"
        startDateTime: zod_1.z.string().optional(), // e.g., "2025-08-20T11:00:00"
        endDateTime: zod_1.z.string().optional(), // e.g., "2025-08-20T11:30:00"
        startTime: zod_1.z.string().optional(), // e.g., "11:00 AM"
        endTime: zod_1.z.string().optional(), // e.g., "11:30 AM"
        totalPrice: zod_1.z.number().optional(),
        notes: zod_1.z.string().optional(),
        isInQueue: zod_1.z.boolean().optional(),
        barberName: zod_1.z.string().optional(),
        barberImage: zod_1.z.string().optional(),
        loyaltySchemeId: zod_1.z.string().optional(),
        bookingType: zod_1.z
            .enum(['BOOKING', 'QUEUE'], {
            required_error: 'Booking type is required',
        })
            .optional(),
    }),
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Booking ID is required').optional(), // ID of the booking to update
    }),
});
const updateBookingStatusSchema = zod_1.z.object({
    body: zod_1.z.object({
        bookingId: zod_1.z.string().min(1, 'Booking ID is required'),
        status: zod_1.z.enum(['PENDING', 'CONFIRMED', 'RESCHEDULED'], {
            required_error: 'Status is required',
        }),
    }),
});
function convertToUTC(date, time) {
    // Combine into a single string
    const combined = `${date} ${time}`;
    // Parse as local time (system’s local timezone)
    const localDate = new Date(combined);
    if (isNaN(localDate.getTime())) {
        throw new Error('Invalid date or time format');
    }
    // Convert to UTC string (ISO)
    return localDate.toISOString();
}
const availableBarbersSchema = zod_1.z.object({
    query: zod_1.z
        .object({
        saloonOwnerId: zod_1.z.string().min(1),
        date: zod_1.z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: zod_1.z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, {
            message: 'Time must be in hh:mm AM/PM format',
        }),
        totalServiceTime: zod_1.z.coerce.number().int().positive(),
        type: zod_1.z
            .enum(['BOOKING', 'QUEUE'], {
            required_error: 'Booking type is required',
        })
            .optional(),
    })
        .transform(({ saloonOwnerId, date, time, totalServiceTime, type }) => ({
        saloonOwnerId,
        utcDateTime: convertToUTC(date, time),
        date,
        totalServiceTime,
        type,
    })),
});
const walkingInBarbersSchema = zod_1.z.object({
    body: zod_1.z.object({
        saloonOwnerId: zod_1.z.string().min(1),
        date: zod_1.z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
});
exports.bookingValidation = {
    createBookingSchema,
    updateBookingSchema,
    updateBookingStatusSchema,
    availableBarbersSchema,
    walkingInBarbersSchema,
};

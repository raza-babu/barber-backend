"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingValidation = void 0;
const zod_1 = require("zod");
const createBookingSchema = zod_1.z.object({
    body: zod_1.z.object({
        barberId: zod_1.z.string().min(1, 'Barber ID is required'),
        saloonOwnerId: zod_1.z.string().min(1, 'Saloon Owner ID is required'),
        appointmentAt: zod_1.z.string().min(1, 'Appointment date-time is required'), // e.g., "2025-08-20T11:00:00"
        date: zod_1.z.string().min(1, 'Date is required'), // e.g., "2025-08-20"
        services: zod_1.z.array(zod_1.z.string()).min(1, 'At least one service is required'),
        // totalPrice: z.number({ required_error: 'Total price is required' }),
        notes: zod_1.z.string().optional(),
        isInQueue: zod_1.z.boolean().optional(),
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
    }),
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Booking ID is required').optional(), // ID of the booking to update
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
    query: zod_1.z.object({
        salonId: zod_1.z.string().min(1),
        date: zod_1.z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: zod_1.z.coerce.string().regex(/^\d{1,2}:\d{2}(\s?(AM|PM))?$/),
        totalServiceTime: zod_1.z.coerce.number().int().positive(),
    }).transform(({ salonId, date, time, totalServiceTime }) => ({
        salonId,
        utcDateTime: convertToUTC(date, time),
        totalServiceTime,
    })),
});
exports.bookingValidation = {
    createBookingSchema,
    updateBookingSchema,
    availableBarbersSchema,
};

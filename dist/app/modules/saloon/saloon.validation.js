"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saloonValidation = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        bookingId: zod_1.z.string({
            required_error: 'Booking ID is required!',
        }),
        status: zod_1.z.nativeEnum(client_1.BookingStatus),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        bookingId: zod_1.z.string({
            required_error: 'Booking ID is required!',
        }),
        status: zod_1.z.nativeEnum(client_1.BookingStatus),
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
        date: zod_1.z.string({
            required_error: 'Date is required!',
        }),
        time: zod_1.z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, {
            message: 'Time must be in hh:mm AM/PM format',
        }),
        // totalServiceTime: z.coerce.number().int().positive(),
    }).transform(({ date, time }) => ({
        // salonId,
        utcDateTime: convertToUTC(date, time),
        // totalServiceTime,
    })),
});
const availableFreeBarbersSchema = zod_1.z.object({
    query: zod_1.z.object({
        date: zod_1.z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).transform(({ date }) => ({
        utcDateTime: new Date(date).toISOString(),
    })),
});
exports.saloonValidation = {
    createSchema,
    updateSchema,
    availableBarbersSchema,
    availableFreeBarbersSchema
};

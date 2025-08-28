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
        // salonId: z.string().min(1),
        date: zod_1.z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: zod_1.z.coerce.string().regex(/^\d{1,2}:\d{2}(\s?(AM|PM))?$/),
        // totalServiceTime: z.coerce.number().int().positive(),
    }).transform(({ date, time }) => ({
        // salonId,
        utcDateTime: convertToUTC(date, time),
        // totalServiceTime,
    })),
});
exports.saloonValidation = {
    createSchema,
    updateSchema,
    availableBarbersSchema,
};

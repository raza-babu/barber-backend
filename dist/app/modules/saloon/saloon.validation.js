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
exports.saloonValidation = {
    createSchema,
    updateSchema,
};

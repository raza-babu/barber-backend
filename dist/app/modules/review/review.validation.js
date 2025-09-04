"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewValidation = void 0;
const zod_1 = require("zod");
const createReviewSchema = zod_1.z.object({
    body: zod_1.z.object({
        barberId: zod_1.z.string().min(1, 'Barber ID is required'),
        saloonOwnerId: zod_1.z.string().min(1, 'Saloon Owner ID is required'),
        bookingId: zod_1.z.string().min(1, 'Booking ID is required'),
        rating: zod_1.z
            .number()
            .int()
            .min(1, 'Rating must be at least 1')
            .max(5, 'Rating cannot exceed 5'),
        comment: zod_1.z.string().optional(),
    }),
});
const updateReviewSchema = zod_1.z.object({
    body: zod_1.z.object({
        rating: zod_1.z
            .number()
            .int()
            .min(1, 'Rating must be at least 1')
            .max(5, 'Rating cannot exceed 5')
            .optional(),
        comment: zod_1.z.string().optional(),
    }),
});
exports.reviewValidation = {
    createReviewSchema,
    updateReviewSchema,
};

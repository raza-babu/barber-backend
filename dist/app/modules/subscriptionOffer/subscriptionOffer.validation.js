"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionOfferValidation = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const createSubscriptionOfferSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({
            required_error: 'Title is required!',
        }),
        description: zod_1.z.string().optional(),
        price: zod_1.z.number({
            required_error: 'Price is required!',
            invalid_type_error: 'Price must be a number!',
        }),
        currency: zod_1.z.string().optional().default('usd'),
        duration: zod_1.z.nativeEnum(client_1.SubscriptionType, {
            required_error: 'Duration is required!',
            invalid_type_error: 'Duration must be a valid enum value!',
        }),
    }),
});
const updateSubscriptionOfferSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        price: zod_1.z.number().optional(),
        currency: zod_1.z.string().optional(),
        duration: zod_1.z.nativeEnum(client_1.SubscriptionType, {
            required_error: 'Duration is required!',
            invalid_type_error: 'Duration must be a valid enum value!',
        }).optional(),
    }),
});
exports.subscriptionOfferValidation = {
    createSubscriptionOfferSchema,
    updateSubscriptionOfferSchema,
};

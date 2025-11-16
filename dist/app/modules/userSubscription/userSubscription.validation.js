"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userSubscriptionValidation = void 0;
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        paymentMethodId: zod_1.z.string({
            required_error: 'Payment Method Id is required!',
        }),
        subscriptionOfferId: zod_1.z.string({
            required_error: 'Subscription Offer Id is required!',
        }),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        paymentMethodId: zod_1.z.string({
            required_error: 'Payment Method Id is required!',
        }),
        subscriptionOfferId: zod_1.z.string({
            required_error: 'Subscription Offer Id is required!',
        }),
    }),
});
exports.userSubscriptionValidation = {
    createSchema,
    updateSchema,
};

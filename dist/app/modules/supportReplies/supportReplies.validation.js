"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportRepliesValidation = void 0;
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        subject: zod_1.z.string().optional(),
        type: zod_1.z.enum(['CUSTOMER_QUESTION', 'CUSTOMER_COMPLAINT'], {
            required_error: 'Type is required!',
        }),
        saloonOwnerId: zod_1.z.string().optional(),
        message: zod_1.z.string().optional(),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        subject: zod_1.z.string().optional(),
        type: zod_1.z.enum(['CUSTOMER_QUESTION', 'CUSTOMER_COMPLAINT'], {
            required_error: 'Type is required!',
        }).optional(),
        saloonOwnerId: zod_1.z.string().optional(),
        message: zod_1.z.string().optional(),
    }),
});
exports.supportRepliesValidation = {
    createSchema,
    updateSchema,
};

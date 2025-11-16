"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loyaltyProgramValidation = void 0;
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        serviceId: zod_1.z.string().min(1, 'Service ID is required'),
        points: zod_1.z.number().min(1, 'Points must be at least 1'),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        serviceId: zod_1.z.string().min(1, 'Service ID is required').optional(),
        points: zod_1.z.number().min(1, 'Points must be at least 1').optional(),
    }),
});
exports.loyaltyProgramValidation = {
    createSchema,
    updateSchema,
};

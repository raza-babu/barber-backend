"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueCapacityValidation = void 0;
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        barberId: zod_1.z.string().min(1, 'barberId is required'),
        maxCapacity: zod_1.z.number().min(1, 'Minimum capacity must be at least 1'),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        barberId: zod_1.z.string().min(1, 'barberId is required').optional(),
        maxCapacity: zod_1.z
            .number()
            .min(1, 'Minimum capacity must be at least 1')
            .optional(),
    }),
});
exports.queueCapacityValidation = {
    createSchema,
    updateSchema,
};

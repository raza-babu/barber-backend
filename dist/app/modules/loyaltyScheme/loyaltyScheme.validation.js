"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loyaltySchemeValidation = void 0;
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        pointThreshold: zod_1.z.number().min(1, 'Point threshold must be at least 1'),
        percentage: zod_1.z.number().min(1, 'Percentage must be at least 1').max(100, 'Percentage cannot exceed 100'),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        pointThreshold: zod_1.z.number().min(1, 'Point threshold must be at least 1').optional(),
        percentage: zod_1.z.number().min(1, 'Percentage must be at least 1').max(100, 'Percentage cannot exceed 100').optional(),
    }),
});
exports.loyaltySchemeValidation = {
    createSchema,
    updateSchema,
};

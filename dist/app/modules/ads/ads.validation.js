"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adsValidation = void 0;
const zod_1 = require("zod");
const createAdsSchema = zod_1.z.object({
    body: zod_1.z.object({
        startDate: zod_1.z
            .string({
            required_error: 'Start date is required!',
        }),
        endDate: zod_1.z
            .string({
            required_error: 'End date is required!',
        }),
        description: zod_1.z.string({
            required_error: 'Description is required!',
        }),
        duration: zod_1.z.string({
            required_error: 'Duration is required!',
        }),
    }),
});
const updateAdsSchema = zod_1.z.object({
    body: zod_1.z.object({
        startDate: zod_1.z.string().optional(),
        endDate: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        duration: zod_1.z.string().optional(),
    }),
});
exports.adsValidation = {
    createAdsSchema,
    updateAdsSchema,
};

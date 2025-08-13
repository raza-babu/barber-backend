"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adsValidation = void 0;
const zod_1 = require("zod");
const createAdsSchema = zod_1.z.object({
    body: zod_1.z.object({
        startDate: zod_1.z
            .string({
            required_error: 'Start date is required!',
        })
            .datetime({ message: 'Start date must be a valid ISO date string!' }),
        endDate: zod_1.z
            .string({
            required_error: 'End date is required!',
        })
            .datetime({ message: 'End date must be a valid ISO date string!' }),
        description: zod_1.z.string({
            required_error: 'Description is required!',
        }),
        images: zod_1.z
            .array(zod_1.z.string(), {
            invalid_type_error: 'Images must be an array of strings!',
        })
            .min(1, 'At least one image is required!'),
        duration: zod_1.z.string({
            required_error: 'Duration is required!',
        }),
    }),
});
const updateAdsSchema = zod_1.z.object({
    body: zod_1.z.object({
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional(),
        description: zod_1.z.string().optional(),
        images: zod_1.z
            .array(zod_1.z.string(), {
            invalid_type_error: 'Images must be an array of strings!',
        })
            .optional(),
        duration: zod_1.z.string().optional(),
    }),
});
exports.adsValidation = {
    createAdsSchema,
    updateAdsSchema,
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedValidation = void 0;
const zod_1 = require("zod");
const createFeedSchema = zod_1.z.object({
    body: zod_1.z.object({
        // userId: z.string({
        //   required_error: 'User ID is required!',
        // }),
        // SaloonOwnerId: z.string().optional(),
        caption: zod_1.z.string({
            required_error: 'Caption is required!',
        }),
        // images: z
        //   .array(z.string(), {
        //     invalid_type_error: 'Images must be an array of strings!',
        //   })
        //   .min(1, 'At least one image is required!'),
        //   favoriteCount: z
        //     .number()
        //     .int()
        //     .nonnegative()
        //     .default(0)
        //     .optional(),
    }),
});
const updateFeedSchema = zod_1.z.object({
    body: zod_1.z.object({
        caption: zod_1.z.string().optional(),
        // images: z
        //   .array(z.string(), {
        //     invalid_type_error: 'Images must be an array of strings!',
        //   })
        //   .optional(),
        // favoriteCount: z
        //   .number()
        //   .int()
        //   .nonnegative()
        //   .optional(),
    }),
});
exports.feedValidation = {
    createFeedSchema,
    updateFeedSchema,
};

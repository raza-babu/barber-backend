"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.termAndConditionValidation = void 0;
const zod_1 = require("zod");
const createTermAndConditionSchema = zod_1.z.object({
    body: zod_1.z.object({
        heading: zod_1.z.string({
            required_error: 'Heading is required!',
        }),
        content: zod_1.z.string({
            required_error: 'Content is required!',
        }),
    }),
});
const updateTermAndConditionSchema = zod_1.z.object({
    body: zod_1.z.object({
        heading: zod_1.z.string().optional(),
        content: zod_1.z.string().optional(),
    }),
});
exports.termAndConditionValidation = {
    createTermAndConditionSchema,
    updateTermAndConditionSchema,
};

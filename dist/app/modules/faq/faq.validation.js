"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.faqValidation = void 0;
const zod_1 = require("zod");
const createFaqSchema = zod_1.z.object({
    body: zod_1.z.object({
        question: zod_1.z.string({
            required_error: 'Question is required!',
        }),
        answer: zod_1.z.string({
            required_error: 'Answer is required!',
        }),
    }),
});
const updateFaqSchema = zod_1.z.object({
    body: zod_1.z.object({
        question: zod_1.z.string().optional(),
        answer: zod_1.z.string().optional(),
    }),
});
exports.faqValidation = {
    createFaqSchema,
    updateFaqSchema,
};

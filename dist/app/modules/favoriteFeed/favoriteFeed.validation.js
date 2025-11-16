"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.favoriteFeedValidation = void 0;
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        feedId: zod_1.z.string({
            required_error: 'Feed ID is required!',
        }),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
    // name: z.string().optional(),
    // description: z.string().optional(),
    }),
});
exports.favoriteFeedValidation = {
    createSchema,
    updateSchema,
};

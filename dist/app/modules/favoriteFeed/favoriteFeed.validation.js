"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.favoriteFeedValidation = void 0;
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Name is required'),
        description: zod_1.z.string().optional(),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
    }),
});
exports.favoriteFeedValidation = {
    createSchema,
    updateSchema,
};

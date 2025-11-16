"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminValidation = void 0;
const zod_1 = require("zod");
const blockSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.boolean(),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
    }),
});
exports.adminValidation = {
    blockSchema,
    updateSchema,
};

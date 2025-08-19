"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessFunctionValidation = void 0;
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        function: zod_1.z.string().optional(),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        function: zod_1.z.string().optional(),
    }),
});
exports.accessFunctionValidation = {
    createSchema,
    updateSchema,
};

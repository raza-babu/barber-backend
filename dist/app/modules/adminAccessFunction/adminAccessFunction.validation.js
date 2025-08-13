"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAccessFunctionValidation = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string({
            required_error: 'Full Name is required!',
        }),
        email: zod_1.z
            .string({
            required_error: 'Email is required!',
        })
            .email('Invalid email format!'),
        password: zod_1.z
            .string({
            required_error: 'Password is required!',
        })
            .min(8, 'Password must be at least 8 characters long!'),
        role: zod_1.z.nativeEnum(client_1.UserRoleEnum, {
            required_error: 'Role is required!',
        }),
        isSuperAdmin: zod_1.z.boolean().optional(),
        function: zod_1.z.array(zod_1.z.string()),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        adminId: zod_1.z.string().optional(),
        role: zod_1.z.nativeEnum(client_1.UserRoleEnum).optional(),
    }),
    isSuperAdmin: zod_1.z.boolean().optional(),
    function: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.adminAccessFunctionValidation = {
    createSchema,
    updateSchema,
};

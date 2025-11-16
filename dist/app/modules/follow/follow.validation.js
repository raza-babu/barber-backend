"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.followValidation = void 0;
const zod_1 = require("zod");
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        // followerId: z.string({
        //   required_error: 'Follower ID is required!',
        // }),
        followingId: zod_1.z.string({
            required_error: 'Following ID is required!',
        }),
    }),
});
const updateSchema = zod_1.z.object({
    body: zod_1.z.object({
        // followerId: z.string().optional(),
        followingId: zod_1.z.string().optional(),
    }),
});
exports.followValidation = {
    createSchema,
    updateSchema,
};

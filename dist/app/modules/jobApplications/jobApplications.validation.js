"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobApplicationsValidation = void 0;
const zod_1 = require("zod");
const JobApplicationStatusEnum = zod_1.z.enum([
    'PENDING',
    'ONGOING',
    'COMPLETED',
    'REJECTED',
]);
const createJobApplicationSchema = zod_1.z.object({
    body: zod_1.z.object({
        jobPostId: zod_1.z.string({
            required_error: 'Job Post ID is required!',
        })
    }),
});
const updateJobApplicationSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: JobApplicationStatusEnum.optional(),
    }),
});
exports.jobApplicationsValidation = {
    createJobApplicationSchema,
    updateJobApplicationSchema,
};

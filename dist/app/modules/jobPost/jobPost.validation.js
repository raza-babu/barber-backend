"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobPostValidation = void 0;
const zod_1 = require("zod");
const createJobPostSchema = zod_1.z.object({
    body: zod_1.z.object({
        // shopName: z.string({
        //   required_error: 'Shop name is required!',
        // }),
        // shopLogo: z.string({
        //   required_error: 'Shop logo is required!',
        // }),
        description: zod_1.z.string({
            required_error: 'Description is required!',
        }),
        hourlyRate: zod_1.z
            .number({
            invalid_type_error: 'Hourly rate must be a number!',
        }),
        salary: zod_1.z
            .number({
            invalid_type_error: 'Salary must be a number!',
        })
            .optional(),
        startDate: zod_1.z
            .string({
            invalid_type_error: 'Start date must be a valid ISO string!',
        })
            // .datetime()
            .optional(),
        endDate: zod_1.z
            .string({
            invalid_type_error: 'End date must be a valid ISO string!',
        })
            // .datetime()
            .optional(),
        datePosted: zod_1.z
            .string({
            invalid_type_error: 'Date posted must be a valid ISO string!',
        })
            // .datetime()
            .optional(),
        isActive: zod_1.z.boolean().optional().default(true),
    }),
});
const updateJobPostSchema = zod_1.z.object({
    body: zod_1.z.object({
        shopName: zod_1.z.string().optional(),
        shopLogo: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        hourlyRate: zod_1.z.number().optional(),
        salary: zod_1.z.number().optional(),
        startDate: zod_1.z
            .string()
            .datetime()
            .optional(),
        endDate: zod_1.z
            .string()
            .datetime()
            .optional(),
        datePosted: zod_1.z
            .string()
            .datetime()
            .optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
exports.jobPostValidation = {
    createJobPostSchema,
    updateJobPostSchema,
};

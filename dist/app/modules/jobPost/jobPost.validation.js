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
        }).min(1, 'Hourly rate must be at least 0!'),
        startDate: zod_1.z
            .string({
            invalid_type_error: 'Start date must be a valid ISO string!',
        })
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
        description: zod_1.z.string().optional(),
        hourlyRate: zod_1.z.number().min(1, 'Hourly rate must be at least 0!').optional(),
        startDate: zod_1.z
            .string({
            invalid_type_error: 'Date posted must be a valid ISO string!',
        })
            .optional(),
        endDate: zod_1.z
            .string({
            invalid_type_error: 'Date posted must be a valid ISO string!',
        })
            .optional(),
        datePosted: zod_1.z
            .string({
            invalid_type_error: 'Date posted must be a valid ISO string!',
        })
            .optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
exports.jobPostValidation = {
    createJobPostSchema,
    updateJobPostSchema,
};

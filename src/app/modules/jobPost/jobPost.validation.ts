import { z } from 'zod';

const createJobPostSchema = z.object({
  body: z.object({
  
    // shopName: z.string({
    //   required_error: 'Shop name is required!',
    // }),
    // shopLogo: z.string({
    //   required_error: 'Shop logo is required!',
    // }),
    description: z.string({
      required_error: 'Description is required!',
    }),
    hourlyRate: z
      .number({
        invalid_type_error: 'Hourly rate must be a number!',
      }),
    salary: z
      .number({
        invalid_type_error: 'Salary must be a number!',
      })
      .optional(),
    startDate: z
      .string({
        invalid_type_error: 'Start date must be a valid ISO string!',
      })
      // .datetime()
      .optional(),
    endDate: z
      .string({
        invalid_type_error: 'End date must be a valid ISO string!',
      })
      // .datetime()
      .optional(),
    datePosted: z
      .string({
        invalid_type_error: 'Date posted must be a valid ISO string!',
      })
      // .datetime()
      .optional(),
    isActive: z.boolean().optional().default(true),
  }),
});
const updateJobPostSchema = z.object({
  body: z.object({
    shopName: z.string().optional(),
    shopLogo: z.string().optional(),
    description: z.string().optional(),
    hourlyRate: z.number().optional(),
    salary: z.number().optional(),
    startDate: z
      .string()
      .datetime()
      .optional(),
    endDate: z
      .string()
      .datetime()
      .optional(),
    datePosted: z
      .string()
      .datetime()
      .optional(),
    isActive: z.boolean().optional(),
  }),
});

export const jobPostValidation = {
  createJobPostSchema,
  updateJobPostSchema,
};
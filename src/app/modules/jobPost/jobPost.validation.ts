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
      }).min(1, 'Hourly rate must be at least 0!'),
  
    startDate: z
      .string({
        invalid_type_error: 'Start date must be a valid ISO string!',
      }),
    endDate: z
      .string({
        invalid_type_error: 'End date must be a valid ISO string!',
      }),
    datePosted: z
      .string({
        invalid_type_error: 'Date posted must be a valid ISO string!',
      })
      // .datetime()
      .optional(),
    isActive: z.boolean().optional().default(true),
  }).superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    
    
   
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startCompare = new Date(start);
    startCompare.setHours(0, 0, 0, 0);

    // start date should be future date
    if (startCompare < today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start date must be today or a future date!',
        path: ['startDate'],
      });
    }

     // start date should be future date
    if (end.getTime() < start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be greater than or equal to Start date!',
        path: ['endDate'],
      });
    }

    // Date post should be future date
    if ( data.datePosted){ 
      const posted = new Date(data.datePosted);
      if  (posted.getTime() !==  start.getTime() ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Date posted must be exactly the same as Start date o!',
          path: ['datePosted'],
        });
      }
    }
  }),
})


const updateJobPostSchema = z.object({
  body: z.object({
    description: z.string().optional(),
    hourlyRate: z.number().min(1, 'Hourly rate must be at least 1!').optional(),
    startDate: z
      .string({
        invalid_type_error: 'Date posted must be a valid ISO string!',
      })    
      .optional(),
    endDate: z
      .string({
        invalid_type_error: 'Date posted must be a valid ISO string!',
      })     
      .optional(),
    datePosted: z
      .string({
        invalid_type_error: 'Date posted must be a valid ISO string!',
      })
      .optional(),
    isActive: z.boolean().optional(),
  }).superRefine((data, ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. If start date Exists, Start date should be future date or now
    if (data.startDate) {
      const start = new Date(data.startDate);
      const startCompare = new Date(start);
      startCompare.setHours(0, 0, 0, 0);

      if (startCompare < today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start date must be today or a future date!',
          path: ['startDate'],
        });
      }

      // 1. If end date Exists, End date should be future date or now
      if (data.endDate) {
        const end = new Date(data.endDate);
        if (end.getTime() < start.getTime()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'End date must be greater than or equal to Start date!',
            path: ['endDate'],
          });
        }
      }

      // ৩. Date Posted-এর সাথে তুলনা (যদি দুটিই পাঠানো হয়)
      if (data.datePosted) {
        const posted = new Date(data.datePosted);
        if (posted.getTime() !== start.getTime()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Date posted must be exactly the same as Start date!',
            path: ['datePosted'],
          });
        }
      }
    }
  }),
});

export const jobPostValidation = {
  createJobPostSchema,
  updateJobPostSchema,
};
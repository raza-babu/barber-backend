import { z } from 'zod';

const JobApplicationStatusEnum = z.enum([
  'PENDING',
  'ONGOING',
  'COMPLETED',
  'REJECTED',
]);

const createJobApplicationSchema = z.object({
  body: z.object({
    jobPostId: z.string({
      required_error: 'Job Post ID is required!',
    })
  }),
});

const updateJobApplicationSchema = z.object({
  body: z.object({
    status: JobApplicationStatusEnum.optional(),
  }),
});

export const jobApplicationsValidation = {
  createJobApplicationSchema,
  updateJobApplicationSchema,
};

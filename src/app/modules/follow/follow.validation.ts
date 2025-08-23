import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    // followerId: z.string({
    //   required_error: 'Follower ID is required!',
    // }),
    followingId: z.string({
      required_error: 'Following ID is required!',
    }),
  }),
});

const updateSchema = z.object({
  body: z.object({
    // followerId: z.string().optional(),
    followingId: z.string().optional(),
  }),
});

export const followValidation = {
  createSchema,
  updateSchema,
};

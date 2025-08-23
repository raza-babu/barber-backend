import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    feedId: z.string({
      required_error: 'Feed ID is required!',
    }),
  }),
});

const updateSchema = z.object({
  body: z.object({
    // name: z.string().optional(),
    // description: z.string().optional(),
  }),
});

export const favoriteFeedValidation = {
  createSchema,
  updateSchema,
};

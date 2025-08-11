import { z } from 'zod';

const blockSchema = z.object({
  body: z.object({
    status: z.boolean(),
    }),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    }),
});


export const adminValidation = {
blockSchema,
updateSchema,
};
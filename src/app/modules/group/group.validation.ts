import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    groupName: z.string().min(1, 'Name is required'),
    groupDescription: z.string().optional(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    groupName: z.string().min(1, 'Name is required'),
    groupDescription: z.string().optional(),
  }),
});

export const groupValidation = {
createSchema,
updateSchema,
};
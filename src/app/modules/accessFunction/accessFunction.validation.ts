import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    function: z.string().optional(),
    }),
});

const updateSchema = z.object({
  body: z.object({
    function: z.string().optional(),
    }),
});

export const accessFunctionValidation = {
createSchema,
updateSchema,
};
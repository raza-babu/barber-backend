import { z } from 'zod';

export const blockValidation = {
  createBlockSchema: z.object({
    body: z.object({
      blockedId: z.string().min(1, 'Blocked user ID is required'),
      reason: z.string().optional(),
    }),
  }),

  unblockSchema: z.object({
    params: z.object({
      blockedId: z.string().min(1, 'Blocked user ID is required'),
    }),
  }),
};

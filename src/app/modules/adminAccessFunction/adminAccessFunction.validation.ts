import { z } from 'zod';
import { UserRoleEnum } from '@prisma/client';

const createSchema = z.object({
  body: z.object({
    fullName: z.string({
      required_error: 'Full Name is required!',
    }),
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email('Invalid email format!'),
    password: z
      .string({
        required_error: 'Password is required!',
      })
      .min(8, 'Password must be at least 8 characters long!'),
    role: z.nativeEnum(UserRoleEnum, {
      required_error: 'Role is required!',
    }),
    isSuperAdmin: z.boolean().optional(),
    function: z.array(z.string()),
  }),
});

const updateSchema = z.object({
  body: z.object({
    adminId: z.string().optional(),
    role: z.nativeEnum(UserRoleEnum).optional(),
  }),
  isSuperAdmin: z.boolean().optional(),
  function: z.array(z.string()).optional(),
});

export const adminAccessFunctionValidation = {
  createSchema,
  updateSchema,
};

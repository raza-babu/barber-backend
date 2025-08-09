import { z } from 'zod';
import admin from '../../utils/firebase';
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
    isSuperAdmin: z.boolean(),
    image: z.string(),
    function: z.array(z.string()),
  }),
});

const updateSchema = z.object({
  body: z.object({
    fullName: z.string().optional(),
    email: z.string().email('Invalid email format!').optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long!')
      .optional(),
    role: z.nativeEnum(UserRoleEnum).optional(),
  }),
  isSuperAdmin: z.boolean().optional(),
  image: z.string().optional(),
  function: z.array(z.string()).optional(),
});

export const adminAccessFunctionValidation = {
  createSchema,
  updateSchema,
};

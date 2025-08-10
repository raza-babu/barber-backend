import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import AppError from '../errors/AppError';
import prisma from '../utils/prisma';
import { verifyToken } from '../utils/verifyToken';
import { UserRoleEnum } from '@prisma/client'; 
import { Admin, User } from '@prisma/client';

// Define a type for the user with included relations
type UserWithAdmin = User & {
  Admin?: (Admin & {
    AdminAccessFunction: {
      accessFunction: {
        function: string;
      };
    }[];
  })[];
};

const auth = (...roles: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization;

      if (!token) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
      }

      const verifyUserToken = verifyToken(
        token,
        config.jwt.access_secret as Secret,
      );

      // Check token purpose
      if (!verifyUserToken.purpose || verifyUserToken.purpose !== 'access') {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token purpose!');
      }

      // Check user exists with admin relations
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: verifyUserToken.id },
        include: {
          Admin: {
            include: {
              AdminAccessFunction: {
                include: {
                  accessFunction: {
                    select: {
                      function: true,
                    },
                  },
                },
              },
            },
          },
        },
      }) as UserWithAdmin;

      if (!user) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
      }

      // Initialize permissions and super admin status
      let isSuperAdmin = false;
      let permissions: string[] = [];

      // Handle admin-specific checks
      if (user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.SUPER_ADMIN) {
        if (!user.Admin || user.Admin.length === 0) {
          throw new AppError(httpStatus.FORBIDDEN, 'Admin profile not found');
        }

        // Get first admin record (assuming one-to-one relationship)
        const admin = user.Admin[0];
        isSuperAdmin = admin.isSuperAdmin || false;
        permissions = admin.AdminAccessFunction.map(
          af => af.accessFunction.function
        );

        // Skip permission check for super admin
        if (!isSuperAdmin) {
          const requiredPermission = (req as any).permission;
          if (requiredPermission && !permissions.includes(requiredPermission)) {
            throw new AppError(httpStatus.FORBIDDEN, 'Insufficient permissions');
          }
        }
      }

      // Role-based access check
      if (roles.length && !roles.includes(user.role)) {
        throw new AppError(httpStatus.FORBIDDEN, 'Forbidden!');
      }

      // Attach user and permissions to request
      req.user = {
        ...verifyUserToken,
        isSuperAdmin,
        permissions,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default auth;
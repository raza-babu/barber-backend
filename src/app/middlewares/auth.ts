import { admin } from 'firebase-admin';
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import AppError from '../errors/AppError';
import prisma from '../utils/prisma';
import { verifyToken } from '../utils/verifyToken';
import { UserRoleEnum } from '@prisma/client';

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

      // Check user exists
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
      });

      if (!user) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
      }

      // For admins, check if they're super admin or have required access functions
      if (
        user.role === UserRoleEnum.ADMIN ||
        user.role === UserRoleEnum.SUPER_ADMIN
      ) {
        const admin = user.Admin;

        if (!admin) {
          throw new AppError(httpStatus.FORBIDDEN, 'Admin profile not found');
        }

        // Super admins bypass all checks
        if (!admin.isSuperAdmin) {
          // Get the required permission from route metadata
          const requiredPermission = (req as any).permission;

          if (requiredPermission) {
            const hasPermission = admin.adminAccessFunctions.some(
              af => af.function.name === requiredPermission,
            );

            if (!hasPermission) {
              throw new AppError(
                httpStatus.FORBIDDEN,
                'Insufficient permissions',
              );
            }
          }
        }
      }

      // Role-based access check
      if (roles.length && !roles.includes(verifyUserToken.role)) {
        throw new AppError(httpStatus.FORBIDDEN, 'Forbidden!');
      }

      // Attach user and permissions to request
      req.user = {
        ...verifyUserToken,
        isSuperAdmin: user.admin?.isSuperAdmin || false,
        permissions:
          user.admin?.adminAccessFunctions.map(af => af.function.name) || [],
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default auth;

import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import AppError from '../errors/AppError';

export const checkPermissions = (...requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip check for super admins
    if (req.user.isSuperAdmin) {
      return next();
    }

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission =>
      req.user.permissions.includes(permission)
    );
    console.log(`User Permissions: ${req.user.permissions}`);
    console.log(`Required Permissions: ${requiredPermissions}`);

    if (!hasAllPermissions) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `You need ${requiredPermissions.join(', ')} permission(s) to access this resource`,
      );
    }

    next();
  };
};

import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import AppError from '../errors/AppError';
import prisma from '../utils/prisma';
import { SubscriptionPlanStatus, UserRoleEnum } from '@prisma/client';

const checkSubscriptionForSalonOwners = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role as UserRoleEnum;

    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not found in request');
    }

    // ✅ Only enforce subscription if role is SALOON_OWNER
    if (role === UserRoleEnum.SALOON_OWNER) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          isSubscribed: true,
          subscriptionEnd: true,
          subscriptionPlan: true,
        },
      });

      if (!user) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'User not found');
      }

      const now = new Date();

      // Case 1: Free Plan → always allowed
      if (user.subscriptionPlan === SubscriptionPlanStatus.FREE) {
        return next();
      }

      // Case 2: Paid Plan → must be active
      if (
        !user.isSubscribed ||
        !user.subscriptionEnd ||
        now > user.subscriptionEnd
      ) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'Your subscription has expired. Please renew to continue.',
        );
      }
    }

    // ✅ Allow all other roles (CUSTOMER, BARBER, ADMIN, etc.)
    return next();
  } catch (err) {
    next(err);
  }
};

export default checkSubscriptionForSalonOwners;

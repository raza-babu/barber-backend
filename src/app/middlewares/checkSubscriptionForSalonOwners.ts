import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import AppError from '../errors/AppError';
import prisma from '../utils/prisma';
import { SubscriptionPlanStatus, UserRoleEnum } from '@prisma/client';

const checkSubscriptionForSalonOwners = () => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const role = req.user?.role as UserRoleEnum;

      if (!userId) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          'User not found in request',
        );
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
          // Saloons with Free plan can not proceed if they are not subscribed
          if (!user.isSubscribed) {
            throw new AppError(
              httpStatus.FORBIDDEN,
              'You are on the Free plan. Please subscribe to a paid plan to access this feature.',
            );
          }
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

        // Attach subscription details to req.user for downstream use
        req.user.isSubscribed = user.isSubscribed;
        req.user.subscriptionEnd = user.subscriptionEnd;
        req.user.subscriptionPlan = user.subscriptionPlan;
      }

      // ✅ Allow all other roles (CUSTOMER, BARBER, ADMIN, etc.)
      return next();
    } catch (err) {
      next(err);
    }
  };
};

export default checkSubscriptionForSalonOwners;

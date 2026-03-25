import { User, UserRoleEnum } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import {
  verifySaloonOwnerPaymentReadiness,
  verifyBarberPaymentReadiness,
} from '../utils/paymentTransfer';
import sendResponse from '../utils/sendResponse';

/**
 * Non-blocking middleware to check if a saloon owner can receive payments
 * This validates that the saloon owner has completed Stripe onboarding
 * and has a connected Stripe account.
 *
 * Usage: Use for monitoring/logging purposes only
 */
const checkSaloonOwnerPaymentReadiness = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // If no saloonOwnerId provided, skip validation
      const saloonOwnerId =
        req.body?.saloonOwnerId || req.query?.saloonOwnerId || req.user?.id;

      if (!saloonOwnerId) {
        return next();
      }
      if (req.user?.role !== UserRoleEnum.SALOON_OWNER) {
        return next();
      }

      // Verify saloon owner payment readiness
      const readinessCheck = await verifySaloonOwnerPaymentReadiness(
        saloonOwnerId as string,
      );

      if (!readinessCheck.ready) {
        console.warn(
          `⚠️ Saloon owner payment readiness check failed: ${readinessCheck.reason}`,
        );

        // Don't block the request, but log the issue
        // The payment transfer will handle the error
        return next();
      }

      console.log(
        `✅ Saloon owner ${saloonOwnerId} is ready to receive payments`,
      );
      next();
    } catch (error) {
      console.error('Error checking saloon owner payment readiness:', error);
      // Don't block the request on validation error
      next();
    }
  };
};

/**
 * BLOCKING middleware to enforce saloon owner payment readiness
 * This prevents saloon owners from taking actions (bookings, etc.)
 * until they've completed Stripe onboarding.
 *
 * Usage: Apply to routes that require saloon owner to be payment-ready
 * Examples:
 * - POST /bookings (saloon owner accepting booking)
 * - POST /payments (saloon owner receiving payment)
 */
const checkSaloonOwnerPaymentReadinessBlocking = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;

      // Only check saloon owners
      if (!user || user.role !== UserRoleEnum.SALOON_OWNER) {
        return next();
      }

      // Verify saloon owner payment readiness
      const readinessCheck = await verifySaloonOwnerPaymentReadiness(user.id);

      if (!readinessCheck.ready) {
        console.warn(
          `🛑 Blocked action for unready saloon owner: ${readinessCheck.reason}`,
        );

        return sendResponse(res, {
          statusCode: httpStatus.FORBIDDEN,
          success: false,
          message: `You cannot perform this action until you complete Stripe onboarding. Reason: ${readinessCheck.reason}`,
          data: {
            required: {
              stripeOnboarding: true,
              accountStatus: readinessCheck.accountStatus || null,
            },
          },
        });
      }

      console.log(`✅ Saloon owner ${user.id} passed payment readiness check`);
      next();
    } catch (error) {
      console.error('Error in payment readiness blocking check:', error);
      return sendResponse(res, {
        statusCode: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: 'Unable to verify payment readiness. Please try again later.',
        data: null,
      });
    }
  };
};

/**
 * Non-blocking middleware to check if a barber can receive payments
 * This validates that the barber has completed Stripe onboarding
 * and has a connected Stripe account.
 *
 * Usage: Use for monitoring/logging purposes only
 */
const checkBarberPaymentReadiness = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // If no barberId provided, skip validation
      const barberId =
        req.body?.barberId || req.query?.barberId || req.user?.id;

      if (!barberId) {
        return next();
      }
      if (req.user?.role !== UserRoleEnum.BARBER) {
        return next();
      }

      // Verify barber payment readiness
      const readinessCheck = await verifyBarberPaymentReadiness(
        barberId as string,
      );

      if (!readinessCheck.ready) {
        console.warn(
          `⚠️ Barber payment readiness check failed: ${readinessCheck.reason}`,
        );

        // Don't block the request, but log the issue
        // The payment transfer will handle the error
        return next();
      }

      console.log(`✅ Barber ${barberId} is ready to receive payments`);
      next();
    } catch (error) {
      console.error('Error checking barber payment readiness:', error);
      // Don't block the request on validation error
      next();
    }
  };
};

/**
 * BLOCKING middleware to enforce barber payment readiness
 * This prevents barbers from taking actions (accepting bookings, etc.)
 * until they've completed Stripe onboarding.
 *
 * Usage: Apply to routes that require barber to be payment-ready
 * Examples:
 * - POST /bookings (barber accepting booking)
 * - POST /payments (barber receiving commission)
 */
const checkBarberPaymentReadinessBlocking = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;

      // Only check barbers
      if (!user || user.role !== UserRoleEnum.BARBER) {
        return next();
      }

      // Verify barber payment readiness
      const readinessCheck = await verifyBarberPaymentReadiness(user.id);

      if (!readinessCheck.ready) {
        console.warn(
          `🛑 Blocked action for unready barber: ${readinessCheck.reason}`,
        );

        return sendResponse(res, {
          statusCode: httpStatus.FORBIDDEN,
          success: false,
          message: `You cannot perform this action until you complete Stripe onboarding. Reason: ${readinessCheck.reason}`,
          data: {
            required: {
              stripeOnboarding: true,
              accountStatus: readinessCheck.accountStatus || null,
            },
          },
        });
      }

      console.log(`✅ Barber ${user.id} passed payment readiness check`);
      next();
    } catch (error) {
      console.error('Error in barber payment readiness blocking check:', error);
      return sendResponse(res, {
        statusCode: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: 'Unable to verify payment readiness. Please try again later.',
        data: null,
      });
    }
  };
};

export {
  checkSaloonOwnerPaymentReadiness,
  checkSaloonOwnerPaymentReadinessBlocking,
  checkBarberPaymentReadiness,
  checkBarberPaymentReadinessBlocking,
};

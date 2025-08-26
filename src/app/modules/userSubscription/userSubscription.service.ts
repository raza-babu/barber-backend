import prisma from '../../utils/prisma';
import {
  PaymentStatus,
  Prisma,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import Stripe from 'stripe';
import config from '../../../config';
import { DateTime } from 'luxon';

// Initialize Stripe with your secret API key
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-07-30.basil',
});

const createUserSubscriptionIntoDb = async (
  userId: string,
  data: {
    paymentMethodId: string;
    subscriptionOfferId: string;
  },
) => {
  // 1. Get user (outside transaction)

  const existingSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId: userId,
      endDate: {
        gt: new Date(),
      },
    },
  });
  if (existingSubscription) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'An active subscription already exists for this user',
    );
  }

  const userCheck = await prisma.user.findUnique({
    where: {
      id: userId,
      role: UserRoleEnum.SALOON_OWNER,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      address: true,
      status: true,
      stripeCustomerId: true,
    },
  });
  if (!userCheck)
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found or inactive');

  // 2. Ensure Stripe customer exists (outside transaction)
  let stripeCustomerId = userCheck.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: userCheck.email!,
      name: userCheck.fullName!,
      address: {
        city: userCheck.address ?? 'City',
        country: 'US',
      },
      metadata: { userId: userCheck.id, role: userCheck.role },
    });

    // Update DB (outside transaction)
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    stripeCustomerId = customer.id;
  }

  // 3. Attach payment method (outside transaction)
  try {
    await stripe.paymentMethods.attach(data.paymentMethodId, {
      customer: stripeCustomerId,
    });
  } catch (err: any) {
    if (err.code !== 'resource_already_attached') throw err;
  }

  // 4. Set default payment method (outside transaction)
  await stripe.customers.update(stripeCustomerId, {
    invoice_settings: { default_payment_method: data.paymentMethodId },
  });

  // 5. Fetch subscription offer (outside transaction)
  const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id: data.subscriptionOfferId },
    include: { creator: { select: { stripeCustomerId: true } } },
  });
  if (!subscriptionOffer?.stripePriceId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription offer or price not found',
    );
  }

  // 6. Create subscription in Stripe (outside transaction)
  const subscription = (await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: subscriptionOffer.stripePriceId }],
    default_payment_method: data.paymentMethodId,
    expand: ['latest_invoice.payment_intent'],
  })) as Stripe.Subscription;

  // Extract details
  const latestInvoice = subscription.latest_invoice as any;
  const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent;
  if (
    subscription.status === 'incomplete' &&
    paymentIntent?.status !== 'succeeded'
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Subscription payment failed');
  }

  const subscriptionWithPeriod =
    subscription as unknown as Stripe.Subscription & {
      current_period_start: number;
      current_period_end: number;
    };

  // 7. ONLY database operations go inside the transaction
  const result = await prisma.$transaction(
    async tx => {
      // Convert Stripe Unix timestamps to JavaScript Date objects
      const startDate = subscriptionWithPeriod.current_period_start
        ? new Date(subscriptionWithPeriod.current_period_start * 1000)
        : new Date();

      const endDate = subscriptionWithPeriod.current_period_end
        ? new Date(subscriptionWithPeriod.current_period_end * 1000)
        : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const createdSubscription = await tx.userSubscription.create({
        data: {
          userId: userCheck.id,
          subscriptionOfferId: subscriptionOffer.id,
          startDate: startDate,
          endDate: endDate,
          stripeSubscriptionId: subscription.id,
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      await tx.payment.create({
        data: {
          stripeSubscriptionId: subscription.id,
          paymentAmount: subscriptionOffer.price,
          stripeCustomerIdProvider: stripeCustomerId,
          status: PaymentStatus.COMPLETED,
          user: {
            connect: { id: userId },
          },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          isSubscribed: true,
          subscriptionEnd: endDate,
        },
      });

      return {
        ...createdSubscription,
        subscriptionId: subscription.id,
        paymentIntentId: paymentIntent?.id,
      };
    },
    {
      // Optional: Increase timeout if needed (default is 5000ms)
      timeout: 10000, // 10 seconds
    },
  );

  return result;
};

const getUserSubscriptionListFromDb = async (userId: string) => {
  const result = await prisma.userSubscription.findMany({
    include: {
      subscriptionOffer: true,
    },
  });
  if (result.length === 0) {
    return { message: 'No userSubscription found' };
  }
  return result.map(item => ({
    ...item,
    subscriptionOffer: item.subscriptionOffer,
  }));
};

const getUserSubscriptionByIdFromDb = async (
  userId: string,
  userSubscriptionId: string,
) => {
  const result = await prisma.userSubscription.findUnique({
    where: {
      id: userSubscriptionId,
    },
    include: {
      subscriptionOffer: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'userSubscription not found');
  }
  return {
    ...result,
    subscriptionOffer: result.subscriptionOffer,
  };
};

const updateUserSubscriptionIntoDb = async (
  userId: string,
  userSubscriptionId: string,
  data: {
    paymentMethodId: string;
    subscriptionOfferId: string;
  },
) => {
  // Step 1: find user subscription (outside transaction)
  const existing = await prisma.userSubscription.findFirst({
    where: {
      id: userSubscriptionId,
      userId,
      // Remove the endDate filter to find both active and expired
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
  }

  // Optional: Add business logic if you only want to allow renewing near expiration
  if (existing.endDate > new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription is still active, cannot renew yet',
    );
  }

  // Step 2: find user (outside transaction)
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (!user.stripeCustomerId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Stripe customer not found');
  }

  // Step 3: find subscription offer (outside transaction)
  const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id: data.subscriptionOfferId },
    include: {
      creator: {
        select: {
          stripeCustomerId: true,
        },
      },
    },
  });
  if (!subscriptionOffer?.stripePriceId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription offer or price not found',
    );
  }

  // Step 4: Handle payment method (outside transaction)
  try {
    await stripe.paymentMethods.attach(data.paymentMethodId, {
      customer: user.stripeCustomerId,
    });
  } catch (err: any) {
    if (err.code !== 'resource_already_attached') throw err;
  }

  // Set default payment method
  await stripe.customers.update(user.stripeCustomerId, {
    invoice_settings: { default_payment_method: data.paymentMethodId },
  });

  // Step 5: renew subscription in Stripe (outside transaction)
  const subscription = await stripe.subscriptions.create({
    customer: user.stripeCustomerId,
    items: [{ price: subscriptionOffer.stripePriceId }],
    default_payment_method: data.paymentMethodId,
    expand: ['latest_invoice.payment_intent'],
  });

  if (!subscription) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Subscription not created');
  }

  // IMPORTANT: Subscription may start as `incomplete` until invoice is paid
  const latestInvoice = subscription.latest_invoice as any;
  const paymentIntent = latestInvoice?.payment_intent;
  if (
    subscription.status === 'incomplete' &&
    paymentIntent?.status !== 'succeeded'
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Subscription payment failed');
  }

  // Type assertion for subscription dates
  const subscriptionWithPeriod =
    subscription as unknown as Stripe.Subscription & {
      current_period_start: number;
      current_period_end: number;
    };

  // Step 6: ONLY database operations inside transaction
  const result = await prisma.$transaction(
    async tx => {
      // Convert Stripe Unix timestamps to JavaScript Date objects
      const startDate = subscriptionWithPeriod.current_period_start
        ? new Date(subscriptionWithPeriod.current_period_start * 1000)
        : new Date();

      const endDate = subscriptionWithPeriod.current_period_end
        ? new Date(subscriptionWithPeriod.current_period_end * 1000)
        : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Update user subscription in DB
      const updatedSubscription = await tx.userSubscription.update({
        where: { id: userSubscriptionId },
        data: {
          subscriptionOfferId: data.subscriptionOfferId,
          startDate: startDate,
          endDate: endDate,
          stripeSubscriptionId: subscription.id,
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      // Record payment
      await tx.payment.create({
        data: {
          userId: userId,
          stripeSubscriptionId: subscription.id,
          paymentAmount: subscriptionOffer.price,
          stripeCustomerIdProvider: user.stripeCustomerId!,
          status: PaymentStatus.COMPLETED,
        },
      });

      // Update user status
      await tx.user.update({
        where: { id: userId },
        data: {
          isSubscribed: true,
          subscriptionEnd: endDate,
        },
      });

      return {
        ...updatedSubscription,
        subscriptionId: subscription.id,
        paymentIntentId: paymentIntent?.id,
      };
    },
    {
      timeout: 10000, // Optional: Increase timeout if needed
    },
  );

  return result;
};

const deleteUserSubscriptionItemFromDb = async (
  userId: string,
  userSubscriptionId: string,
) => {
  const result = await prisma.$transaction(async tx => {
    // Step 1: Find existing subscription
    const existing = await tx.userSubscription.findFirst({
      where: {
        id: userSubscriptionId,
        userId,
      },
    });
    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
    }

    // Step 2: Cancel Stripe subscription if exists
    if (existing.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(existing.stripeSubscriptionId);
      } catch (err) {
        // Log error but proceed with deletion
        console.error('Error cancelling Stripe subscription:', err);
      }
    }

    // Step 3: Delete user subscription record
    await tx.userSubscription.update({
      where: { id: userSubscriptionId },
      data: { endDate: new Date(), paymentStatus: PaymentStatus.REFUNDED }, // Soft delete by setting endDate to now
    });

    // Step 4: Check if user has other active subscriptions
    const activeSubscriptions = await tx.userSubscription.findUnique({
      where: {
        userId,
        stripeSubscriptionId: existing.stripeSubscriptionId!,
        endDate: {
          gt: new Date(),
        },
      },
    });

    const checkPaymentStatus = await prisma.payment.findUnique({
      where: {
        userId: existing.userId,
        stripeSubscriptionId: existing.stripeSubscriptionId!,
        status: PaymentStatus.COMPLETED,
      },
    });
    if (!checkPaymentStatus) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Payment not found');
    }

    const updatePaymentStatus = await tx.payment.update({
      where: {
        userId: existing.userId,
        stripeSubscriptionId: existing.stripeSubscriptionId!,
      },
      data: { status: PaymentStatus.REFUNDED },
    });
    if (!updatePaymentStatus) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Payment not updated');
    }

    // Step 5: Update user status if no active subscriptions remain
    if (!activeSubscriptions) {
      await tx.user.update({
        where: { id: userId },
        data: {
          isSubscribed: false,
          subscriptionEnd: null,
        },
      });
    }

    return { message: 'Subscription cancelled successfully' };
  });
  return result;
};

export const userSubscriptionService = {
  createUserSubscriptionIntoDb,
  getUserSubscriptionListFromDb,
  getUserSubscriptionByIdFromDb,
  updateUserSubscriptionIntoDb,
  deleteUserSubscriptionItemFromDb,
};

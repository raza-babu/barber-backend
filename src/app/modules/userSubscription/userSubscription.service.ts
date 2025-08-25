import prisma from '../../utils/prisma';
import { PaymentStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import Stripe from 'stripe';
import config from '../../../config';

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
  return await prisma.$transaction(async tx => {
    // 1. Verify user
    const userCheck = await tx.user.findUnique({
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
    if (!userCheck) {
      throw new AppError(httpStatus.BAD_REQUEST, 'User not found or inactive');
    }

    // 2. Ensure Stripe Customer exists
    if (!userCheck.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userCheck.email!,
        name: userCheck.fullName!,
        address: {
          city: userCheck.address ?? 'City',
          country: 'America',
        },
        metadata: { userId: userCheck.id, role: userCheck.role },
      });
      await tx.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
      });
      userCheck.stripeCustomerId = customer.id;
    }

    // 3. Attach the payment method to the customer
    try {
  await stripe.paymentMethods.attach(data.paymentMethodId, {
    customer: userCheck.stripeCustomerId,
  });
} catch (err: any) {
  if (err.code !== 'resource_already_attached') throw err;
}


    // 4. Set it as the default payment method
    await stripe.customers.update(userCheck.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: data.paymentMethodId,
      },
    });

    // 5. Get subscription offer
    const subscriptionOffer = await tx.subscriptionOffer.findUnique({
      where: { id: data.subscriptionOfferId },
      include:{
        creator: {
          select: {
            stripeCustomerId: true
          }
        }
      }
    });
    if (!subscriptionOffer?.stripePriceId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Subscription offer or price not found',
      );
    }

    // 6. Create the subscription in Stripe
    const subscription = await stripe.subscriptions.create({
      customer: userCheck.stripeCustomerId,
      items: [{ price: subscriptionOffer.stripePriceId }],
      default_payment_method: data.paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
    }) 

    if (!subscription) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Subscription not created');
    }

    // IMPORTANT: Subscription may start as `incomplete` until invoice is paid
    const latestInvoice = subscription.latest_invoice as any;
    const paymentIntent = latestInvoice?.payment_intent;

    if (subscription.status === 'incomplete' && paymentIntent?.status !== 'succeeded') {
      throw new AppError(httpStatus.BAD_REQUEST, 'Subscription payment failed');
    }

    // 7. Save subscription to DB
    const result = await tx.userSubscription.create({
      data: {
        userId: userId,
        subscriptionOfferId: data.subscriptionOfferId,
        startDate: new Date(),
        endDate: new Date((subscription as any).current_period_end * 1000),
        stripeSubscriptionId: subscription.id,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });

    // 8. Record payment
    await tx.payment.create({
      data: {
        userId: userId,
        stripePaymentIntentId: paymentIntent?.id ?? null,
        paymentAmount: subscriptionOffer.price,
        stripeCustomerIdProvider: userCheck.stripeCustomerId,
        // stripeAccountIdReceiver: subscriptionOffer.creator.stripeCustomerId!,
        status: PaymentStatus.COMPLETED,
      },
    });

    // 9. Update user status
    await tx.user.update({
      where: { id: userId },
      data: {
        isSubscribed: true,
        subscriptionEnd: result.endDate,
      },
    });

    return {
      ...result,
      subscriptionId: subscription.id,
      paymentIntentId: paymentIntent?.id,
    };
  });
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
  }
) => {
  
  return await prisma.$transaction(async tx => {
    // Step 1: find user subscription
    const existing = await tx.userSubscription.findFirst({
      where: {
        id: userSubscriptionId,
        userId,
      },
    });
    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, 'User subscription not found');
    }
    // Step 2: find user
    const user = await tx.user.findUnique({
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
    // Step 3: find subscription offer
    const subscriptionOffer = await tx.subscriptionOffer.findUnique({
      where: { id: data.subscriptionOfferId },
      include:{
        creator: {
          select: {
            stripeCustomerId: true
          }
        }
      }
    });
    if (!subscriptionOffer?.stripePriceId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Subscription offer or price not found',
      );
    }
    // Step 4: renew subscription in Stripe
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
    if (subscription.status === 'incomplete' && paymentIntent?.status !== 'succeeded') {
      throw new AppError(httpStatus.BAD_REQUEST, 'Subscription payment failed');
    }
    // Step 5: update user subscription in DB
    const result = await tx.userSubscription.update({
      where: { id: userSubscriptionId },
      data: {
        subscriptionOfferId: data.subscriptionOfferId,
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        stripeSubscriptionId: subscription.id,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });
    // Step 6: record payment
    await tx.payment.create({
      data: {
        userId: userId,
        stripePaymentIntentId: paymentIntent?.id ?? null,
        paymentAmount: subscriptionOffer.price,
        stripeCustomerIdProvider: user.stripeCustomerId,  
        // stripeAccountIdReceiver: subscriptionOffer.creator.stripeCustomerId!,
        status: PaymentStatus.COMPLETED,
      },
    });
    // Step 7: update user status
    await tx.user.update({
      where: { id: userId },
      data: {
        isSubscribed: true,
        subscriptionEnd: result.endDate,
      },
    });
    return {
      ...result,
      subscriptionId: subscription.id,
      paymentIntentId: paymentIntent?.id,
    };
  });
};

const deleteUserSubscriptionItemFromDb = async (
  userId: string,
  userSubscriptionId: string,
) => {
  const deletedItem = await prisma.userSubscription.delete({
    where: {
      id: userSubscriptionId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'userSubscriptionId, not deleted',
    );
  }

  return deletedItem;
};

export const userSubscriptionService = {
  createUserSubscriptionIntoDb,
  getUserSubscriptionListFromDb,
  getUserSubscriptionByIdFromDb,
  updateUserSubscriptionIntoDb,
  deleteUserSubscriptionItemFromDb,
};

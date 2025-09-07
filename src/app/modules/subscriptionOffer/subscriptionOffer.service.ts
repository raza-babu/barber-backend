import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import Stripe from 'stripe';
import config from '../../../config';

// Initialize Stripe with your secret API key
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-07-30.basil',
});

const createSubscriptionOfferIntoDb = async (userId: string, data: any) => {
  return await prisma.$transaction(async tx => {
    const result = await tx.subscriptionOffer.create({
      data: {
        ...data,
        userId: userId,
      },
    });
    if (!result) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'subscriptionOffer not created',
      );
    }

    // Create a product in Stripe for this subscription offer
    let product: Stripe.Product;
    try {
      product = await stripe.products.create({
        name: result.title,
        description: result.description!,
      });
    } catch (err) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Stripe product not created!');
    }

    let price: Stripe.Price;
    try {
      price = await stripe.prices.create({
        unit_amount: result.price * 100, // Amount in cents
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        product: product.id,
      });
    } catch (err: any) {
      await stripe.products.del(product.id);
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Stripe price creation failed: ${err.message}`,
      );
    }

    console.log(
      'Success! Here is your starter subscription product id: ' + product.id,
    );
    console.log(
      'Success! Here is your starter subscription price id: ' + price.id,
    );

    const updatedResult = await tx.subscriptionOffer.update({
      where: {
        id: result.id,
        userId: userId,
      },
      data: {
        stripeProductId: product.id,
        stripePriceId: price.id,
      },
    });
    if (!updatedResult) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'subscriptionOffer not updated with Stripe IDs',
      );
    }

    return {
      ...result,
      product,
      price,
      stripeProductId: product.id,
      stripePriceId: price.id,
    };
  });
};

const getSubscriptionOfferListFromDb = async () => {
  const result = await prisma.subscriptionOffer.findMany();
  if (result.length === 0) {
    return [];
  }
  const stripeProductIds = await stripe.products.list({
    limit: 100,
  });
  const stripePriceIds = await stripe.prices.list({
    limit: 100,
  });
  const resultWithStripeData = result.map(offer => {
    const product = stripeProductIds.data.find(
      prod => prod.id === offer.stripeProductId,
    );
    const price = stripePriceIds.data.find(
      prc => prc.id === offer.stripePriceId,
    );
    return {
      ...offer,
    };
  });
  return resultWithStripeData;
};

const getSubscriptionOfferByIdFromDb = async (subscriptionOfferId: string) => {
  const result = await prisma.subscriptionOffer.findUnique({
    where: {
      id: subscriptionOfferId,
    },
  });
  if (!result) {
    return { message: 'SubscriptionOffer not found' };
  }
  // const product = await stripe.products.retrieve(result.stripeProductId!);
  // const price = await stripe.prices.retrieve(result.stripePriceId!);
  return result;
};

const updateSubscriptionOfferIntoDb = async (
  userId: string,
  subscriptionOfferId: string,
  data: any,
) => {
  return await prisma.$transaction(async tx => {
    // Step 1: find subscription offer
    const existing = await tx.subscriptionOffer.findFirst({
      where: {
        id: subscriptionOfferId,
        userId,
      },
    });

    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, 'Subscription offer not found');
    }
    if (data.duration) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Duration cannot be updated');
    }

    // Step 2: update in DB first
    const result = await tx.subscriptionOffer.update({
      where: { id: subscriptionOfferId },
      data: { ...data },
    });

    // Step 3: update Stripe product
    let product: Stripe.Product;
    try {
      product = await stripe.products.update(result.stripeProductId!, {
        name: result.title,
        description: result.description!,
      });
    } catch (err) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Stripe product not updated!');
    }

    // Step 4: handle Stripe price
    let newPrice: Stripe.Price | null = null;

    // If user updated price → create new Stripe price
    if (data.price && data.price > 0 && data.price !== existing.price) {
      try {
        newPrice = await stripe.prices.create({
          unit_amount: data.price * 100,
          currency: result.currency || 'usd',
          recurring: { interval: 'month' },
          product: result.stripeProductId!,
        });
      } catch (err) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Stripe price not created!');
      }

      // Deactivate the old price in Stripe
      if (existing.stripePriceId) {
        try {
          await stripe.prices.update(existing.stripePriceId, { active: false });
        } catch (err) {
          // Log but don't block the update if deactivation fails
          console.error('Failed to deactivate old Stripe price:', err);
        }
      }

      // Update DB with new Stripe price id
      await tx.subscriptionOffer.update({
        where: { id: subscriptionOfferId },
        data: { stripePriceId: newPrice.id },
      });
    } else {
      // Otherwise reuse existing active price
      const prices = await stripe.prices.list({
        product: result.stripeProductId!,
        active: true,
        limit: 1,
      });
      if (prices.data.length === 0) {
        throw new AppError(httpStatus.BAD_REQUEST, 'No Stripe price found!');
      }
      newPrice = prices.data[0];
    }

    console.log('Updated Stripe product id:', product.id);
    console.log('Stripe price id:', newPrice.id);

    return {
      ...result,
      stripePriceId: newPrice.id,
    };
  });
};

const deleteSubscriptionOfferItemFromDb = async (
  userId: string,
  subscriptionOfferId: string,
) => {
  return await prisma.$transaction(async tx => {
    const isSuperAdmin = await tx.user.findFirst({
      where: {
        id: userId,
        role: UserRoleEnum.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    if (!isSuperAdmin) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Only super admin can delete subscription offers',
      );
    }
    // Find the subscription offer first
    const existing = await tx.subscriptionOffer.findUnique({
      where: {
        id: subscriptionOfferId,
        // userId: userId,
      },
    });
    if (!existing) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'subscriptionOfferId not found',
      );
    }

    // Delete the subscription offer in DB
    const deletedItem = await tx.subscriptionOffer.delete({
      where: {
        id: subscriptionOfferId,
        // userId: userId,
      },
    });
    if (!deletedItem) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'subscriptionOfferId not deleted',
      );
    }

    // Delete the product from Stripe
    let deleteFromStripe;
    try {
      deleteFromStripe = await stripe.products.update(
        existing.stripeProductId!,
        {
          active: false,
        },
      );
      if (!deleteFromStripe.active === false) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Stripe product not deleted!',
        );
      }
    } catch (err) {
      // Throwing here will rollback the transaction
      throw new AppError(httpStatus.BAD_REQUEST, 'Stripe product not deleted!');
    }

    return {
      ...deletedItem,
      stripeProduct: deleteFromStripe,
    };
  });
};

export const subscriptionOfferService = {
  createSubscriptionOfferIntoDb,
  getSubscriptionOfferListFromDb,
  getSubscriptionOfferByIdFromDb,
  updateSubscriptionOfferIntoDb,
  deleteSubscriptionOfferItemFromDb,
};

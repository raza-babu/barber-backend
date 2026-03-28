import prisma from '../../utils/prisma';
import { SubscriptionType, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createSubscriptionOfferIntoDb = async (userId: string, data: any) => {
  return await prisma.$transaction(async tx => {
    // check existing active subscription offer with same title and duration
    const existing = await tx.subscriptionOffer.findFirst({
      where: {
        title: data.title,
        duration: data.duration,
        status: UserStatus.ACTIVE,
      },
    });
    if (existing) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'An active subscription offer with the same title and duration already exists',
      );
    }

    // need to calculate the durationsDays based on the duration enum value
    let durationDays = 30;
    switch (data.duration) {
      case SubscriptionType.WEEKLY:
        durationDays = 7;
        break;
      case SubscriptionType.MONTHLY:
        durationDays = 30;
        break;
      case SubscriptionType.YEARLY:
        durationDays = 365;
        break;
      case SubscriptionType.LIFETIME:
        durationDays = 365 * 100; // effectively a lifetime subscription
        break;
      default:
        durationDays = 30;
    }

    const result = await tx.subscriptionOffer.create({
      data: {
        ...data,
        durationDays,
        userId: userId,
      },
    });
    if (!result) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'subscriptionOffer not created',
      );
    }

    return result;
  });
};

const getSubscriptionOfferListFromDb = async () => {
  const result = await prisma.subscriptionOffer.findMany();
  if (result.length === 0) {
    return [];
  }
  return result;
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

    //if duration is being updated, we need to recalculate the durationDays based on the new duration value
    if (data.duration) {
      switch (data.duration) {
        case SubscriptionType.WEEKLY:
          data.durationDays = 7;
          break;
        case SubscriptionType.MONTHLY:
          data.durationDays = 30;
          break;
        case SubscriptionType.YEARLY:
          data.durationDays = 365;
          break;
        case SubscriptionType.LIFETIME:
          data.durationDays = 365 * 100; // effectively a lifetime subscription
        default:
          data.durationDays = 30;
      }
    }

    // Step 2: update in DB
    const result = await tx.subscriptionOffer.update({
      where: { id: subscriptionOfferId },
      data: { ...data },
    });

    return result;
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
      },
    });
    if (!deletedItem) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'subscriptionOfferId not deleted',
      );
    }

    return deletedItem;
  });
};

export const subscriptionOfferService = {
  createSubscriptionOfferIntoDb,
  getSubscriptionOfferListFromDb,
  getSubscriptionOfferByIdFromDb,
  updateSubscriptionOfferIntoDb,
  deleteSubscriptionOfferItemFromDb,
};

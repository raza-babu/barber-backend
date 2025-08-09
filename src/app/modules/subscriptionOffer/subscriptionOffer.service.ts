import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createSubscriptionOfferIntoDb = async (userId: string, data: any) => {
  const result = await prisma.subscriptionOffer.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'subscriptionOffer not created');
  }
  return result;
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
  const result = await prisma.subscriptionOffer.update({
    where: {
      id: subscriptionOfferId,
      createdBy: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'subscriptionOfferId, not updated',
    );
  }
  return result;
};

const deleteSubscriptionOfferItemFromDb = async (
  userId: string,
  subscriptionOfferId: string,
) => {
  const deletedItem = await prisma.subscriptionOffer.delete({
    where: {
      id: subscriptionOfferId,
      createdBy: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'subscriptionOfferId, not deleted',
    );
  }

  return deletedItem;
};

export const subscriptionOfferService = {
  createSubscriptionOfferIntoDb,
  getSubscriptionOfferListFromDb,
  getSubscriptionOfferByIdFromDb,
  updateSubscriptionOfferIntoDb,
  deleteSubscriptionOfferItemFromDb,
};

import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createLoyaltySchemeIntoDb = async (
  userId: string,
  data: {
    pointThreshold: number;
    percentage: number;
  },
) => {

  const existingScheme = await prisma.loyaltyScheme.findFirst({
    where: {
      userId: userId,
      pointThreshold: data.pointThreshold,
      percentage: data.percentage,
    },
  });

  if (existingScheme) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A loyalty scheme with the same point threshold and percentage already exists.',
    );
  }

  const result = await prisma.loyaltyScheme.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'loyaltyScheme not created');
  }
  return result;
};

const getLoyaltySchemeListFromDb = async (userId: string) => {
  const result = await prisma.loyaltyScheme.findMany({
    where: {
      userId: userId,
    },
  });
  if (result.length === 0) {
    return { message: 'No loyaltyScheme found' };
  }
  return result;
};

const getLoyaltySchemeByIdFromDb = async (
  userId: string,
  loyaltySchemeId: string,
) => {
  const result = await prisma.loyaltyScheme.findUnique({
    where: {
      userId: userId,
      id: loyaltySchemeId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'loyaltyScheme not found');
  }
  return result;
};

const updateLoyaltySchemeIntoDb = async (
  userId: string,
  loyaltySchemeId: string,
  data: {
    pointThreshold?: number;
    percentage?: number;
  },
) => {
  const result = await prisma.loyaltyScheme.update({
    where: {
      id: loyaltySchemeId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'loyaltySchemeId, not updated');
  }
  return result;
};

const deleteLoyaltySchemeItemFromDb = async (
  userId: string,
  loyaltySchemeId: string,
) => {
  const deletedItem = await prisma.loyaltyScheme.delete({
    where: {
      id: loyaltySchemeId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'loyaltySchemeId, not deleted');
  }

  return deletedItem;
};

export const loyaltySchemeService = {
  createLoyaltySchemeIntoDb,
  getLoyaltySchemeListFromDb,
  getLoyaltySchemeByIdFromDb,
  updateLoyaltySchemeIntoDb,
  deleteLoyaltySchemeItemFromDb,
};

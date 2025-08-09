import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createAdsIntoDb = async (userId: string, data: any) => {
  const result = await prisma.ads.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'ads not created');
  }
  return result;
};

const getAdsListFromDb = async () => {
  const result = await prisma.ads.findMany();
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getAdsByIdFromDb = async (adsId: string) => {
  const result = await prisma.ads.findUnique({
    where: {
      id: adsId,
    },
  }); 
  if (!result) {
    return { message: 'Ads not found' };
  }
  return result;
};

const updateAdsIntoDb = async (userId: string, adsId: string, data: any) => {
  const result = await prisma.ads.update({
    where: {
      id: adsId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'adsId, not updated');
  }
  return result;
};

const deleteAdsItemFromDb = async (userId: string, adsId: string) => {
  const deletedItem = await prisma.ads.delete({
    where: {
      id: adsId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'adsId, not deleted');
  }

  return deletedItem;
};

export const adsService = {
  createAdsIntoDb,
  getAdsListFromDb,
  getAdsByIdFromDb,
  updateAdsIntoDb,
  deleteAdsItemFromDb,
};

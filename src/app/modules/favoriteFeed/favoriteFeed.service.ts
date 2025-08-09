import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createFavoriteFeedIntoDb = async (userId: string, data: any) => {
  const result = await prisma.favoriteFeed.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteFeed not created');
  }
  return result;
};

const getFavoriteFeedListFromDb = async () => {
  const result = await prisma.favoriteFeed.findMany();
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getFavoriteFeedByIdFromDb = async (favoriteFeedId: string) => {
  const result = await prisma.favoriteFeed.findUnique({
    where: {
      id: favoriteFeedId,
    },
  });
  if (!result) {
    return { message: 'FavoriteFeed item not found'};
  }
  return result;
};

const updateFavoriteFeedIntoDb = async (
  userId: string,
  favoriteFeedId: string,
  data: any,
) => {
  const result = await prisma.favoriteFeed.update({
    where: {
      id: favoriteFeedId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteFeedId, not updated');
  }
  return result;
};

const deleteFavoriteFeedItemFromDb = async (
  userId: string,
  favoriteFeedId: string,
) => {
  const deletedItem = await prisma.favoriteFeed.delete({
    where: {
      id: favoriteFeedId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteFeedId, not deleted');
  }

  return deletedItem;
};

export const favoriteFeedService = {
  createFavoriteFeedIntoDb,
  getFavoriteFeedListFromDb,
  getFavoriteFeedByIdFromDb,
  updateFavoriteFeedIntoDb,
  deleteFavoriteFeedItemFromDb,
};

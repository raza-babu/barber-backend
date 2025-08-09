import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createFeedIntoDb = async (userId: string, data: any) => {
  let saloonOwner;
  if (userId) {
    saloonOwner = await prisma.saloonOwner.findFirst({
      where: {
        userId: userId,
      },
    });
  }
  const result = await prisma.feed.create({
    data: {
      ...data,
      userId: userId,
      saloonOwnerId: saloonOwner ? saloonOwner.id : null,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'feed not created');
  }
  return result;
};

const getFeedListFromDb = async (userId: string) => {
  // if(userId) {
  //   const user = await prisma.user.findUnique({
  //     where: {
  //       id: userId,
  //     },
  //   });
  //   if(user?.role !== UserRoleEnum.CUSTOMER) {
  //     throw new AppError(httpStatus.FORBIDDEN, 'Only customers can view the feed');
  //   }
  // }

  const result = await prisma.feed.findMany({
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          image: true,
        },
      },
      shop: {
        select: {
          id: true,
          userId: true,
          shopName: true,
          shopLogo: true,
          avgRating: true,
          ratingCount: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (result.length === 0) {
    return [];
  }
  return result;
};

const getFeedByIdFromDb = async (feedId: string) => {
  const result = await prisma.feed.findUnique({
    where: {
      id: feedId,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          image: true,
        },
      },
      shop: {
        select: {
          id: true,
          userId: true,
          shopName: true,
          shopLogo: true,
          avgRating: true,
          ratingCount: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'feed not found');
  }
  return result;
};

const updateFeedIntoDb = async (userId: string, feedId: string, data: any) => {
  const result = await prisma.feed.update({
    where: {
      id: feedId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'feedId, not updated');
  }
  return result;
};

const deleteFeedItemFromDb = async (userId: string, feedId: string) => {
  const deletedItem = await prisma.feed.delete({
    where: {
      id: feedId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'feedId, not deleted');
  }

  return deletedItem;
};

export const feedService = {
  createFeedIntoDb,
  getFeedListFromDb,
  getFeedByIdFromDb,
  updateFeedIntoDb,
  deleteFeedItemFromDb,
};

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
    select: {
      id: true,
      favoriteCount: true,
      caption: true,
      images: true,
      user: {
        select: {
          id: true,
          fullName: true,
          image: true,
          SaloonOwner: {
            select: {
              userId: true,
              registrationNumber: true,
              shopName: true,
              shopAddress: true,
              shopImages: true,
              shopVideo: true,
              shopLogo: true,
              avgRating: true,
              ratingCount: true,
            },
          },
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
  return result.map(feed => ({
    id: feed.id,
    userId: feed.user.id,
    userName: feed.user.fullName,
    userImage: feed.user.image,
    caption: feed.caption,
    images: feed.images,
    favoriteCount: feed.favoriteCount,
    saloonOwner:
      feed.user.SaloonOwner && feed.user.SaloonOwner.length > 0
        ? {
            userId: feed.user.SaloonOwner[0].userId,
            shopName: feed.user.SaloonOwner[0].shopName,
            registration: feed.user.SaloonOwner[0].registrationNumber,
            shopAddress: feed.user.SaloonOwner[0].shopAddress,
            shopImages: feed.user.SaloonOwner[0].shopImages,
            shopVideo: feed.user.SaloonOwner[0].shopVideo,
            shopLogo: feed.user.SaloonOwner[0].shopLogo,
            avgRating: feed.user.SaloonOwner[0].avgRating,
            ratingCount: feed.user.SaloonOwner[0].ratingCount,
          }
        : null,
  }));
};

const getFeedByIdFromDb = async (feedId: string) => {
  const result = await prisma.feed.findUnique({
    where: {
      id: feedId,
    },
    select: {
      id: true,
      favoriteCount: true,
      caption: true,
      images: true,
      user: {
        select: {
          id: true,
          fullName: true,
          image: true,
          SaloonOwner: {
            select: {
              userId: true,
              shopName: true,
              shopAddress: true,
              shopImages: true,
              shopVideo: true,
              shopLogo: true,
              avgRating: true,
              ratingCount: true,
            },
          },
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'feed not found');
  }
  return {
    id: result.id,
    userId: result.user.id,
    userName: result.user.fullName,
    userImage: result.user.image,
    caption: result.caption,
    images: result.images,
    favoriteCount: result.favoriteCount,
    saloonOwner:
      result.user.SaloonOwner && result.user.SaloonOwner.length > 0
        ? {
            userId: result.user.SaloonOwner[0].userId,
            shopName: result.user.SaloonOwner[0].shopName,
            shopAddress: result.user.SaloonOwner[0].shopAddress,
            shopImages: result.user.SaloonOwner[0].shopImages,
            shopVideo: result.user.SaloonOwner[0].shopVideo,
            shopLogo: result.user.SaloonOwner[0].shopLogo,
            avgRating: result.user.SaloonOwner[0].avgRating,
            ratingCount: result.user.SaloonOwner[0].ratingCount,
          }
        : null,
  };
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

import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { deleteFileFromSpace } from '../../utils/deleteImage';

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
  // check the post is favorite by the user or not
  const favorites = await prisma.favoriteFeed.findMany({
    where: {
      userId: userId,
      feedId: {
        in: result.map(feed => feed.id),
      },
    },
  });
  const favoriteFeedIds = favorites.map((fav: { feedId: string }) => fav.feedId);


  return result.map(feed => ({
    id: feed.id,
    userId: feed.user.id,
    userName: feed.user.fullName,
    userImage: feed.user.image,
    caption: feed.caption,
    images: feed.images,
    favoriteCount: feed.favoriteCount,
    isFavorite: favoriteFeedIds.includes(feed.id),
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


const getMyFeedsFromDb = async (userId: string) => {
  if(!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }
 
  const result = await prisma.feed.findMany({
    where: {
      userId: userId,
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

const updateFeedIntoDb = async (
  userId: string,
  feedId: string,
  data: any,
  existingImages: string[]
) => {
  const feed = await prisma.feed.findUnique({
    where: { id: feedId },
  });

  if (!feed) {
    throw new AppError(httpStatus.BAD_REQUEST, "Feed not found");
  }

  // Update DB
  const result = await prisma.feed.update({
    where: {
      id: feedId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });

  // Delete images removed by the client
  const removedImages = (feed.images || []).filter(
    img => !data.images.includes(img)
  );

  for (const img of removedImages) {
    await deleteFileFromSpace(img); // your DO Spaces delete helper
    console.log("Deleted feed image from space:", img);
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
  getMyFeedsFromDb,
  getFeedByIdFromDb,
  updateFeedIntoDb,
  deleteFeedItemFromDb,
};

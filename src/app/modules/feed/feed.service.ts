import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { notificationService } from '../notification/notification.service';
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

  // Send notification to all followers about new feed
  try {
    if (userId) {
      // Get all followers of this user
      const followers = await prisma.follow.findMany({
        where: {
          followingId: userId,
        },
        select: {
          userId: true,
        },
      });

      // Get creator's name
      const creator = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });

      // Send notifications to all followers
      if (followers.length > 0 && creator) {
        const followerIds = followers.map(f => f.userId);
        
        // Get FCM tokens for all followers
        const followerTokens = await prisma.user.findMany({
          where: { id: { in: followerIds } },
          select: { id: true, fcmToken: true },
        });

        // Send notification to each follower
        for (const follower of followerTokens) {
          await notificationService.sendNotification(
            follower.fcmToken,
            'New Feed Posted',
            `${creator.fullName} posted new content!`,
            follower.id,
          );
        }
      }
    }
  } catch (error) {
    console.error('Error sending feed creation notification:', error);
  }

  return result;
};

// ...existing code...
const getFeedListFromDb = async (
  userId: string,
  page: number | string = 1,
  limit: number | string = 10,
) => {
  // Coerce and validate inputs so `take` is always a valid integer for Prisma
  const take = Math.max(1, Math.min(100, Number(limit) || 10)); // cap limit (1..100)
  const pageNum = Math.max(1, Number(page) || 1);
  const skip = (pageNum - 1) * take;

  // fetch page + total in a transaction
  const [result, total] = await prisma.$transaction([
    prisma.feed.findMany({
      skip,
      take,
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
    }),
    prisma.feed.count(),
  ]);

  if (result.length === 0) {
    return {
      items: [],
      meta: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // favorites for returned feeds
  const favorites = userId
    ? await prisma.favoriteFeed.findMany({
        where: {
          userId: userId,
          feedId: { in: result.map(feed => feed.id) },
        },
      })
    : [];

  const favoriteFeedIds = favorites.map(
    (fav: { feedId: string }) => fav.feedId,
  );

  const items = result.map(feed => ({
    id: feed.id,
    userId: feed.user.id,
    userName: feed.user.fullName,
    userImage: feed.user.image,
    caption: feed.caption,
    images: feed.images,
    favoriteCount: feed.favoriteCount,
    isFavorite: userId ? favoriteFeedIds.includes(feed.id) : false,
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

  return {
    items,
    meta: {
      total,
      page: pageNum,
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
};

// ...existing code...

const getMyFeedsFromDb = async (userId: string) => {
  if (!userId) {
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
  existingImages: string[],
) => {
  const feed = await prisma.feed.findUnique({
    where: { id: feedId },
  });

  if (!feed) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Feed not found');
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
    img => !data.images.includes(img),
  );

  for (const img of removedImages) {
    await deleteFileFromSpace(img); // your DO Spaces delete helper
    console.log('Deleted feed image from space:', img);
  }

  return result;
};

const deleteFeedItemFromDb = async (userId: string, feedId: string) => {
  // find feed to get images for deletion
  const feed = await prisma.feed.findUnique({
    where: { id: feedId },
  });

  if (!feed) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Feed not found');
  }

  // Delete images from space
  for (const img of feed.images || []) {
    await deleteFileFromSpace(img); // your DO Spaces delete helper
    console.log('Deleted feed image from space:', img);
  }
  // delete from other tables if any (e.g., favorites) before deleting feed itself
  const deleteFavorites = await prisma.favoriteFeed.findMany({
    where: { feedId: feedId },
  });
  for (const fav of deleteFavorites) {
    await prisma.favoriteFeed.delete({
      where: { id: fav.id },
    });
    console.log('Deleted favorite feed entry:', fav.id);
  }

  // Delete feed from DB
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

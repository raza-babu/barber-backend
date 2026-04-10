import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { notificationService } from '../notification/notification.service';

const createFavoriteFeedIntoDb = async (
  userId: string,
  data: {
    feedId: string;
  },
) => {
  const result = await prisma.favoriteFeed.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteFeed not created');
  }

  // Update favorite count in Feed table
  await prisma.feed.update({
    where: {
      id: data.feedId,
    },
    data: {
      favoriteCount: {
        increment: 1,
      },
    },
  });

  // Send notification to feed creator
  try {
    const feed = await prisma.feed.findUnique({
      where: { id: data.feedId },
      select: { userId: true },
    });

    if (feed && feed.userId) {
      const feedCreator = await prisma.user.findUnique({
        where: { id: feed.userId },
        select: { fcmToken: true },
      });

      // Get the customer's name who favorited the feed
      const customer = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });

      if (feedCreator && customer) {
        await notificationService.sendNotification(
          feedCreator.fcmToken,
          'Feed Liked',
          `${customer.fullName} liked your feed!`,
          feed.userId,
        );
      }
    }
  } catch (error) {
    console.error('Error sending feed favorite notification:', error);
  }

  return result;
};

const getFavoriteFeedListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {},
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query
  const searchQuery = options.searchTerm
    ? {
        feed: {
          is: {
            caption: {
              contains: options.searchTerm,
              mode: 'insensitive' as const,
            },
          },
        },
      }
    : {};

  // Combine all queries
  const whereClause = {
    userId: userId,
    ...(Object.keys(searchQuery).length > 0 && searchQuery),
  };

  const [result, total] = await Promise.all([
    prisma.favoriteFeed.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        feedId: true,
        feed: {
          select: {
            id: true,
            caption: true,
            images: true,
            user: {
              select: {
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
        },
      },
    }),
    prisma.favoriteFeed.count({
      where: whereClause,
    }),
  ]);

  // Flatten the feed object in each result
  const flattenedResult = result.map(item => {
    const { feed, ...rest } = item;
    const { user, ...feedRest } = feed;
    return {
      ...rest,
      ...feedRest,
      userId: user.fullName,
      profileImage: user.image,
      saloonOwner:
        user.SaloonOwner && user.SaloonOwner.length > 0
          ? {
              userId: user.SaloonOwner[0].userId,
              shopName: user.SaloonOwner[0].shopName,
              registration: user.SaloonOwner[0].registrationNumber,
              shopAddress: user.SaloonOwner[0].shopAddress,
              shopImages: user.SaloonOwner[0].shopImages,
              shopVideo: user.SaloonOwner[0].shopVideo,
              shopLogo: user.SaloonOwner[0].shopLogo,
              avgRating: user.SaloonOwner[0].avgRating,
              ratingCount: user.SaloonOwner[0].ratingCount,
            }
          : null,
    };
  });

  return formatPaginationResponse(flattenedResult, total, page, limit);
};

const getFavoriteFeedByIdFromDb = async (
  userId: string,
  favoriteFeedId: string,
) => {
  const result = await prisma.favoriteFeed.findUnique({
    where: {
      id: favoriteFeedId,
      userId: userId,
    },
    select: {
      id: true,
      feedId: true,
      feed: true,
    },
  });
  if (!result) {
    return { message: 'FavoriteFeed item not found' };
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
  feedId: string,
) => {
  // Get count of favoriteFeed items to be deleted
  const favoriteFeedCount = await prisma.favoriteFeed.count({
    where: {
      feedId: feedId,
      userId: userId,
    },
  });

  const deletedItem = await prisma.favoriteFeed.deleteMany({
    where: {
      feedId: feedId,
      userId: userId,
    },
  });
  if (!deletedItem || deletedItem.count === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteFeedId, not deleted');
  }

  // Update favorite count in Feed table
  await prisma.feed.update({
    where: {
      id: feedId,
      favoriteCount: {
        gte: favoriteFeedCount,
      },
    },
    data: {
      favoriteCount: {
        decrement: favoriteFeedCount,
      },
    },
  });

  return deletedItem;
};

export const favoriteFeedService = {
  createFavoriteFeedIntoDb,
  getFavoriteFeedListFromDb,
  getFavoriteFeedByIdFromDb,
  updateFavoriteFeedIntoDb,
  deleteFavoriteFeedItemFromDb,
};

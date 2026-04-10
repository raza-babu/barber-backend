import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { calculatePagination } from '../../utils/pagination';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { notificationService } from '../notification/notification.service';

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

  // Send notification to followers about new loyalty scheme
  try {
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    // Get all followers of this salon owner
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { follower: { select: { fcmToken: true } } },
    });

    if (owner && followers.length > 0) {
      const notificationPromises = followers.map(follower =>
        notificationService.sendNotification(
          follower.follower.fcmToken,
          'New Loyalty Scheme',
          `${owner.fullName} introduced a new loyalty scheme with ${data.percentage}% discount!`,
          userId,
        ).catch(error => console.error('Error sending loyalty scheme notification:', error))
      );
      await Promise.all(notificationPromises);
    }
  } catch (error) {
    console.error('Error sending loyalty scheme creation notification:', error);
  }

  return result;
};

const getLoyaltySchemeListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const [result, total] = await Promise.all([
    prisma.loyaltyScheme.findMany({
      where: {
        userId: userId,
      },
      include: {
        loyaltyRedemptions: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    }),
    prisma.loyaltyScheme.count({
      where: {
        userId: userId,
      },
    }),
  ]);

  if (result.length === 0) {
    return { message: 'No loyaltyScheme found' };
  }

  const data = result.map((scheme) => ({
    ...scheme,
    isUsed: scheme.loyaltyRedemptions.length > 0,
    loyaltyRedemptions: undefined,
  }));

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
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

  const existingScheme = await prisma.loyaltyScheme.findFirst({
    where: {
      id: loyaltySchemeId,
      userId: userId,
    },
  });

  if (!existingScheme) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Loyalty scheme not found for this user.',
    );
  }

  if (data.pointThreshold !== undefined && data.pointThreshold <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Point threshold must be greater than 0.',
    );
  }

  if (data.percentage !== undefined) {
    if (data.percentage <= 0 || data.percentage > 100) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Percentage must be between 1 and 100.',
      );
    }
  }

  const finalPointThreshold =
    data.pointThreshold ?? existingScheme.pointThreshold;

  const finalPercentage =
    data.percentage ?? existingScheme.percentage;

  const duplicateScheme = await prisma.loyaltyScheme.findFirst({
    where: {
      userId: userId,
      pointThreshold: finalPointThreshold,
      percentage: finalPercentage,
      NOT: {
        id: loyaltySchemeId,
      },
    },
  });

  if (duplicateScheme) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A loyalty scheme with the same point threshold and percentage already exists.',
    );
  }

  if (
    finalPointThreshold === existingScheme.pointThreshold &&
    finalPercentage === existingScheme.percentage
  ) {
    return existingScheme;
  }

  const result = await prisma.loyaltyScheme.update({
    where: {
      id: loyaltySchemeId,
    },
    data: {
      pointThreshold: finalPointThreshold,
      percentage: finalPercentage,
    },
  });

  // Send notification to followers about loyalty scheme update
  try {
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    // Get all followers of this salon owner
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { follower: { select: { fcmToken: true } } },
    });

    if (owner && followers.length > 0) {
      const notificationPromises = followers.map(follower =>
        notificationService.sendNotification(
          follower.follower.fcmToken,
          'Loyalty Scheme Updated',
          `${owner.fullName} updated the loyalty scheme to ${finalPercentage}% discount!`,
          userId,
        ).catch(error => console.error('Error sending update notification:', error))
      );
      await Promise.all(notificationPromises);
    }
  } catch (error) {
    console.error('Error sending loyalty scheme update notification:', error);
  }

  return result;
};

const deleteLoyaltySchemeItemFromDb = async (
  userId: string,
  loyaltySchemeId: string,
) => {
  const loyaltyScheme = await prisma.loyaltyScheme.findUnique({
    where: {
      id: loyaltySchemeId,
      userId: userId,
    },
  });
  if (!loyaltyScheme) {
    throw new AppError(httpStatus.BAD_REQUEST, 'loyaltySchemeId, not found');
  }

  const deletedItem = await prisma.loyaltyScheme.delete({
    where: {
      id: loyaltySchemeId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'loyaltySchemeId, not deleted');
  }

  // Send notification to followers about loyalty scheme deletion
  try {
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    // Get all followers of this salon owner
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { follower: { select: { fcmToken: true } } },
    });

    if (owner && followers.length > 0) {
      const notificationPromises = followers.map(follower =>
        notificationService.sendNotification(
          follower.follower.fcmToken,
          'Loyalty Scheme Deleted',
          `The loyalty scheme by ${owner.fullName} has been deleted.`,
          userId,
        ).catch(error => console.error('Error sending deletion notification:', error))
      );
      await Promise.all(notificationPromises);
    }
  } catch (error) {
    console.error('Error sending loyalty scheme deletion notification:', error);
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

import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createFollowIntoDb = async (
  userId: string,
  data: {
    followingId: string;
  },
) => {
  if (data.followingId === userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You cannot follow yourself');
  }

  const followingUser = await prisma.user.findUnique({
    where: {
      id: data.followingId,
      status: UserStatus.ACTIVE,
    },
  });
  if (!followingUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'Following user not found');
  }

  const existingFollow = await prisma.follow.findFirst({
    where: {
      userId: userId,
      followingId: data.followingId,
    },
  });
  if (existingFollow) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You are already following this user',
    );
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const follow = await tx.follow.create({
        data: {
          ...data,
          userId: userId,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          followingCount: { increment: 1 },
        },
      });

      await tx.user.update({
        where: { id: data.followingId },
        data: {
          followerCount: { increment: 1 },
        },
      });

      return follow;
    });

    return result;
  } catch (error) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Transaction failed');
  }
};

const getFollowingListFromDb = async (userId: string) => {
  const result = await prisma.follow.findMany({
    where: {
      userId: userId,
    },
    select: {
      id: true,
      following: {
        select: {
          id: true,
          status: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          image: true,
          gender: true,
          address: true,
        },
      },
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  if (result.length === 0) {
    return { message: 'No following found' };
  }

  return result
    .filter(item => item.following.status === UserStatus.ACTIVE)
    .map(item => ({
      id: item.id,
      followingId: item.following.id,
      followingName: item.following.fullName,
      followingEmail: item.following.email,
      followingPhoneNumber: item.following.phoneNumber,
      followingImage: item.following.image,
      followingGender: item.following.gender,
      followingAddress: item.following.address,
    }));
};

const getFollowListFromDb = async (userId: string) => {
  const result = await prisma.follow.findMany({
    where: {
      followingId: userId,
    },
    select: {
      id: true,
      follower: {
        select: {
          id: true,
          status: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          image: true,
          address: true,
          gender: true,
        },
      },
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  if (result.length === 0) {
    return { message: 'No follower found' };
  }
  return result
    .filter(item => item.follower.status === UserStatus.ACTIVE)
    .map(item => ({
      id: item.id,
      followerId: item.follower.id,
      followerName: item.follower.fullName,
      followerEmail: item.follower.email,
      followerPhoneNumber: item.follower.phoneNumber,
      followerImage: item.follower.image,
      followerAddress: item.follower.address,
      followerGender: item.follower.gender,
    }));
};

const getFollowByIdFromDb = async (userId: string, followId: string) => {
  const result = await prisma.follow.findUnique({
    where: {
      id: followId,
      OR: [
        { userId: userId },
        { followingId: userId },
      ]
    },
    select: {
      id: true,
      following: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          image: true,
          status: true,
        },
      },
    },
  });
  if (!result || result.following.status !== UserStatus.ACTIVE) {
    throw new AppError(httpStatus.NOT_FOUND, 'follow not found');
  }
  return {
    id: result.id,
    followingId: result.following.id,
    followingName: result.following.fullName,
    followingEmail: result.following.email,
    followingPhoneNumber: result.following.phoneNumber,
    followingImage: result.following.image,
  };
};

const updateFollowIntoDb = async (
  userId: string,
  followId: string,
  data: any,
) => {
  const result = await prisma.follow.update({
    where: {
      id: followId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'followId, not updated');
  }
  return result;
};

const deleteFollowingFromDb = async (userId: string, followId: string) => {
  const follow = await prisma.follow.findUnique({
    where: {
      id: followId,
      userId: userId,
    },
  });
  if (!follow) {
    throw new AppError(httpStatus.NOT_FOUND, 'Follow not found');
  }

  const existingFollowing = await prisma.user.findUnique({
    where: {
      id: follow.followingId,
      status: UserStatus.ACTIVE,
    },
  });
  if (!existingFollowing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Following user not found');
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const deletedItem = await tx.follow.delete({
        where: {
          id: followId,
          userId: userId,
        },
      });

      const followingId = follow.followingId;

      const findFollowingProfile = await tx.user.findUnique({
        where: {
          id: followingId,
          status: UserStatus.ACTIVE,
        },
      });
      if (!findFollowingProfile) {
        throw new AppError(httpStatus.NOT_FOUND, 'Following profile not found');
      }

      const deletedFollowingProfile = await tx.user.update({
        where: {
          id: followingId,
          status: UserStatus.ACTIVE,
        },
        data: {
          followerCount: {
            decrement: 1,
          },
        },
      });
      if (!deletedFollowingProfile) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Following profile not updated',
        );
      }

      const deletedOwnProfile = await tx.user.update({
        where: {
          id: userId,
          status: UserStatus.ACTIVE,
        },
        data: {
          followingCount: {
            decrement: 1,
          },
        },
      });
      if (!deletedOwnProfile) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Own profile not updated');
      }

      return deletedItem;
    });

    return result;
  } catch (error) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Transaction failed');
  }
};

export const followService = {
  createFollowIntoDb,
  getFollowingListFromDb,
  getFollowListFromDb,
  getFollowByIdFromDb,
  updateFollowIntoDb,
  deleteFollowingFromDb,
};

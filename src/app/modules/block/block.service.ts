import prisma from '../../utils/prisma';
import { UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const blockUserIntoDb = async (userId: string, blockedId: string, reason?: string) => {
  // Validate that user is not blocking themselves
  if (userId === blockedId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You cannot block yourself');
  }

  // Validate that the blocked user exists and is active
  const blockedUser = await prisma.user.findUnique({
    where: {
      id: blockedId,
      status: UserStatus.ACTIVE,
      isDeactivated: false,
    },
  });

  if (!blockedUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found or is inactive');
  }

  // Check if already blocked
  const existingBlock = await prisma.block.findFirst({
    where: {
      blockerId: userId,
      blockedId: blockedId,
    },
  });

  if (existingBlock) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User is already blocked');
  }

  try {
    // Use transaction for atomic operation
    const result = await prisma.$transaction(async tx => {
      // Create the block relationship
      const block = await tx.block.create({
        data: {
          blockerId: userId,
          blockedId: blockedId,
          reason: reason,
        },
      });

      // Increment block count for blocker
      await tx.user.update({
        where: { id: userId },
        data: {
          blockCount: { increment: 1 },
        },
      });

      // Increment blockedBy count for blocked user
      await tx.user.update({
        where: { id: blockedId },
        data: {
          blockedByCount: { increment: 1 },
        },
      });

      // Remove follow relationship if exists (both directions)
      await tx.follow.deleteMany({
        where: {
          OR: [
            { userId: userId, followingId: blockedId },
            { userId: blockedId, followingId: userId },
          ],
        },
      });

      // Update follower/following counts
      const followerCount = await tx.follow.count({
        where: { followingId: userId },
      });

      const followingCount = await tx.follow.count({
        where: { userId: userId },
      });

      const blockedFollowerCount = await tx.follow.count({
        where: { followingId: blockedId },
      });

      const blockedFollowingCount = await tx.follow.count({
        where: { userId: blockedId },
      });

      // Update counts atomically
      await tx.user.update({
        where: { id: userId },
        data: {
          followerCount: followerCount,
          followingCount: followingCount,
        },
      });

      await tx.user.update({
        where: { id: blockedId },
        data: {
          followerCount: blockedFollowerCount,
          followingCount: blockedFollowingCount,
        },
      });

      return block;
    });

    return result;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to block user');
  }
};

const unblockUserFromDb = async (userId: string, blockedId: string) => {
  // Validate that the block relationship exists
  const block = await prisma.block.findFirst({
    where: {
      blockerId: userId,
      blockedId: blockedId,
    },
  });

  if (!block) {
    throw new AppError(httpStatus.NOT_FOUND, 'Block relationship not found');
  }

  try {
    // Use transaction for atomic operation
    const result = await prisma.$transaction(async tx => {
      // Delete the block relationship
      await tx.block.delete({
        where: {
          id: block.id,
        },
      });

      // Decrement block count for blocker
      await tx.user.update({
        where: { id: userId },
        data: {
          blockCount: { decrement: 1 },
        },
      });

      // Decrement blockedBy count for blocked user
      await tx.user.update({
        where: { id: blockedId },
        data: {
          blockedByCount: { decrement: 1 },
        },
      });

      return { success: true, message: 'User unblocked successfully' };
    });

    return result;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to unblock user');
  }
};

const getBlockListFromDb = async (userId: string) => {
  const blocks = await prisma.block.findMany({
    where: {
      blockerId: userId,
    },
    select: {
      id: true,
      blocked: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          role: true,
          phoneNumber: true,
        },
      },
      reason: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (blocks.length === 0) {
    return { message: 'No blocked users found', data: [] };
  }

  return {
    data: blocks.map(block => ({
      id: block.id,
      blockedId: block.blocked.id,
      blockedName: block.blocked.fullName,
      blockedEmail: block.blocked.email,
      blockedImage: block.blocked.image,
      blockedRole: block.blocked.role,
      blockedPhoneNumber: block.blocked.phoneNumber,
      reason: block.reason,
      blockedAt: block.createdAt,
    })),
  };
};

const checkIfBlockedFromDb = async (userId1: string, userId2: string) => {
  const isBlocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    },
  });

  return !!isBlocked;
};

const getBlockedUserIdsFromDb = async (userId: string) => {
  const blocks = await prisma.block.findMany({
    where: {
      blockerId: userId,
    },
    select: {
      blockedId: true,
    },
  });

  return blocks.map(block => block.blockedId);
};

const getBlockedByUserIdsFromDb = async (userId: string) => {
  const blocks = await prisma.block.findMany({
    where: {
      blockedId: userId,
    },
    select: {
      blockerId: true,
    },
  });

  return blocks.map(block => block.blockerId);
};

export const blockService = {
  blockUserIntoDb,
  unblockUserFromDb,
  getBlockListFromDb,
  checkIfBlockedFromDb,
  getBlockedUserIdsFromDb,
  getBlockedByUserIdsFromDb,
};

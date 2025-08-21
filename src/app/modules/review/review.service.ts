import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createReviewIntoDb = async (userId: string, data: any) => {
  const result = await prisma.review.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'review not created');
  }
  return result;
};

const getReviewListForSaloonFromDb = async (
  userId: string,
  saloonOwnerId: string,
) => {
  const result = await prisma.review.findMany({
    where: {
      saloonOwnerId: saloonOwnerId,
    },
    select: {
      id: true,
      userId: true,
      barberId: true,
      saloonOwnerId: true,
      bookingId: true,
      rating: true,
      comment: true,
      createdAt: true,
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

const getReviewListForBarberFromDb = async (
  userId: string,
  barberId: string,
) => {
  const result = await prisma.review.findMany({
    where: {
      barberId: userId,
    },
    select: {
      id: true,
      userId: true,
      barberId: true,
      saloonOwnerId: true,
      bookingId: true,
      rating: true,
      comment: true,
      createdAt: true,
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

const getReviewByIdFromDb = async (userId: string, reviewId: string) => {
  const result = await prisma.review.findUnique({
    where: {
      id: reviewId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'review not found');
  }
  return result;
};

const updateReviewIntoDb = async (
  userId: string,
  reviewId: string,
  data: any,
) => {
  const result = await prisma.review.update({
    where: {
      id: reviewId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'reviewId, not updated');
  }
  return result;
};

const deleteReviewItemFromDb = async (userId: string, reviewId: string) => {
  const deletedItem = await prisma.review.delete({
    where: {
      id: reviewId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'reviewId, not deleted');
  }

  return deletedItem;
};

export const reviewService = {
  createReviewIntoDb,
  getReviewListForSaloonFromDb,
  getReviewListForBarberFromDb,
  getReviewByIdFromDb,
  updateReviewIntoDb,
  deleteReviewItemFromDb,
};

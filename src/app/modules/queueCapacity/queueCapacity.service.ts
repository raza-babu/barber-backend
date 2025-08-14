import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { messaging } from 'firebase-admin';

const createQueueCapacityIntoDb = async (userId: string, data: any) => {
  const result = await prisma.queueCapacity.create({
    data: {
      ...data,
      saloonOwnerId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'queueCapacity not created');
  }
  return result;
};

const getQueueCapacityListFromDb = async (userId: string) => {
  const result = await prisma.queueCapacity.findMany({
    where: {
      saloonOwnerId: userId,
    },
    select: {
      id: true,
      barberId: true,
      maxCapacity: true,
      barber: {
        select: {
          user: {
            select: {
              fullName: true,
              image: true,
            },
          },
        },
      },
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result.map(item => ({
    id: item.id,
    barberId: item.barberId,
    maxCapacity: item.maxCapacity,
    barberName: item.barber.user.fullName,
    image: item.barber.user.image,
  }));
};

const getQueueCapacityByIdFromDb = async (
  userId: string,
  queueCapacityId: string,
) => {
  const result = await prisma.queueCapacity.findUnique({
    where: {
      id: queueCapacityId,
      saloonOwnerId: userId,
    },
    select: {
      id: true,
      barberId: true,
      maxCapacity: true,
      barber: {
        select: {
          user: {
            select: {
              fullName: true,
              image: true,
            },
          },
        },
      },
    },
  });
  if (!result) {
    return { message: 'Queue capacity not found' };
  }
  return {
    id: result.id,
    barberId: result.barberId,
    maxCapacity: result.maxCapacity,
    barberName: result.barber.user.fullName,
    image: result.barber.user.image,
  };
};

const updateQueueCapacityIntoDb = async (
  userId: string,
  queueCapacityId: string,
  data: any,
) => {
  const result = await prisma.queueCapacity.update({
    where: {
      id: queueCapacityId,
      saloonOwnerId: userId,
    },
    data: {
      ...data,
    },
    select: {
      id: true,
      barberId: true,
      maxCapacity: true,
      barber: {
        select: {
          user: {
            select: {
              fullName: true,
              image: true,
            },
          },
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'queueCapacityId, not updated');
  }
  return {
    id: result.id,
    barberId: result.barberId,
    maxCapacity: result.maxCapacity,
    barberName: result.barber.user.fullName,
    image: result.barber.user.image,
  };
};

const deleteQueueCapacityItemFromDb = async (
  userId: string,
  queueCapacityId: string,
) => {
  const deletedItem = await prisma.queueCapacity.delete({
    where: {
      id: queueCapacityId,
      saloonOwnerId: userId,
    },
    select: {
      id: true,
      barberId: true,
      maxCapacity: true,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'queueCapacityId, not deleted');
  }

  return deletedItem;
};

export const queueCapacityService = {
  createQueueCapacityIntoDb,
  getQueueCapacityListFromDb,
  getQueueCapacityByIdFromDb,
  updateQueueCapacityIntoDb,
  deleteQueueCapacityItemFromDb,
};

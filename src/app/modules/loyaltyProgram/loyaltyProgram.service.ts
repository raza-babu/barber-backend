import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination } from '../../utils/pagination';

const createLoyaltyProgramIntoDb = async (
  userId: string,
  data: {
    serviceId: string;
    points: number;
  },
) => {
  const findService = await prisma.service.findUnique({
    where: {
      id: data.serviceId,
      saloonOwnerId: userId,
    },
  });
  if (!findService) {
    throw new AppError(httpStatus.NOT_FOUND, 'Service not found');
  }

  const existingScheme = await prisma.loyaltyProgram.findUnique({
    where: {
      serviceId: data.serviceId,
    },
  });
  if (existingScheme) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Loyalty program for this service already exists to this service',
    );
  }

  const result = await prisma.loyaltyProgram.create({
    data: {
      ...data,
      serviceName: findService.serviceName,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'loyaltyProgram not created');
  }
  return result;
};

const getLoyaltyProgramListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
    const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  
  const searchTerm = options.searchTerm || '';

  const whereCondition = {
    userId: userId,
    ...(searchTerm && {
      OR: [
        {
          serviceName: {
            contains: searchTerm,
            mode: 'insensitive' as const,
          },
        },
      ],
    }),
  };

  const [result, total] = await prisma.$transaction([
    prisma.loyaltyProgram.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    }),
    prisma.loyaltyProgram.count({
      where: whereCondition,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: result,
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

const getLoyaltyProgramByIdFromDb = async (
  userId: string,
  loyaltyProgramId: string,
) => {
  const result = await prisma.loyaltyProgram.findUnique({
    where: {
      id: loyaltyProgramId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'loyaltyProgram not found');
  }
  return result;
};

const updateLoyaltyProgramIntoDb = async (
  userId: string,
  loyaltyProgramId: string,
  data: {
    serviceId?: string;
    points?: number;
  },
) => {
  const findService = await prisma.service.findUnique({
    where: {
      id: data.serviceId,
      saloonOwnerId: userId,
    },
  });
  if (!findService) {
    throw new AppError(httpStatus.NOT_FOUND, 'Service not found');
  }

  const result = await prisma.loyaltyProgram.update({
    where: {
      id: loyaltyProgramId,
      userId: userId,
    },
    data: {
      ...data,
      serviceName: findService.serviceName,

    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'loyaltyProgramId, not updated');
  }
  return result;
};

const deleteLoyaltyProgramItemFromDb = async (
  userId: string,
  loyaltyProgramId: string,
) => {
  const deletedItem = await prisma.loyaltyProgram.delete({
    where: {
      id: loyaltyProgramId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'loyaltyProgramId, not deleted');
  }

  return deletedItem;
};

export const loyaltyProgramService = {
  createLoyaltyProgramIntoDb,
  getLoyaltyProgramListFromDb,
  getLoyaltyProgramByIdFromDb,
  updateLoyaltyProgramIntoDb,
  deleteLoyaltyProgramItemFromDb,
};

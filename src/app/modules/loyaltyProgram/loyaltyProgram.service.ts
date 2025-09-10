import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

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

const getLoyaltyProgramListFromDb = async (userId: string) => {
  const result = await prisma.loyaltyProgram.findMany({
    where: {
      userId: userId,
    },
  });
  if (result.length === 0) {
    return { message: 'No loyaltyProgram found' };
  }
  return result;
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

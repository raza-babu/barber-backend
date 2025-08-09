import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createAccessFunctionIntoDb = async (userId: string, data: any) => {
  const result = await prisma.accessFunction.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'accessFunction not created');
  }
  return result;
};

const getAccessFunctionListFromDb = async () => {
  const result = await prisma.accessFunction.findMany();
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getAccessFunctionByIdFromDb = async (accessFunctionId: string) => {
  const result = await prisma.accessFunction.findUnique({
    where: {
      id: accessFunctionId,
    },
  });
  if (!result) {
    return { message: 'AccessFunction item is not found' };
  }
  return result;
};

const updateAccessFunctionIntoDb = async (
  userId: string,
  accessFunctionId: string,
  data: any,
) => {
  const result = await prisma.accessFunction.update({
    where: {
      id: accessFunctionId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'accessFunction item is not updated');
  }
  return result;
};

const deleteAccessFunctionItemFromDb = async (
  userId: string,
  accessFunctionId: string,
) => {
  const deletedItem = await prisma.accessFunction.delete({
    where: {
      id: accessFunctionId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'accessFunctionId, not deleted');
  }

  return deletedItem;
};

export const accessFunctionService = {
  createAccessFunctionIntoDb,
  getAccessFunctionListFromDb,
  getAccessFunctionByIdFromDb,
  updateAccessFunctionIntoDb,
  deleteAccessFunctionItemFromDb,
};

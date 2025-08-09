import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createSupportRepliesIntoDb = async (userId: string, data: any) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      fullName: true,
    },
  });

  const result = await prisma.support.create({
    data: {
      ...data,
      userId: userId,
      userName: user?.fullName,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Support Item is not created');
  }
  return result;
};

const getSupportRepliesListFromDb = async () => {
  const result = await prisma.support.findMany();
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getSupportRepliesByIdFromDb = async (supportRepliesId: string) => {
  const result = await prisma.support.findUnique({
    where: {
      id: supportRepliesId,
    },
  });
  if (!result) {
    return { message: 'Support item is not found' };
  }
  return result;
};

const updateSupportRepliesIntoDb = async (
  userId: string,
  supportRepliesId: string,
  data: any,
) => {
  const result = await prisma.support.update({
    where: {
      id: supportRepliesId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Support Item is not updated');
  }
  return result;
};

const deleteSupportRepliesItemFromDb = async (
  userId: string,
  supportRepliesId: string,
) => {
  const deletedItem = await prisma.support.delete({
    where: {
      id: supportRepliesId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'supportRepliesId is not deleted');
  }

  return deletedItem;
};

export const supportRepliesService = {
  createSupportRepliesIntoDb,
  getSupportRepliesListFromDb,
  getSupportRepliesByIdFromDb,
  updateSupportRepliesIntoDb,
  deleteSupportRepliesItemFromDb,
};

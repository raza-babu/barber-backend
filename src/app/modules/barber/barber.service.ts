import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createBarberIntoDb = async (userId: string, data: any) => {
  const result = await prisma.barber.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barber not created');
  }
  return result;
};

const getBarberListFromDb = async (userId: string) => {
  const result = await prisma.barber.findMany();
  if (result.length === 0) {
    return { message: 'No barber found' };
  }
  return result;
};

const getBarberByIdFromDb = async (userId: string, barberId: string) => {
  const result = await prisma.barber.findUnique({
    where: {
      userId: barberId,
    },
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
          phoneNumber: true,
          image: true,
        }
      }
    }
  });

  // check following or not
  const isFollowing = await prisma.follow.findFirst({
    where: {
      userId: userId,
      followingId: barberId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'barber not found');
  }
  return {
    ...result,
    isFollowing: isFollowing ? true : false,
  };
};

const updateBarberIntoDb = async (
  userId: string,
  barberId: string,
  data: any,
) => {
  const result = await prisma.barber.update({
    where: {
      id: barberId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberId, not updated');
  }
  return result;
};

const deleteBarberItemFromDb = async (userId: string, barberId: string) => {
  const deletedItem = await prisma.barber.delete({
    where: {
      id: barberId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberId, not deleted');
  }

  return deletedItem;
};

export const barberService = {
  createBarberIntoDb,
  getBarberListFromDb,
  getBarberByIdFromDb,
  updateBarberIntoDb,
  deleteBarberItemFromDb,
};

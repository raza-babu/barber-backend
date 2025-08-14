import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createBookingIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.booking.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'booking not created');
  }
    return result;
};

const getBookingListFromDb = async () => {
  
    const result = await prisma.booking.findMany();
    if (result.length === 0) {
    return { message: 'No booking found' };
  }
    return result;
};

const getBookingByIdFromDb = async (bookingId: string) => {
  
    const result = await prisma.booking.findUnique({ 
    where: {
      id: bookingId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'booking not found');
  }
    return result;
  };



const updateBookingIntoDb = async (userId: string, bookingId: string, data: any) => {
  
    const result = await prisma.booking.update({
      where:  {
        id: bookingId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'bookingId, not updated');
  }
    return result;
  };

const deleteBookingItemFromDb = async (userId: string, bookingId: string) => {
    const deletedItem = await prisma.booking.delete({
      where: {
      id: bookingId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'bookingId, not deleted');
  }

    return deletedItem;
  };

export const bookingService = {
createBookingIntoDb,
getBookingListFromDb,
getBookingByIdFromDb,
updateBookingIntoDb,
deleteBookingItemFromDb,
};
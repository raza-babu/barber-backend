import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createBarberScheduleIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.barberSchedule.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberSchedule not created');
  }
    return result;
};

const getBarberScheduleListFromDb = async () => {
  
    const result = await prisma.barberSchedule.findMany();
    if (result.length === 0) {
    return { message: 'No barberSchedule found' };
  }
    return result;
};

const getBarberScheduleByIdFromDb = async (barberScheduleId: string) => {
  
    const result = await prisma.barberSchedule.findUnique({ 
    where: {
      id: barberScheduleId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'barberSchedule not found');
  }
    return result;
  };



const updateBarberScheduleIntoDb = async (userId: string, barberScheduleId: string, data: any) => {
  
    const result = await prisma.barberSchedule.update({
      where:  {
        id: barberScheduleId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberScheduleId, not updated');
  }
    return result;
  };

const deleteBarberScheduleItemFromDb = async (userId: string, barberScheduleId: string) => {
    const deletedItem = await prisma.barberSchedule.delete({
      where: {
      id: barberScheduleId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberScheduleId, not deleted');
  }

    return deletedItem;
  };

export const barberScheduleService = {
createBarberScheduleIntoDb,
getBarberScheduleListFromDb,
getBarberScheduleByIdFromDb,
updateBarberScheduleIntoDb,
deleteBarberScheduleItemFromDb,
};
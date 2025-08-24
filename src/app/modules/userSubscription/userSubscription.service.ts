import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createUserSubscriptionIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.userSubscription.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'userSubscription not created');
  }
    return result;
};

const getUserSubscriptionListFromDb = async (userId: string) => {
  
    const result = await prisma.userSubscription.findMany();
    if (result.length === 0) {
    return { message: 'No userSubscription found' };
  }
    return result;
};

const getUserSubscriptionByIdFromDb = async (userId: string, userSubscriptionId: string) => {
  
    const result = await prisma.userSubscription.findUnique({ 
    where: {
      id: userSubscriptionId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'userSubscription not found');
  }
    return result;
  };



const updateUserSubscriptionIntoDb = async (userId: string, userSubscriptionId: string, data: any) => {
  
    const result = await prisma.userSubscription.update({
      where:  {
        id: userSubscriptionId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'userSubscriptionId, not updated');
  }
    return result;
  };

const deleteUserSubscriptionItemFromDb = async (userId: string, userSubscriptionId: string) => {
    const deletedItem = await prisma.userSubscription.delete({
      where: {
      id: userSubscriptionId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'userSubscriptionId, not deleted');
  }

    return deletedItem;
  };

export const userSubscriptionService = {
createUserSubscriptionIntoDb,
getUserSubscriptionListFromDb,
getUserSubscriptionByIdFromDb,
updateUserSubscriptionIntoDb,
deleteUserSubscriptionItemFromDb,
};
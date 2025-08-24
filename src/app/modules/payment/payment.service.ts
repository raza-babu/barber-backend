import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createPaymentIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.payment.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'payment not created');
  }
    return result;
};

const getPaymentListFromDb = async (userId: string) => {
  
    const result = await prisma.payment.findMany();
    if (result.length === 0) {
    return { message: 'No payment found' };
  }
    return result;
};

const getPaymentByIdFromDb = async (userId: string, paymentId: string) => {
  
    const result = await prisma.payment.findUnique({ 
    where: {
      id: paymentId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'payment not found');
  }
    return result;
  };



const updatePaymentIntoDb = async (userId: string, paymentId: string, data: any) => {
  
    const result = await prisma.payment.update({
      where:  {
        id: paymentId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'paymentId, not updated');
  }
    return result;
  };

const deletePaymentItemFromDb = async (userId: string, paymentId: string) => {
    const deletedItem = await prisma.payment.delete({
      where: {
      id: paymentId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'paymentId, not deleted');
  }

    return deletedItem;
  };

export const paymentService = {
createPaymentIntoDb,
getPaymentListFromDb,
getPaymentByIdFromDb,
updatePaymentIntoDb,
deletePaymentItemFromDb,
};
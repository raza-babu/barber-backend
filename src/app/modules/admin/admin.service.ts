import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createAdminIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.admin.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'admin not created');
  }
    return result;
};

const getAdminListFromDb = async () => {
  
    const result = await prisma.admin.findMany();
    if (result.length === 0) {
    return { message: 'No admin found' };
  }
    return result;
};

const getAdminByIdFromDb = async (adminId: string) => {
  
    const result = await prisma.admin.findUnique({ 
    where: {
      id: adminId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'admin not found');
  }
    return result;
  };



const updateAdminIntoDb = async (userId: string, adminId: string, data: any) => {
  
    const result = await prisma.admin.update({
      where:  {
        id: adminId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'adminId, not updated');
  }
    return result;
  };

const deleteAdminItemFromDb = async (userId: string, adminId: string) => {
    const deletedItem = await prisma.admin.delete({
      where: {
      id: adminId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'adminId, not deleted');
  }

    return deletedItem;
  };

export const adminService = {
createAdminIntoDb,
getAdminListFromDb,
getAdminByIdFromDb,
updateAdminIntoDb,
deleteAdminItemFromDb,
};
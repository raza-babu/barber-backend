import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createServiceIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.service.create({ 
    data: {
      ...data,
      saloonOwnerId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'service not created');
  }
    return result;
};

const getServiceListFromDb = async () => {
  
    const result = await prisma.service.findMany({
    where: {
      isActive: true,
    },
    });
    if (result.length === 0) {
    return [];
  }
    return result;
};

const getServiceByIdFromDb = async (serviceId: string) => {
  
    const result = await prisma.service.findUnique({ 
    where: {
      id: serviceId,
      isActive: true,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'service not found');
  }
    return result;
  };



const updateServiceIntoDb = async (userId: string, serviceId: string, data: any) => {
  
    const result = await prisma.service.update({
      where:  {
        id: serviceId,
        saloonOwnerId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'serviceId, not updated');
  }
    return result;
  };

  const toggleServiceActiveIntoDb = async (userId: string, serviceId: string) => {
    const service = await prisma.service.findUnique({
      where: {
        id: serviceId,
        saloonOwnerId: userId,
      },
    });
    if (!service) {
      throw new AppError(httpStatus.NOT_FOUND, 'Service not found');
    }
    const updatedService = await prisma.service.update({
      where: {
        id: serviceId,
        saloonOwnerId: userId,
      },
      data: {
        isActive: !service.isActive,
      },
    });
    return updatedService;
  };

const deleteServiceItemFromDb = async (userId: string, serviceId: string) => {
    const deletedItem = await prisma.service.delete({
      where: {
      id: serviceId,
      saloonOwnerId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'serviceId, not deleted');
  }

    return deletedItem;
  };

export const serviceService = {
createServiceIntoDb,
getServiceListFromDb,
getServiceByIdFromDb,
updateServiceIntoDb,
toggleServiceActiveIntoDb,
deleteServiceItemFromDb,
};
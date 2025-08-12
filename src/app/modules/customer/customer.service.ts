import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createCustomerIntoDb = async (userId: string, data: any) => {
  const result = await prisma.saloonOwner.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'customer not created');
  }
  return result;
};

const getAllSaloonListFromDb = async () => {
  const result = await prisma.saloonOwner.findMany({
    where: {
      isVerified: true,
    },
    select: {
      id: true,
      userId: true,
      shopName: true,
      shopAddress: true,
      shopImages: true,
      isVerified: true,
      shopLogo: true,
      shopVideo: true,
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getSaloonAllServicesListFromDb = async (saloonOwnerId: string) => {
  const result = await prisma.service.findMany({
    where: {
      saloonOwnerId: saloonOwnerId,
      isActive: true,
    },
    select: {
      id: true,
      serviceName: true,
      price: true,
      duration: true,
      saloonOwnerId: true,
      saloon: {
        select: {
          shopName: true,
          shopLogo: true,
          shopAddress: true,
          user: {
            select: {
              fullName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });
  if (result.length === 0) {
    throw new AppError(httpStatus.NOT_FOUND, 'No services found');
  }
  return result.map(service => ({
    id: service.id,
    name: service.serviceName,
    price: service.price, 
    duration: service.duration,
    // isActive: service.isActive,   
    saloonOwnerId: service.saloonOwnerId,
    saloon: {
      shopName: service.saloon.shopName,
      shopLogo: service.saloon.shopLogo,
      shopAddress: service.saloon.shopAddress,    
      ownerName: service.saloon.user.fullName,
      ownerEmail: service.saloon.user.email,    
      ownerPhone: service.saloon.user.phoneNumber,
    },
  }));
};   

const getCustomerByIdFromDb = async (customerId: string) => {
  const result = await prisma.saloonOwner.findUnique({
    where: {
      id: customerId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'customer not found');
  }
  return result;
};

const updateCustomerIntoDb = async (
  userId: string,
  customerId: string,
  data: any,
) => {
  const result = await prisma.saloonOwner.update({
    where: {
      id: customerId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'customerId, not updated');
  }
  return result;
};

const deleteCustomerItemFromDb = async (userId: string, customerId: string) => {
  const deletedItem = await prisma.saloonOwner.delete({
    where: {
      id: customerId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'customerId, not deleted');
  }

  return deletedItem;
};

export const customerService = {
  createCustomerIntoDb,
  getAllSaloonListFromDb,
  getSaloonAllServicesListFromDb,
  getCustomerByIdFromDb,
  updateCustomerIntoDb,
  deleteCustomerItemFromDb,
};

import { SaloonOwner } from './../../../../node_modules/.prisma/client/index.d';
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { get } from 'node:http';

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

const getASaloonByIdFromDb = async (saloonOwnerId: string) => {
  const result = await prisma.saloonOwner.findUnique({
    where: {
      userId: saloonOwnerId,
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
      registrationNumber: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          Service: {
            select: {
              id: true,
              serviceName: true,
              price: true,
              duration: true,
              isActive: true,
            },
          },
        },
      },
      Barber: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              image: true,
            },
          },
          saloonOwnerId: true,
          experienceYears: true,
          bio: true,
          portfolio: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Saloon not found');
  }

  //flatten the salon information
  return {
    id: result.id,
    userId: result.userId,
    shopName: result.shopName,
    shopAddress: result.shopAddress,
    shopImages: result.shopImages,
    isVerified: result.isVerified,
    shopLogo: result.shopLogo,
    shopVideo: result.shopVideo,
    latitude: result.latitude,
    longitude: result.longitude,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    services: result.user?.Service.map(service => ({
      id: service.id,
      serviceName: service.serviceName,
      price: service.price,
      duration: service.duration,
      isActive: service.isActive,
    })),
    barbers: result.Barber.map(barber => ({
      id: barber.user.id,
      fullName: barber.user.fullName,
      email: barber.user.email,
      phoneNumber: barber.user.phoneNumber,
      image: barber.user.image,
      experienceYears: barber.experienceYears,
      bio: barber.bio,
      portfolio: barber.portfolio,
    })),
  };
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
      user: {
        select: {
          SaloonOwner: {
            select: {
              userId: true,
              shopName: true,
              shopLogo: true,
              shopAddress: true,
            },
          },
        },
      },
    },
  });
  if (result.length === 0) {
    throw new AppError(httpStatus.NOT_FOUND, 'No services found');
  }
  return result.map(service => {
    const saloon = service.user?.SaloonOwner?.[0];
    return {
      id: service.id,
      name: service.serviceName,
      price: service.price,
      duration: service.duration,
      // isActive: service.isActive,
      saloonOwnerId: service.saloonOwnerId,
      saloon: saloon
        ? {
            saloonId: saloon.userId,
            shopName: saloon.shopName,
            shopLogo: saloon.shopLogo,
            shopAddress: saloon.shopAddress,
          }
        : null,
    };
  });
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
  getASaloonByIdFromDb,
  getSaloonAllServicesListFromDb,
  getCustomerByIdFromDb,
  updateCustomerIntoDb,
  deleteCustomerItemFromDb,
};

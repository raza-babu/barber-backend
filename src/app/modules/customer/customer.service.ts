import prisma from '../../utils/prisma';
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

// All saloons near get within a radius
const getMyNearestSaloonListFromDb = async (
  latitude: number,
  longitude: number,
  radiusInKm: number,
) => {
  const radiusInMeters = (radiusInKm || 10) * 1000; // Mongo uses meters

  const saloons = await prisma.saloonOwner.aggregateRaw({
    pipeline: [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distance',
          maxDistance: radiusInMeters,
          spherical: true,
        },
      },
      {
        $sort: { distance: 1 },
      },
    ],
  });

  return saloons;
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

const getCustomerByIdFromDb = async (userId: string, customerId: string) => {
  const result = await prisma.user.findUnique({
    where: {
      id: customerId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'customer not found');
  }
  return {
    isMe: result.id === userId,
    id: result.id,
    fullName: result.fullName,
    email: result.email,
    phoneNumber: result.phoneNumber,
    image: result.image,
    address: result.address,
    
  };
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
  getMyNearestSaloonListFromDb,
  getSaloonAllServicesListFromDb,
  getCustomerByIdFromDb,
  updateCustomerIntoDb,
  deleteCustomerItemFromDb,
};

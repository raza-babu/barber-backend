import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { calculatePagination, formatPaginationResponse } from '../../utils/pagination';
import { buildCompleteQuery, buildNumericRangeQuery } from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

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

const getServiceListFromDb = async (options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  
  // Build search query
  const searchQuery = options.searchTerm ? {
    OR: [
      {
        serviceName: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },{},
      // {
      //   description: {
      //     contains: options.searchTerm,
      //     mode: 'insensitive' as const,
      //   },
      // },
      // {
      //   category: {
      //     contains: options.searchTerm,
      //     mode: 'insensitive' as const,
      //   },
      // },
    ],
  } : {};

  // Build filter query
  const filterQuery: any = {
    isActive: options.isActive !== undefined ? options.isActive === 'true' : true,
  };

  // Add saloon owner filter if provided
  if (options.saloonOwnerId) {
    filterQuery.saloonOwnerId = options.saloonOwnerId;
  }

  // Build price range filter
  const priceRangeQuery = buildNumericRangeQuery(
    'price',
    options.priceMin ? Number(options.priceMin) : undefined,
    options.priceMax ? Number(options.priceMax) : undefined
  );

  // Build date range query
  const dateRangeQuery = options.startDate || options.endDate ? {
    createdAt: {
      ...(options.startDate && { gte: new Date(options.startDate) }),
      ...(options.endDate && { lte: new Date(options.endDate) }),
    },
  } : {};

  // Combine all queries
  const whereClause = {
    ...filterQuery,
    ...priceRangeQuery,
    ...dateRangeQuery,
    ...(Object.keys(searchQuery).length > 0 && searchQuery),
  };

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        saloon: {
          select: {
            shopName: true,
            shopLogo: true,
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    }),
    prisma.service.count({
      where: whereClause,
    }),
  ]);

  // Transform the data to include saloon information
  const transformedServices = services.map(service => ({
    id: service.id,
    name: service.serviceName,
    // description: service.description,
    price: service.price,
    duration: service.duration,
    // category: service.category,
    isActive: service.isActive,
    saloonOwnerId: service.saloonOwnerId,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
    saloon: {
      shopName: service.saloon?.shopName,
      shopLogo: service.saloon?.shopLogo,
      ownerName: service.saloon?.user?.fullName,
      ownerEmail: service.saloon?.user?.email,
    },
  }));

  return formatPaginationResponse(transformedServices, total, page, limit);
};

const getServiceByIdFromDb = async (serviceId: string) => {
  const result = await prisma.service.findUnique({ 
    where: {
      id: serviceId,
      isActive: true,
    },
    include: {
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
  
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'service not found');
  }
  
  // Transform the data
  const transformedResult = {
    id: result.id,
    name: result.serviceName,
    // description: result.description,
    price: result.price,
    duration: result.duration,
    // category: result.category,
    isActive: result.isActive,
    saloonOwnerId: result.saloonOwnerId,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    saloon: {
      shopName: result.saloon?.shopName,
      shopLogo: result.saloon?.shopLogo,
      shopAddress: result.saloon?.shopAddress,
      ownerName: result.saloon?.user?.fullName,
      ownerEmail: result.saloon?.user?.email,
      ownerPhone: result.saloon?.user?.phoneNumber,
    },
  };
  
  return transformedResult;
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
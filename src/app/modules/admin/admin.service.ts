import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { calculatePagination, formatPaginationResponse } from '../../utils/pagination';
import { buildCompleteQuery } from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const getSaloonFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  
  const whereClause = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['fullName', 'email', 'phoneNumber'],
    },
    {
      role: UserRoleEnum.SALOON_OWNER,
      status: options.status || UserStatus.ACTIVE,
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    }
  );

  // Handle SaloonOwner specific filters
  if (options.isVerified !== undefined) {
    whereClause.SaloonOwner = {
      isVerified: options.isVerified === true,
    };
  }

  const [saloons, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        status: true,
        createdAt: true,
        SaloonOwner: {
          select: {
            userId: true,
            isVerified: true,
            shopAddress: true,
            shopName: true,
            registrationNumber: true,
            shopLogo: true,
            shopImages: true,
            shopVideo: true,
          },
        },
      },
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  return formatPaginationResponse(saloons, total, page, limit);
};

const blockSaloonByIdIntoDb = async (saloonOwnerId: string, data: any) => {
  const { status } = data;
  const result = await prisma.saloonOwner.update({
    where: {
      userId: saloonOwnerId,
    },
    data: {
      isVerified: status,
    },
    select: {
      userId: true,
      isVerified: true,
      shopAddress: true,
      shopName: true,
      registrationNumber: true,
      shopLogo: true,
      shopImages: true,
      shopVideo: true,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Saloon not found or not updated',
    );
  }
  return result;
};

const getBarbersListFromDb = async (options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  
  const whereClause = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['fullName', 'email', 'phoneNumber'],
    },
    {
      role: UserRoleEnum.BARBER,
      status: options.status || UserStatus.ACTIVE,
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    }
  );

  // Handle Barber specific filters
  if (options.experienceYears !== undefined) {
    whereClause.Barber = {
      experienceYears: {
        gte: Number(options.experienceYears),
      },
    };
  }

  const [barbers, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        status: true,
        createdAt: true,
        Barber: {
          select: {
            userId: true,
            portfolio: true,
            experienceYears: true,
            skills: true,
            bio: true,
          },
        },
      },
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  return formatPaginationResponse(barbers, total, page, limit);
};

const blockBarberByIdIntoDb = async (
  userId: string,
  barberId: string,
  data: any,
) => {
  const result = await prisma.user.update({
    where: {
      id: barberId,
      role: UserRoleEnum.BARBER,
    },
    data: {
      status: data.status === true ? UserStatus.BLOCKED : UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      status: true,
      createdAt: true,
      Barber: {
        select: {
          userId: true,
          portfolio: true,
          experienceYears: true,
          skills: true,
          bio: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Barber not found or not updated');
  }
  return result;
};

const getCustomersListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  
  const whereClause = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['fullName', 'email', 'phoneNumber'],
    },
    {
      role: UserRoleEnum.CUSTOMER,
      status: options.status || UserStatus.ACTIVE,
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    }
  );

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        image: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  return formatPaginationResponse(customers, total, page, limit);
};

const blockCustomerByIdIntoDb = async (userId: string, customerId: string, data: any) => {
  const result = await prisma.user.update({
    where: {
      id: customerId,
      role: UserRoleEnum.CUSTOMER,
    },
    data: {
      status: data.status === true ? UserStatus.BLOCKED : UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      image: true,
      status: true,
      createdAt: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Customer not found or not updated');
  }
  return result;
};

const updateSaloonOwnerByIdIntoDb = async (userId: string, saloonOwnerId: string, data: any) => {
  const {status} = data;
  const saloonOwner = await prisma.saloonOwner.update({
    where: {
      userId: saloonOwnerId,
    },
    data:{
      isVerified: status === true ? true : false,
    }
  });
  if (!saloonOwner) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Saloon owner not found or not updated');
  }
  return saloonOwner; 
}

const getAdminDashboardFromDb = async (userId: string) => {
  const saloonCount = await prisma.saloonOwner.count({
    where: {
      isVerified: true,
    },
  });

  const barberCount = await prisma.user.count({
    where: {
      role: UserRoleEnum.BARBER,
      status: UserStatus.ACTIVE,
    },
  });

  const customerCount = await prisma.user.count({
    where: {
      role: UserRoleEnum.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  const userGrowth = await prisma.user.groupBy({
    by: ['createdAt', 'role'],
    _count: {
      id: true,
    },
    where: {
      role: {
        in: [UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER, UserRoleEnum.CUSTOMER],
      },
      status: UserStatus.ACTIVE,
      createdAt: {
        gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
      },
    },
    orderBy: [
      { createdAt: 'asc' },
      { role: 'asc' },
    ],
  });

  return {
    saloonCount,
    barberCount,
    customerCount,
    userGrowth: userGrowth.map((item) => ({
      date: item.createdAt.toISOString().split('T')[0], // Format date to YYYY-MM-DD
      role: item.role,
      count: item._count.id,
    })),
  };
};

export const adminService = {
  getSaloonFromDb,
  blockSaloonByIdIntoDb,
  getBarbersListFromDb,
  blockBarberByIdIntoDb,
  getCustomersListFromDb,
  blockCustomerByIdIntoDb,
  updateSaloonOwnerByIdIntoDb,
  getAdminDashboardFromDb,
};
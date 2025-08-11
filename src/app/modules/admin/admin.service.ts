import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const getSaloonFromDb = async (userId: string) => {
  const result = await prisma.user.findMany({
    where: {
      role: UserRoleEnum.SALOON_OWNER,
      status: UserStatus.ACTIVE,
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
  });
  if (result.length === 0) {
    return [];
  }
  return result;
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

const getBarbersListFromDb = async () => {
  const result = await prisma.user.findMany({
    where: {
      role: UserRoleEnum.BARBER,
      status: UserStatus.ACTIVE,
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
  if (result.length === 0) {
    return [];
  }
  return result;
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
    throw new AppError(httpStatus.BAD_REQUEST, 'adminId, not updated');
  }
  return result;
};

const getCustomersListFromDb = async (userId: string) => {
  const result = await prisma.user.findMany({
    where: {
      role: UserRoleEnum.CUSTOMER,
      status: UserStatus.ACTIVE,
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
  if (result.length === 0) {
    return [];
  }
  return result;
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
    throw new AppError(httpStatus.BAD_REQUEST, 'adminId, not updated');
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

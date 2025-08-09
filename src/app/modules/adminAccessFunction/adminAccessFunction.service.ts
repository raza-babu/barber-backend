import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createAdminAccessFunctionIntoDb = async (userId: string, data: any) => {

  const newUser = await prisma.user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      role: data.role,
      image: data.image,
      phoneNumber: data.phone,
      status: UserStatus.ACTIVE,
      isProfileComplete: true,
    },
  });
  if (!newUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not created');
  }

  const newAdmin = await prisma.admin.create({
    data: {
      userId: newUser.id,
      isSuperAdmin: data.role === UserRoleEnum.SUPER_ADMIN? true : false,
    },
  });
  if (!newAdmin) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Admin not created');
  }

  interface AccessFunction {
    id: string;
    // Add other fields if needed
  }

  interface CreateAdminAccessFunctionData {
    fullName: string;
    email: string;
    password: string;
    role: UserRoleEnum;
    image?: string;
    phone: string;
    isSuperAdmin: boolean;
    function: AccessFunction[];
  }

  const result = await prisma.adminAccessFunction.createMany({
    data: (data as CreateAdminAccessFunctionData).function.map((func: AccessFunction) => ({
      userId: userId,
      adminId: newAdmin.id,
      accessFunctionId: func.id,
    })),
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'adminAccessFunction not created',
    );
  }
  return result;
};

const getAdminAccessFunctionListFromDb = async () => {
  const result = await prisma.adminAccessFunction.findMany();
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getAdminAccessFunctionByIdFromDb = async (
  adminAccessFunctionId: string,
) => {
  const result = await prisma.adminAccessFunction.findUnique({
    where: {
      id: adminAccessFunctionId,
    },
  });
  if (!result) {
    return { message: 'AdminAccessFunction not found' };
  }
  return result;
};

const updateAdminAccessFunctionIntoDb = async (
  userId: string,
  adminAccessFunctionId: string,
  data: any,
) => {
  const result = await prisma.adminAccessFunction.update({
    where: {
      id: adminAccessFunctionId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'adminAccessFunctionId, not updated',
    );
  }
  return result;
};

const deleteAdminAccessFunctionItemFromDb = async (
  userId: string,
  adminAccessFunctionId: string,
) => {
  const deletedItem = await prisma.adminAccessFunction.delete({
    where: {
      id: adminAccessFunctionId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'adminAccessFunctionId, not deleted',
    );
  }

  return deletedItem;
};

export const adminAccessFunctionService = {
  createAdminAccessFunctionIntoDb,
  getAdminAccessFunctionListFromDb,
  getAdminAccessFunctionByIdFromDb,
  updateAdminAccessFunctionIntoDb,
  deleteAdminAccessFunctionItemFromDb,
};

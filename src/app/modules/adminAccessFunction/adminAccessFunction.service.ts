import { access } from 'fs';
import { log } from 'node:console';
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import * as bcrypt from 'bcrypt';

interface CreateAdminData {
  fullName: string;
  email: string;
  password: string;
  role: UserRoleEnum;
  image?: string;
  phone: string;
  function: string[]; // Changed from 'function' to 'functions'
}

const createAdminAccessFunctionIntoDb = async (
  userId: string,
  data: CreateAdminData,
) => {
  return await prisma.$transaction(async tx => {
    // 1. Create User
    const newUser = await tx.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        password: await bcrypt.hash(data.password, 12),
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

    // 2. Create Admin
    const newAdmin = await tx.admin.create({
      data: {
        userId: newUser.id,
        isSuperAdmin: data.role === UserRoleEnum.SUPER_ADMIN ? true : false,
      },
    });

    if (!newAdmin) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Admin not created');
    }

    // 3. Create Admin Access Functions
    if (data.function && data.function.length > 0) {
      const result = await tx.adminAccessFunction.createMany({
        data: data.function.map(func => ({
          userId: userId,
          adminId: newAdmin.id,
          accessFunctionId: func,
        })),
      });

      if (!result) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Failed to create access functions',
        );
      }
      return {
        user: {
          fullName: newUser.fullName,
          email: newUser.email,
          image: newUser.image,
          role: newUser.role,
        },
        admin: newAdmin,
        accessFunctions: result,
      };
    }
  });
};

const getAdminAccessFunctionListFromDb = async () => {
  const result = await prisma.adminAccessFunction.findMany({
    include: {
      admin: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              image: true,
              role: true,
            },
          },
        },
      },
      accessFunction: {
        select: {
          id: true,
          function: true,
        },
      },
    },
  });

  // Group by adminId
  const adminMap: Record<string, any> = {};

  for (const item of result) {
    if (!item.admin) continue;
    const adminId = item.admin.id;
    if (!adminMap[adminId]) {
      adminMap[adminId] = {
        adminId: item.admin.userId,
        information: item.admin.user,
        role: item.admin.user.role,
        isSuperAdmin: item.admin.isSuperAdmin,
        accesses: [],
      };
    }
    if (item.accessFunction) {
      adminMap[adminId].accesses.push({
        accessFunctionId: item.accessFunction.id,
        function: item.accessFunction.function,
        adminAccessFunctionId: item.id,
      });
    }
  }

  return Object.values(adminMap);
};

const getAdminAccessFunctionByIdFromDb = async (adminId: string) => {
  const result = await prisma.admin.findUnique({
    where: {
      userId: adminId,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          role: true,
        },
      },
      
          AdminAccessFunction: {
            include: {
              accessFunction: {
                select: {
                  id: true,
                  function: true,
                },
              },
            },
          },
        },
      
    
  });

  // Flatten access functions for response
  let accesses: any[] = [];
  if (result?.AdminAccessFunction) {
    accesses = result.AdminAccessFunction.map(item => ({
      accessFunctionId: item.accessFunction?.id,
      function: item.accessFunction?.function,
      adminAccessFunctionId: item.id,
    }));
  }
  return {
    adminId: result?.userId,
    information: result?.user || null,
    role: result?.user?.role || null,
    isSuperAdmin: result?.isSuperAdmin,
    accesses: accesses,
  };
};

const updateAdminAccessFunctionIntoDb = async (
  userId: string,
  data: { adminId: string; function: string[] },
) => {
  return await prisma.$transaction(async tx => {
    // 1. Delete existing accesses for this admin
    await tx.adminAccessFunction.deleteMany({
      where: {
        adminId: data.adminId,
        userId: userId,
      },
    });

    // 2. Add new accesses
    if (!Array.isArray(data.function)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'accessFunctionIds must be a non-empty array',
      );
    }

    const created = await tx.adminAccessFunction.createMany({
      data: data.function.map(func => ({
        userId: userId,
        adminId: data.adminId,
        accessFunctionId: func,
      })),
    });

    if (!created) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'adminAccessFunctionId, not updated',
      );
    }

    // 3. Return the new list of accesses
    const updatedAccesses = await tx.adminAccessFunction.findMany({
      where: {
        adminId: data.adminId,
        userId: userId,
      },
      include: {
        accessFunction: {
          select: {
            function: true,
          },
        },
      },
    });

    return updatedAccesses;
  });
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

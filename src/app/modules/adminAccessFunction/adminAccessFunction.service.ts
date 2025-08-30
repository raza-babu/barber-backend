import { access } from 'fs';
import { log } from 'node:console';
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus, Admin } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import * as bcrypt from 'bcrypt';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';
import { buildCompleteQuery } from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

interface CreateAdminData {
  fullName: string;
  email: string;
  password: string;
  role: UserRoleEnum;
  image?: string;
  phone: string;
  function: string[];
}

const createAdminAccessFunctionIntoDb = async (
  userId: string,
  data: CreateAdminData,
) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: data.email,
    },
  });
  if (existingUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Email already exists');
  }

  const existingAdmin = await prisma.admin.findFirst({
    where: {
      userId: userId,
      isSuperAdmin: false,
    },
  });

  if(existingAdmin){
    throw new AppError(httpStatus.BAD_REQUEST, 'Admin cannot create another admin');
  }


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
    const isSuperAdmin = data.role === UserRoleEnum.SUPER_ADMIN;
    const newAdmin = await tx.admin.create({
      data: {
        userId: newUser.id,
        isSuperAdmin,
      },
    });

    if (!newAdmin) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Admin not created');
    }

  // Prevent ADMIN role from having ADMIN_MANAGEMENT access
  if (
    data.role === UserRoleEnum.ADMIN &&
    data.function &&
    data.function.length > 0
  ) {
    // Fetch all access function records by IDs
    const accessFunctions = await tx.accessFunction.findMany({
      where: {
        id: { in: data.function },
      },
      select: { id: true, function: true },
    });

    // Check if any of the selected functions is 'ADMIN_MANAGEMENT'
    const hasAdminManagement = accessFunctions.some(
      af => af.function === 'ADMIN_MANAGEMENT'
    );

    if (hasAdminManagement) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'ADMIN role cannot have ADMIN_MANAGEMENT access function'
      );
    }
  }

    // 3. Create Admin Access Functions only if not super admin
    let accessFunctionsResult = null;
    if (!isSuperAdmin && data.function && data.function.length > 0) {
      accessFunctionsResult = await tx.adminAccessFunction.createMany({
        data: data.function.map(func => ({
          userId: userId,
          adminId: newAdmin.userId,
          accessFunctionId: func,
        })),
      });

      if (!accessFunctionsResult) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Failed to create access functions',
        );
      }
    }

    return {
      user: {
        fullName: newUser.fullName,
        email: newUser.email,
        image: newUser.image,
        role: newUser.role,
      },
      admin: newAdmin,
      accessFunctions: accessFunctionsResult,
    };
  });
};

const getAdminAccessFunctionListFromDb = async (
  options: ISearchAndFilterOptions = {},
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build user search and filter
  let userWhere: any = {};
  if (options.searchTerm) {
    userWhere.OR = [
      {
        fullName: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },
      {
        email: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },
    ];
  }
  if (options.role) {
    userWhere.role = options.role;
  }
  if (options.startDate || options.endDate) {
    userWhere.createdAt = {};
    if (options.startDate)
      userWhere.createdAt.gte = new Date(options.startDate);
    if (options.endDate) userWhere.createdAt.lte = new Date(options.endDate);
  }

  // Build admin filter
  let adminWhere: any = {};
  if (options.isSuperAdmin !== undefined) {
    adminWhere.isSuperAdmin = options.isSuperAdmin === 'true';
  }
  if (Object.keys(userWhere).length > 0) {
    adminWhere.user = userWhere;
  }

  const [admins, total] = await Promise.all([
    prisma.admin.findMany({
      where: adminWhere,
      skip,
      take: limit,
      orderBy: {
        user: {
          [sortBy === 'fullName' || sortBy === 'email' ? sortBy : 'createdAt']:
            sortOrder,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            image: true,
            role: true,
            createdAt: true,
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
    }),
    prisma.admin.count({
      where: adminWhere,
    }),
  ]);

  const data = admins.map(admin => {
    const accesses = (admin.AdminAccessFunction || []).map(item => ({
      accessFunctionId: item.accessFunction?.id,
      function: item.accessFunction?.function,
      // adminAccessFunctionId: item.id,
    }));

    return {
      adminId: admin.userId,
      adminName: admin.user?.fullName,
      adminEmail: admin.user?.email,
      adminImage: admin.user?.image,

      role: admin.user?.role,
      isSuperAdmin: admin.isSuperAdmin,
      accesses,
    };
  });

  return formatPaginationResponse(data, total, page, limit);
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
  // Check if the admin is a super admin
  const admin = await prisma.admin.findUnique({
    where: { userId: data.adminId },
    select: { isSuperAdmin: true },
  });

  if (admin?.isSuperAdmin) {
    // No operation needed for super admin
    return [];
  }

  return await prisma.$transaction(async tx => {
    // 1. Delete existing accesses for this admin
    await tx.adminAccessFunction.deleteMany({
      where: {
        adminId: data.adminId,
      },
    });

    if (!data.function || data.function.length === 0) {
      return [];
    }
    // 2. Add new accesses
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
  callerUserId: string, // The admin who is performing the delete
  targetUserId: string, // The admin who will be deleted
) => {
  return await prisma.$transaction(async tx => {
    /**
     * STEP 1: Find the caller (the one requesting deletion)
     */
    const caller = await tx.admin.findUnique({
      where: { userId: callerUserId },
      select: {
        id: true,
        userId: true,
        isSuperAdmin: true,
        systemOwner: true,
      },
    });

    if (!caller) {
      throw new AppError(httpStatus.FORBIDDEN, 'Caller is not a valid admin');
    }

    /**
     * STEP 2: Find the target (the one to be deleted)
     */
    const target = await tx.admin.findUnique({
      where: { userId: targetUserId },
      select: {
        id: true,
        userId: true,
        isSuperAdmin: true,
        systemOwner: true,
      },
    });

    if (!target) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Target admin not found');
    }

    /**
     * STEP 3: Apply business rules for deletion
     */
    if (caller.userId === target.userId) {
      // Prevent self-deletion (system owner or super admin cannot delete themselves)
      throw new AppError(httpStatus.FORBIDDEN, 'You cannot delete yourself');
    }

    if (caller.systemOwner && caller.isSuperAdmin) {
      //  System Owner Super Admin
      // Can delete both normal admins and super admins (except himself, already checked above)
    } else if (caller.isSuperAdmin) {
      //  Normal Super Admin
      // Can delete only regular admins
      if (target.isSuperAdmin || target.systemOwner) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'Super admins cannot delete other super admins or the system owner',
        );
      }
    } else {
      throw new AppError(httpStatus.FORBIDDEN, 'Admins cannot delete anyone');
    }

    /**
     * STEP 4: Delete all related access functions (cleanup first)
     */
    await tx.adminAccessFunction.deleteMany({
      where: { adminId: target.userId },
    });

    /**
     * STEP 5: Delete target admin entry
     */
    const deletedAdmin = await tx.admin.delete({
      where: { userId: target.userId },
    });

    /**
     * STEP 6: Delete target user record as well
     */
    await tx.user.delete({
      where: { id: target.userId },
    });

    /**
     * STEP 7: Return deleted admin record
     */
    return deletedAdmin;
  });
};


export const adminAccessFunctionService = {
  createAdminAccessFunctionIntoDb,
  getAdminAccessFunctionListFromDb,
  getAdminAccessFunctionByIdFromDb,
  updateAdminAccessFunctionIntoDb,
  deleteAdminAccessFunctionItemFromDb,
};

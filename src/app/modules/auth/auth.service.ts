import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import { generateToken, refreshToken } from '../../utils/generateToken';
import prisma from '../../utils/prisma';
import { verifyToken } from '../../utils/verifyToken';
import { UserRoleEnum, UserStatus } from '@prisma/client';

const loginUserFromDB = async (payload: {
  email: string;
  password: string;
}) => {
  const userData = await prisma.user.findUniqueOrThrow({
    where: {
      email: payload.email,
    },
  });

  if (userData.password === null) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password is not set');
  }

  const isCorrectPassword: Boolean = await bcrypt.compare(
    payload.password,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect');
  }
  if (
    userData.isProfileComplete === false ||
    userData.isProfileComplete === null
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Please complete your profile before logging in',
    );
  }
  if (userData.status === UserStatus.BLOCKED) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Your account is blocked. Please contact support.',
    );
  }

  if (userData.role === UserRoleEnum.SALOON_OWNER) {
    const saloon = await prisma.saloonOwner.findFirst({
      where: {
        userId: userData.id,
      },
    });
    if (saloon?.isVerified === false) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Your saloon is not verified yet. Please wait for verification.',
      );
    }
  }
  let adminAccessFunctions: string[] = [];

  if (userData.role === UserRoleEnum.ADMIN) {
    const admin = await prisma.admin.findUnique({
      where: {
        userId: userData.id,
        isSuperAdmin: false,
      },
    });
    if (admin) {
      const accessFunctions = await prisma.adminAccessFunction.findMany({
        where: {
          adminId: userData.id,
        },
      });
      if (accessFunctions.length === 0) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You do not have access to any functions. Please contact super admin.',
        );
      }

      const functionNames = await prisma.accessFunction.findMany({
        where: {
          id: { in: accessFunctions.map(func => func.accessFunctionId) },
        },
      });
      if (functionNames.length === 0) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You do not have access to any functions. Please contact super admin.',
        );
      }

      adminAccessFunctions = functionNames.map(func => func.function);
    }
  }

  if (userData.isLoggedIn === false) {
    const updateUser = await prisma.user.update({
      where: { id: userData.id },
      data: { isLoggedIn: true },
    });
    if (!updateUser) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'User login failed');
    }
  }

  const accessToken = await generateToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      purpose: 'access',
      functions: adminAccessFunctions,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshedToken = await refreshToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );
  return {
    id: userData.id,
    name: userData.fullName,
    email: userData.email,
    role: userData.role,
    image: userData.image,
    accessToken: accessToken,
    refreshToken: refreshedToken,
    ...(userData.role === UserRoleEnum.ADMIN && { functions: adminAccessFunctions }),
  };
};

const refreshTokenFromDB = async (refreshedToken: string) => {
  if (!refreshedToken) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token is required');
  }

  const decoded = await verifyToken(
    refreshedToken,
    config.jwt.refresh_secret as Secret,
  );
  if (!decoded) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid refresh token');
  }

  const userData = await prisma.user.findUniqueOrThrow({
    where: {
      id: (decoded as any).id,
      status: UserStatus.ACTIVE,
    },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  let adminAccessFunctions: string[] = [];

  if (userData.role === UserRoleEnum.ADMIN) {
    const admin = await prisma.admin.findUnique({
      where: {
        userId: userData.id,
        isSuperAdmin: false,
      },
    });
    if (admin) {
      const accessFunctions = await prisma.adminAccessFunction.findMany({
        where: {
          adminId: userData.id,
        },
      });
      if (accessFunctions.length === 0) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You do not have access to any functions. Please contact super admin.',
        );
      }

      const functionNames = await prisma.accessFunction.findMany({
        where: {
          id: { in: accessFunctions.map(func => func.accessFunctionId) },
        },
      });
      if (functionNames.length === 0) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You do not have access to any functions. Please contact super admin.',
        );
      }

      adminAccessFunctions = functionNames.map(func => func.function);
    }
  }

  const newAccessToken = await generateToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      purpose: 'access',
      functions: adminAccessFunctions,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const newRefreshToken = await refreshToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const logoutUserFromDB = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { isLoggedIn: false },
  });
};
export const AuthServices = {
  loginUserFromDB,
  logoutUserFromDB,
  refreshTokenFromDB,
};

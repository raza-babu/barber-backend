import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createQrCodeIntoDb = async (userId: string, data: any) => {
  const existingQrCode = await prisma.qrCode.findFirst({
    where: {
      code: data.code,
      saloonOwnerId: userId,
    },
  });
  if (existingQrCode) {
    throw new AppError(httpStatus.BAD_REQUEST, 'QR Code already exists');
  }

  const result = await prisma.qrCode.create({
    data: {
      ...data,
      saloonOwnerId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'qrCode not created');
  }
  return result;
};

const getQrCodeListFromDb = async (userId: string) => {
  const result = await prisma.qrCode.findMany({
    where: {
      saloonOwnerId: userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getQrCodeByIdFromDb = async (userId: string, qrCodeId: string) => {
  const result = await prisma.qrCode.findUnique({
    where: {
      id: qrCodeId,
      saloonOwnerId: userId,
    },
  });
  if (!result) {
    return { message: 'QR Code not found' };
  }
  return result;
};

const updateQrCodeIntoDb = async (
  userId: string,
  qrCodeId: string,
  data: any,
) => {
  const result = await prisma.qrCode.update({
    where: {
      id: qrCodeId,
      saloonOwnerId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'qrCodeId, not updated');
  }
  return result;
};

const deleteQrCodeItemFromDb = async (userId: string, qrCodeId: string) => {
  const deletedItem = await prisma.qrCode.delete({
    where: {
      id: qrCodeId,
      saloonOwnerId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'qrCodeId, not deleted');
  }

  return deletedItem;
};

export const qrCodeService = {
  createQrCodeIntoDb,
  getQrCodeListFromDb,
  getQrCodeByIdFromDb,
  updateQrCodeIntoDb,
  deleteQrCodeItemFromDb,
};

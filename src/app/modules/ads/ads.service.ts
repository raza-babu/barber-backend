import { start } from 'repl';
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { deleteFileFromSpace } from '../../utils/deleteImage';

const createAdsIntoDb = async (userId: string, data: any) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  // Convert to UTC by adjusting for local timezone offset
  const startDateUtc = new Date(
    startDate.getTime() - startDate.getTimezoneOffset() * 60000,
  );
  const endDateUtc = new Date(
    endDate.getTime() - endDate.getTimezoneOffset() * 60000,
  );

  data.startDate = startDateUtc.toISOString();
  data.endDate = endDateUtc.toISOString();
  if (startDate >= endDate) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Start date must be before end date',
    );
  }

  const durationMs = endDateUtc.getTime() - startDateUtc.getTime();
  const durationDays = durationMs / (1000 * 60 * 60 * 24);
  data.duration = `${durationDays.toString()} days`;

  const result = await prisma.ads.create({
    data: {
      ...data,
      userId: userId,
      startDate: data.startDate,
      endDate: data.endDate,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'ads not created');
  }
  return result;
};

const getAdsListFromDb = async () => {
  const result = await prisma.ads.findMany();
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getAdsByIdFromDb = async (adsId: string) => {
  const result = await prisma.ads.findUnique({
    where: {
      id: adsId,
    },
  });
  if (!result) {
    return { message: 'Ads not found' };
  }
  return result;
};

const updateAdsIntoDb = async (userId: string, adsId: string, data: any) => {
  const existingAd = await prisma.ads.findUnique({
    where: { id: adsId },
  });

  if (!existingAd) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Ads not found');
  }

  // Normalize dates
  if (data.startDate && data.endDate) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (startDate >= endDate) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Start date must be before end date',
      );
    }

    data.startDate = new Date(
      startDate.getTime() - startDate.getTimezoneOffset() * 60000,
    ).toISOString();
    data.endDate = new Date(
      endDate.getTime() - endDate.getTimezoneOffset() * 60000,
    ).toISOString();
  }

  // 🟢 Merge logic for images
  let finalImages: string[] = existingAd.images || [];

  if (data.images !== undefined) {
    if (Array.isArray(data.images) && data.images.length > 0) {
      // Case 1: client sends FINAL list (existing + new) → replace directly
      finalImages = data.images;
    } else {
      // Case 2: client uploaded new images but didn’t send existing → merge
      finalImages = [...finalImages, ...data.images];
    }
  }

  const updateData: any = {};
  if (data.description !== undefined) updateData.description = data.description;
  if (finalImages.length > 0) updateData.images = finalImages;
  if (data.startDate !== undefined) updateData.startDate = data.startDate;
  if (data.endDate !== undefined) updateData.endDate = data.endDate;
  if (data.duration !== undefined) updateData.duration = data.duration;

  const result = await prisma.ads.update({
    where: { id: adsId },
    data: updateData,
  });

  const removedImages = existingAd.images.filter(
    img => !finalImages.includes(img),
  );
  for (const img of removedImages) {
    await deleteFileFromSpace(img); // implement using DeleteObjectCommand
    console.log('Deleted image from space:', img);
  }

  return result;
};

const deleteAdsItemFromDb = async (userId: string, adsId: string) => {
  const deletedItem = await prisma.ads.delete({
    where: {
      id: adsId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'adsId, not deleted');
  }

  return deletedItem;
};

export const adsService = {
  createAdsIntoDb,
  getAdsListFromDb,
  getAdsByIdFromDb,
  updateAdsIntoDb,
  deleteAdsItemFromDb,
};

import { start } from 'repl';
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';
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

const getAdsListFromDb = async (options: ISearchAndFilterOptions = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for description
  const searchQuery = options.searchTerm
    ? {
        description: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      }
    : {};

  // Date range filter
  const dateFilter: any = {};
  if (options.startDate) {
    dateFilter.startDate = {
      gte: new Date(options.startDate as string),
    };
  }
  if (options.endDate) {
    dateFilter.endDate = {
      lte: new Date(options.endDate as string),
    };
  }

  const whereClause = {
    ...(Object.keys(searchQuery).length > 0 && searchQuery),
    ...dateFilter,
  };

  const [result, total] = await Promise.all([
    prisma.ads.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.ads.count({ where: whereClause }),
  ]);

  return formatPaginationResponse(result, total, page, limit);
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

const updateAdsIntoDb = async (
  userId: string,
  adsId: string,
  data: any,
  existingImages: string[]
) => {
  const existingAd = await prisma.ads.findUnique({
    where: { id: adsId },
  });

  if (!existingAd) {
    throw new AppError(httpStatus.BAD_REQUEST, "Ads not found");
  }

  // Dates normalization
  if (data.startDate && data.endDate) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (startDate >= endDate) {
      throw new AppError(httpStatus.BAD_REQUEST, "Start date must be before end date");
    }

    data.startDate = new Date(
      startDate.getTime() - startDate.getTimezoneOffset() * 60000
    ).toISOString();
    data.endDate = new Date(
      endDate.getTime() - endDate.getTimezoneOffset() * 60000
    ).toISOString();
  }

  // Final images already prepared in controller
  const finalImages: string[] = data.images;

  const updateData: any = {
    description: data.description,
    images: finalImages,
    startDate: data.startDate,
    endDate: data.endDate,
  };

  const result = await prisma.ads.update({
    where: { id: adsId },
    data: updateData,
  });

  // Remove images that are not in final list anymore
  const removedImages = (existingAd.images || []).filter(
    img => !finalImages.includes(img)
  );

  for (const img of removedImages) {
    await deleteFileFromSpace(img);
    console.log("Deleted image from space:", img);
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

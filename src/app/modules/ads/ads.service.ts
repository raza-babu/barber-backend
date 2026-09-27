import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import moment from 'moment-timezone';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { getSalonTimezone, resolveTimezone } from '../../utils/timezone.helper';

const createAdsIntoDb = async (userId: string, data: any) => {
  const salon = await prisma.saloonOwner.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(salon);

  const startM = moment.tz(data.startDate, salonZone);
  const endM = moment.tz(data.endDate, salonZone);

  if (!startM.isValid() || !endM.isValid()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
  }

  if (!startM.isBefore(endM)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Start date must be before end date',
    );
  }

  const startDateUtc = startM.toDate();
  const endDateUtc = endM.toDate();

  data.startDate = startDateUtc.toISOString();
  data.endDate = endDateUtc.toISOString();

  const durationDays = endM.diff(startM, 'days');
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

const getAdsListFromDb = async (
  user: any,
  options: ISearchAndFilterOptions = {},
) => {
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
  if (options.startDate || options.endDate) {
    const zone = resolveTimezone(options.timezone);
    if (options.startDate) {
      dateFilter.startDate = {
        gte: moment.tz(options.startDate as string, zone).startOf('day').toDate(),
      };
    }
    if (options.endDate) {
      dateFilter.endDate = {
        lte: moment.tz(options.endDate as string, zone).endOf('day').toDate(),
      };
    }
  }

  const whereClause = {
    ...(Object.keys(searchQuery).length > 0 && searchQuery),
    ...dateFilter,
  };

  const now = new Date();

  const [result, total] = await Promise.all([
    prisma.ads.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.ads.count({ where: whereClause }),
  ]);

  // Filter out ads where current date is not between startDate and endDate
  const activeAds = result.filter(ad => {
    const start = new Date(ad.startDate);
    const end = new Date(ad.endDate);
    return now >= start && now <= end;
  });

  if ([UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN].includes(user.role)) {
    return formatPaginationResponse(result, total, page, limit);
  }

  // const activeTotal = await prisma.ads.count({
  //   where: {
  //     ...whereClause,
  //     startDate: { lte: now },
  //     endDate: { gte: now },
  //   },
  // });

  return formatPaginationResponse(activeAds, total, page, limit);
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
  existingImages: string[],
) => {
  const existingAd = await prisma.ads.findUnique({
    where: { id: adsId },
  });

  if (!existingAd) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Ads not found');
  }

  // Dates normalization
  if (data.startDate && data.endDate) {
    const salon = await prisma.saloonOwner.findUnique({
      where: { userId: existingAd.userId },
      select: { timezone: true },
    });
    const salonZone = getSalonTimezone(salon);

    const startM = moment.tz(data.startDate, salonZone);
    const endM = moment.tz(data.endDate, salonZone);

    if (!startM.isValid() || !endM.isValid()) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
    }

    if (!startM.isBefore(endM)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Start date must be before end date',
      );
    }

    data.startDate = startM.toDate().toISOString();
    data.endDate = endM.toDate().toISOString();
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
    img => !finalImages.includes(img),
  );

  for (const img of removedImages) {
    await deleteFileFromSpace(img);
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

import httpStatus from 'http-status';
import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import { BookingStatus, DiscountType } from '@prisma/client';
import { calculatePagination, formatPaginationResponse } from '../../utils/pagination';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const normalizeDate = (dateVal: string | Date, isEnd = false): Date => {
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
    const d = new Date(dateVal.trim());
    if (isEnd) {
      d.setUTCHours(23, 59, 59, 999);
    } else {
      d.setUTCHours(0, 0, 0, 0);
    }
    return d;
  }
  return new Date(dateVal);
};

const createDiscountOfferInDb = async (saloonOwnerId: string, payload: any) => {
  const saloonOwner = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId },
  });

  if (!saloonOwner) {
    throw new AppError(httpStatus.NOT_FOUND, 'Salon owner profile not found');
  }

  const code = payload.code ? payload.code.trim().toUpperCase() : null;

  if (code) {
    const existing = await prisma.salonDiscountOffer.findFirst({
      where: {
        saloonOwnerId,
        code,
      },
    });

    if (existing) {
      throw new AppError(
        httpStatus.CONFLICT,
        'A discount offer with this promo code already exists for your salon',
      );
    }
  }

  const result = await prisma.salonDiscountOffer.create({
    data: {
      saloonOwnerId,
      name: payload.name,
      description: payload.description,
      code,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      maxDiscountAmount: payload.maxDiscountAmount ?? null,
      minBookingAmount: payload.minBookingAmount ?? 0,
      startDate: normalizeDate(payload.startDate, false),
      endDate: normalizeDate(payload.endDate, true),
      isActive: payload.isActive ?? true,
      usageLimit: payload.usageLimit ?? null,
      perUserLimit: payload.perUserLimit ?? 1,
    },
  });

  return result;
};

const getSalonDiscountOffersForOwnerFromDb = async (
  saloonOwnerId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  const { searchTerm, isActive } = options as any;

  const andConditions: any[] = [{ saloonOwnerId }];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { code: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (isActive !== undefined) {
    const activeBool = isActive === 'true' || isActive === true;
    andConditions.push({ isActive: activeBool });
  }

  const where = { AND: andConditions };

  const [data, total] = await Promise.all([
    prisma.salonDiscountOffer.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy || 'createdAt']: sortOrder || 'desc',
      },
    }),
    prisma.salonDiscountOffer.count({ where }),
  ]);

  return formatPaginationResponse(data, total, page, limit);
};

const getDiscountOfferByIdFromDb = async (
  saloonOwnerId: string,
  offerId: string,
) => {
  const offer = await prisma.salonDiscountOffer.findUnique({
    where: { id: offerId },
  });

  if (!offer) {
    throw new AppError(httpStatus.NOT_FOUND, 'Discount offer not found');
  }

  if (offer.saloonOwnerId !== saloonOwnerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have permission to view this discount offer',
    );
  }

  return offer;
};

const updateDiscountOfferInDb = async (
  saloonOwnerId: string,
  offerId: string,
  payload: any,
) => {
  const existing = await prisma.salonDiscountOffer.findUnique({
    where: { id: offerId },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Discount offer not found');
  }

  if (existing.saloonOwnerId !== saloonOwnerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have permission to modify this discount offer',
    );
  }

  const code =
    payload.code !== undefined
      ? payload.code
        ? payload.code.trim().toUpperCase()
        : null
      : undefined;

  if (code && code !== existing.code) {
    const codeConflict = await prisma.salonDiscountOffer.findFirst({
      where: {
        saloonOwnerId,
        code,
        id: { not: offerId },
      },
    });

    if (codeConflict) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Another discount offer with this promo code already exists for your salon',
      );
    }
  }

  const updateData: any = { ...payload };
  if (code !== undefined) {
    updateData.code = code;
  }
  if (payload.startDate) {
    updateData.startDate = normalizeDate(payload.startDate, false);
  }
  if (payload.endDate) {
    updateData.endDate = normalizeDate(payload.endDate, true);
  }

  const result = await prisma.salonDiscountOffer.update({
    where: { id: offerId },
    data: updateData,
  });

  return result;
};

const deleteDiscountOfferFromDb = async (
  saloonOwnerId: string,
  offerId: string,
) => {
  const existing = await prisma.salonDiscountOffer.findUnique({
    where: { id: offerId },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Discount offer not found');
  }

  if (existing.saloonOwnerId !== saloonOwnerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You do not have permission to delete this discount offer',
    );
  }

  // Check if any bookings already used this offer
  const usedInBookings = await prisma.booking.count({
    where: { discountOfferId: offerId },
  });

  if (usedInBookings > 0) {
    // If referenced in historical bookings, deactivate instead of hard delete to preserve booking receipts
    const result = await prisma.salonDiscountOffer.update({
      where: { id: offerId },
      data: { isActive: false },
    });
    return result;
  }

  const result = await prisma.salonDiscountOffer.delete({
    where: { id: offerId },
  });

  return result;
};

const getActiveOffersForCustomerFromDb = async (
  saloonOwnerId: string,
  customerId?: string,
) => {
  const now = new Date();

  const offers = await prisma.salonDiscountOffer.findMany({
    where: {
      saloonOwnerId,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: {
      id: true,
      name: true,
      description: true,
      code: true,
      discountType: true,
      discountValue: true,
      maxDiscountAmount: true,
      minBookingAmount: true,
      startDate: true,
      endDate: true,
      usageLimit: true,
      usageCount: true,
      perUserLimit: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter out any offers whose global usage limit has been reached
  const availableOffers = offers.filter(
    offer => offer.usageLimit === null || offer.usageCount < offer.usageLimit,
  );

  if (customerId) {
    const offerIds = availableOffers.map(o => o.id);
    const userBookings = await prisma.booking.findMany({
      where: {
        userId: customerId,
        discountOfferId: { in: offerIds },
        status: { not: BookingStatus.CANCELLED },
      },
      select: {
        discountOfferId: true,
      },
    });

    const usageCountMap: Record<string, number> = {};
    for (const b of userBookings) {
      if (b.discountOfferId) {
        usageCountMap[b.discountOfferId] =
          (usageCountMap[b.discountOfferId] || 0) + 1;
      }
    }

    return availableOffers.map(offer => {
      const userUsage = usageCountMap[offer.id] || 0;
      const isRedeemed = offer.perUserLimit
        ? userUsage >= offer.perUserLimit
        : false;
      return {
        ...offer,
        userUsageCount: userUsage,
        isRedeemed,
      };
    });
  }

  return availableOffers;
};

const validateDiscountOfferForBooking = async (
  customerId: string,
  saloonOwnerId: string,
  identifier: { discountOfferId?: string; code?: string },
  subtotal: number,
) => {
  const { discountOfferId, code } = identifier;
  const now = new Date();

  const whereClause: any = {
    saloonOwnerId,
  };

  if (discountOfferId) {
    whereClause.id = discountOfferId;
  } else if (code) {
    whereClause.code = code.trim().toUpperCase();
  } else {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Discount offer ID or promo code must be provided',
    );
  }

  const offer = await prisma.salonDiscountOffer.findFirst({
    where: whereClause,
  });

  if (!offer) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Discount offer or promo code not found for this salon',
    );
  }

  if (!offer.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This discount offer is currently inactive',
    );
  }

  if (now < offer.startDate) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This discount offer has not started yet',
    );
  }

  if (now > offer.endDate) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This discount offer has expired',
    );
  }

  if (offer.usageLimit !== null && offer.usageCount >= offer.usageLimit) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This discount offer has reached its maximum total usage limit',
    );
  }

  if (offer.perUserLimit) {
    const userUsagesCount = await prisma.booking.count({
      where: {
        userId: customerId,
        discountOfferId: offer.id,
        status: { not: BookingStatus.CANCELLED },
      },
    });

    if (userUsagesCount >= offer.perUserLimit) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `You have already reached the maximum limit (${offer.perUserLimit}) for this discount offer`,
      );
    }
  }

  if (offer.minBookingAmount && subtotal < offer.minBookingAmount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Minimum booking amount to use this offer is £${offer.minBookingAmount}`,
    );
  }

  let discountAmount = 0;
  if (offer.discountType === DiscountType.PERCENTAGE) {
    discountAmount = (subtotal * offer.discountValue) / 100;
    if (offer.maxDiscountAmount && discountAmount > offer.maxDiscountAmount) {
      discountAmount = offer.maxDiscountAmount;
    }
  } else if (offer.discountType === DiscountType.FIXED) {
    discountAmount = Math.min(offer.discountValue, subtotal);
  }

  discountAmount = Math.round(discountAmount * 100) / 100;
  const finalPrice = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

  return {
    isValid: true,
    offer: {
      id: offer.id,
      name: offer.name,
      code: offer.code,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      maxDiscountAmount: offer.maxDiscountAmount,
    },
    subtotal,
    discountAmount,
    finalPrice,
  };
};

export const salonDiscountOfferService = {
  createDiscountOfferInDb,
  getSalonDiscountOffersForOwnerFromDb,
  getDiscountOfferByIdFromDb,
  updateDiscountOfferInDb,
  deleteDiscountOfferFromDb,
  getActiveOffersForCustomerFromDb,
  validateDiscountOfferForBooking,
};

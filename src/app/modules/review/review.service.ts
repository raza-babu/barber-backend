import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus, BookingStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createReviewIntoDb = async (userId: string, data: any) => {
  return await prisma.$transaction(async (tx) => {
    const BookingStatusCheck = await tx.booking.findUnique({
      where: {
        id: data.bookingId,
        userId: userId,
        status: BookingStatus.COMPLETED,
      },
    });
    if (!BookingStatusCheck) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Booking not found or not completed');
    }

    const existingReview = await tx.review.findFirst({
      where: {
        userId: userId,
        saloonOwnerId: data.saloonOwnerId,
        barberId: data.barberId,
      },
    });
    if (existingReview) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Review already exists for this booking');
    }

    const result = await tx.review.create({
      data: {
        ...data,
        userId: userId,
      },
    });
    if (!result) {
      throw new AppError(httpStatus.BAD_REQUEST, 'review not created');
    }
    const findExistingReview = await tx.review.findMany({
      where: {
        saloonOwnerId: data.saloonOwnerId,
        barberId: data.barberId,
      },
      select: {
        rating: true,
      },
      orderBy: {
        createdAt: 'desc',
      },  
    });

    const saloonReviewCount = findExistingReview.length;
    const saloonAvgRating = saloonReviewCount === 0 ? 0 : findExistingReview.reduce((acc, review) => acc + review.rating, 0) / saloonReviewCount;
    
    const updateSaloonOwner = await tx.saloonOwner.update({
      where: {
        userId: data.saloonOwnerId,
      },
      data: {
        ratingCount: {
          increment: 1,
        },
        avgRating: {
          set: saloonAvgRating
        },
      },
    });
    if (!updateSaloonOwner) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Saloon owner not updated');
    }

    const barberReviewCount = findExistingReview.length;
    const barberAvgRating = barberReviewCount === 0 ? 0 : findExistingReview.reduce((acc, review) => acc + review.rating, 0) / barberReviewCount;

    const updateBarber = await tx.barber.update({
      where: {
        userId: data.barberId,
        saloonOwnerId: data.saloonOwnerId,
      },
      data: {
        ratingCount: {
          increment: 1,
        },
        avgRating: {
          set: barberAvgRating,
        },
      },
    });
    if (!updateBarber) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Barber not updated');
    }
    return result;
  });
};

const getReviewListForSaloonFromDb = async (
  userId: string,
) => {
  const result = await prisma.review.findMany({
    where: {
      saloonOwnerId: userId,
    },
    select: {
      id: true,
      userId: true,
      barberId: true,
      saloonOwnerId: true,
      bookingId: true,
      rating: true,
      comment: true,
      createdAt: true,
      saloonOwner: {
        select: {
          userId : true,
          shopName: true,
          shopAddress: true,
          shopLogo: true,
        }
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result.map(review => ({
    id: review.id,
    customerId: review.userId,
    rating: review.rating,
    comment: review.comment,
    barberId: review.barberId,
    saloonOwnerId: review.saloonOwnerId,
    saloonName: review.saloonOwner?.shopName || 'Unknown Saloon',
    saloonAddress: review.saloonOwner?.shopAddress || 'Unknown Address',
    saloonLogo: review.saloonOwner?.shopLogo || null,
    bookingId: review.bookingId,
    createdAt: review.createdAt,
  }));
};

const getReviewListForBarberFromDb = async (
  userId: string,
  // barberId: string,
) => {
  const result = await prisma.review.findMany({
    where: {
      OR: [
        { barberId: userId },
        { saloonOwnerId: userId },
      ],
    },
    select: {
      id: true,
      barberId: true,
      saloonOwnerId: true,
      bookingId: true,
      userId: true,
      rating: true,
      comment: true,
      createdAt: true,
      saloonOwner: {
        select: {
          userId : true,
          shopName: true,
          shopAddress: true,
          shopLogo: true,
        }
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result.map(review => ({
    id: review.id,
    customerId: review.userId,
    rating: review.rating,
    comment: review.comment,
    barberId: userId,
    saloonOwnerId: review.saloonOwner?.userId || null,
    saloonName: review.saloonOwner?.shopName || 'Unknown Saloon',
    saloonAddress: review.saloonOwner?.shopAddress || 'Unknown Address',
    saloonLogo: review.saloonOwner?.shopLogo || null,
    bookingId: review.bookingId,
    createdAt: review.createdAt,
  }));
};

const getReviewByIdFromDb = async (userId: string, reviewId: string) => {
  const result = await prisma.review.findUnique({
    where: {
      id: reviewId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'review not found');
  }
  return result;
};

const updateReviewIntoDb = async (
  userId: string,
  reviewId: string,
  data: {
    rating: number;
    comment?: string;
  },
) => {
  return await prisma.$transaction(async (tx) => {
    const result = await tx.review.update({
      where: {
        id: reviewId,
        userId: userId,
      },
      data: {
        ...data,
      },
    });
    if (!result) {
      throw new AppError(httpStatus.BAD_REQUEST, 'reviewId, not updated');
    }

    const findExistingReview = await tx.review.findMany({
      where: {
        saloonOwnerId: result.saloonOwnerId,
        barberId: result.barberId,
      },
      select: {
        rating: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    const saloonReviewCount = findExistingReview.length;
    const saloonAvgRating = saloonReviewCount === 0 ? 0 : findExistingReview.reduce((acc, review) => acc + review.rating, 0) / saloonReviewCount;
    const updateSaloonOwner = await tx.saloonOwner.update({
      where: {
        userId: result.saloonOwnerId,
      },
      data: {
        avgRating: {
          set: saloonAvgRating,
        },
      },
    });
    if (!updateSaloonOwner) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Saloon owner not updated');
    }
    const barberReviewCount = findExistingReview.length;
    const barberAvgRating = barberReviewCount === 0 ? 0 : findExistingReview.reduce((acc, review) => acc + review.rating, 0) / barberReviewCount;
    const updateBarber = await tx.barber.update({
      where: {
        userId: result.barberId,
        saloonOwnerId: result.saloonOwnerId,
      },
      data: {
        avgRating: {
          set: barberAvgRating,
        },
      },
    });
    if (!updateBarber) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Barber not updated');
    }

    return result;
  });
};

const deleteReviewItemFromDb = async (userId: string, reviewId: string) => {
  return await prisma.$transaction(async (tx) => {
    const deletedItem = await tx.review.delete({
      where: {
        id: reviewId,
        userId: userId,
      },
    });
    if (!deletedItem) {
      throw new AppError(httpStatus.BAD_REQUEST, 'reviewId, not deleted');
    }
    const findExistingReview = await tx.review.findMany({
      where: {
        saloonOwnerId: deletedItem.saloonOwnerId,
        barberId: deletedItem.barberId,
      },
      select: {
        rating: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    const saloonReviewCount = findExistingReview.length;
    const saloonAvgRating = saloonReviewCount === 0 ? 0 : findExistingReview.reduce((acc, review) => acc + review.rating, 0) / saloonReviewCount;
    const updateSaloonOwner = await tx.saloonOwner.update({
      where: {
        userId: deletedItem.saloonOwnerId,
      },
      data: {
        ratingCount: {
          decrement: 1,
        },
        avgRating: {
          set: saloonAvgRating,
        },
      },
    });
    if (!updateSaloonOwner) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Saloon owner not updated');
    }
    const barberReviewCount = findExistingReview.length;
    const barberAvgRating = barberReviewCount === 0 ? 0 : findExistingReview.reduce((acc, review) => acc + review.rating, 0) / barberReviewCount; 
    const updateBarber = await tx.barber.update({
      where: {
        userId: deletedItem.barberId,
        saloonOwnerId: deletedItem.saloonOwnerId,
      },
      data: {
        ratingCount: {
          decrement: 1,
        },
        avgRating: {
          set: barberAvgRating,
        },
      },
    });
    if (!updateBarber) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Barber not updated');
    }
    return deletedItem;
  });
};

export const reviewService = {
  createReviewIntoDb,
  getReviewListForSaloonFromDb,
  getReviewListForBarberFromDb,
  getReviewByIdFromDb,
  updateReviewIntoDb,
  deleteReviewItemFromDb,
};

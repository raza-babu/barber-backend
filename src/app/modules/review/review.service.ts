import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus, BookingStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { notificationService } from '../notification/notification.service';

const createReviewIntoDb = async (userId: string, data: any) => {
  return await prisma.$transaction(async tx => {
    const BookingStatusCheck = await tx.booking.findUnique({
      where: {
        id: data.bookingId,
        userId: userId,
        status: BookingStatus.COMPLETED,
      },
    });
    if (!BookingStatusCheck) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Booking not found or not completed',
      );
    }

    const existingReview = await tx.review.findFirst({
      where: {
        userId: userId,
        saloonOwnerId: data.saloonOwnerId,
        barberId: data.barberId,
        bookingId: data.bookingId,
      },
    });
    if (existingReview) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Review already exists for this booking',
      );
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
    const saloonAvgRating =
      saloonReviewCount === 0
        ? 0
        : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
          saloonReviewCount;

    const updateSaloonOwner = await tx.saloonOwner.update({
      where: {
        userId: data.saloonOwnerId,
      },
      data: {
        ratingCount: {
          increment: 1,
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
    const barberAvgRating =
      barberReviewCount === 0
        ? 0
        : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
          barberReviewCount;

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
    
    // Send notification to barber and salon owner about new review
    try {
      const customer = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });

      const barber = await prisma.barber.findUnique({
        where: { id: data.barberId },
        select: { user: { select: { fcmToken: true } } },
      });

      const saloonOwner = await prisma.saloonOwner.findUnique({
        where: { userId: data.saloonOwnerId },
        select: { user: { select: { fcmToken: true } } },
      });

      if (customer) {
        // Notify barber
        if (barber?.user?.fcmToken) {
          await notificationService.sendNotification(
            barber.user.fcmToken,
            'New Review',
            `${customer.fullName} left you a ${data.rating}-star review!`,
            data.barberId,
          ).catch(error => console.error('Error sending barber review notification:', error));
        }

        // Notify salon owner
        if (saloonOwner?.user?.fcmToken) {
          await notificationService.sendNotification(
            saloonOwner.user.fcmToken,
            'New Salon Review',
            `${customer.fullName} left your salon a ${data.rating}-star review!`,
            data.saloonOwnerId,
          ).catch(error => console.error('Error sending salon review notification:', error));
        }
      }
    } catch (error) {
      console.error('Error sending review creation notification:', error);
    }
    
    return result;
  });
};

const getReviewListForSaloonFromDb = async (userId: string, saloonOwnerId: string, options: ISearchAndFilterOptions) => {
  const { page = 1, limit = 10 } = options;
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const take = limitNum;

  const [result, total] = await Promise.all([
    prisma.review.findMany({
      where: {
        saloonOwnerId,
      },
      select: {
        id: true,
        userId: true,
        barberId: true,
        saloonOwnerId: true,
        images: true,
        bookingId: true,
        rating: true,
        comment: true,
        createdAt: true,
        saloonOwner: {
          select: {
            userId: true,
            shopName: true,
            shopAddress: true,
            shopLogo: true,
          },
        },
        barber: {
          select: {
            userId: true,
            user: {
              select: {
                fullName: true,
                email: true,
                image: true,
              },
            },
          },
        },
        booking: {
          select: {
            appointmentAt: true,
            date: true,
            bookingType: true,
            user: {
              select: {
                fullName: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    }),
    prisma.review.count({
      where: {
        saloonOwnerId,
      },
    }),
  ]);

  if (result.length === 0) {
    return {
      data: [],
      meta: {
        page,
        limit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrePage: false,
      },
    };
  }

  return {
    data: result.map(review => ({
      id: review.id,
      customerId: review.userId,
      rating: review.rating,
      comment: review.comment,
      barberId: review.barberId,
      saloonOwnerId: review.saloonOwnerId,
      saloonName: review.saloonOwner?.shopName || 'Unknown Saloon',
      saloonAddress: review.saloonOwner?.shopAddress || 'Unknown Address',
      saloonLogo: review.saloonOwner?.shopLogo || null,
      type: review.booking?.bookingType || null,
      barberName: review.barber?.user?.fullName || 'Unknown Barber',
      barberImage: review.barber?.user?.image || null,
      customerName: review.booking?.user?.fullName || 'Unknown Customer',
      customerImage: review.booking?.user?.image || null,
      appointmentAt: review.booking?.appointmentAt || null,
      date: review.booking?.date || null,
      images: review.images || [],
      bookingId: review.bookingId,
      createdAt: review.createdAt,
    })),
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasNextPage: pageNum * limitNum < total,
      hasPrePage: pageNum > 1,
    },
  };
};

const getNotProvidedReviewsForSaloonFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page = 1, limit = 10 } = options;
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const take = limitNum;

  const [result, total] = await Promise.all([
    prisma.booking.findMany({
      where: {
        userId: userId,
        status: BookingStatus.COMPLETED,
        Review: {
          none: {},
        },
      },
      select: {
        id: true,
        userId: true,
        barberId: true,
        saloonOwnerId: true,
        date: true,
        bookingType: true,
        appointmentAt: true,
      },
      orderBy: {
        date: 'desc',
      },
      skip,
      take,
    }),
    prisma.booking.count({
      where: {
        userId: userId,
        status: BookingStatus.COMPLETED,
        Review: {
          none: {},
        },
      },
    }),
  ]);

  const saloonsNotReviewed = await Promise.all(
    result.map(async booking => {
      const saloons = await prisma.saloonOwner.findUnique({
        where: {
          userId: booking.saloonOwnerId,
        },
        select: {
          id: true,
          userId: true,
          shopName: true,
          shopAddress: true,
          shopImages: true,
          isVerified: true,
          shopLogo: true,
          shopVideo: true,
          latitude: true,
          longitude: true,
          ratingCount: true,
          avgRating: true,
          FavoriteShop: {
            where: {
              userId: booking.userId,
            },
            select: {
              id: true,
            },
          },
        },
      });

      return {
        id: saloons?.id,
        userId: saloons?.userId,
        bookingId: booking.id,
        barberId: booking.barberId,
        type: booking.bookingType,
        saloonOwnerId: booking.saloonOwnerId,
        saloonName: saloons?.shopName || 'Unknown Saloon',
        saloonAddress: saloons?.shopAddress || 'Unknown Address',
        saloonLogo: saloons?.shopLogo || null,
        saloonImages: saloons?.shopImages || [],
        saloonVideo: saloons?.shopVideo || null,
        latitude: saloons?.latitude || null,
        longitude: saloons?.longitude || null,
        ratingCount: saloons?.ratingCount || 0,
        avgRating: saloons?.avgRating || 0,
        isFavorite: saloons?.FavoriteShop.length !== 0,
      };
    }),
  );

  return {
    data: saloonsNotReviewed,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasNextPage: pageNum * limitNum < total,
      hasPrePage: pageNum > 1,
    },
  };
};

const getReviewListForBarberFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page = 1, limit = 10 } = options;
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const take = limitNum;

  const [result, total] = await Promise.all([
    prisma.review.findMany({
      where: {
        OR: [{ barberId: userId }, { saloonOwnerId: userId }],
      },
      select: {
        id: true,
        barberId: true,
        saloonOwnerId: true,
        bookingId: true,
        userId: true,
        rating: true,
        comment: true,
        images: true,
        createdAt: true,
        saloonOwner: {
          select: {
            userId: true,
            shopName: true,
            shopAddress: true,
            shopLogo: true,
          },
        },
        barber: {
          select: {
            userId: true,
            user: {
              select: {
                fullName: true,
                email: true,
                image: true,
              },
            },
          },
        },
        booking: {
          select: {
            appointmentAt: true,
            date: true,
            bookingType: true,
            user: {
              select: {
                fullName: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    }),
    prisma.review.count({
      where: {
        OR: [{ barberId: userId }, { saloonOwnerId: userId }],
      },
    }),
  ]);

  if (result.length === 0) {
    return {
      data: [],
      meta: {
        page: pageNum,
        limit: limitNum,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrePage: false,
      },
    };
  }

  return {
    data: result.map(review => ({
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
      type: review.booking?.bookingType || null,
      barberName: review.barber?.user?.fullName || 'Unknown Barber',
      barberImage: review.barber?.user?.image || null,
      customerName: review.booking?.user?.fullName || 'Unknown Customer',
      customerImage: review.booking?.user?.image || null,
      appointmentAt: review.booking?.appointmentAt || null,
      date: review.booking?.date || null,
      images: review.images || [],
      createdAt: review.createdAt,
    })),
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasNextPage: pageNum * limitNum < total,
      hasPrePage: pageNum > 1,
    },
  };
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
  return await prisma.$transaction(async tx => {
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
    const saloonAvgRating =
      saloonReviewCount === 0
        ? 0
        : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
          saloonReviewCount;
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
    const barberAvgRating =
      barberReviewCount === 0
        ? 0
        : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
          barberReviewCount;
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

    // Send notification to barber and salon owner about review update
    try {
      const customer = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { fullName: true },
      });

      const barber = await prisma.barber.findUnique({
        where: { userId: result.barberId },
        select: { user: { select: { fcmToken: true } } },
      });

      const saloonOwner = await prisma.saloonOwner.findUnique({
        where: { userId: result.saloonOwnerId },
        select: { user: { select: { fcmToken: true } } },
      });

      if (customer) {
        // Notify barber
        if (barber?.user?.fcmToken) {
          await notificationService.sendNotification(
            barber.user.fcmToken,
            'Review Updated',
            `${customer.fullName} updated their review to ${result.rating} stars!`,
            result.barberId,
          ).catch(error => console.error('Error sending barber update notification:', error));
        }

        // Notify salon owner
        if (saloonOwner?.user?.fcmToken) {
          await notificationService.sendNotification(
            saloonOwner.user.fcmToken,
            'Salon Review Updated',
            `${customer.fullName} updated their salon review to ${result.rating} stars!`,
            result.saloonOwnerId,
          ).catch(error => console.error('Error sending salon update notification:', error));
        }
      }
    } catch (error) {
      console.error('Error sending review update notification:', error);
    }

    return result;
  });
};

const deleteReviewItemFromDb = async (userId: string, reviewId: string) => {
  return await prisma.$transaction(async tx => {
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
    const saloonAvgRating =
      saloonReviewCount === 0
        ? 0
        : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
          saloonReviewCount;
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
    const barberAvgRating =
      barberReviewCount === 0
        ? 0
        : findExistingReview.reduce((acc, review) => acc + review.rating, 0) /
          barberReviewCount;
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

    // Send notification to barber and salon owner about review deletion
    try {
      const customer = await prisma.user.findUnique({
        where: { id: deletedItem.userId },
        select: { fullName: true },
      });

      const barber = await prisma.barber.findUnique({
        where: { userId: deletedItem.barberId },
        select: { user: { select: { fcmToken: true } } },
      });

      const saloonOwner = await prisma.saloonOwner.findUnique({
        where: { userId: deletedItem.saloonOwnerId },
        select: { user: { select: { fcmToken: true } } },
      });

      if (customer) {
        // Notify barber
        if (barber?.user?.fcmToken) {
          await notificationService.sendNotification(
            barber.user.fcmToken,
            'Review Deleted',
            `${customer.fullName} deleted their review.`,
            deletedItem.barberId,
          ).catch(error => console.error('Error sending barber deletion notification:', error));
        }

        // Notify salon owner
        if (saloonOwner?.user?.fcmToken) {
          await notificationService.sendNotification(
            saloonOwner.user.fcmToken,
            'Salon Review Deleted',
            `${customer.fullName} deleted their salon review.`,
            deletedItem.saloonOwnerId,
          ).catch(error => console.error('Error sending salon deletion notification:', error));
        }
      }
    } catch (error) {
      console.error('Error sending review deletion notification:', error);
    }

    return deletedItem;
  });
};

export const reviewService = {
  createReviewIntoDb,
  getReviewListForSaloonFromDb,
  getReviewListForBarberFromDb,
  getNotProvidedReviewsForSaloonFromDb,
  getReviewByIdFromDb,
  updateReviewIntoDb,
  deleteReviewItemFromDb,
};

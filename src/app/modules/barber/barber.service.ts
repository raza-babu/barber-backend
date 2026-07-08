import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { BookingStatus, UserRoleEnum } from '@prisma/client';
import { notificationService } from '../notification/notification.service';
import { blockService } from '../block/block.service';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';
import { buildCompleteQuery } from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { TGetAllSaloonsType } from './barber.validation';

const createBarberIntoDb = async (userId: string, data: any) => {
  const result = await prisma.barber.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barber not created');
  }
  return result;
};

const getMyScheduleFromDb = async (userId: string, dayName: string) => {
  const result = await prisma.barberSchedule.findMany({
    where: {
      barberId: userId,
      // dayName: dayName,
    },
    select: {
      id: true,
      saloonOwnerId: true,
      barberId: true,
      dayName: true,
      openingTime: true,
      closingTime: true,
      isActive: true,
      type: true,
      // openingDateTime: true,
      // closingDateTime: true,
    },
  });
  if (!result) {
    return [];
  }
  return result.map(item => {
    const weekend = item.isActive === false;
    return {
      id: item.id,
      saloonOwnerId: item.saloonOwnerId,
      barberId: item.barberId,
      dayName: item.dayName,
      time: item.isActive
        ? `${item.openingTime} - ${item.closingTime}`
        : 'Closed',
      isActive: item.isActive,
      type: item.type,
      weekend,
      // openingDateTime: item.openingDateTime,
      // closingDateTime: item.closingDateTime,
    };
  });
};

const getMyBookingsFromDb = async (
  userId: string,
  options?: {
    search?: string;
    status?: BookingStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  },
) => {
  const page = options?.page || 1;
  const limit = options?.limit || 10;
  const skip = (page - 1) * limit;

  // Build where clause
  const whereClause: any = {
    barberId: userId,
    OR: [
      { status: BookingStatus.CONFIRMED },
      { status: BookingStatus.COMPLETED },
      { status: BookingStatus.STARTED },
      { status: BookingStatus.ENDED },
    ],
  };

  // Filter by status if provided
  if (options?.status) {
    whereClause.OR = [{ status: options.status }];
  }

  // Filter by date range
  if (options?.startDate || options?.endDate) {
    whereClause.AND = whereClause.AND || [];
    if (options?.startDate) {
      whereClause.AND.push({
        startDateTime: { gte: new Date(options.startDate) },
      });
    }
    if (options?.endDate) {
      whereClause.AND.push({
        endDateTime: { lte: new Date(options.endDate) },
      });
    }
  }

  // Get total count for pagination
  const totalCount = await prisma.booking.count({
    where: whereClause,
  });

  let bookings = await prisma.booking.findMany({
    where: whereClause,
    include: {
      BookedServices: {
        select: {
          id: true,
          service: {
            select: {
              id: true,
              serviceName: true,
              duration: true,
              availableTo: true,
              price: true,
            },
          },
        },
      },
    },
    orderBy: { startDateTime: 'asc' },
    skip,
    take: limit,
  });

  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  if (bookings.length === 0) {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage,
        hasPrevPage,
      },
      message: 'No bookings found',
    };
  }

  const bookingUserIds = Array.from(
    new Set(bookings.map(b => b.userId).filter(Boolean)),
  );

  const registeredUsersMap: Record<string, any> = {};
  if (bookingUserIds.length > 0) {
    const registeredUsers = await prisma.user.findMany({
      where: { id: { in: bookingUserIds } },
      // include email and phoneNumber so we don't lose those fields when replacing the user object
      select: {
        id: true,
        fullName: true,
        image: true,
        email: true,
        phoneNumber: true,
      },
    });
    for (const u of registeredUsers) {
      registeredUsersMap[u.id] = u;
    }
  }

  const nonRegisteredUsersMap: Record<string, any> = {};
  const nonRegIds = bookingUserIds.filter(id => !registeredUsersMap[id]);
  if (nonRegIds.length > 0) {
    const nonRegisteredUsers = await prisma.nonRegisteredUser.findMany({
      where: { id: { in: nonRegIds } },
      // include phoneNumber and image if available, and email
      select: { id: true, fullName: true, email: true, phone: true },
    });
    for (const nr of nonRegisteredUsers) {
      nonRegisteredUsersMap[nr.id] = nr;
    }
  }

  bookings = bookings.map(b => {
    const uid = b.userId as string | null;
    const userObj = (uid && registeredUsersMap[uid]) ||
      (uid && nonRegisteredUsersMap[uid]) || {
        id: null,
        fullName: null,
        email: null,
        phoneNumber: null,
        image: null,
      };
    return { ...b, user: userObj };
  });
  bookings = bookings.map(b => ({
    ...b,
    user: (b as any).user ?? {
      id: null,
      fullName: null,
      email: null,
      phoneNumber: null,
      image: null,
    },
  }));

  let results = bookings.map(booking => ({
    bookingId: booking.id,
    userId: booking.userId,
    saloonOwnerId: booking.saloonOwnerId,
    barberId: booking.barberId,
    bookingType: booking.bookingType,
    date: booking.date,
    startDateTime: booking.startDateTime,
    endDateTime: booking.endDateTime,
    status: booking.status,
    totalPrice: booking.totalPrice,
    createdAt: booking.createdAt,
    userFullName: (booking as any).user.fullName,
    userEmail: (booking as any).user.email,
    userPhoneNumber: (booking as any).user.phoneNumber,
    userImage: (booking as any).user.image,
    bookedServices: booking.BookedServices.map(bs => ({
      id: bs.service.id,
      serviceName: bs.service.serviceName,
      availableTo: bs.service.availableTo,
      price: bs.service.price,
      duration: bs.service.duration,
    })),
  }));

  // Apply search filter on transformed results
  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    results = results.filter(
      booking =>
        booking.userFullName?.toLowerCase().includes(searchLower) ||
        booking.userEmail?.toLowerCase().includes(searchLower) ||
        booking.userPhoneNumber?.toLowerCase().includes(searchLower) ||
        booking.bookingId.toLowerCase().includes(searchLower),
    );
  }

  return {
    data: results,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage,
      hasPrevPage,
    },
  };
};

const getBarberListFromDb = async (userId: string) => {
  // Get blocked user IDs
  const blockedUserIds = userId
    ? await blockService.getBlockedUserIdsFromDb(userId)
    : [];
  const blockedByUserIds = userId
    ? await blockService.getBlockedByUserIdsFromDb(userId)
    : [];
  const excludeUserIds = [...blockedUserIds, ...blockedByUserIds];

  const result = await prisma.barber.findMany({
    where: {
      user: {
        // Note: Handle account deactivations also:
        isDeactivated: false,
        id: excludeUserIds.length > 0 ? { notIn: excludeUserIds } : undefined,
      },
    },
  });
  if (result.length === 0) {
    return { message: 'No barber found' };
  }
  return result;
};

const getSaloonOwnerList = async (
  userId: string,
  query: TGetAllSaloonsType,
) => {
  const { page, limit, searchTerm } = query;

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  // 1. Get blocked user IDs to handle exclusions
  const blockedUserIds = userId
    ? await blockService.getBlockedUserIdsFromDb(userId)
    : [];
  const blockedByUserIds = userId
    ? await blockService.getBlockedByUserIdsFromDb(userId)
    : [];
  const excludeUserIds = [...blockedUserIds, ...blockedByUserIds];

  // 2. Build the structural filters
  const whereClause: any = {
    id: excludeUserIds.length > 0 ? { notIn: excludeUserIds } : undefined,
    role: UserRoleEnum.SALOON_OWNER,
    status: 'ACTIVE',
    isDeactivated: false,
    isProfileComplete: true,
  };

  // 3. Inject Search Term conditions
  if (searchTerm) {
    whereClause.OR = [
      { fullName: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } },
      {
        SaloonOwner: {
          some: {
            OR: [
              { shopName: { contains: searchTerm, mode: 'insensitive' } },
              { shopBio: { contains: searchTerm, mode: 'insensitive' } },
              { shopAddress: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }

  // 4. Run total count and data extraction concurrently via Promise.all
  const [total, result] = await prisma.$transaction([
    prisma.user.count({ where: whereClause }),
    prisma.user.findMany({
      where: whereClause,
      skip: skip,
      take: limitNum,
      select: {
        id: true,
        fullName: true,
        email: true,
        image: true,
        SaloonOwner: {
          select: {
            id: true,
            shopAddress: true,
            shopBio: true,
            shopImages: true,
            shopLogo: true,
            shopName: true,
            followerCount: true,
            followingCount: true,
          },
        },
      },
    }),
  ]);

  // 5. Total pages calculation
  const totalPage = Math.ceil(total / limitNum);

  if (result.length === 0) {
    return {
      meta: {
        page: pageNum,
        limit: limitNum,
        total: 0,
        totalPage: 0,
      },
      data: [],
    };
  }

  // 6. Format the flattened dataset
  const formattedValue = result.map(({ SaloonOwner, ...user }) => {
    const ownerDetails = SaloonOwner?.[0]; // Access first element of relation array

    return {
      ...user,
      shopId: ownerDetails?.id,
      shopAddress: ownerDetails?.shopAddress,
      shopBio: ownerDetails?.shopBio,
      shopImages: ownerDetails?.shopImages,
      shopLogo: ownerDetails?.shopLogo,
      shopName: ownerDetails?.shopName,
      followerCount: ownerDetails?.followerCount,
      followingCount: ownerDetails?.followingCount,
    };
  });

  // 7. Standard API paginated format output
  return {
    meta: {
      page: pageNum,
      limit: limitNum,
      total: total,
      totalPage: totalPage,
    },
    data: formattedValue,
  };
};

const getBarberByIdFromDb = async (userId: string, barberId: string) => {
  // Check if barber is blocked
  if (userId) {
    const isBlocked = await blockService.checkIfBlockedFromDb(userId, barberId);
    if (isBlocked) {
      throw new AppError(httpStatus.FORBIDDEN, 'This barber is blocked');
    }
  }

  const result = await prisma.barber.findUnique({
    where: {
      userId: barberId,
    },
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
          phoneNumber: true,
          image: true,
          followerCount: true,
          followingCount: true,
          isDeactivated: true,
        },
      },
    },
  });

  //  Note: Handle account deactivation :
  if (result?.user?.isDeactivated) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Barber profile is deactiaved!');
  }

  // check following or not
  const isFollowing = await prisma.follow.findFirst({
    where: {
      userId: userId,
      followingId: barberId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'barber not found');
  }

  // without user
  const { user, ...rest } = result;

  return {
    isMe: userId === barberId,
    ...rest,
    user,
    followerCount: result.user.followerCount,
    followingCount: result.user.followingCount,
    isFollowing: isFollowing ? true : false,
  };
};

const updateBookingStatusIntoDb = async (
  userId: string,
  bookingId: string,
  data: { status: BookingStatus },
) => {
  // Perform all database operations within a transaction
  const result = await prisma.$transaction(async tx => {
    const existingBooking = await tx.booking.findUnique({
      where: {
        id: bookingId,
        barberId: userId,
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.STARTED],
        },
      },
      include: {
        BookedServices: {
          select: {
            serviceId: true,
          },
        },
      },
    });

    if (!existingBooking) {
      throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
    }

    // Validate status transitions
    if (data.status === BookingStatus.ENDED) {
      if (existingBooking.status !== BookingStatus.STARTED) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Booking must be in STARTED status to end it',
        );
      }
    }

    const now = new Date();

    // Time validation for STARTED status
    // if (data.status === BookingStatus.STARTED) {
    //   const scheduledStartTime = existingBooking.startDateTime
    //     ? new Date(existingBooking.startDateTime)
    //     : null;
    //   const twentyMinsBeforeStart = scheduledStartTime
    //     ? new Date(scheduledStartTime.getTime() - 20 * 60000)
    //     : null;

    //   if (twentyMinsBeforeStart && now < twentyMinsBeforeStart) {
    //     throw new AppError(
    //       httpStatus.BAD_REQUEST,
    //       'Cannot start booking before 20 minutes of scheduled time',
    //     );
    //   }
    // }

    // // Time validation for ENDED status
    // if (data.status === BookingStatus.ENDED) {
    //   if (!existingBooking.actualStartedAt && !existingBooking.startDateTime) {
    //     throw new AppError(
    //       httpStatus.BAD_REQUEST,
    //       'Booking must have an actual start time before ending. Please ensure the booking was started first.',
    //     );
    //   }

    //   const endTime = new Date(existingBooking.endDateTime!);
    //   const twentyMinsBeforeEnd = new Date(endTime.getTime() - 20 * 60000);

    //   if (now < twentyMinsBeforeEnd) {
    //     throw new AppError(
    //       httpStatus.BAD_REQUEST,
    //       'Cannot end booking before 20 minutes of scheduled end time',
    //     );
    //   }
    // }

    // Prepare update data
    const updateData: any = {
      status: data.status,
    };
    let actualDurationMinutes: number | null = null;

    // Track actual start time
    if (data.status === BookingStatus.STARTED) {
      updateData.actualStartedAt = now;
      console.log(`📍 Booking ${bookingId} STARTED at ${now.toISOString()}`);
    }

    // Track actual end time
    if (data.status === BookingStatus.ENDED) {
      const actualStartTime = existingBooking.actualStartedAt
        ? new Date(existingBooking.actualStartedAt)
        : existingBooking.startDateTime
          ? new Date(existingBooking.startDateTime)
          : null;

      if (!actualStartTime) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Booking must have an actual start time before ending. Please ensure the booking was started first.',
        );
      }

      actualDurationMinutes = Math.round(
        (now.getTime() - actualStartTime.getTime()) / 60000,
      );

      updateData.actualEndedAt = now;
      updateData.actualDurationMinutes = actualDurationMinutes;
      console.log(`📍 Booking ${bookingId} ENDED at ${now.toISOString()}`);
    }

    // Update booking
    const updatedBooking = await tx.booking.update({
      where: { id: bookingId, barberId: userId },
      data: updateData,
    });

    if (!updatedBooking) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Booking status not updated');
    }

    // Calculate and save queue time when booking ends
    if (updatedBooking.status === BookingStatus.ENDED) {
      // Get the ACTUAL start time from the booking lifecycle.
      const actualStartTime = updatedBooking.actualStartedAt
        ? new Date(updatedBooking.actualStartedAt)
        : existingBooking.startDateTime
          ? new Date(existingBooking.startDateTime)
          : null;

      // Get the ACTUAL end time from the just-updated result.
      const actualEndTime = updatedBooking.actualEndedAt
        ? new Date(updatedBooking.actualEndedAt)
        : null;

      console.log('=== Queue Time Calculation ===');
      console.log('actualStartTime:', actualStartTime?.toISOString());
      console.log('actualEndTime:', actualEndTime?.toISOString());

      if (!actualStartTime || !actualEndTime) {
        console.warn(
          `⚠️ Booking ${bookingId} ended but missing actual times:`,
          `startTime=${actualStartTime}, endTime=${actualEndTime}`,
        );
        return updatedBooking;
      }

      // Calculate actual service duration in minutes (end time - start time)
      actualDurationMinutes =
        actualDurationMinutes ??
        Math.round((actualEndTime.getTime() - actualStartTime.getTime()) / 60000);

      console.log(`⏱️ Actual duration: ${actualDurationMinutes} minutes`);
      console.log(
        `📅 Scheduled duration: ${
          existingBooking.startDateTime && existingBooking.endDateTime
            ? Math.round(
                (new Date(existingBooking.endDateTime).getTime() -
                  new Date(existingBooking.startDateTime).getTime()) /
                  60000,
              )
            : 'unknown'
        } minutes`,
      );

      // Validate actual duration is reasonable (at least 1 minute)
      if (actualDurationMinutes < 1) {
        console.warn(
          `⚠️ Booking ${bookingId} has invalid duration: ${actualDurationMinutes}min. Skipping queue time update.`,
        );
        return updatedBooking;
      }

      // Get sorted service IDs for consistent matching
      const serviceIds = existingBooking.BookedServices.map(
        bs => bs.serviceId,
      ).sort();

      console.log('Service IDs:', serviceIds);

      // Find existing queue time for this service combination
      const existingQueueTime = await tx.queueTime.findFirst({
        where: {
          saloonId: updatedBooking.saloonOwnerId,
          barberId: userId,
          serviceIds: {
            hasEvery: serviceIds, // Must contain all service IDs
            // equals: serviceIds,    // Must be exact match
          },
        },
      });

      if (existingQueueTime) {
        console.log(
          `📊 Found existing queue time: ${existingQueueTime.averageMin}min`,
        );

        // Only update if new time is LESS than existing time
        if (actualDurationMinutes < existingQueueTime.averageMin) {
          await tx.queueTime.update({
            where: { id: existingQueueTime.id },
            data: {
              averageMin: actualDurationMinutes, // Use the shorter time
              bookingId: bookingId, // Update to latest booking
            },
          });

          console.log(
            `✅ Updated queue time: ${existingQueueTime.averageMin}min → ${actualDurationMinutes}min (shorter time!)`,
          );
        } else {
          console.log(
            `⏭️ Keeping existing queue time: ${existingQueueTime.averageMin}min (current time ${actualDurationMinutes}min is not shorter)`,
          );
        }
      } else {
        // First time - Create new queue time record with actual duration
        console.log('📝 No existing queue time found, creating new record');

        await tx.queueTime.create({
          data: {
            saloonId: updatedBooking.saloonOwnerId,
            customerId: updatedBooking.userId,
            barberId: userId,
            serviceIds: serviceIds,
            bookingId: bookingId,
            averageMin: actualDurationMinutes, // Use actual time for first booking
          },
        });

        console.log(
          `✅ Created new queue time: ${actualDurationMinutes}min for services [${serviceIds.join(', ')}]`,
        );
      }
    }

    return updatedBooking;
  });

  // Send notification to customer about booking status change (outside transaction)
  // This is intentionally outside the transaction since it's an external service call
  try {
    if (result.userId) {
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { fcmToken: true },
      });

      if (user) {
        let notificationTitle = 'Booking Status Updated';
        let notificationBody = '';

        switch (result.status) {
          case BookingStatus.STARTED:
            notificationTitle = 'Service Started';
            notificationBody = 'Your barber has started the service.';
            break;
          case BookingStatus.ENDED:
            notificationTitle = 'Service Completed';
            notificationBody =
              'Your service has been completed. Please leave a review!';
            break;
        }

        if (notificationBody) {
          await notificationService.sendNotification(
            user.fcmToken,
            notificationTitle,
            notificationBody,
            result.userId,
            userId,
          );
        }
      }
    }
  } catch (error) {
    console.error('Error sending booking status notification:', error);
  }

  return result;
};

const updateBarberIntoDb = async (
  userId: string,
  barberId: string,
  data: any,
) => {
  const result = await prisma.barber.update({
    where: {
      id: barberId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberId, not updated');
  }
  return result;
};

const deleteBarberItemFromDb = async (userId: string, barberId: string) => {
  const deletedItem = await prisma.barber.delete({
    where: {
      id: barberId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberId, not deleted');
  }

  return deletedItem;
};

const getSaloonFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const whereClause = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['fullName', 'email', 'phoneNumber'],
    },
    {
      role: UserRoleEnum.SALOON_OWNER,
      isProfileComplete: true,
      // ...(options.status
      //   ? { status: options.status }
      //   : { status: { not: UserStatus.PENDING } }),
      ...(options?.status && { status: options.status }),
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    },
  );

  // Handle SaloonOwner specific filters
  // if (options.isVerified !== undefined) {
  //   whereClause.SaloonOwner = {
  //     isVerified: options.isVerified === true,
  //   };
  // }

  const [saloons, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        status: true,
        createdAt: true,
        SaloonOwner: {
          select: {
            userId: true,
            isVerified: true,
            shopAddress: true,
            shopName: true,
            registrationNumber: true,
            shopLogo: true,
            shopImages: true,
            shopVideo: true,
            ratingCount: true,
            avgRating: true,
          },
        },
      },
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  // Flatten the response so that SaloonOwner fields are at the top level
  const flattenedSaloons = saloons.map(saloon => {
    const { SaloonOwner, ...userFields } = saloon;
    const owner = Array.isArray(SaloonOwner) ? SaloonOwner[0] : SaloonOwner;
    return {
      ...userFields,
      userId: owner?.userId,
      isVerified: owner?.isVerified,
      shopPhoneNumber: userFields.phoneNumber,
      shopAddress: owner?.shopAddress,
      shopName: owner?.shopName,
      registrationNumber: owner?.registrationNumber,
      shopLogo: owner?.shopLogo,
      shopImages: owner?.shopImages,
      shopVideo: owner?.shopVideo,
      ratingCount: owner?.ratingCount || 0,
      avgRating: owner?.avgRating || 0,
    };
  });

  return formatPaginationResponse(flattenedSaloons, total, page, limit);
};
export const barberService = {
  createBarberIntoDb,
  getMyScheduleFromDb,
  getBarberListFromDb,
  getMyBookingsFromDb,
  getBarberByIdFromDb,
  updateBookingStatusIntoDb,
  updateBarberIntoDb,
  deleteBarberItemFromDb,
  getSaloonFromDb,
  getSaloonOwnerList,
};

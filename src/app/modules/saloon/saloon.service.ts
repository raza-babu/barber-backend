import prisma from '../../utils/prisma';
import { BookingStatus, UserRoleEnum, UserStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { start } from 'repl';
import { DateTime } from 'luxon';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination, formatPaginationResponse } from '../../utils/pagination';

const manageBookingsIntoDb = async (
  userId: string,
  data: {
    bookingId: string;
    status: BookingStatus;
  },
) => {
  return await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: {
        id: data.bookingId,
        saloonOwnerId: userId,
      },
    });

    if (!booking) {
      throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
    }

    const currentStatus = booking.status;
    const targetStatus = data.status;
    const bookingEndTime = DateTime.fromJSDate(booking.endDateTime!);
    const now = DateTime.now();

    // ---------- Status Transition Rules ----------
    switch (targetStatus) {
      case BookingStatus.PENDING:
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Status cannot be changed back to pending',
        );

      case BookingStatus.CONFIRMED:
        if (currentStatus !== BookingStatus.PENDING) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Only pending bookings can be confirmed',
          );
        }
        break;

      case BookingStatus.COMPLETED:
        if (currentStatus !== BookingStatus.CONFIRMED) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Only confirmed bookings can be marked as completed',
          );
        }
        if (now < bookingEndTime) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Cannot mark an ongoing booking as completed',
          );
        }
        break;

      case BookingStatus.CANCELLED:
        if (currentStatus === BookingStatus.COMPLETED) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Completed bookings cannot be cancelled',
          );
        }
        if (currentStatus === BookingStatus.CANCELLED) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Booking is already cancelled',
          );
        }
        break;

      default:
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid status transition');
    }

    // ---------- Additional Rules ----------
    if (currentStatus === BookingStatus.RESCHEDULED && now > bookingEndTime) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Cannot change status of a missed booking',
      );
    }

    // ---------- Refund Logic Placeholders ----------
    if (
      (currentStatus === BookingStatus.CONFIRMED &&
        targetStatus === BookingStatus.CANCELLED) ||
      (currentStatus === BookingStatus.PENDING &&
        targetStatus === BookingStatus.CANCELLED)
    ) {
      // Refund logic can be implemented here if needed
    }

    // ---------- Update Booking ----------
    const updatedBooking = await tx.booking.update({
      where: {
        id: data.bookingId,
        saloonOwnerId: userId,
      },
      data: {
        status: targetStatus,
      },
    });

    if (!updatedBooking) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Booking not found or not updated',
      );
    }

    return updatedBooking;
  });
};

const getBarberDashboardFromDb = async (userId: string) => {
  const customerCount = await prisma.booking.count({
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
    },
  });
  const totalEarnings = await prisma.booking.aggregate({
    _sum: {
      totalPrice: true,
    },
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
    },
  });

  const barberCount = await prisma.barber.count({
    where: {
      saloonOwnerId: userId,
    },
  });
  const bookingCount = await prisma.booking.count({
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.PENDING,
    },
  });
  // Get customer growth for the last 12 months, grouped by month and year (e.g., Jan 2024)
  const startDate = DateTime.now()
    .minus({ months: 11 })
    .startOf('month')
    .toJSDate();
  const customerGrowthRaw = await prisma.booking.findMany({
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
      createdAt: {
        gte: startDate,
      },
    },
    select: {
      createdAt: true,
    },
  });

  // Prepare a map for each month in the last 12 months (e.g., Jan 2024)
  const monthlyGrowth: { [key: string]: number } = {};
  for (let i = 0; i < 12; i++) {
    const dt = DateTime.now().minus({ months: 11 - i });
    const monthYear = dt.toFormat('LLL yyyy'); // e.g., Jan 2024
    monthlyGrowth[monthYear] = 0;
  }

  // Count bookings per month-year
  customerGrowthRaw.forEach(item => {
    const monthYear = DateTime.fromJSDate(item.createdAt).toFormat('LLL yyyy');
    if (monthlyGrowth[monthYear] !== undefined) {
      monthlyGrowth[monthYear]++;
    }
  });

  // Calculate earning growth for the last 12 months, grouped by month and year
  const earningGrowthRaw = await prisma.booking.findMany({
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
      createdAt: {
        gte: startDate,
      },
    },
    select: {
      createdAt: true,
      totalPrice: true,
    },
  });

  // Prepare a map for each month in the last 12 months for earnings
  const monthlyEarnings: { [key: string]: number } = {};
  for (let i = 0; i < 12; i++) {
    const dt = DateTime.now().minus({ months: 11 - i });
    const monthYear = dt.toFormat('LLL yyyy');
    monthlyEarnings[monthYear] = 0;
  }

  // Sum earnings per month-year
  earningGrowthRaw.forEach(item => {
    const monthYear = DateTime.fromJSDate(item.createdAt).toFormat('LLL yyyy');
    if (monthlyEarnings[monthYear] !== undefined) {
      monthlyEarnings[monthYear] += item.totalPrice ?? 0;
    }
  });

  return {
    totalCustomers: customerCount,
    totalEarnings: totalEarnings._sum.totalPrice || 0,
    totalBarbers: barberCount,
    totalBookings: bookingCount,
    earningGrowth: Object.entries(monthlyEarnings).map(([month, amount]) => ({
      month,
      amount,
    })),
    customerGrowth: Object.entries(monthlyGrowth).map(([month, count]) => ({
      month,
      count,
    })),
  };
};

const getCustomerBookingsFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {}
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for customer name, email, phone, or barber name
  const searchQuery = options.searchTerm
    ? {
        OR: [
          {
            user: {
              fullName: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            user: {
              email: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            user: {
              phoneNumber: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            barber: {
              user: {
                fullName: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
        ],
      }
    : {};

  // Status filter
  const statusFilter =
    options.status && Array.isArray(options.status)
      ? { status: { in: options.status.map(s => s as BookingStatus) } }
      : options.status
      ? { status: options.status as BookingStatus }
      : {};

  const whereClause = {
    saloonOwnerId: userId,
    ...statusFilter,
    ...(Object.keys(searchQuery).length > 0 && searchQuery),
  };

  const [result, total] = await Promise.all([
    prisma.booking.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]:  'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            image: true,
            email: true,
            phoneNumber: true,
          },
        },
        barber: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                image: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        BookedServices: {
          select: {
            service: {
              select: {
                id: true,
                serviceName: true,
                price: true,
                availableTo: true,
              },
            },
          },
        },
      },
    }),
    prisma.booking.count({
      where: whereClause,
    }),
  ]);

  const bookings = result.map(booking => ({
    bookingId: booking.id,
    customerId: booking.user.id,
    customerName: booking.user.fullName,
    customerImage: booking.user.image,
    customEmail: booking.user.email,
    customerPhone: booking.user.phoneNumber,
    barberId: booking.barber.user.id,
    barberName: booking.barber.user.fullName,
    barberImage: booking.barber.user.image,
    barberEmail: booking.barber.user.email,
    barberPhone: booking.barber.user.phoneNumber,
    totalPrice: booking.totalPrice,
    bookingDate: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    // paymentStatus: booking.paymentStatus,
    status: booking.status,
    services: booking.BookedServices.map(service => ({
      serviceId: service.service.id,
      serviceName: service.service.serviceName,
      price: service.service.price,
      availableTo: service.service.availableTo,
    })),
  }));

  return formatPaginationResponse(bookings, total, page, limit);
};


const getTransactionsFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {}
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);


  const searchQuery = options.searchTerm
    ? {
        OR: [
          {
            user: {
              fullName: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            user: {
              email: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            user: {
              phoneNumber: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            barber: {
              user: {
                fullName: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
          {
            BookedServices: {
              some: { 
                service: {
                  serviceName: {
                    contains: options.searchTerm,
                    mode: 'insensitive' as const,
                  },
                },
              },
            },
          },
          // Removed invalid payment status search by 'contains' since status is an enum
        ],
      }
    : {};
  // Only fetch payments with status 'COMPLETED' and join booking for saloonOwnerId
  const whereClause = {
    status: { in: [PaymentStatus.COMPLETED, PaymentStatus.REFUNDED] },
    booking: {
      saloonOwnerId: userId,
      ...(searchQuery.OR
        ? {
            OR: searchQuery.OR.map((searchCondition: any) => {
              // Move booking-related search fields inside booking
              if (
                searchCondition.user ||
                searchCondition.barber ||
                searchCondition.BookedServices
              ) {
                return searchCondition;
              }
              return undefined;
            }).filter(Boolean),
          }
        : {}),
    },
    // Removed invalid payment status search by 'contains' since status is an enum
  };

  const [result, total] = await Promise.all([
    prisma.payment.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        booking: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                image: true,
                email: true,
                phoneNumber: true,
              },
            },
            barber: {
              select: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    image: true,
                    email: true,
                    phoneNumber: true,
                  },
                },
              },
            },
            BookedServices: {
              select: {
                service: {
                  select: {
                    id: true,
                    serviceName: true,
                    price: true,
                    availableTo: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.payment.count({
      where: whereClause,
    }),
  ]);


  const transactions = result.map(payment => {
    const booking = payment.booking;
    return {
      paymentId: payment.id,
      bookingId: booking?.id,
      customerId: booking?.user.id,
      customerName: booking?.user.fullName,
      customerImage: booking?.user.image,
      customEmail: booking?.user.email,
      customerPhone: booking?.user.phoneNumber,
      barberId: booking?.barber.user.id,
      barberName: booking?.barber.user.fullName,
      barberImage: booking?.barber.user.image,
      barberEmail: booking?.barber.user.email,
      barberPhone: booking?.barber.user.phoneNumber,
      totalPrice: booking?.totalPrice,
      bookingDate: booking?.date,
      startTime: booking?.startTime,
      endTime: booking?.endTime,
      paymentStatus: payment.status,
      paymentAmount: payment.paymentAmount,
      paymentDate: payment.createdAt,
      status: booking?.status,
      // services: booking?.BookedServices.map(service => ({
      //   serviceId: service.service.id,
      //   serviceName: service.service.serviceName,
      //   price: service.service.price,
      //   availableTo: service.service.availableTo,
      // })) || [],
    };
  });

  return formatPaginationResponse(transactions, total, page, limit);
};

const getSaloonListFromDb = async (userId: string) => {
  const result = await prisma.saloonOwner.findMany();
  if (result.length === 0) {
    return { message: 'No saloon found' };
  }
  return result;
};

const getAllBarbersFromDb = async (
  userId: string,
  // saloonId: string,
  options: ISearchAndFilterOptions = {}
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Search by barber name, phone, or address
  const searchQuery = options.searchTerm
    ? {
        OR: [
          {
            barber: {
              user: {
                fullName: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
          {
            barber: {
              user: {
                phoneNumber: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
          {
            barber: {
              user: {
                address: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
        ],
      }
    : {};

  const whereClause = {
    userId: userId,
    ...(Object.keys(searchQuery).length > 0 && searchQuery),
  };

  const [result, total] = await Promise.all([
    prisma.hiredBarber.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        barberId: true,
        hourlyRate: true,
        barber: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                image: true,
                phoneNumber: true,
                address: true,
              },
            },
          },
        },
      },
    }),
    prisma.hiredBarber.count({
      where: whereClause,
    }),
  ]);

  const barbers = result.map(barber => ({
    barberId: barber.barberId,
    barberImage: barber.barber.user.image,
    barberName: barber.barber.user.fullName,
    barberPhone: barber.barber.user.phoneNumber,
    barberAddress: barber.barber.user.address,
    hourlyRate: barber.hourlyRate,
  }));

  return formatPaginationResponse(barbers, total, page, limit);
};

const terminateBarberIntoDb = async (
  userId: string,
  data: {
    barberId: string;
    reason?: string;
    date: DateTime;
  },
) => {
  const { barberId, reason, date } = data;
  if (!barberId || !date || !userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Missing required fields');
  }
  const terminationDate = DateTime.fromISO(date as unknown as string).toUTC();

  return await prisma.$transaction(async tx => {
    // Check if the barber exists
    const barber = await tx.barber.findUnique({
      where: {
        userId: barberId,
        saloonOwnerId: userId,
      },
    });

    if (!barber) {
      throw new AppError(httpStatus.NOT_FOUND, 'Barber not found');
    }

    // Check for future bookings for this barber
    const conflictingBooking = await tx.booking.findFirst({
      where: {
        barberId: data.barberId,
        startDateTime: {
          gte: terminationDate.toJSDate(),
        },
        status: {
          in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    if (conflictingBooking) {
      let startTimeString = 'unknown time';
      if (conflictingBooking.startTime) {
        const date = new Date(conflictingBooking.startTime);
        startTimeString = isNaN(date.getTime())
          ? conflictingBooking.date.toDateString()
          : date.toISOString();
      }
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Cannot terminate barber before ${startTimeString} due to existing bookings.`,
      );
    }

    // Create a termination record
    const terminationRecord = await tx.terminateBarber.create({
      data: {
        barberId: data.barberId,
        reason: data.reason,
        saloonId: userId,
        date: data.date.toJSDate(),
      },
    });

    // Delete the barber
    await tx.barber.delete({
      where: {
        id: data.barberId,
      },
    });

    const deleteFromHiredBarber = await tx.hiredBarber.delete({
      where: {
        barberId: terminationRecord.barberId,
      },
    });
    if (!deleteFromHiredBarber) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Barber not found or not deleted',
      );
    }

    return terminationRecord;
  });
};

const deleteSaloonItemFromDb = async (userId: string, saloonId: string) => {
  const deletedItem = await prisma.saloonOwner.delete({
    where: {
      id: saloonId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'saloonId, not deleted');
  }

  return deletedItem;
};

export const saloonService = {
  manageBookingsIntoDb,
  getBarberDashboardFromDb,
  getCustomerBookingsFromDb,
  getTransactionsFromDb,
  getSaloonListFromDb,
  getAllBarbersFromDb,
  terminateBarberIntoDb,
  deleteSaloonItemFromDb,
};

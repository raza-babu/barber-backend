import prisma from '../../utils/prisma';
import {
  BookingStatus,
  UserRoleEnum,
  UserStatus,
  PaymentStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { start } from 'repl';
import { DateTime } from 'luxon';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';

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
  options: ISearchAndFilterOptions = {},
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

  // Status filter, but always exclude PENDING and CONFIRMED
  const excludedStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
  const excludedStatusStrings = excludedStatuses.map(s => s.toString());
  const statusFilter =
    options.status && Array.isArray(options.status)
      ? {
          status: {
            in: (options.status as string[]).filter(
              s => !excludedStatusStrings.includes(s),
            ) as BookingStatus[],
          },
        }
      : options.status
        ? excludedStatusStrings.includes(options.status as string)
          ? { status: { notIn: excludedStatuses } }
          : { status: options.status as BookingStatus }
        : { status: { notIn: excludedStatuses } };

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
        [sortBy]: 'desc',
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

const getRemainingBarbersToScheduleFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {},
) => {
  // First, get all hired barbers for this saloon owner
  const hiredBarbers = await prisma.hiredBarber.findMany({
    where: {
      userId: userId,
    },
    select: {
      barberId: true,
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
  });

  if (hiredBarbers.length === 0) {
    return { message: 'No hired barbers found' };
  }

  const hiredBarberIds = hiredBarbers.map(hb => hb.barberId);

  // Next, find barbers who do not have any schedule entries
  const barbersWithSchedules = await prisma.barberSchedule.findMany({
    where: {
      barberId: { in: hiredBarberIds },
      saloonOwnerId: userId,
    },
    select: {
      barberId: true,
    },
    distinct: ['barberId'],
  });

  const scheduledBarberIds = barbersWithSchedules.map(bs => bs.barberId);

  // Barbers without schedules are those hired but not in the scheduled list
  const remainingBarbers = hiredBarbers
    .filter(hb => !scheduledBarberIds.includes(hb.barberId))
    .map(hb => ({
      barberId: hb.barberId,
      barberName: hb.barber.user.fullName,
      barberImage: hb.barber.user.image,
      barberPhone: hb.barber.user.phoneNumber,
      barberAddress: hb.barber.user.address,
    }));

  if (remainingBarbers.length === 0) {
    return { message: 'All hired barbers have schedules' };
  }

  return remainingBarbers;
};

const getFreeBarbersOnADateFromDb = async (
  userId: string,
  date: string,
  options: ISearchAndFilterOptions = {},
) => {
  if (!date) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Date is required');
  }
  const targetDate = DateTime.fromISO(date, { zone: 'local' });
  if (!targetDate.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
  }
  // const dayName = targetDate.toFormat('cccc'); // e.g., 'Monday'

  // Step 1: Get all hired barbers for this saloon owner
  const hiredBarbers = await prisma.hiredBarber.findMany({
    where: {
      userId: userId,
    },
    select: {
      barberId: true,
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
  });

  if (hiredBarbers.length === 0) {
    return { message: 'No hired barbers found' };
  }

  const hiredBarberIds = hiredBarbers.map(hb => hb.barberId);

  // Step 2: Find barbers who have a schedule on the specified day and are active
  const barbersWithDaySchedule = await prisma.barberSchedule.findMany({
    where: {
      barberId: { in: hiredBarberIds },
      saloonOwnerId: userId,
      // dayName: dayName,
      isActive: true,
    },
    select: {
      barberId: true,
      openingTime: true, // e.g., "09:00 AM"
      closingTime: true, // e.g., "05:00 PM"
    },
    distinct: ['barberId'],
  });

  const scheduledBarberIds = barbersWithDaySchedule.map(bs => bs.barberId);

  // Step 3: For each scheduled barber, get their bookings for that date
  const bookings = await prisma.booking.findMany({
    where: {
      barberId: { in: scheduledBarberIds },
      saloonOwnerId: userId,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      date: targetDate.toJSDate(),
    },
    select: {
      barberId: true,
      startTime: true,
      endTime: true,
    },
  });

  console.log('targetDate', targetDate);

  // Group bookings by barberId
  const bookingsByBarber: Record<
    string,
    { startTime: string; endTime: string }[]
  > = {};
  bookings.forEach(b => {
    if (!bookingsByBarber[b.barberId]) bookingsByBarber[b.barberId] = [];
    bookingsByBarber[b.barberId].push({
      startTime: b.startTime!,
      endTime: b.endTime!,
    });
  });

  // For each scheduled barber, calculate free slots
  const freeBarberSlots = barbersWithDaySchedule
    .map(schedule => {
      const hired = hiredBarbers.find(hb => hb.barberId === schedule.barberId);
      if (!schedule.openingTime || !schedule.closingTime) return null;

      const dateStr = targetDate.toFormat('yyyy-MM-dd');
      const opening = DateTime.fromFormat(
        `${dateStr} ${schedule.openingTime}`,
        'yyyy-MM-dd hh:mm a',
        { zone: targetDate.zone },
      );
      const closing = DateTime.fromFormat(
        `${dateStr} ${schedule.closingTime}`,
        'yyyy-MM-dd hh:mm a',
        { zone: targetDate.zone },
      );
      if (!opening.isValid || !closing.isValid) return null;

      // Get all bookings for this barber, sorted by startTime
      const barberBookings = (bookingsByBarber[schedule.barberId] || [])
        .map(b => ({
          start: DateTime.fromFormat(
            `${dateStr} ${b.startTime}`,
            'yyyy-MM-dd hh:mm a',
            { zone: targetDate.zone },
          ),
          end: DateTime.fromFormat(
            `${dateStr} ${b.endTime}`,
            'yyyy-MM-dd hh:mm a',
            { zone: targetDate.zone },
          ),
        }))
        .filter(b => b.start.isValid && b.end.isValid)
        .sort((a, b) => a.start.toMillis() - b.start.toMillis());

      // Find free slots between opening and closing, excluding bookings
      const freeSlots: { start: string; end: string }[] = [];
      let lastEnd = opening;

      for (const booking of barberBookings) {
        if (booking.start > lastEnd) {
          freeSlots.push({
            start: lastEnd.toFormat('hh:mm a'),
            end: booking.start.toFormat('hh:mm a'),
          });
        }
        if (booking.end > lastEnd && booking.end.isValid) {
          lastEnd = booking.end as DateTime;
        }
      }
      if (lastEnd < closing) {
        freeSlots.push({
          start: lastEnd.toFormat('hh:mm a'),
          end: closing.toFormat('hh:mm a'),
        });
      }

      return {
        barberId: hired?.barberId,
        barberName: hired?.barber.user.fullName,
        barberImage: hired?.barber.user.image,
        barberPhone: hired?.barber.user.phoneNumber,
        barberAddress: hired?.barber.user.address,
        freeSlots,
      };
    })
    .filter(Boolean);

  // Barbers who do not have a schedule on that day are not available
  if (freeBarberSlots.length === 0) {
    return { message: 'No free barbers available on the selected date' };
  }
  return freeBarberSlots;
};

const getTransactionsFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {},
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
  options: ISearchAndFilterOptions = {},
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

const getScheduledBarbersFromDb = async (
  userId: string,
  data: {
    utcDateTime: string; // ISO string
  },
) => {
  const { utcDateTime } = data;
  if (!utcDateTime || !userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Missing required fields');
  }
  const appointmentDateTime = DateTime.fromISO(utcDateTime).toUTC();
  if (!appointmentDateTime.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date or time format');
  }

  // Find bookings that overlap with the requested time
  const bookings = await prisma.booking.findMany({
    where: {
      saloonOwnerId: userId,
      startDateTime: {
        lte: appointmentDateTime.toJSDate(),
      },
      endDateTime: {
        gte: appointmentDateTime.toJSDate(),
      },
      status: {
        in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      },
    },
    include: {
      barber: {
        select: {
          userId: true,
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
      user: {
        select: {
          id: true,
          fullName: true,
          image: true,
          email: true,
          phoneNumber: true,
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
  });

  // Map bookings to include barber and booking details
  const scheduledBarbers = bookings.map(booking => ({
    barberId: booking.barber.userId,
    barberName: booking.barber.user.fullName,
    barberImage: booking.barber.user.image,
    barberPhone: booking.barber.user.phoneNumber,
    barberAddress: booking.barber.user.address,
    bookingId: booking.id,
    bookingDate: booking.date,
    bookingStartTime: booking.startTime,
    bookingEndTime: booking.endTime,
    bookingStatus: booking.status,
    customer: {
      customerId: booking.user.id,
      customerName: booking.user.fullName,
      customerImage: booking.user.image,
      customerEmail: booking.user.email,
      customerPhone: booking.user.phoneNumber,
    },
    services: booking.BookedServices.map(service => ({
      serviceId: service.service.id,
      serviceName: service.service.serviceName,
      price: service.service.price,
      availableTo: service.service.availableTo,
    })),
    totalPrice: booking.totalPrice,
  }));

  return scheduledBarbers;
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
  getRemainingBarbersToScheduleFromDb,
  getTransactionsFromDb,
  getSaloonListFromDb,
  getAllBarbersFromDb,
  terminateBarberIntoDb,
  getFreeBarbersOnADateFromDb,
  getScheduledBarbersFromDb,
  deleteSaloonItemFromDb,
};

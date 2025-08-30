import prisma from '../../utils/prisma';
import {
  BookingStatus,
  QueueStatus,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { DateTime } from 'luxon';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createBookingIntoDb = async (userId: string, data: any) => {
  const {
    barberId,
    saloonOwnerId,
    appointmentAt,
    date,
    services,
    notes,
    isInQueue,
  } = data;

  const saloonStatus = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId, isVerified: true },
  });
  if (!saloonStatus) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Saloon not found or not verified',
    );
  }

  // 1. Fetch saloonOwner to check queue status
  const saloonOwner = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId },
    select: { isQueueEnabled: true },
  });
  if (!saloonOwner) {
    throw new AppError(httpStatus.NOT_FOUND, 'Salon owner not found');
  }

  // 2. Convert date and time to UTC DateTime
  // Combine date and appointmentAt (e.g., "2025-08-20" + "11:00 AM")
  const localDateTime = DateTime.fromFormat(
    `${date} ${appointmentAt}`,
    'yyyy-MM-dd hh:mm a',
    { zone: 'local' },
  );
  if (!localDateTime.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date or time format');
  }
  const utcDateTime = localDateTime.toUTC().toJSDate();

  // check the date is grater then 3 weeks from now
  const threeWeeksFromNow = DateTime.now().plus({ weeks: 3 });
  if (localDateTime > threeWeeksFromNow) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Booking cannot be made more than 3 weeks in advance',
    );
  }

  // 3. Calculate total price using service model
  const serviceRecords = await prisma.service.findMany({
    where: { id: { in: services } },
    select: { id: true, price: true, duration: true },
  });
  if (serviceRecords.length !== services.length) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Some services not found');
  }
  const totalDuration = serviceRecords.reduce(
    (sum, s) => sum + (s.duration || 0), // assuming each service has a 'duration' in minutes
    0,
  );
  if (totalDuration <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Total service duration must be greater than zero',
    );
  }
  const totalPrice = serviceRecords.reduce(
    (sum, s) => sum + Number(s.price),
    0,
  );

  // 4. Transaction for all DB operations
  const result = await prisma.$transaction(async tx => {
    // 4a. Check if barber exists and is available
    const barber = await tx.barber.findUnique({
      where: { userId: barberId },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            fullName: true,
            image: true,
          },
        },
      },
    });
    if (!barber) {
      throw new AppError(httpStatus.NOT_FOUND, 'Barber not found');
    }
    // 4b. Check if barber is on holiday or not
    const barberHoliday = await tx.barberDayOff.findFirst({
      where: {
        barberId: barber.id,
        date: localDateTime.toJSDate(),
        saloonOwnerId: saloonOwnerId,
      },
    });
    if (barberHoliday) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Barber is on holiday');
    }

    // Check if the booking time overlaps with the barber's lunch/break time (time only, ignore date)
    const barberBreak = await tx.lunch.findFirst({
      where: {
        saloonOwnerId: saloonOwnerId,
      },
    });

    if (barberBreak) {
      // Extract only the time part from the booking start and end
      const bookingStartTime = DateTime.fromFormat(appointmentAt, 'hh:mm a', {
        zone: 'local',
      });
      const bookingEndTime = bookingStartTime.plus({ minutes: totalDuration });

      // Parse lunch break start and end times (time only, ignore date)
      if (!barberBreak.startTime || !barberBreak.endTime) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Barber break start or end time is missing',
        );
      }
      const breakStartTime = DateTime.fromFormat(
        barberBreak.startTime,
        'hh:mm a',
        { zone: 'local' },
      );
      const breakEndTime = DateTime.fromFormat(barberBreak.endTime, 'hh:mm a', {
        zone: 'local',
      });

      // Check for overlap (time only)
      if (
        (bookingStartTime >= breakStartTime &&
          bookingStartTime < breakEndTime) ||
        (bookingEndTime > breakStartTime && bookingEndTime <= breakEndTime) ||
        (bookingStartTime <= breakStartTime && bookingEndTime >= breakEndTime)
      ) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Barber is unavailable during break/lunch time',
        );
      }
    }
    // 4a. If queue is enabled, create queue and queueSlot
    let queue = null;
    let queueSlot = null;
    if (saloonOwner.isQueueEnabled && isInQueue) {
      // Find the current max position in the queue for this barber and date
      // Delete any existing queue for this barber for previous days (before today)
      // console.log('Queue found:');
      await tx.queue.deleteMany({
        where: {
          barberId,
          saloonOwnerId,
          isActive: false,
          date: { lt: new Date() },
        },
      });

      // Try to find an existing queue for this barber and date (only one per day allowed)
      queue = await tx.queue.findFirst({
        where: {
          barberId,
          saloonOwnerId,
          date: new Date(date),
        },
      });

      if (!queue) {
        // If not found, create a new queue for the given date (today or any future date)
        queue = await tx.queue.create({
          data: {
            barberId,
            saloonOwnerId,
            date: new Date(date),
            currentPosition: 1,
          },
        });
        if (!queue) {
          throw new AppError(httpStatus.BAD_REQUEST, 'Error creating queue');
        }
      } else {
        // If found, increment currentPosition
        queue = await tx.queue.update({
          where: { id: queue.id },
          data: {
            currentPosition: queue.currentPosition + 1,
          },
        });
        if (!queue) {
          throw new AppError(httpStatus.BAD_REQUEST, 'Error updating queue');
        }
      }

      // Find all existing queueSlots for this queue, ordered by startedAt
      const existingSlots = await tx.queueSlot.findMany({
        where: { queueId: queue.id },
        orderBy: { startedAt: 'asc' },
      });

      // Find the correct position for the new slot based on startedAt (utcDateTime)
      let insertPosition = 1;
      for (let i = 0; i < existingSlots.length; i++) {
        const slot = existingSlots[i];
        if (
          slot &&
          slot.startedAt !== null &&
          slot.startedAt !== undefined &&
          utcDateTime > slot.startedAt
        ) {
          insertPosition = i + 2; // +2 because positions are 1-based and we want to insert after this slot
        } else {
          break;
        }
      }

      // Shift positions of slots that come after the new slot
      for (let i = existingSlots.length - 1; i >= insertPosition - 1; i--) {
        await tx.queueSlot.update({
          where: { id: existingSlots[i].id },
          data: { position: existingSlots[i].position + 1 },
        });
        if (!queueSlot) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Error updating queue slot position',
          );
        }
      }

      // Create the new queueSlot at the correct position
      queueSlot = await tx.queueSlot.create({
        data: {
          queueId: queue.id,
          customerId: userId,
          barberId: barberId,
          position: insertPosition,
          startedAt: utcDateTime,
        },
      });
      if (!queueSlot) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Error creating queue slot');
      }
    }

    // 4b. Create booking
    const booking = await tx.booking.create({
      data: {
        userId,
        barberId,
        saloonOwnerId,
        appointmentAt: utcDateTime,
        date: new Date(date),
        notes,
        isInQueue: !!(saloonOwner.isQueueEnabled && isInQueue),
        totalPrice,
        startDateTime: utcDateTime,
        endDateTime: DateTime.fromJSDate(utcDateTime)
          .plus({ minutes: totalDuration })
          .toJSDate(),
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(utcDateTime)
          .plus({ minutes: totalDuration })
          .toFormat('hh:mm a'),
      },
    });

    // 4c. Create bookedService records
    await Promise.all(
      serviceRecords.map(service =>
        tx.bookedServices.create({
          data: {
            bookingId: booking.id,
            customerId: userId,
            serviceId: service.id,
            price: service.price,
          },
        }),
      ),
    );

    if (queueSlot && queueSlot.id) {
      queueSlot = await tx.queueSlot.update({
        where: { id: queueSlot.id },
        data: {
          bookingId: booking.id,
          completedAt: DateTime.fromJSDate(utcDateTime)
            .plus({ minutes: totalDuration })
            .toJSDate(),
        },
      });
      if (!queueSlot) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Error updating queue slot');
      }
    }

    // 4d. Add barberRealTimeStatus
    // Calculate endDateTime by adding totalServiceTime (in minutes) to utcDateTime
    const totalServiceTime = serviceRecords.reduce(
      (sum, s) => sum + (s.duration || 0),
      0,
    ); // assuming each service has a 'duration' in minutes
    const endDateTime = DateTime.fromJSDate(utcDateTime)
      .plus({ minutes: totalServiceTime })
      .toJSDate();
    // Check if the barber is scheduled to work during the requested time range
    // Get the day name (e.g., 'monday') from the appointment date
    const dayName = DateTime.fromJSDate(utcDateTime)
      .toFormat('cccc')
      .toLowerCase();

    const barberSchedule = await tx.barberSchedule.findFirst({
      where: {
        barberId: barberId,
        dayName: dayName,
        isActive: true,
      },
    });

    if (!barberSchedule) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Barber schedule not found for this day',
      );
    }
    // Parse openingTime and closingTime (e.g., "09:00 AM") into DateTime objects on the same date as the booking
    const openingDateTime = DateTime.fromFormat(
      `${date} ${barberSchedule.openingTime}`,
      'yyyy-MM-dd hh:mm a',
      { zone: 'local' },
    ).toUTC();
    const closingDateTime = DateTime.fromFormat(
      `${date} ${barberSchedule.closingTime}`,
      'yyyy-MM-dd hh:mm a',
      { zone: 'local' },
    ).toUTC();

    if (
      localDateTime < openingDateTime ||
      DateTime.fromJSDate(endDateTime) > closingDateTime
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Barber is not available during the requested time range',
      );
    }

    // Check if there is already a barberRealTimeStatus for this barber that overlaps with the requested time slot
    const overlappingStatus = await tx.barberRealTimeStatus.findFirst({
      where: {
        barberId,
        OR: [
          {
            startDateTime: {
              lt: endDateTime,
            },
            endDateTime: {
              gt: utcDateTime,
            },
          },
        ],
      },
    });

    if (overlappingStatus) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Barber already has a booking or is unavailable during the requested time slot',
      );
    }

    await tx.barberRealTimeStatus.create({
      data: {
        barberId,
        startDateTime: utcDateTime,
        endDateTime: endDateTime,
        isAvailable: false,
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
      },
    });

    return {
      booking,
      queue,
      queueSlot,
      totalPrice,
    };
  });

  return result;
};

const getBookingListFromDb = async (userId: string) => {
  const result = await prisma.booking.findMany({
    where: {
      userId: userId,
    },
    select: {
      id: true,
      userId: true,
      barberId: true,
      saloonOwnerId: true,
      date: true,
      notes: true,
      isInQueue: true,
      totalPrice: true,
      startTime: true,
      endTime: true,
      status: true,
      queueSlot: {
        select: {
          id: true,
          queueId: true,
          customerId: true,
          barberId: true,
          position: true,
          startedAt: true,
          bookingId: true,
          barberStatus: {
            select: {
              id: true,
              barberId: true,
              isAvailable: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      },
      BookedServices: {
        select: {
          id: true,
          serviceId: true,
          customerId: true,
          price: true,
          service: {
            select: {
              id: true,
              serviceName: true,
              price: true,
              duration: true,
            },
          },
        },
      },
      barber: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              image: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
  });
  if (result.length === 0) {
    return [];
  }
  // Flatten the result to include barber and booked services details at the top level
  return result.map(booking => ({
    bookingId: booking.id,
    customerId: booking.userId,
    barberId: booking.barberId,
    saloonOwnerId: booking.saloonOwnerId,
    totalPrice: booking.totalPrice,
    notes: booking.notes,
    customerName: booking.user?.fullName || null,
    customerEmail: booking.user?.email || null,
    customerContact: booking.user?.phoneNumber || null,
    date: booking.date,
    time: booking.startTime,
    position: booking.queueSlot[0]?.position || null,
    serviceNames:
      booking.BookedServices?.map(bs => bs.service?.serviceName) || [],
    barberName: booking.barber?.user?.fullName || null,
    status: booking.status || null,
  }));
};

const getBookingByIdFromDb = async (userId: string, bookingId: string) => {
  const result = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      userId: userId,
    },
    select: {
      id: true,
      userId: true,
      barberId: true,
      saloonOwnerId: true,
      date: true,
      notes: true,
      isInQueue: true,
      totalPrice: true,
      startTime: true,
      endTime: true,
      status: true,
      queueSlot: {
        select: {
          id: true,
          queueId: true,
          customerId: true,
          barberId: true,
          position: true,
          startedAt: true,
          bookingId: true,
          barberStatus: {
            select: {
              id: true,
              barberId: true,
              isAvailable: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      },
      BookedServices: {
        select: {
          id: true,
          serviceId: true,
          customerId: true,
          price: true,
          service: {
            select: {
              id: true,
              serviceName: true,
              price: true,
              duration: true,
            },
          },
        },
      },
      barber: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              image: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
  });
  if (!result) {
    return {
      message: 'Booking not found or you do not have permission to view it',
    };
  }
  return {
    bookingId: result.id,
    customerId: result.userId,
    barberId: result.barberId,
    saloonOwnerId: result.saloonOwnerId,
    totalPrice: result.totalPrice,
    notes: result.notes,
    customerName: result.user?.fullName || null,
    customerEmail: result.user?.email || null,
    customerContact: result.user?.phoneNumber || null,
    date: result.date,
    time: result.startTime,
    position: result.queueSlot[0]?.position || null,
    serviceNames:
      result.BookedServices?.map(bs => bs.service?.serviceName) || [],
    barberName: result.barber?.user?.fullName || null,
    status: result.status || null,
  };
};

const getAvailableBarbersFromDb = async (
  userId: string,
  data: {
    salonId: string;
    utcDateTime: string; // ISO string
    totalServiceTime: number;
  },
) => {
  const date = new Date(data.utcDateTime);
  const luxonDate = DateTime.fromJSDate(date);
  // 1. Check if the salon is on holiday (global filter)
  const salon = await prisma.saloonOwner.findUnique({
    where: { userId: data.salonId },
    select: {
      userId: true,
    },
  });
  if (!salon || !salon.userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Salon not found for user');
  }
  // const salonId = booking.salonId;
  const salonHoliday = await prisma.saloonHoliday.findFirst({
    where: {
      userId: salon.userId,
      date: date,
    },
  });
  if (salonHoliday) {
    return { message: 'Salon is closed on this date' };
  }

  // 2. Get all barbers for the salon
  const barbers = await prisma.barber.findMany({
    where: {
      saloonOwnerId: data.salonId,
    },
  });

  // 3. Parallelize per-barber checks
  const availableBarbers = await Promise.all(
    barbers.map(async barber => {
      // 3a. Check day-off
      const dayOff = await prisma.barberDayOff.findFirst({
        where: {
          saloonOwnerId: data.salonId,
          barberId: barber.userId,
          date: date,
        },
      });
      if (dayOff) return null;

      // 3b. Check real-time availability (from cache/fast source)
      // Assume a function checkBarberRealtimeAvailability(barberId, time) returns boolean
      const isAvailableRealtime = await prisma.barberRealTimeStatus.findMany({
        where: {
          barberId: barber.userId,
          AND: [
            {
              startDateTime: {
                lte: date,
              },
            },
            {
              endDateTime: {
                gte: date,
              },
            },
          ],
        },
      });
      if (!isAvailableRealtime)
        return { message: 'Barber is not available at this time' };

      // 3c. Fetch schedule + bookings if still potentially available
      const schedule = await prisma.barberSchedule.findFirst({
        where: {
          barberId: barber.userId,
          dayName: luxonDate.toFormat('cccc').toLowerCase(),
        },
      });
      if (!schedule) return { message: 'Barber schedule not found' };

      const overlappingBooking = await prisma.booking.findFirst({
        where: {
          barberId: barber.userId,
          AND: [
            {
              startDateTime: {
                lte: date,
              },
            },
            {
              endDateTime: {
                gte: date,
              },
            },
          ],
        },
      });
      if (overlappingBooking)
        return { message: 'No barber is not available for this time' };

      return barber;
    }),
  );

  return availableBarbers.filter(Boolean);
};

const getBookingListForSalonOwnerFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {},
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for customer or barber name/email/phone
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

  // ✅ Only CONFIRMED and PENDING bookings
  const allowedStatuses = [BookingStatus.CONFIRMED, BookingStatus.PENDING];

  const whereClause = {
    saloonOwnerId: userId,
    status: { in: allowedStatuses },
    ...(Object.keys(searchQuery).length > 0 && searchQuery),
  };

  const [result, total] = await Promise.all([
    prisma.booking.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        userId: true,
        barberId: true,
        saloonOwnerId: true,
        date: true,
        notes: true,
        isInQueue: true,
        totalPrice: true,
        startTime: true,
        endTime: true,
        status: true,
        queueSlot: {
          select: {
            id: true,
            position: true,
          },
        },
        BookedServices: {
          select: {
            id: true,
            service: {
              select: {
                serviceName: true,
              },
            },
          },
        },
        barber: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                image: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            image: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    }),
    prisma.booking.count({ where: whereClause }),
  ]);

  // Flatten results
  const mapped = result.map(booking => ({
    bookingId: booking.id,
    customerId: booking.userId,
    barberId: booking.barberId,
    saloonOwnerId: booking.saloonOwnerId,
    totalPrice: booking.totalPrice,
    notes: booking.notes,
    customerImage: booking.user?.image || null,
    customerName: booking.user?.fullName || null,
    customerEmail: booking.user?.email || null,
    customerContact: booking.user?.phoneNumber || null,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    serviceNames: booking.BookedServices?.map(bs => bs.service?.serviceName) || [],
    barberName: booking.barber?.user?.fullName || null,
    barberImage: booking.barber?.user?.image || null,
    status: booking.status || null,
    position: booking.queueSlot[0]?.position || null,
  }));

  // ✅ Return directly in the required shape
  return {
    data: mapped,
    meta: {
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
    },
  };
};

const getBookingByIdFromDbForSalon = async (
  userId: string,
  bookingId: string,
) => {
  const result = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      saloonOwnerId: userId,
    },
    select: {
      id: true,
      userId: true,
      barberId: true,
      saloonOwnerId: true,
      date: true,
      notes: true,
      isInQueue: true,
      totalPrice: true,
      startTime: true,
      endTime: true,
      status: true,
      queueSlot: {
        select: {
          id: true,
          queueId: true,
          customerId: true,
          barberId: true,
          position: true,
          startedAt: true,
          bookingId: true,
          barberStatus: {
            select: {
              id: true,
              barberId: true,
              isAvailable: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      },
      BookedServices: {
        select: {
          id: true,
          serviceId: true,
          customerId: true,
          price: true,
          service: {
            select: {
              id: true,
              serviceName: true,
              price: true,
              duration: true,
            },
          },
        },
      },
      barber: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              image: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
  });
  if (!result) {
    return {
      message: 'Booking not found or you do not have permission to view it',
    };
  }
  return {
    bookingId: result.id,
    customerId: result.userId,
    barberId: result.barberId,
    saloonOwnerId: result.saloonOwnerId,
    totalPrice: result.totalPrice,
    notes: result.notes,
    customerName: result.user?.fullName || null,
    customerEmail: result.user?.email || null,
    customerContact: result.user?.phoneNumber || null,
    date: result.date,
    time: result.startTime,
    serviceNames:
      result.BookedServices?.map(bs => bs.service?.serviceName) || [],
    barberName: result.barber?.user?.fullName || null,
    status: result.status || null,
  };
};

const updateBookingIntoDb = async (userId: string, data: any) => {
  // Only allow customer to update the schedule (date and appointmentAt/time)
  const { bookingId, date, appointmentAt } = data;

  if (!date || !appointmentAt) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only date and appointmentAt can be updated',
    );
  }

  // Fetch the existing booking to verify ownership and get related info
  const existingBooking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      userId: userId,
    },
    include: {
      BookedServices: {
        select: { serviceId: true, service: { select: { duration: true } } },
      },
      queueSlot: true,
      barber: true,
    },
  });

  if (!existingBooking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  // Calculate totalDuration from booked services
  const totalDuration = existingBooking.BookedServices.reduce(
    (sum, bs) => sum + (bs.service?.duration || 0),
    0,
  );

  // Combine date and appointmentAt to get new startDateTime
  const localDateTime = DateTime.fromFormat(
    `${date} ${appointmentAt}`,
    'yyyy-MM-dd hh:mm a',
    { zone: 'local' },
  );
  if (!localDateTime.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date or time format');
  }
  const utcDateTime = localDateTime.toUTC().toJSDate();

  // Calculate new endDateTime
  const endDateTime = DateTime.fromJSDate(utcDateTime)
    .plus({ minutes: totalDuration })
    .toJSDate();

  // Check for overlapping bookings for this barber
  const overlappingBooking = await prisma.booking.findFirst({
    where: {
      barberId: existingBooking.barberId,
      id: { not: bookingId },
      AND: [
        { startDateTime: { lt: endDateTime } },
        { endDateTime: { gt: utcDateTime } },
      ],
    },
  });
  if (overlappingBooking) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Barber already has a booking or is unavailable during the requested time slot',
    );
  }

  // Transaction to update booking, queueSlot, and barberRealTimeStatus
  const result = await prisma.$transaction(async tx => {
    // 1. Update booking
    const updatedBooking = await tx.booking.update({
      where: {
        id: bookingId,
        userId: userId,
      },
      data: {
        date: new Date(date),
        appointmentAt: utcDateTime,
        startDateTime: utcDateTime,
        endDateTime: endDateTime,
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
      },
    });

    // 2. Update queueSlot if exists
    if (existingBooking.queueSlot) {
      // Update the current slot's startedAt before reordering
      await tx.queueSlot.update({
        where: { id: existingBooking.queueSlot[0].id },
        data: {
          startedAt: utcDateTime,
          completedAt: endDateTime,
        },
      });

      // Fetch all slots again, ordered by startedAt
      const queueSlots = await tx.queueSlot.findMany({
        where: {
          queueId: existingBooking.queueSlot[0]?.queueId,
        },
        orderBy: { startedAt: 'asc' },
      });

      // Re-assign positions sequentially based on startedAt
      for (let i = 0; i < queueSlots.length; i++) {
        await tx.queueSlot.update({
          where: { id: queueSlots[i].id },
          data: { position: i + 1 },
        });
      }
    }

    // 3. Update barberRealTimeStatus for this booking if exists
    await tx.barberRealTimeStatus.deleteMany({
      where: {
        barberId: existingBooking.barberId,
        startDateTime: existingBooking.startDateTime || utcDateTime,
        endDateTime: existingBooking.endDateTime || endDateTime,
      },
    });

    await tx.barberRealTimeStatus.create({
      data: {
        barberId: existingBooking.barberId,
        startDateTime: utcDateTime,
        endDateTime: endDateTime,
        isAvailable: false,
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
      },
    });

    return updatedBooking;
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'bookingId, not updated');
  }

  return result;
};

const updateBookingStatusIntoDb = async (userId: string, data: any) => {
  const { bookingId, status } = data;
  // Only allow salon owner to update the status
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      saloonOwnerId: userId,
    },
  });
  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }
  if (!['CONFIRMED', 'CANCELED', 'COMPLETED', 'RESCHEDULED'].includes(status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid status. Allowed values are CONFIRMED, CANCELED, COMPLETED',
    );
  }

  const result = await prisma.$transaction(async tx => {
    const updatedBooking = await tx.booking.update({
      where: {
        id: bookingId,
        saloonOwnerId: userId,
      },
      data: {
        status:
          status === 'COMPLETED'
            ? BookingStatus.COMPLETED
            : BookingStatus.PENDING,
      },
    });
    if (!updatedBooking) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Booking status not updated');
    }
    // If status is COMPLETED, update barber's real-time status to available
    if (status === 'COMPLETED') {
      await tx.barberRealTimeStatus.deleteMany({
        where: {
          barberId: booking.barberId,
          startDateTime: booking.startDateTime!,
          endDateTime: booking.endDateTime!,
        },
      });
      // update queueSlot status to completed
      await tx.queueSlot.updateMany({
        where: {
          bookingId: bookingId,
        },
        data: {
          status: QueueStatus.COMPLETED,
        },
      });
      await tx.queue.updateMany({
        where: {
          barberId: booking.barberId,
          saloonOwnerId: booking.saloonOwnerId,
          date: booking.date,
        },
        data: {
          currentPosition: {
            decrement: 1,
          },
        },
      });
    }
    // If status is CANCELED, delete the queueSlot and barberRealTimeStatus
    if (status === 'CANCELED') {
      await tx.booking.update({
        where: {
          id: bookingId,
          saloonOwnerId: userId,
        },
        data: {
          status:
            status === 'CANCELED'
              ? BookingStatus.CANCELLED
              : BookingStatus.PENDING,
        },
      });
      // Delete the queueSlot and barberRealTimeStatus
      await tx.queueSlot.deleteMany({
        where: {
          bookingId: bookingId,
        },
      });
      await tx.queue.updateMany({
        where: {
          barberId: booking.barberId,
          saloonOwnerId: booking.saloonOwnerId,
          date: booking.date,
        },
        data: {
          currentPosition: {
            decrement: 1,
          },
        },
      });
      await tx.barberRealTimeStatus.deleteMany({
        where: {
          barberId: booking.barberId,
          startDateTime: booking.startDateTime!,
          endDateTime: booking.endDateTime!,
        },
      });
    }
    return updatedBooking;
  });

  return result;
};

const deleteBookingItemFromDb = async (userId: string, bookingId: string) => {
  const deletedItem = await prisma.booking.delete({
    where: {
      id: bookingId,
      saloonOwnerId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'bookingId, not deleted');
  }

  return deletedItem;
};

export const bookingService = {
  createBookingIntoDb,
  getBookingListFromDb,
  getBookingListForSalonOwnerFromDb,
  getBookingByIdFromDbForSalon,
  getAvailableBarbersFromDb,
  getBookingByIdFromDb,
  updateBookingIntoDb,
  updateBookingStatusIntoDb,
  deleteBookingItemFromDb,
};

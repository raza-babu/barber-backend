import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { DateTime } from 'luxon';

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
    { zone: 'local' }
  );
  if (!localDateTime.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date or time format');
  }
  const utcDateTime = localDateTime.toUTC().toJSDate();

  // 3. Calculate total price using service model
  const serviceRecords = await prisma.service.findMany({
    where: { id: { in: services } },
    select: { id: true, price: true, duration: true },
  });
  if (serviceRecords.length !== services.length) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Some services not found');
  }
  const totalPrice = serviceRecords.reduce((sum, s) => sum + Number(s.price), 0);

  // 4. Transaction for all DB operations
  const result = await prisma.$transaction(async (tx) => {
    // 4a. If queue is enabled, create queue and queueSlot
    let queue = null;
    let queueSlot = null;
    if (saloonOwner.isQueueEnabled && isInQueue) {
      // Find the current max position in the queue for this barber and date
      const maxPosition = await tx.queue.aggregate({
        where: {
          barberId,
          saloonOwnerId,
          date: new Date(date),
        },
        _max: {
          currentPosition: true,
        },
      });

      queue = await tx.queue.create({
        data: {
          barberId,
          saloonOwnerId,
          date: new Date(date),
          currentPosition: (maxPosition._max.currentPosition || 0) + 1,
        },
      });
      queueSlot = await tx.queueSlot.create({
        data: {
          queueId: queue.id,
          customerId: userId,
          barberId: barberId,
          position: queue.currentPosition,
        },
      });
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
      },
    });

    // 4c. Create bookedService records
    await Promise.all(
      serviceRecords.map((service) =>
        tx.bookedServices.create({
          data: {
            bookingId: booking.id,
            customerId: userId,
            serviceId: service.id,
            price: service.price,
          },
        })
      )
    );

    // 4d. Add barberRealTimeStatus
    // Calculate endDateTime by adding totalServiceTime (in minutes) to utcDateTime
    const totalServiceTime = serviceRecords.reduce((sum, s) => sum + (s.duration || 0), 0); // assuming each service has a 'duration' in minutes
    const endDateTime = DateTime.fromJSDate(utcDateTime).plus({ minutes: totalServiceTime }).toJSDate();

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

const getBookingListFromDb = async () => {
  const result = await prisma.booking.findMany();
  if (result.length === 0) {
    return { message: 'No booking found' };
  }
  return result;
};

const getBookingByIdFromDb = async (bookingId: string) => {
  const result = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'booking not found');
  }
  return result;
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
        return { message: 'Barber has an overlapping booking' };

      return barber;
    }),
  );

  return availableBarbers.filter(Boolean);
};

const updateBookingIntoDb = async (
  userId: string,
  bookingId: string,
  data: any,
) => {
  const result = await prisma.booking.update({
    where: {
      id: bookingId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'bookingId, not updated');
  }
  return result;
};

const deleteBookingItemFromDb = async (userId: string, bookingId: string) => {
  const deletedItem = await prisma.booking.delete({
    where: {
      id: bookingId,
      userId: userId,
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
  getAvailableBarbersFromDb,
  getBookingByIdFromDb,
  updateBookingIntoDb,
  deleteBookingItemFromDb,
};

import prisma from '../../utils/prisma';
import { BookingStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { start } from 'repl';
import { DateTime } from 'luxon';

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
      (currentStatus === BookingStatus.CONFIRMED && targetStatus === BookingStatus.CANCELLED) ||
      (currentStatus === BookingStatus.PENDING && targetStatus === BookingStatus.CANCELLED)
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
  const customerGrowth = await prisma.booking.groupBy({
    by: ['createdAt'],
    _count: {
      id: true,
    },
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
      createdAt: {
        gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Group customer growth by month
  const monthlyGrowth: { [key: string]: number } = {};
  customerGrowth.forEach(item => {
    const month = `${item.createdAt.getFullYear()}-${String(item.createdAt.getMonth() + 1).padStart(2, '0')}`;
    monthlyGrowth[month] = (monthlyGrowth[month] || 0) + item._count.id;
  });

  return {
    totalCustomers: customerCount,
    totalEarnings: totalEarnings._sum.totalPrice || 0,
    totalBarbers: barberCount,
    totalBookings: bookingCount,
    customerGrowth: Object.entries(monthlyGrowth).map(([month, count]) => ({
      month,
      count,
    })),
  };
};

const getCustomerBookingsFromDb = async (userId: string) => {
  const result = await prisma.booking.findMany({
    where: {
      saloonOwnerId: userId,
      // status: BookingStatus.COMPLETED,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          image: true,
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

      BookedServices: {
        select: {
          service: {
            select: {
              id: true,
              serviceName: true,
              price: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result.map(booking => ({
    bookingId: booking.id,
    customerId: booking.user.id,
    customerName: booking.user.fullName,
    customerImage: booking.user.image,
    barberId: booking.barber.user.id,
    barberName: booking.barber.user.fullName,
    barberImage: booking.barber.user.image,
    totalPrice: booking.totalPrice,
    bookingDate: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    services: booking.BookedServices.map(service => ({
      serviceId: service.service.id,
      serviceName: service.service.serviceName,
      price: service.service.price,
    })),
  }));
};

const getSaloonListFromDb = async (userId: string) => {
  const result = await prisma.saloonOwner.findMany();
  if (result.length === 0) {
    return { message: 'No saloon found' };
  }
  return result;
};

const getAllBarbersFromDb = async (userId: string, saloonId: string) => {
  const result = await prisma.hiredBarber.findMany({
    where: {
      userId: userId,
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
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'saloon not found');
  }
  return result.map(barber => ({
    barberId: barber.barberId,
    barberImage: barber.barber.user.image,
    barberName: barber.barber.user.fullName,
    barberPhone: barber.barber.user.phoneNumber,
    barberAddress: barber.barber.user.address,
    hourlyRate: barber.hourlyRate,
  }));
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
  getSaloonListFromDb,
  getAllBarbersFromDb,
  terminateBarberIntoDb,
  deleteSaloonItemFromDb,
};

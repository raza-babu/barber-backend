import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { BookingStatus } from '@prisma/client';

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

const getMyBookingsFromDb = async (userId: string) => {
  const result = await prisma.booking.findMany({
    where: {
      barberId: userId,
      OR: [
        { status: BookingStatus.CONFIRMED },
        { status: BookingStatus.COMPLETED },
      ] 
    },
    select: {
      id: true,
      userId: true,
      saloonOwnerId: true,
      barberId: true,
      date: true,
      startDateTime: true,
      endDateTime: true,
      status: true,
      totalPrice: true,
      createdAt: true,
      user: {
        select: {
          fullName: true,
          email: true,
          phoneNumber: true,
          image: true,
        },
      },
      BookedServices: {
        select: {
          service: {
            select: {
              id: true,
              serviceName: true,
              availableTo: true,
              price: true,
              duration: true,
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
    return { message: 'No bookings found' };
  }
  return result.map(booking => ({
    bookingId: booking.id,
    userId: booking.userId,
    saloonOwnerId: booking.saloonOwnerId,
    barberId: booking.barberId,
    date: booking.date,
    startDateTime: booking.startDateTime,
    endDateTime: booking.endDateTime,
    status: booking.status,
    totalPrice: booking.totalPrice,
    createdAt: booking.createdAt,
    userFullName: booking.user.fullName,
    userEmail: booking.user.email,
    userPhoneNumber: booking.user.phoneNumber,
    userImage: booking.user.image,
    bookedServices: booking.BookedServices.map(bs => ({
      id: bs.service.id,
      serviceName: bs.service.serviceName,
      availableTo: bs.service.availableTo,
      price: bs.service.price,
      duration: bs.service.duration,
    })),
  }));
};

const getBarberListFromDb = async (userId: string) => {
  const result = await prisma.barber.findMany();
  if (result.length === 0) {
    return { message: 'No barber found' };
  }
  return result;
};

const getBarberByIdFromDb = async (userId: string, barberId: string) => {
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
        },
      },
    },
  });

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
  return {
    ...result,
    isFollowing: isFollowing ? true : false,
  };
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

export const barberService = {
  createBarberIntoDb,
  getMyScheduleFromDb,
  getBarberListFromDb,
  getMyBookingsFromDb,
  getBarberByIdFromDb,
  updateBarberIntoDb,
  deleteBarberItemFromDb,
};

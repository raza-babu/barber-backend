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
  let bookings = await prisma.booking.findMany({
    where: {
      barberId: userId,
      OR: [
        { status: BookingStatus.CONFIRMED },
        { status: BookingStatus.COMPLETED },
        { status: BookingStatus.PENDING },
      ] 
    },
    include: {
          BookedServices: {
            select: {
              id: true,
              service: {
                select: { id: true, serviceName: true, duration: true, availableTo: true, price: true },
              },
            },
          },
        },
        orderBy: { startDateTime: 'asc' },
      
    
  });

  if (bookings.length === 0) {
    return { message: 'No bookings found' };
  }

  const bookingUserIds = Array.from(
        new Set(bookings.map(b => b.userId).filter(Boolean)),
      );

      const registeredUsersMap: Record<string, any> = {};
      if (bookingUserIds.length > 0) {
        const registeredUsers = await prisma.user.findMany({
          where: { id: { in: bookingUserIds } },
          // include email and phoneNumber so we don't lose those fields when replacing the user object
          select: { id: true, fullName: true, image: true, email: true, phoneNumber: true },
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
        user: (b as any).user ?? { id: null, fullName: null, email: null, phoneNumber: null, image: null },
      }));

  return bookings.map(booking => ({
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
          followerCount: true,
          followingCount: true,
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
  const existingBooking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      barberId: userId,
      status: { in : [BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.STARTED, BookingStatus.ENDED] },
    },
  });

  if (!existingBooking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  const now = new Date();
  const startTime = new Date(existingBooking.startDateTime!);
  const endTime = new Date(existingBooking.endDateTime!);
  const twentyMinsBeforeStart = new Date(startTime.getTime() - 20 * 60000);
  const twentyMinsBeforeEnd = new Date(endTime.getTime() - 20 * 60000);

  // Check if trying to start booking - can only start 20 mins before or after start time
  if (data.status === BookingStatus.STARTED && now < twentyMinsBeforeStart) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cannot start booking before 20 minutes of scheduled time');
  }

  // Check if trying to end booking - can only end 20 mins before end time or after
  if (data.status === BookingStatus.ENDED && now < twentyMinsBeforeEnd) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cannot end booking before 20 minutes of scheduled end time');
  }

  const result = await prisma.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      status: data.status,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Booking status not updated');
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

export const barberService = {
  createBarberIntoDb,
  getMyScheduleFromDb,
  getBarberListFromDb,
  getMyBookingsFromDb,
  getBarberByIdFromDb,
  updateBookingStatusIntoDb,
  updateBarberIntoDb,
  deleteBarberItemFromDb,
};

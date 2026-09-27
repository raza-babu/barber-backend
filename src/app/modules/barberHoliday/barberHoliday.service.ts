import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { getSalonTimezone, getDayBoundsInZone } from '../../utils/timezone.helper';

const createBarberHolidayIntoDb = async (userId: string, data: any) => {
  const salon = await prisma.saloonOwner.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(salon);
  const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(data.date, salonZone);
  data.date = startOfDayUTC;

  const existing = await prisma.barberDayOff.findFirst({
    where: {
      saloonOwnerId: userId,
      barberId: data.barberId,
      date: { gte: startOfDayUTC, lte: endOfDayUTC },
    },
  });
  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Barber day off already exists for this date',
    );
  }

  const result = await prisma.barberDayOff.create({
    data: {
      ...data,
      saloonOwnerId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberHoliday not created');
  }
  return result;
};

const getBarberHolidayListFromDb = async (userId: string) => {
  const result = await prisma.barberDayOff.findMany({
    select: {
      id: true,
      barberId: true,
      date: true,
      reason: true,
      isAllDay: true,
      user: {
        select: {
          fullName: true,
          email: true,
          address: true,
        },
      },
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getBarberHolidayByIdFromDb = async (
  userId: string,
  barberHolidayId: string,
) => {
  const result = await prisma.barberDayOff.findMany({
    where: {
      barberId: barberHolidayId,
      saloonOwnerId: userId,
    },
    select: {
      id: true,
      barberId: true,
      date: true,
      reason: true,
      isAllDay: true,
    },
  });
  if (!result) {
    return { message: 'Barber Holidays not found' };
  }
  return result;
};

const updateBarberHolidayIntoDb = async (
  userId: string,
  barberHolidayId: string,
  data: any,
) => {
  if (data.date) {
    const salon = await prisma.saloonOwner.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const salonZone = getSalonTimezone(salon);
    const { startOfDayUTC } = getDayBoundsInZone(data.date, salonZone);
    data.date = startOfDayUTC;
  }

  const result = await prisma.barberDayOff.update({
    where: {
      id: barberHolidayId,
      saloonOwnerId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberHolidayId, not updated');
  }
  return result;
};

const deleteBarberHolidayItemFromDb = async (
  userId: string,
  barberHolidayId: string,
) => {
  const deletedItem = await prisma.barberDayOff.delete({
    where: {
      id: barberHolidayId,
      saloonOwnerId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberHolidayId, not deleted');
  }

  return deletedItem;
};

export const barberHolidayService = {
  createBarberHolidayIntoDb,
  getBarberHolidayListFromDb,
  getBarberHolidayByIdFromDb,
  updateBarberHolidayIntoDb,
  deleteBarberHolidayItemFromDb,
};

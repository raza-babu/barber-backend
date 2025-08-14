import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createBarberScheduleIntoDb = async (saloonOwnerId: string, data: any) => {
  const { barberId, schedules } = data;
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Schedule data is required');
  }

  // Map for Prisma
  const dataForDb = schedules.map(schedule => ({
    saloonOwnerId,
    barberId: barberId,
    dayName: schedule.dayName,
    dayOfWeek: schedule.dayOfWeek,
    openingDateTime: schedule.openingDateTime,
    closingDateTime: schedule.closingDateTime,
    openingTime: schedule.openingTime,
    closingTime: schedule.closingTime,
    isActive: schedule.isActive,
  }));

  // Delete old schedules for this barber first
  await prisma.barberSchedule.deleteMany({
    where: { saloonOwnerId },
  });

  // Create new schedules
  const result = await prisma.barberSchedule.createMany({
    data: dataForDb,
  });

  if (!result || result.count !== schedules.length) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create all barber schedule entries',
    );
  }

  return result;
};

const getBarberScheduleListFromDb = async (userId: string,) => {
  const result = await prisma.barberSchedule.findMany({
    select: {
      id: true,
      saloonOwnerId: true,
      barberId: true,
      dayName: true,
      openingTime: true,
      closingTime: true,
      isActive: true,
      // openingDateTime: true,
      // closingDateTime: true,
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result.map(schedule => ({
    id: schedule.id,
    saloonOwnerId: schedule.saloonOwnerId,
    barberId: schedule.barberId,
    dayName: schedule.dayName,
    time: `${schedule.openingTime} - ${schedule.closingTime}`,
    isActive: schedule.isActive,
    // openingDateTime: schedule.openingDateTime,
    // closingDateTime: schedule.closingDateTime,
  }));
};

const getBarberScheduleByIdFromDb = async (userId: string, barberScheduleId: string) => {
  const result = await prisma.barberSchedule.findMany({
    where: {
      barberId: barberScheduleId,
      saloonOwnerId: userId,
    },
    select: {
      id: true,
      saloonOwnerId: true,
      barberId: true,
      dayName: true,
      openingTime: true,
      closingTime: true,
      isActive: true,
      // openingDateTime: true,
      // closingDateTime: true,
    },
  });
  if (!result) {
    return []
  }
  return result.map(schedule => ({
    id: schedule.id,
    saloonOwnerId: schedule.saloonOwnerId,
    barberId: schedule.barberId,
    dayName: schedule.dayName,
    time: `${schedule.openingTime} - ${schedule.closingTime}`,   
    isActive: schedule.isActive,
    // openingDateTime: schedule.openingDateTime,
    // closingDateTime: schedule.closingDateTime,
  }));
};

const updateBarberScheduleIntoDb = async (
  userId: string,
  barberScheduleId: string,
  data: any,
) => {
  const result = await prisma.barberSchedule.update({
    where: {
      id: barberScheduleId,
      saloonOwnerId: userId,
    },
    data: {
      ...data,
    },
    select: {
      id: true,
      saloonOwnerId: true,
      barberId: true,
      dayName: true,
      openingTime: true,
      closingTime: true,
      isActive: true,
      // openingDateTime: true,
      // closingDateTime: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberScheduleId, not updated');
  }
  return {
    id: result.id,
    saloonOwnerId: result.saloonOwnerId,
    barberId: result.barberId,
    dayName: result.dayName,
    time: `${result.openingTime} - ${result.closingTime}`,
    isActive: result.isActive,
    // openingDateTime: result.openingDateTime,
    // closingDateTime: result.closingDateTime,
  };
};

const deleteBarberScheduleItemFromDb = async (
  userId: string,
  barberId: string,
) => {
  const deletedItem = await prisma.barberSchedule.deleteMany({
    where: {
      barberId: barberId,
      saloonOwnerId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberScheduleId, not deleted');
  }

  return deletedItem;
};

export const barberScheduleService = {
  createBarberScheduleIntoDb,
  getBarberScheduleListFromDb,
  getBarberScheduleByIdFromDb,
  updateBarberScheduleIntoDb,
  deleteBarberScheduleItemFromDb,
};

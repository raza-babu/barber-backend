import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createLunchIntoDb = async (
  userId: string,
  data: {
    startTime: string; // "01:00 PM"
    endTime: string; // "02:00 PM"
    status?: boolean;
  },
) => {
  const { startTime, endTime, status = true } = data;

  // Parse "hh:mm AM/PM" → 24-hour
  function parseTimeTo24Hour(timeStr: string) {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  const { hours: startHours, minutes: startMinutes } =
    parseTimeTo24Hour(startTime);
  const { hours: endHours, minutes: endMinutes } = parseTimeTo24Hour(endTime);

  // Force into ISO format to avoid "Invalid Date"
  const isoDate = new Date().toISOString(); // e.g., "2025-08-20"

  const startedAt = new Date(isoDate);
  startedAt.setUTCHours(startHours, startMinutes, 0, 0);

  const completedAt = new Date(isoDate);
  completedAt.setUTCHours(endHours, endMinutes, 0, 0);

  const result = await prisma.lunch.create({
    data: {
      saloonOwnerId: userId,
      startedAt,
      completedAt,
      startTime,
      endTime,
      status,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'lunch not created');
  }

  return result;
};

const getLunchListFromDb = async (userId: string) => {
  const result = await prisma.lunch.findMany({
    where: {
      saloonOwnerId: userId,
      status: true,
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getLunchByIdFromDb = async (userId: string, lunchId: string) => {
  const result = await prisma.lunch.findUnique({
    where: {
      id: lunchId,
      saloonOwnerId: userId,
      status: true,
    },
  });
  if (!result) {
    return { message: 'Lunch not found' };
  }
  return result;
};

const updateLunchIntoDb = async (
  userId: string,
  lunchId: string,
  data: {
    startTime: string; // e.g., "01:00 PM"
    endTime: string; // e.g., "02:00 PM"
    status?: boolean; // default is true
  },
) => {
  const { startTime, endTime, status = true } = data;

  // Parse "hh:mm AM/PM" → 24-hour
  function parseTimeTo24Hour(timeStr: string) {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  const { hours: startHours, minutes: startMinutes } =
    parseTimeTo24Hour(startTime);
  const { hours: endHours, minutes: endMinutes } = parseTimeTo24Hour(endTime);

  // Force into ISO format to avoid "Invalid Date"
  const isoDate = new Date().toISOString();

  const startedAt = new Date(isoDate);
  startedAt.setUTCHours(startHours, startMinutes, 0, 0);

  const completedAt = new Date(isoDate);
  completedAt.setUTCHours(endHours, endMinutes, 0, 0);

  const updateData: any = {
    startTime,
    endTime,
    startedAt,
    completedAt,
    status,
  };

  const result = await prisma.lunch.update({
    where: {
      id: lunchId,
      saloonOwnerId: userId,
    },
    data: updateData,
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'lunchId, not updated');
  }
  return result;
};

const deleteLunchItemFromDb = async (userId: string, lunchId: string) => {
  const deletedItem = await prisma.lunch.delete({
    where: {
      id: lunchId,
      saloonOwnerId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'lunchId, not deleted');
  }

  return deletedItem;
};

export const lunchService = {
  createLunchIntoDb,
  getLunchListFromDb,
  getLunchByIdFromDb,
  updateLunchIntoDb,
  deleteLunchItemFromDb,
};

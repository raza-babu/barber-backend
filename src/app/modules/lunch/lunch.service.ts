import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import moment from 'moment-timezone';
import { getSalonTimezone } from '../../utils/timezone.helper';

const createLunchIntoDb = async (
  userId: string,
  data: {
    startTime: string; // "01:00 PM"
    endTime: string; // "02:00 PM"
    status?: boolean;
  },
) => {
  const { startTime, endTime, status = true } = data;

  const salon = await prisma.saloonOwner.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(salon);

  const today = moment.tz(salonZone).format('YYYY-MM-DD');
  const startM = moment.tz(
    `${today} ${startTime.trim()}`,
    [
      'YYYY-MM-DD hh:mm A',
      'YYYY-MM-DD h:mm A',
      'YYYY-MM-DD hh:mma',
      'YYYY-MM-DD h:mma',
      'YYYY-MM-DD HH:mm',
    ],
    salonZone,
  );
  const endM = moment.tz(
    `${today} ${endTime.trim()}`,
    [
      'YYYY-MM-DD hh:mm A',
      'YYYY-MM-DD h:mm A',
      'YYYY-MM-DD hh:mma',
      'YYYY-MM-DD h:mma',
      'YYYY-MM-DD HH:mm',
    ],
    salonZone,
  );

  if (!startM.isValid() || !endM.isValid() || !startM.isBefore(endM)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid lunch times or start time must be before end time',
    );
  }

  const startedAt = startM.toDate();
  const completedAt = endM.toDate();

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

  const salon = await prisma.saloonOwner.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(salon);

  const today = moment.tz(salonZone).format('YYYY-MM-DD');
  const startM = moment.tz(
    `${today} ${startTime.trim()}`,
    [
      'YYYY-MM-DD hh:mm A',
      'YYYY-MM-DD h:mm A',
      'YYYY-MM-DD hh:mma',
      'YYYY-MM-DD h:mma',
      'YYYY-MM-DD HH:mm',
    ],
    salonZone,
  );
  const endM = moment.tz(
    `${today} ${endTime.trim()}`,
    [
      'YYYY-MM-DD hh:mm A',
      'YYYY-MM-DD h:mm A',
      'YYYY-MM-DD hh:mma',
      'YYYY-MM-DD h:mma',
      'YYYY-MM-DD HH:mm',
    ],
    salonZone,
  );

  if (!startM.isValid() || !endM.isValid() || !startM.isBefore(endM)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid lunch times or start time must be before end time',
    );
  }

  const startedAt = startM.toDate();
  const completedAt = endM.toDate();

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

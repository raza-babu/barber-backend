import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { saloonHolidayService } from '../saloonHoliday/saloonHoliday.service';

// Type for schedule input
type ScheduleInput = {
  dayOfWeek: number;
  openingTime: string;
  closingTime: string;
  isActive: boolean;
};

// Type for the function parameters
type CreateSaloonScheduleParams = {
  schedules: ScheduleInput[];
};

const createSaloonScheduleIntoDb = async (
  userId: string,
  schedules : CreateSaloonScheduleParams,
) => {
  // Validate input data
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Schedule data is required');
  }

  // Validate each schedule entry
  schedules.forEach(schedule => {
    if (
      schedule.dayOfWeek < 0 ||
      schedule.dayOfWeek > 6 ||
      !schedule.openingTime ||
      !schedule.closingTime ||
      typeof schedule.isActive !== 'boolean'
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Invalid schedule data format',
      );
    }
  });

  // Use transaction to ensure atomic operation
  return await prisma.$transaction(async transactionClient => {
    // First delete existing schedules for this saloon
    await transactionClient.saloonSchedule.deleteMany({
      where: { saloonOwnerId: userId },
    });

    // Create new schedules
    const createdSchedules = await transactionClient.saloonSchedule.createMany({
      data: schedules.map(schedule => ({
        saloonOwnerId: userId,
        dayOfWeek: schedule.dayOfWeek,
        openingTime: schedule.openingTime,
        closingTime: schedule.closingTime,
        isActive: schedule.isActive,
      })),
    });

    if (!createdSchedules || createdSchedules.count !== schedules.length) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to create all schedule entries',
      );
    }

    return createdSchedules;
  });
};

const getSaloonScheduleListFromDb = async (userId: string) => {
  // Get all schedules for the user
  const schedules = await prisma.saloonSchedule.findMany({
    where: {
      saloonOwnerId: userId,
    },
  });

  if (schedules.length === 0) {
    return [];
  }

  // Get holidays for the user
  // const holidays = await saloonHolidayService.getSaloonHolidayListFromDb(userId);
  // const holidayDays = holidays.map((h: any) => h.dayOfWeek);

  // // Mark isActive false for holidays in the response (do not change DB)
  // const result = schedules.map(schedule => {
  //   if (holidayDays.includes(schedule.dayOfWeek)) {
  //     return { ...schedule, isActive: false };
  //   }
  //   return schedule;
  // });

  return schedules;
};

const getSaloonScheduleByIdFromDb = async (
  userId: string,
  saloonScheduleId: string,
) => {
  const result = await prisma.saloonSchedule.findUnique({
    where: {
      id: saloonScheduleId,
      saloonOwnerId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'saloonSchedule not found');
  }
  return result;
};

const updateSaloonScheduleIntoDb = async (
  userId: string,
  saloonScheduleId: string,
  data: any,
) => {
  const result = await prisma.saloonSchedule.update({
    where: {
      id: saloonScheduleId,
      saloonOwnerId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'saloonScheduleId, not updated');
  }
  return result;
};

const deleteSaloonScheduleItemFromDb = async (
  userId: string,
) => {
  const deletedItem = await prisma.saloonSchedule.deleteMany({
    where: {
      saloonOwnerId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'saloonScheduleId, not deleted');
  }

  return deletedItem;
};

export const saloonScheduleService = {
  createSaloonScheduleIntoDb,
  getSaloonScheduleListFromDb,
  getSaloonScheduleByIdFromDb,
  updateSaloonScheduleIntoDb,
  deleteSaloonScheduleItemFromDb,
};

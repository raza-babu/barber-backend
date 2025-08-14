import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { saloonHolidayService } from '../saloonHoliday/saloonHoliday.service';
import { DateTime } from 'luxon';

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

// Helper to map day name to dayOfWeek (0=Sunday, 1=Monday, ..., 6=Saturday)
const dayNameToIndex: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// Updated ScheduleInput to accept dayName instead of dayOfWeek
type ScheduleInputWithDayName = {
  dayName: string;
  openingTime: string;
  closingTime: string;
  isActive: boolean;
};

type CreateSaloonScheduleParamsWithDayName = {
  schedules: ScheduleInputWithDayName[];
};

const createSaloonScheduleIntoDb = async (
  userId: string,
  data: CreateSaloonScheduleParamsWithDayName
) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Schedule data is required');
  }

  const mappedSchedules = data.map(schedule => {
    const dayOfWeek = dayNameToIndex[schedule.dayName.toLowerCase()];
    if (
      dayOfWeek === undefined ||
      !schedule.openingTime ||
      !schedule.closingTime ||
      typeof schedule.isActive !== 'boolean'
    ) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid schedule data format');
    }

    const openingDateTime = DateTime.fromFormat(schedule.openingTime, 'hh:mm a', { zone: 'local' }).toUTC().toJSDate();
    const closingDateTime = DateTime.fromFormat(schedule.closingTime, 'hh:mm a', { zone: 'local' }).toUTC().toJSDate();

    return {
      saloonOwnerId: userId,
      dayName: schedule.dayName,
      dayOfWeek,
      openingDateTime,
      closingDateTime,
      openingTime: schedule.openingTime,
      closingTime: schedule.closingTime,
      isActive: schedule.isActive,
    };
  });

  return prisma.$transaction(async transactionClient => {
    await transactionClient.saloonSchedule.deleteMany({
      where: { saloonOwnerId: userId },
    });

    const createdSchedules = await transactionClient.saloonSchedule.createMany({
      data: mappedSchedules,
    });

    if (createdSchedules.count !== mappedSchedules.length) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create all schedule entries');
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
    select: { 
      id: true,
      saloonOwnerId: true,
      dayName: true,
      openingTime: true,
      closingTime: true,
      isActive: true,
    },
    orderBy: {
      dayOfWeek: 'asc',
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

  return schedules.map(schedule => ({
    id: schedule.id,
    saloonOwnerId: schedule.saloonOwnerId,
    dayName: schedule.dayName,
    time: `${schedule.openingTime} - ${schedule.closingTime}`,
    isActive: schedule.isActive,
    // openingDateTime: schedule.openingDateTime,
    // closingDateTime: schedule.closingDateTime, 
    }));
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
    select: {
      id: true,
      saloonOwnerId: true,
      dayName: true,
      openingTime: true,
      closingTime: true,
      isActive: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'saloonSchedule not found');
  }
  // Format the response to match the list output
  return {
    id: result.id,
    saloonOwnerId: result.saloonOwnerId,
    dayName: result.dayName,
    time: `${result.openingTime} - ${result.closingTime}`,
    isActive: result.isActive,
  };
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
    select: {
      id: true,
      saloonOwnerId: true,
      dayName: true,
      openingTime: true,
      closingTime: true,
      isActive: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'saloonScheduleId, not updated');
  }
  return result;
};

const deleteSaloonScheduleItemFromDb = async (userId: string) => {
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

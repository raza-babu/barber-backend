import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { messaging } from 'firebase-admin';

// Type definitions
type HolidayInput = {
  // saloonId: string;
  date: Date;
  holidayName: string;
  description?: string;
  isRecurring?: boolean;
};

type UpdateHolidayInput = Partial<HolidayInput>;

const createSaloonHolidayIntoDb = async (
  userId: string,
  //  saloonId: string, 
   data: HolidayInput) => {
  // Check if saloon exists and belongs to user
  const saloon = await prisma.saloonOwner.findUnique({
    where: { 
      // id: saloonId,
      userId: userId 
    }
  });

  if (!saloon) {
    throw new AppError(httpStatus.NOT_FOUND, 'Saloon not found or not owned by user');
  }

  // Check for duplicate holidays
  const existingHoliday = await prisma.saloonHoliday.findFirst({
    where: {
      // saloonId,
      userId,
      date: data.date
    }
  });

  if (existingHoliday) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Holiday already exists for this date'
    );
  }

  return await prisma.saloonHoliday.create({ 
    data: {
      ...data,
      userId,
      // saloonId
    }
  });
};

const getSaloonHolidayListFromDb = async (saloonId: string, filters: {
  fromDate?: Date;
  toDate?: Date;
  isRecurring?: boolean;
} = {}) => {
  const where: Prisma.SaloonHolidayWhereInput = { saloonId };

  if (filters.fromDate || filters.toDate) {
    where.date = {
      gte: filters.fromDate,
      lte: filters.toDate
    };
  }

  if (filters.isRecurring !== undefined) {
    where.isRecurring = filters.isRecurring;
  }

  return await prisma.saloonHoliday.findMany({
    where,
    orderBy: { date: 'asc' }
  });
};

const getSaloonHolidayByIdFromDb = async (userId: string, holidayId: string) => {
  const result = await prisma.saloonHoliday.findUnique({ 
    where: {
      id: holidayId,
      userId
    }
  });

  if (!result) {
    return {message: 'Holiday not found or not owned by user'};
  }

  return result;
};

const updateSaloonHolidayIntoDb = async (
  userId: string, 
  // saloonId: string,
  holidayId: string, 
  data: UpdateHolidayInput
) => {
  // Verify ownership
  const holiday = await prisma.saloonHoliday.findFirst({
    where: {
      id: holidayId,
      // saloonId,
      userId
    }
  });

  if (!holiday) {
    throw new AppError(httpStatus.NOT_FOUND, 'Holiday not found or not owned by user');
  }

  return await prisma.saloonHoliday.update({
    where: { id: holidayId },
    data
  });
};

const deleteSaloonHolidayItemFromDb = async (
  userId: string,
  // saloonId: string,
  holidayId: string
) => {
  // Verify ownership before deletion
  const holiday = await prisma.saloonHoliday.findFirst({
    where: {
      id: holidayId,
      // saloonId,
      userId
    }
  });

  if (!holiday) {
    throw new AppError(httpStatus.NOT_FOUND, 'Holiday not found or not owned by user');
  }

  return await prisma.saloonHoliday.delete({
    where: { id: holidayId }
  });
};

// Additional utility function
const checkSaloonHolidayFromDb = async (saloonId: string, date: Date) => {
  // Check specific date
  const specificHoliday = await prisma.saloonHoliday.findFirst({
    where: {
      saloonId,
      date: {
        equals: date
      }
    }
  });

  if (specificHoliday) return specificHoliday;

  // Check recurring holidays (same month/day)
  const recurringHolidays = await prisma.saloonHoliday.findMany({
    where: {
      saloonId,
      isRecurring: true
    }
  });

  return recurringHolidays.find(h => {
    const hDate = new Date(h.date);
    return hDate.getMonth() === date.getMonth() && 
           hDate.getDate() === date.getDate();
  });
};

export const saloonHolidayService = {
  createSaloonHolidayIntoDb,
  getSaloonHolidayListFromDb,
  getSaloonHolidayByIdFromDb,
  updateSaloonHolidayIntoDb,
  deleteSaloonHolidayItemFromDb,
  checkSaloonHolidayFromDb
};
import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { messaging } from 'firebase-admin';
import { notificationService } from '../notification/notification.service';

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
  data: HolidayInput,
) => {
  // Check if saloon exists and belongs to user
  const saloon = await prisma.saloonOwner.findUnique({
    where: {
      // id: saloonId,
      userId: userId,
    },
  });

  if (!saloon) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Saloon not found or not owned by user',
    );
  }

  // Check for duplicate holidays
  const existingHoliday = await prisma.saloonHoliday.findFirst({
    where: {
      // saloonId,
      userId,
      date: data.date,
    },
    select: {
      id: true,
      date: true,
      holidayName: true,
      description: true,
      isRecurring: true,
    },
  });

  if (existingHoliday) {
    throw new AppError(httpStatus.CONFLICT, 'Holiday already exists');
  }

  return await prisma.saloonHoliday.create({
    data: {
      ...data,
      userId,
      // saloonId
    },
    select: {
      id: true,
      userId: true,
      date: true,
      holidayName: true,
      description: true,
      isRecurring: true,
    },
  }).then(async (createdHoliday) => {
    // Send notification to followers about holiday
    try {
      const saloon = await prisma.saloonOwner.findUnique({
        where: { userId },
        select: { user: { select: { fullName: true } } },
      });

      const followers = await prisma.follow.findMany({
        where: { followingId: userId },
        select: { userId: true },
      });

      if (followers.length > 0) {
        const followerIds = followers.map(f => f.userId);
        const followerTokens = await prisma.user.findMany({
          where: { id: { in: followerIds } },
          select: { id: true, fcmToken: true },
        });

        const saloonName = saloon?.user?.fullName || 'Salon';
        const dateStr = new Date(data.date).toLocaleDateString('en-US');
        const message = `${saloonName} is closed on ${dateStr}: ${data.holidayName}`;

        await Promise.all(
          followerTokens
            .filter(f => f.fcmToken)
            .map(f =>
              notificationService
                .sendNotification(
                  f.fcmToken!,
                  'Salon Holiday',
                  message,
                  f.id,
                )
                .catch(error =>
                  console.error('Error sending holiday creation notification:', error),
                ),
            ),
        );
      }
    } catch (error) {
      console.error('Error sending holiday creation notifications:', error);
    }

    return createdHoliday;
  });
};

const getSaloonHolidayListFromDb = async (
  saloonId: string,
  // filters: {
  //   fromDate?: Date;
  //   toDate?: Date;
  //   isRecurring?: boolean;
  // } = {},
) => {
  // const where: Prisma.SaloonHolidayWhereInput = { saloonId };

  // if (filters.fromDate || filters.toDate) {
  //   where.date = {
  //     gte: filters.fromDate,
  //     lte: filters.toDate,
  //   };
  // }

  // if (filters.isRecurring !== undefined) {
  //   where.isRecurring = filters.isRecurring;
  // }

  return await prisma.saloonHoliday.findMany({
    where:{
      userId: saloonId,
    },
    select: {
      id: true,
      userId: true,
      date: true,
      holidayName: true,
      description: true,
      isRecurring: true,
    },
    orderBy: { date: 'asc' },
  });
};

const getSaloonHolidayByIdFromDb = async (
  userId: string,
  holidayId: string,
) => {
  console.log(`Fetching holiday with ID: ${holidayId} for user: ${userId}`);
  
  const result = await prisma.saloonHoliday.findUnique({
    where: {
      id: holidayId,
      userId,
    },
  });

  if (!result) {
    return { message: 'Holiday not found or not owned by user' };
  }

  return result;
};

const updateSaloonHolidayIntoDb = async (
  userId: string,
  // saloonId: string,
  holidayId: string,
  data: UpdateHolidayInput,
) => {
  // Verify ownership
  const holiday = await prisma.saloonHoliday.findFirst({
    where: {
      id: holidayId,
      // saloonId,
      userId,
    },
  });

  if (!holiday) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Holiday not found or not owned by user',
    );
  }

  return await prisma.saloonHoliday.update({
    where: { id: holidayId },
    data,
    select: {
      id: true,
      userId: true,
      date: true,
      holidayName: true,
      description: true,
      isRecurring: true,
    },
  }).then(async (updatedHoliday) => {
    // Send notification to followers about holiday update
    try {
      const saloon = await prisma.saloonOwner.findUnique({
        where: { userId },
        select: { user: { select: { fullName: true } } },
      });

      const followers = await prisma.follow.findMany({
        where: { followingId: userId },
        select: { userId: true },
      });

      if (followers.length > 0) {
        const followerIds = followers.map(f => f.userId);
        const followerTokens = await prisma.user.findMany({
          where: { id: { in: followerIds } },
          select: { id: true, fcmToken: true },
        });

        const saloonName = saloon?.user?.fullName || 'Salon';
        const dateStr = new Date(updatedHoliday.date).toLocaleDateString('en-US');
        const message = `${saloonName} holiday updated for ${dateStr}: ${updatedHoliday.holidayName}`;

        await Promise.all(
          followerTokens
            .filter(f => f.fcmToken)
            .map(f =>
              notificationService
                .sendNotification(
                  f.fcmToken!,
                  'Salon Holiday Updated',
                  message,
                  f.id,
                )
                .catch(error =>
                  console.error('Error sending holiday update notification:', error),
                ),
            ),
        );
      }
    } catch (error) {
      console.error('Error sending holiday update notifications:', error);
    }

    return updatedHoliday;
  });
};

const deleteSaloonHolidayItemFromDb = async (
  userId: string,
  // saloonId: string,
  holidayId: string,
) => {
  // Verify ownership before deletion
  const holiday = await prisma.saloonHoliday.findFirst({
    where: {
      id: holidayId,
      // saloonId,
      userId,
    },
  });

  if (!holiday) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Holiday not found or not owned by user',
    );
  }

  return await prisma.saloonHoliday.delete({
    where: { id: holidayId },
    select: {
      id: true,
      userId: true,
      date: true,
      holidayName: true,
      description: true,
      isRecurring: true,
    },
  }).then(async (deletedHoliday) => {
    // Send notification to followers about holiday deletion
    try {
      const saloon = await prisma.saloonOwner.findUnique({
        where: { userId },
        select: { user: { select: { fullName: true } } },
      });

      const followers = await prisma.follow.findMany({
        where: { followingId: userId },
        select: { userId: true },
      });

      if (followers.length > 0) {
        const followerIds = followers.map(f => f.userId);
        const followerTokens = await prisma.user.findMany({
          where: { id: { in: followerIds } },
          select: { id: true, fcmToken: true },
        });

        const saloonName = saloon?.user?.fullName || 'Salon';
        const message = `${saloonName} removed holiday: ${deletedHoliday.holidayName}`;

        await Promise.all(
          followerTokens
            .filter(f => f.fcmToken)
            .map(f =>
              notificationService
                .sendNotification(
                  f.fcmToken!,
                  'Salon Holiday Removed',
                  message,
                  f.id,
                )
                .catch(error =>
                  console.error('Error sending holiday deletion notification:', error),
                ),
            ),
        );
      }
    } catch (error) {
      console.error('Error sending holiday deletion notifications:', error);
    }

    return deletedHoliday;
  });
};

// Additional utility function
const checkSaloonHolidayFromDb = async (saloonId: string, date: Date) => {
  // Check specific date
  const specificHoliday = await prisma.saloonHoliday.findFirst({
    where: {
      saloonId,
      date: {
        equals: date,
      },
    },
  });

  if (specificHoliday) return specificHoliday;

  // Check recurring holidays (same month/day)
  const recurringHolidays = await prisma.saloonHoliday.findMany({
    where: {
      saloonId,
      isRecurring: true,
    },
  });

  return recurringHolidays.find(h => {
    const hDate = new Date(h.date);
    return (
      hDate.getMonth() === date.getMonth() && hDate.getDate() === date.getDate()
    );
  });
};

export const saloonHolidayService = {
  createSaloonHolidayIntoDb,
  getSaloonHolidayListFromDb,
  getSaloonHolidayByIdFromDb,
  updateSaloonHolidayIntoDb,
  deleteSaloonHolidayItemFromDb,
  checkSaloonHolidayFromDb,
};

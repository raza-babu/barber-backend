import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { DateTime } from 'luxon';
import config from '../../../config';
import { notificationService } from '../notification/notification.service';

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

    const openingDateTime = DateTime.fromFormat(schedule.openingTime, 'hh:mm a', { zone: config.timezone }).toUTC().toJSDate();
    const closingDateTime = DateTime.fromFormat(schedule.closingTime, 'hh:mm a', { zone: config.timezone }).toUTC().toJSDate();

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
  }).then(async (result) => {
    // Send notification to followers about schedule creation
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
        const daysCount = mappedSchedules.length;
        const message = `${saloonName} updated its schedule for ${daysCount} days`;

        await Promise.all(
          followerTokens
            .filter(f => f.fcmToken)
            .map(f =>
              notificationService
                .sendNotification(
                  f.fcmToken!,
                  'Salon Schedule Updated',
                  message,
                  f.id,
                )
                .catch(error =>
                  console.error('Error sending schedule creation notification:', error),
                ),
            ),
        );
      }
    } catch (error) {
      console.error('Error sending schedule creation notifications:', error);
    }

    return result;
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

  // Send notification to followers about schedule update
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
      const statusText = data.isActive ? 'opened' : 'closed';
      const message = `${saloonName} ${result.dayName} schedule is now ${statusText}`;

      await Promise.all(
        followerTokens
          .filter(f => f.fcmToken)
          .map(f =>
            notificationService
              .sendNotification(
                f.fcmToken!,
                'Salon Schedule Updated',
                message,
                f.id,
              )
              .catch(error =>
                console.error('Error sending schedule update notification:', error),
              ),
          ),
      );
    }
  } catch (error) {
    console.error('Error sending schedule update notifications:', error);
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

  // Send notification to followers about schedule deletion
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
      const message = `${saloonName} schedule has been cleared`;

      await Promise.all(
        followerTokens
          .filter(f => f.fcmToken)
          .map(f =>
            notificationService
              .sendNotification(
                f.fcmToken!,
                'Salon Schedule Cleared',
                message,
                f.id,
              )
              .catch(error =>
                console.error('Error sending schedule deletion notification:', error),
              ),
          ),
      );
    }
  } catch (error) {
    console.error('Error sending schedule deletion notifications:', error);
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

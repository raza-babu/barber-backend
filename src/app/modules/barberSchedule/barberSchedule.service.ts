import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import moment from 'moment-timezone';
import { notificationService } from '../notification/notification.service';
import { getSalonTimezone } from '../../utils/timezone.helper';

const createBarberScheduleIntoDb = async (saloonOwnerId: string, data: any) => {
  const { barberId, schedules } = data;
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Schedule data is required');
  }

  const salon = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(salon);

  // Map for Prisma
  const dataForDb = schedules.map(schedule => {
    let openingDateTime = schedule.openingDateTime;
    let closingDateTime = schedule.closingDateTime;

    const today = moment.tz(salonZone).format('YYYY-MM-DD');
    if (schedule.openingTime) {
      const openM = moment.tz(
        `${today} ${schedule.openingTime.trim()}`,
        [
          'YYYY-MM-DD hh:mm A',
          'YYYY-MM-DD h:mm A',
          'YYYY-MM-DD hh:mma',
          'YYYY-MM-DD h:mma',
          'YYYY-MM-DD HH:mm',
        ],
        salonZone,
      );
      if (openM.isValid()) {
        openingDateTime = openM.toDate();
      }
    }
    if (schedule.closingTime) {
      const closeM = moment.tz(
        `${today} ${schedule.closingTime.trim()}`,
        [
          'YYYY-MM-DD hh:mm A',
          'YYYY-MM-DD h:mm A',
          'YYYY-MM-DD hh:mma',
          'YYYY-MM-DD h:mma',
          'YYYY-MM-DD HH:mm',
        ],
        salonZone,
      );
      if (closeM.isValid()) {
        closingDateTime = closeM.toDate();
      }
    }

    return {
      saloonOwnerId,
      barberId: barberId,
      dayName: schedule.dayName,
      dayOfWeek: schedule.dayOfWeek,
      openingDateTime,
      closingDateTime,
      openingTime: schedule.openingTime,
      closingTime: schedule.closingTime,
      isActive: schedule.isActive,
      type: data.type,
    };
  });

  // Delete old schedules for this barber first
  await prisma.barberSchedule.deleteMany({
    where: { saloonOwnerId, barberId: barberId },
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

  // Send notification to barber about schedule creation
  try {
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
      select: { user: { select: { fcmToken: true, fullName: true } } },
    });

    if (barber?.user?.fcmToken) {
      const barberName = barber.user.fullName || 'Barber';
      const daysList = schedules.map(s => s.dayName).join(', ');
      const message = `Your schedule has been created for: ${daysList}`;

      await notificationService
        .sendNotification(
          barber.user.fcmToken,
          'Schedule Created',
          message,
          barberId,
          saloonOwnerId,
        )
        .catch(error =>
          console.error('Error sending schedule creation notification:', error),
        );
    }
  } catch (error) {
    console.error(
      'Error sending barber schedule creation notification:',
      error,
    );
  }

  return result;
};

const getBarberScheduleListFromDb = async (userId: string) => {
  const result = await prisma.barberSchedule.findMany({
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
    type: schedule.type,
    // openingDateTime: schedule.openingDateTime,
    // closingDateTime: schedule.closingDateTime,
  }));
};

const getBarberScheduleByIdFromDb = async (
  userId: string,
  barberScheduleId: string,
) => {
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
      type: true,
      // openingDateTime: true,
      // closingDateTime: true,
    },
  });
  if (!result) {
    return [];
  }
  return result.map(schedule => ({
    id: schedule.id,
    saloonOwnerId: schedule.saloonOwnerId,
    barberId: schedule.barberId,
    dayName: schedule.dayName,
    time: `${schedule.openingTime} - ${schedule.closingTime}`,
    isActive: schedule.isActive,
    type: schedule.type,
    // openingDateTime: schedule.openingDateTime,
    // closingDateTime: schedule.closingDateTime,
  }));
};

const updateBarberScheduleIntoDb = async (
  userId: string,
  barberScheduleId: string,
  data: any,
) => {
  console.log({ data });
  // ensure the schedule exists and belongs to the saloon owner
  const existing = await prisma.barberSchedule.findFirst({
    where: {
      id: barberScheduleId,
      saloonOwnerId: userId,
    },
  });
  if (!existing) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberScheduleId, not found');
  }

  const salon = await prisma.saloonOwner.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(salon);

  const updateData = { ...data };
  const openingTime = data.openingTime || existing.openingTime;
  const closingTime = data.closingTime || existing.closingTime;

  if (data.openingTime || data.closingTime) {
    const today = moment.tz(salonZone).format('YYYY-MM-DD');
    const openM = moment.tz(
      `${today} ${openingTime.trim()}`,
      [
        'YYYY-MM-DD hh:mm A',
        'YYYY-MM-DD h:mm A',
        'YYYY-MM-DD hh:mma',
        'YYYY-MM-DD h:mma',
        'YYYY-MM-DD HH:mm',
      ],
      salonZone,
    );
    if (openM.isValid()) {
      updateData.openingDateTime = openM.toDate();
    }

    const closeM = moment.tz(
      `${today} ${closingTime.trim()}`,
      [
        'YYYY-MM-DD hh:mm A',
        'YYYY-MM-DD h:mm A',
        'YYYY-MM-DD hh:mma',
        'YYYY-MM-DD h:mma',
        'YYYY-MM-DD HH:mm',
      ],
      salonZone,
    );
    if (closeM.isValid()) {
      updateData.closingDateTime = closeM.toDate();
    }
  }

  const result = await prisma.barberSchedule.update({
    where: { id: barberScheduleId },
    data: updateData,
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

  // Send notification to barber about schedule update
  try {
    const barber = await prisma.barber.findUnique({
      where: { id: result.barberId },
      select: { user: { select: { fcmToken: true, fullName: true } } },
    });

    if (barber?.user?.fcmToken) {
      const statusText = data.isActive ? 'activated' : 'deactivated';
      const message = `Your ${result.dayName} schedule has been updated (${statusText})`;

      await notificationService
        .sendNotification(
          barber.user.fcmToken,
          'Schedule Updated',
          message,
          result.barberId,
          userId,
        )
        .catch(error =>
          console.error('Error sending schedule update notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending barber schedule update notification:', error);
  }

  return {
    id: result.id,
    saloonOwnerId: result.saloonOwnerId,
    barberId: result.barberId,
    dayName: result.dayName,
    time: `${result.openingTime} - ${result.closingTime}`,
    isActive: result.isActive,
    type: result.type,
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

  // Send notification to barber about schedule deletion
  try {
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
      select: { user: { select: { fcmToken: true, fullName: true } } },
    });

    if (barber?.user?.fcmToken) {
      const message = 'Your schedule has been deleted';

      await notificationService
        .sendNotification(
          barber.user.fcmToken,
          'Schedule Deleted',
          message,
          barberId,
          userId,
        )
        .catch(error =>
          console.error('Error sending schedule deletion notification:', error),
        );
    }
  } catch (error) {
    console.error(
      'Error sending barber schedule deletion notification:',
      error,
    );
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

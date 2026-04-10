import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { notificationService } from '../notification/notification.service';

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
    type: data.type,
  }));

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
      
      await notificationService.sendNotification(
        barber.user.fcmToken,
        'Schedule Created',
        message,
        barberId,
      ).catch(error => console.error('Error sending schedule creation notification:', error));
    }
  } catch (error) {
    console.error('Error sending barber schedule creation notification:', error);
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
      type: true,
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

  const result = await prisma.barberSchedule.update({
    where: { id: barberScheduleId },
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
      type: true
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
      
      await notificationService.sendNotification(
        barber.user.fcmToken,
        'Schedule Updated',
        message,
        result.barberId,
      ).catch(error => console.error('Error sending schedule update notification:', error));
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
      
      await notificationService.sendNotification(
        barber.user.fcmToken,
        'Schedule Deleted',
        message,
        barberId,
      ).catch(error => console.error('Error sending schedule deletion notification:', error));
    }
  } catch (error) {
    console.error('Error sending barber schedule deletion notification:', error);
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

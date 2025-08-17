import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { DateTime } from 'luxon';


const createBarberLunchIntoDb = async (
  userId: string,
  data: {
    barberId: string;
    saloonOwnerId: string;
    date: string; // e.g., "2025-08-20"
    startTime: string; // e.g., "12:00 PM"
    endTime: string; // e.g., "01:00 PM"
  }
) => {
  const { barberId, date, startTime, endTime } = data;

  // Parse date and times to UTC ISO strings
  const baseDate = DateTime.fromISO(date, { zone: 'utc' });
  const parseTime = (timeStr: string): string => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    const isoString = baseDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 }).toUTC().toISO();
    if (!isoString) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid time format');
    }
    return isoString;
  };
  const lunchStart = parseTime(startTime);
  const lunchEnd = parseTime(endTime);

  // Transaction for atomicity
  return await prisma.$transaction(async (tx) => {
    // 1. Check if barber is off on this date
    const dayName = baseDate.toFormat('cccc'); // e.g., "Monday"
    const schedule = await tx.barberSchedule.findFirst({
      where: {
      barberId,
      dayName,
      isActive: true,
      },
    });
    if (schedule) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Barber is off on this date');
    }

    // 2. Create barberLunch
    const lunch = await tx.barberLunch.create({
      data: {
        lunchStart,
        lunchEnd,
        startTime,
        endTime,
        barberId,
        saloonOwnerId: userId,
      },
    });

    // 3. Update barberRealTimeStatus for the lunch period
    await tx.barberRealTimeStatus.create({
      data: {
        barberId,
        startDateTime: lunchStart,
        endDateTime: lunchEnd,
        startTime: DateTime.fromISO(lunchStart).toFormat('hh:mm a'),
        endTime: DateTime.fromISO(lunchEnd).toFormat('hh:mm a'),
      },
    });

    // 4. Reschedule queueSlot(s) that overlap with lunch
    const overlappingSlots = await tx.queueSlot.findMany({
      where: {
        barberId,
        startedAt: { lte: lunchEnd },
        completedAt: { gte: lunchStart },
      },
    });

    for (const slot of overlappingSlots) {
      // Move slot to after lunchEnd (simple logic, can be improved)
      const duration = DateTime.fromISO(slot.completedAt as unknown as string).diff(DateTime.fromISO(slot.startedAt as unknown as string)).as('minutes');
      const newStart = DateTime.fromISO(lunchEnd);
      const newEnd = newStart.plus({ minutes: duration });
      await tx.queueSlot.update({
        where: { id: slot.id },
        data: {
          startedAt: newStart.toISO(),
          completedAt: newEnd.toISO(),
        },
      });
    }

    // 5. Update endDateTime and endTime in booking model for affected bookings
    await tx.booking.updateMany({
      where: {
        barberId,
        endDateTime: { gte: lunchStart, lte: lunchEnd },
      },
      data: {
        endDateTime: lunchEnd,
        endTime: DateTime.fromISO(lunchEnd).toFormat('hh:mm a'),
      },
    });

    return lunch;
  });
};

const getBarberLunchListFromDb = async (userId: string) => {
  
    const result = await prisma.barberLunch.findMany();
    if (result.length === 0) {
    return { message: 'No barberLunch found' };
  }
    return result;
};

const getBarberLunchByIdFromDb = async (userId: string, barberLunchId: string) => {
  
    const result = await prisma.barberLunch.findUnique({ 
    where: {
      id: barberLunchId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'barberLunch not found');
  }
    return result;
  };



const updateBarberLunchIntoDb = async (userId: string, barberLunchId: string, data: any) => {
  
    const result = await prisma.barberLunch.update({
      where:  {
        id: barberLunchId,
        saloonOwnerId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberLunchId, not updated');
  }
    return result;
  };

const deleteBarberLunchItemFromDb = async (userId: string, barberLunchId: string) => {
    const deletedItem = await prisma.barberLunch.delete({
      where: {
      id: barberLunchId,
      saloonOwnerId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'barberLunchId, not deleted');
  }

    return deletedItem;
  };

export const barberLunchService = {
createBarberLunchIntoDb,
getBarberLunchListFromDb,
getBarberLunchByIdFromDb,
updateBarberLunchIntoDb,
deleteBarberLunchItemFromDb,
};
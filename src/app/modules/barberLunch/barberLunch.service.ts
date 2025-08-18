import { number } from 'zod';
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { DateTime } from 'luxon';

const createBarberLunchIntoDb = async (
  userId: string,
  data: {
    barberId: string;
    date: string; // "2025-08-20"
    startTime: string; // "12:00 PM"
    endTime: string; // "01:00 PM"
  },
) => {
  const { barberId, date, startTime, endTime } = data;

  const baseDate = DateTime.fromISO(date, { zone: 'local' });
  if (!baseDate.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
  }

  const parseClockToUTC = (timeStr: string): DateTime => {
    const [time, modifier] = timeStr.trim().split(' ');
    let [h, m] = time.split(':').map(Number);
    if (modifier?.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (modifier?.toUpperCase() === 'AM' && h === 12) h = 0;
    return baseDate
      .set({ hour: h, minute: m, second: 0, millisecond: 0 })
      .toUTC();
  };

  const lunchStartDt = parseClockToUTC(startTime);
  const lunchEndDt = parseClockToUTC(endTime);
  if (!(lunchStartDt < lunchEndDt)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Lunch start must be before end',
    );
  }

  const dayStartUTC = baseDate.startOf('day').toUTC();
  const dayEndUTC = baseDate.endOf('day').toUTC();

  return await prisma.$transaction(async tx => {
    const dayName = baseDate.toFormat('cccc');
    const schedule = await tx.barberSchedule.findFirst({
      where: {
        saloonOwnerId: userId,
        barberId,
        dayName: dayName.toLowerCase(),
        isActive: true,
      },
    });
    if (!schedule) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Barber is off on this date');
    }

    const opening =
      schedule.openingDateTime instanceof Date
        ? DateTime.fromJSDate(schedule.openingDateTime).setZone('local')
        : DateTime.fromISO(String(schedule.openingDateTime), { zone: 'local' });
    const closing =
      schedule.closingDateTime instanceof Date
        ? DateTime.fromJSDate(schedule.closingDateTime).setZone('local')
        : DateTime.fromISO(String(schedule.closingDateTime), { zone: 'local' });

    const workStart = baseDate
      .set({ hour: opening.hour, minute: opening.minute })
      .toUTC();
    const workEnd = baseDate
      .set({ hour: closing.hour, minute: closing.minute })
      .toUTC();

    if (lunchStartDt < workStart || lunchEndDt > workEnd) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Lunch must be within working hours',
      );
    }

    const overlappingLunch = await tx.barberLunch.findFirst({
      where: {
        barberId,
        lunchStart: { lt: lunchEndDt.toJSDate() },
        lunchEnd: { gt: lunchStartDt.toJSDate() },
      },
    });
    if (overlappingLunch) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Lunch already exists in this period',
      );
    }

    const now = DateTime.local().toUTC();

    // 🚫 Block if lunch intersects with an ongoing status
    const activeStatus = await tx.barberRealTimeStatus.findFirst({
      where: {
        barberId,
        startDateTime: { lte: now.toJSDate() },
        endDateTime: { gt: now.toJSDate() },
        AND: [
          { startDateTime: { lt: lunchEndDt.toJSDate() } },
          { endDateTime: { gt: lunchStartDt.toJSDate() } },
        ],
      },
    });
    if (activeStatus) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Lunch overlaps an ongoing status. Pick another time.',
      );
    }

    // 🚫 Block if lunch intersects with an ongoing slot
    const activeSlot = await tx.queueSlot.findFirst({
      where: {
        barberId,
        startedAt: { lte: now.toJSDate() },
        completedAt: { gt: now.toJSDate() },
        AND: [
          { startedAt: { lt: lunchEndDt.toJSDate() } },
          { completedAt: { gt: lunchStartDt.toJSDate() } },
        ],
      },
    });
    if (activeSlot) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Lunch overlaps an ongoing slot. Pick another time.',
      );
    }

    // ✅ Create lunch record
    const lunch = await tx.barberLunch.create({
      data: {
        barberId,
        saloonOwnerId: userId,
        lunchStart: lunchStartDt.toJSDate(),
        lunchEnd: lunchEndDt.toJSDate(),
        startTime,
        endTime,
      },
    });

    // ⏸ Insert explicit On Break status
    const realTime = await tx.barberRealTimeStatus.create({
      data: {
        barberId,
        isAvailable: false,
        startDateTime: lunch.lunchStart,
        endDateTime: lunch.lunchEnd,
        startTime: lunch.startTime,
        endTime: lunch.endTime,
      },
    });

    if (
      realTime.startDateTime.getTime() !== lunch.lunchStart.getTime() ||
      realTime.endDateTime.getTime() !== lunch.lunchEnd.getTime()
    ) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to create real-time status for lunch',
      );
    }

    // 🔁 Reschedule future RealTimeStatuses
    const statuses = await tx.barberRealTimeStatus.findMany({
      where: {
        barberId,
        startDateTime: {
          gt: now.toJSDate(), // greater than now
          lt: dayEndUTC.toJSDate(), // less than end of day
        },
      },
      orderBy: { startDateTime: 'asc' },
    });

    let nextStart: DateTime = lunchEndDt;
    let skipReschedule = false;

    for (const st of statuses) {
      // ⛔ Skip the lunch record itself
      if (
        st.startDateTime.getTime() === lunch.lunchStart.getTime() &&
        st.endDateTime.getTime() === lunch.lunchEnd.getTime()
      ) {
        continue;
      }

      const sStart = DateTime.fromJSDate(st.startDateTime).toUTC();
      const sEnd = DateTime.fromJSDate(st.endDateTime).toUTC();

      if (sEnd <= lunchStartDt) continue;

      if (sStart >= lunchEndDt && nextStart?.equals(lunchEndDt)) {
        skipReschedule = true;
        continue;
      }

      const duration = sEnd.diff(sStart, 'minutes').as('minutes');
      const newStart = nextStart!;
      const newEnd = newStart.plus({ minutes: duration });

      await tx.barberRealTimeStatus.update({
        where: { id: st.id },
        data: {
          startDateTime: newStart.toJSDate(),
          endDateTime: newEnd.toJSDate(),
          startTime: newStart.setZone('local').toFormat('hh:mm a'),
          endTime: newEnd.setZone('local').toFormat('hh:mm a'),
        },
      });

      nextStart = newEnd;
    }

    // 🔁 Reschedule future QueueSlots
    const slots = await tx.queueSlot.findMany({
      where: {
        barberId,
        startedAt: {
          gt: now.toJSDate(), // after now
          lt: dayEndUTC.toJSDate(), // before end of the day
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    nextStart = lunchEndDt;
    let skipSlotReschedule = false;
    for (const slot of slots) {
      if (!slot.startedAt || !slot.completedAt) continue;
      const slotStart = DateTime.fromJSDate(slot.startedAt).toUTC();
      const slotEnd = DateTime.fromJSDate(slot.completedAt).toUTC();

      if (slotEnd <= lunchStartDt) continue;
      if (slotStart >= lunchEndDt && nextStart.equals(lunchEndDt)) {
        skipSlotReschedule = true; // first one after lunch untouched
        continue;
      }
      if (skipSlotReschedule) continue;

      const duration = slotEnd.diff(slotStart, 'minutes').as('minutes');
      const newStart = nextStart!;
      const newEnd = newStart.plus({ minutes: duration });

      await tx.queueSlot.update({
        where: { id: slot.id },
        data: {
          startedAt: newStart.toJSDate(),
          completedAt: newEnd.toJSDate(),
        },
      });

      if (slot.bookingId) {
        await tx.booking.update({
          where: { id: slot.bookingId },
          data: {
            startDateTime: newStart.toJSDate(),
            endDateTime: newEnd.toJSDate(),
            startTime: newStart.setZone('local').toFormat('hh:mm a'),
            endTime: newEnd.setZone('local').toFormat('hh:mm a'),
          },
        });
      }

      nextStart = newEnd;
    }

    return lunch;
  });
};

const getBarberLunchListFromDb = async (userId: string) => {
  const result = await prisma.barberLunch.findMany({
    where: {
      saloonOwnerId: userId,
    },
    orderBy: {
      lunchStart: 'asc',
    },
    select: {
      id: true,
      barberId: true,
      saloonOwnerId: true,
      lunchStart: true,
      lunchEnd: true,
      startTime: true,
      endTime: true,
      barber: {
        select: {
          user: {
            select: {
              fullName: true,
              image: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result.map(item => ({
    barberName: item.barber.user.fullName,
    barberImage: item.barber.user.image,
    barberEmail: item.barber.user.email,
    barberPhone: item.barber.user.phoneNumber,
    barberId: item.barberId,
    lunchStart: DateTime.fromJSDate(item.lunchStart).toUTC().toISO(),
    lunchEnd: DateTime.fromJSDate(item.lunchEnd).toUTC().toISO(),
    startTime: DateTime.fromJSDate(item.lunchStart).setZone('local').toFormat('hh:mm a'),
    endTime: DateTime.fromJSDate(item.lunchEnd).setZone('local').toFormat('hh:mm a'),
  }));
};

const getBarberLunchByIdFromDb = async (
  userId: string,
  barberLunchId: string,
) => {
  const result = await prisma.barberLunch.findFirst({
    where: {
      barberId: barberLunchId,
      saloonOwnerId: userId,
    },
    select: {
      id: true,
      barberId: true,
      saloonOwnerId: true,
      lunchStart: true,
      lunchEnd: true,
      startTime: true,
      endTime: true,
      barber: {
        select: {
          user: {
            select: {
              fullName: true,
              image: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'barberLunch not found');
  }
  return {
    id: result.id,
    barberId: result.barberId,
    saloonOwnerId: result.saloonOwnerId,
    barberName: result.barber.user.fullName,
    barberImage: result.barber.user.image,
    barberEmail: result.barber.user.email,
    barberPhone: result.barber.user.phoneNumber,
    lunchStart: DateTime.fromJSDate(result.lunchStart).toUTC().toISO(),
    lunchEnd: DateTime.fromJSDate(result.lunchEnd).toUTC().toISO(),
    startTime: DateTime.fromJSDate(result.lunchStart).setZone('local').toFormat('hh:mm a'),
    endTime: DateTime.fromJSDate(result.lunchEnd).setZone('local').toFormat('hh:mm a'),
  };
};

const updateBarberLunchIntoDb = async (
  userId: string,
  barberLunchId: string,
  data: any,
) => {
  const result = await prisma.barberLunch.update({
    where: {
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

const deleteBarberLunchItemFromDb = async (
  userId: string,
  barberLunchId: string,
) => {
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

import { number } from 'zod';
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import moment from 'moment-timezone';
import config from '../../../config';
import { getSalonTimezone } from '../../utils/timezone.helper';

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

  const saloon = await prisma.saloonOwner.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(saloon);

  const baseDate = moment.tz(date, salonZone);
  if (!baseDate.isValid()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
  }

  const parseClockToUTC = (timeStr: string): moment.Moment => {
    const m = moment.tz(
      `${date} ${timeStr.trim()}`,
      [
        'YYYY-MM-DD hh:mm A',
        'YYYY-MM-DD h:mm A',
        'YYYY-MM-DD hh:mma',
        'YYYY-MM-DD h:mma',
        'YYYY-MM-DD HH:mm',
      ],
      salonZone,
    );
    return m.utc();
  };

  const lunchStartDt = parseClockToUTC(startTime);
  const lunchEndDt = parseClockToUTC(endTime);
  if (!lunchStartDt.isBefore(lunchEndDt)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Lunch start must be before end',
    );
  }

  const dayEndUTC = baseDate.clone().endOf('day').utc();

  return await prisma.$transaction(async tx => {
    const dayName = baseDate.format('dddd').toLowerCase();
    const schedule = await tx.barberSchedule.findFirst({
      where: {
        saloonOwnerId: userId,
        barberId,
        dayName,
        isActive: true,
      },
    });
    if (!schedule) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Barber is off on this date');
    }

    const opening = moment.tz(schedule.openingDateTime, salonZone);
    const closing = moment.tz(schedule.closingDateTime, salonZone);

    const workStart = baseDate
      .clone()
      .hour(opening.hour())
      .minute(opening.minute())
      .second(0)
      .millisecond(0)
      .utc();
    const workEnd = baseDate
      .clone()
      .hour(closing.hour())
      .minute(closing.minute())
      .second(0)
      .millisecond(0)
      .utc();

    if (lunchStartDt.isBefore(workStart) || lunchEndDt.isAfter(workEnd)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Lunch must be within working hours',
      );
    }

    const overlappingLunch = await tx.barberLunch.findFirst({
      where: {
        barberId,
        lunchStart: { lt: lunchEndDt.toDate() },
        lunchEnd: { gt: lunchStartDt.toDate() },
      },
    });
    if (overlappingLunch) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Lunch already exists in this period',
      );
    }

    const now = moment.utc();

    // 🚫 Block if lunch intersects with an ongoing status
    const activeStatus = await tx.barberRealTimeStatus.findFirst({
      where: {
        barberId,
        startDateTime: { lte: now.toDate() },
        endDateTime: { gt: now.toDate() },
        AND: [
          { startDateTime: { lt: lunchEndDt.toDate() } },
          { endDateTime: { gt: lunchStartDt.toDate() } },
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
        startedAt: { lte: now.toDate() },
        completedAt: { gt: now.toDate() },
        AND: [
          { startedAt: { lt: lunchEndDt.toDate() } },
          { completedAt: { gt: lunchStartDt.toDate() } },
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
        lunchStart: lunchStartDt.toDate(),
        lunchEnd: lunchEndDt.toDate(),
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
          gt: now.toDate(), // greater than now
          lt: dayEndUTC.toDate(), // less than end of day
        },
      },
      orderBy: { startDateTime: 'asc' },
    });

    let nextStart: moment.Moment = lunchEndDt.clone();
    let skipReschedule = false;

    for (const st of statuses) {
      // ⛔ Skip the lunch record itself
      if (
        st.startDateTime.getTime() === lunch.lunchStart.getTime() &&
        st.endDateTime.getTime() === lunch.lunchEnd.getTime()
      ) {
        continue;
      }

      const sStart = moment.utc(st.startDateTime);
      const sEnd = moment.utc(st.endDateTime);

      if (sEnd.isSameOrBefore(lunchStartDt)) continue;

      if (sStart.isSameOrAfter(lunchEndDt) && nextStart.isSame(lunchEndDt)) {
        skipReschedule = true;
        continue;
      }

      const duration = sEnd.diff(sStart, 'minutes');
      const newStart = nextStart.clone();
      const newEnd = newStart.clone().add(duration, 'minutes');

      await tx.barberRealTimeStatus.update({
        where: { id: st.id },
        data: {
          startDateTime: newStart.toDate(),
          endDateTime: newEnd.toDate(),
          startTime: newStart.clone().tz(salonZone).format('hh:mm A'),
          endTime: newEnd.clone().tz(salonZone).format('hh:mm A'),
        },
      });

      nextStart = newEnd;
    }

    // 🔁 Reschedule future QueueSlots
    const slots = await tx.queueSlot.findMany({
      where: {
        barberId,
        startedAt: {
          gt: now.toDate(), // after now
          lt: dayEndUTC.toDate(), // before end of the day
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    nextStart = lunchEndDt.clone();
    let skipSlotReschedule = false;
    for (const slot of slots) {
      if (!slot.startedAt || !slot.completedAt) continue;
      const slotStart = moment.utc(slot.startedAt);
      const slotEnd = moment.utc(slot.completedAt);

      if (slotEnd.isSameOrBefore(lunchStartDt)) continue;
      if (slotStart.isSameOrAfter(lunchEndDt) && nextStart.isSame(lunchEndDt)) {
        skipSlotReschedule = true; // first one after lunch untouched
        continue;
      }
      if (skipSlotReschedule) continue;

      const duration = slotEnd.diff(slotStart, 'minutes');
      const newStart = nextStart.clone();
      const newEnd = newStart.clone().add(duration, 'minutes');

      await tx.queueSlot.update({
        where: { id: slot.id },
        data: {
          startedAt: newStart.toDate(),
          completedAt: newEnd.toDate(),
        },
      });

      if (slot.bookingId) {
        await tx.booking.update({
          where: { id: slot.bookingId },
          data: {
            startDateTime: newStart.toDate(),
            endDateTime: newEnd.toDate(),
            startTime: newStart.clone().tz(salonZone).format('hh:mm A'),
            endTime: newEnd.clone().tz(salonZone).format('hh:mm A'),
          },
        });
      }

      nextStart = newEnd;
    }

    return lunch;
  });
};

const getBarberLunchListFromDb = async (userId: string) => {
  const saloon = await prisma.saloonOwner.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(saloon);

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
    lunchStart: moment.utc(item.lunchStart).toISOString(),
    lunchEnd: moment.utc(item.lunchEnd).toISOString(),
    startTime: moment.tz(item.lunchStart, salonZone).format('hh:mm A'),
    endTime: moment.tz(item.lunchEnd, salonZone).format('hh:mm A'),
  }));
};

const getBarberLunchByIdFromDb = async (
  userId: string,
  barberLunchId: string,
) => {
  const saloon = await prisma.saloonOwner.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(saloon);

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
    lunchStart: moment.utc(result.lunchStart).toISOString(),
    lunchEnd: moment.utc(result.lunchEnd).toISOString(),
    startTime: moment.tz(result.lunchStart, salonZone).format('hh:mm A'),
    endTime: moment.tz(result.lunchEnd, salonZone).format('hh:mm A'),
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

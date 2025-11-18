import { start } from 'repl';
import prisma from '../../utils/prisma';
import {
  BookingStatus,
  BookingType,
  PaymentStatus,
  ScheduleType,
  User,
  UserRoleEnum,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { DateTime } from 'luxon';
import { calculatePagination } from '../../utils/pagination';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { nullable } from 'zod';

const createQueueBookingIntoDb = async (userId: string, data: any) => {
  const {
    barberId,
    saloonOwnerId,
    appointmentAt,
    date,
    services,
    notes,
    isInQueue,
    loyaltySchemeId,
  } = data;

  const saloonStatus = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId, isVerified: true },
  });
  if (!saloonStatus) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Saloon not found or not verified',
    );
  }

  // 1. Fetch saloonOwner to check queue status
  const saloonOwner = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId },
    select: { isQueueEnabled: true },
  });
  if (!saloonOwner) {
    throw new AppError(httpStatus.NOT_FOUND, 'Salon owner not found');
  }

  // 2. Convert date and time to UTC DateTime
  // Enforce that the provided date MUST be today's date (local)
  const dateObj = DateTime.fromISO(date, { zone: 'local' });
  if (!dateObj.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
  }
  const todayISO = DateTime.now().setZone('local').toISODate();
  if (dateObj.toISODate() !== todayISO) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Date must be the current date');
  }

  // Combine date and appointmentAt (e.g., "2025-08-20" + "11:00 AM")
  const localDateTime = DateTime.fromFormat(
    `${date} ${appointmentAt}`,
    'yyyy-MM-dd hh:mm a',
    { zone: 'local' },
  );
  if (!localDateTime.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date or time format');
  }

  // appointmentAt cannot be in the past (local time)
  const nowLocal = DateTime.now().setZone('local');
  if (localDateTime < nowLocal) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Appointment time cannot be in the past',
    );
  }

  const utcDateTime = localDateTime.toUTC().toJSDate();

  // 3. Calculate total price using service model
  const serviceRecords = await prisma.service.findMany({
    where: { id: { in: services } },
    select: { id: true, price: true, duration: true },
  });
  if (serviceRecords.length !== services.length) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Some services not found');
  }
  const totalDuration = serviceRecords.reduce(
    (sum, s) => sum + (s.duration || 0), // assuming each service has a 'duration' in minutes
    0,
  );
  if (totalDuration <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Total service duration must be greater than zero',
    );
  }
  const totalPrice = serviceRecords.reduce(
    (sum, s) => sum + Number(s.price),
    0,
  );

  // 4. Transaction for all DB operations
  const result = await prisma.$transaction(async tx => {
    // 4a. Check if barber exists and is available
    const barber = await tx.barber.findUnique({
      where: { userId: barberId },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            fullName: true,
            image: true,
          },
        },
      },
    });
    if (!barber) {
      throw new AppError(httpStatus.NOT_FOUND, 'Barber not found');
    }
    // 4b. Check if barber is on holiday or not
    const barberHoliday = await tx.barberDayOff.findFirst({
      where: {
        barberId: barber.id,
        date: localDateTime.toJSDate(),
        saloonOwnerId: saloonOwnerId,
      },
    });
    if (barberHoliday) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Barber is on holiday');
    }

    // Check if the booking time overlaps with the barber's lunch/break time (time only, ignore date)
    const barberBreak = await tx.lunch.findFirst({
      where: {
        saloonOwnerId: saloonOwnerId,
      },
    });

    if (barberBreak) {
      // Extract only the time part from the booking start and end
      const bookingStartTime = DateTime.fromFormat(appointmentAt, 'hh:mm a', {
        zone: 'local',
      });
      const bookingEndTime = bookingStartTime.plus({ minutes: totalDuration });

      // Parse lunch break start and end times (time only, ignore date)
      if (!barberBreak.startTime || !barberBreak.endTime) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Barber break start or end time is missing',
        );
      }
      const breakStartTime = DateTime.fromFormat(
        barberBreak.startTime,
        'hh:mm a',
        { zone: 'local' },
      );
      const breakEndTime = DateTime.fromFormat(barberBreak.endTime, 'hh:mm a', {
        zone: 'local',
      });

      // Check for overlap (time only)
      if (
        (bookingStartTime >= breakStartTime &&
          bookingStartTime < breakEndTime) ||
        (bookingEndTime > breakStartTime && bookingEndTime <= breakEndTime) ||
        (bookingStartTime <= breakStartTime && bookingEndTime >= breakEndTime)
      ) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Barber is unavailable during break/lunch time',
        );
      }
    }
    // 4a. If queue is enabled, create queue and queueSlot
    let queue = null;
    let queueSlot = null;
    // if (saloonOwner.isQueueEnabled && isInQueue) {
    // Find the current max position in the queue for this barber and date
    // Delete any existing queue for this barber for previous days (before today)
    // console.log('Queue found:');
    await tx.queue.deleteMany({
      where: {
        barberId,
        saloonOwnerId,
        isActive: false,
        date: { lt: new Date() },
      },
    });

    // Try to find an existing queue for this barber and date (only one per day allowed)
    queue = await tx.queue.findFirst({
      where: {
        barberId,
        saloonOwnerId,
        date: new Date(date),
      },
    });

    if (!queue) {
      // If not found, create a new queue for the given date (today or any future date)
      queue = await tx.queue.create({
        data: {
          barberId,
          saloonOwnerId,
          date: new Date(date),
          currentPosition: 1,
        },
      });
      if (!queue) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Error creating queue');
      }
    } else {
      // If found, increment currentPosition
      queue = await tx.queue.update({
        where: { id: queue.id },
        data: {
          currentPosition: queue.currentPosition + 1,
        },
      });
      if (!queue) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Error updating queue');
      }
    }

    // Find all existing queueSlots for this queue, ordered by startedAt
    const existingSlots = await tx.queueSlot.findMany({
      where: { queueId: queue.id },
      orderBy: { startedAt: 'asc' },
    });

    // Find the correct position for the new slot based on startedAt (utcDateTime)
    let insertPosition = 1;
    for (let i = 0; i < existingSlots.length; i++) {
      const slot = existingSlots[i];
      if (
        slot &&
        slot.startedAt !== null &&
        slot.startedAt !== undefined &&
        utcDateTime > slot.startedAt
      ) {
        insertPosition = i + 2; // +2 because positions are 1-based and we want to insert after this slot
      } else {
        break;
      }
    }

    // Shift positions of slots that come after the new slot
    for (let i = existingSlots.length - 1; i >= insertPosition - 1; i--) {
      await tx.queueSlot.update({
        where: { id: existingSlots[i].id },
        data: { position: existingSlots[i].position + 1 },
      });
      if (!queueSlot) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Error updating queue slot position',
        );
      }
    }

    // Create the new queueSlot at the correct position
    queueSlot = await tx.queueSlot.create({
      data: {
        queueId: queue.id,
        customerId: userId,
        barberId: barberId,
        position: insertPosition,
        startedAt: utcDateTime,
      },
    });
    if (!queueSlot) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Error creating queue slot');
    }
    // }

    let price = totalPrice;
    let loyaltyUsed = null;

    if (loyaltySchemeId) {
      // Verify the loyalty scheme exists and belongs to the saloon owner
      const loyaltyScheme = await tx.loyaltyScheme.findUnique({
        where: { id: loyaltySchemeId, userId: saloonOwnerId },
      });
      if (!loyaltyScheme) {
        throw new AppError(httpStatus.NOT_FOUND, 'Loyalty scheme not found');
      }
      // Check if the customer has enough points
      const customerLoyalty = await tx.customerLoyalty.findUnique({
        where: { userId: userId },
        select: { id: true, totalPoints: true },
      });
      if (
        !customerLoyalty ||
        (customerLoyalty.totalPoints || 0) < loyaltyScheme.pointThreshold
      ) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Not enough loyalty points');
      }
      // Deduct points from customerLoyalty
      await tx.customerLoyalty.update({
        where: { userId: userId },
        data: { totalPoints: { decrement: loyaltyScheme.pointThreshold } },
      });
      // Add a record to loyaltyRedemption
      loyaltyUsed = await tx.loyaltyRedemption.create({
        data: {
          customerId: userId,
          customerLoyaltyId: customerLoyalty.id,
          pointsUsed: loyaltyScheme.pointThreshold,
        },
      });

      // Reduce the totalPrice by the discountAmount
      price = totalPrice - totalPrice * (loyaltyScheme.percentage / 100);
      if (price < 0) price = 0;
    }

    // 4b. Create booking
    const booking = await tx.booking.create({
      data: {
        userId,
        barberId,
        saloonOwnerId,
        appointmentAt: utcDateTime,
        date: new Date(date),
        notes,
        bookingType: BookingType.QUEUE,
        isInQueue: !!(saloonOwner.isQueueEnabled && isInQueue),
        totalPrice: price,
        startDateTime: utcDateTime,
        endDateTime: DateTime.fromJSDate(utcDateTime)
          .plus({ minutes: totalDuration })
          .toJSDate(),
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(utcDateTime)
          .plus({ minutes: totalDuration })
          .toFormat('hh:mm a'),
        loyaltySchemeId: data.loyaltySchemeId || null,
        loyaltyUsed: data.loyaltyProgramId ? true : false,
      },
    });
    if (isInQueue && booking) {
      // add payment status as PAID
      await tx.payment.create({
        data: {
          userId: userId,
          bookingId: booking.id,
          paymentAmount: price,
          status: PaymentStatus.COMPLETED,
          paymentDate: new Date(),
        },
      });
    }

    if (loyaltyUsed) {
      if (booking && booking.loyaltySchemeId) {
        await tx.loyaltyRedemption.update({
          where: { id: loyaltyUsed.id, customerId: userId, bookingId: null },
          data: { bookingId: booking.id },
        });
      }
    }

    // 4c. Create bookedService records
    await Promise.all(
      serviceRecords.map(service =>
        tx.bookedServices.create({
          data: {
            bookingId: booking.id,
            customerId: userId,
            serviceId: service.id,
            price: service.price,
          },
        }),
      ),
    );

    if (queueSlot && queueSlot.id) {
      queueSlot = await tx.queueSlot.update({
        where: { id: queueSlot.id },
        data: {
          bookingId: booking.id,
          completedAt: DateTime.fromJSDate(utcDateTime)
            .plus({ minutes: totalDuration })
            .toJSDate(),
        },
      });
      if (!queueSlot) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Error updating queue slot');
      }
    }

    // 4d. Add barberRealTimeStatus
    // Calculate endDateTime by adding totalServiceTime (in minutes) to utcDateTime
    const totalServiceTime = serviceRecords.reduce(
      (sum, s) => sum + (s.duration || 0),
      0,
    ); // assuming each service has a 'duration' in minutes
    const endDateTime = DateTime.fromJSDate(utcDateTime)
      .plus({ minutes: totalServiceTime })
      .toJSDate();
    // Check if the barber is scheduled to work during the requested time range
    // Get the day name (e.g., 'monday') from the appointment date
    const dayName = DateTime.fromJSDate(utcDateTime)
      .toFormat('cccc')
      .toLowerCase();

    const barberSchedule = await tx.barberSchedule.findFirst({
      where: {
        barberId: barberId,
        dayName: dayName,
        isActive: false,
        type: ScheduleType.QUEUE,
      },
    });

    if (!barberSchedule) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Barber schedule not found for this day',
      );
    }
    // Parse openingTime and closingTime (e.g., "09:00 AM") into DateTime objects on the same date as the booking
    const openingDateTime = DateTime.fromFormat(
      `${date} ${barberSchedule.openingTime}`,
      'yyyy-MM-dd hh:mm a',
      { zone: 'local' },
    ).toUTC();
    const closingDateTime = DateTime.fromFormat(
      `${date} ${barberSchedule.closingTime}`,
      'yyyy-MM-dd hh:mm a',
      { zone: 'local' },
    ).toUTC();

    if (
      localDateTime < openingDateTime ||
      DateTime.fromJSDate(endDateTime) > closingDateTime
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Barber is not available during the requested time range',
      );
    }

    // Check if there is already a barberRealTimeStatus for this barber that overlaps with the requested time slot
    const overlappingStatus = await tx.barberRealTimeStatus.findFirst({
      where: {
        barberId,
        OR: [
          {
            startDateTime: {
              lt: endDateTime,
            },
            endDateTime: {
              gt: utcDateTime,
            },
          },
        ],
      },
    });

    if (overlappingStatus) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Barber already has a booking or is unavailable during the requested time slot',
      );
    }

    await tx.barberRealTimeStatus.create({
      data: {
        barberId,
        startDateTime: utcDateTime,
        endDateTime: endDateTime,
        isAvailable: false,
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
      },
    });

    return {
      booking,
      queue,
      queueSlot,
      totalPrice,
    };
  });

  return result;
};

const createQueueBookingForSalonOwnerIntoDb = async (
  saloonOwnerId: string,
  data: any,
) => {
  const { fullName, email, phone, date, services, notes, bookingType } = data;
  // appointmentAt may be omitted — we'll choose it based on barber free slots later.
  let appointmentAt: string | undefined = data.appointmentAt;

  // Helper: pick the earliest free slot start that can accommodate totalDuration (minutes).
  const pickEarliestSlotForBarber = (
    freeSlots: { start: string; end: string }[] | undefined,
    totalDurationMinutes: number,
  ): string | undefined => {
    if (!freeSlots || freeSlots.length === 0) return undefined;
    for (const slot of freeSlots) {
      const slotStart = DateTime.fromFormat(
        `${date} ${slot.start}`,
        'yyyy-MM-dd hh:mm a',
        { zone: 'local' },
      );
      const slotEnd = DateTime.fromFormat(
        `${date} ${slot.end}`,
        'yyyy-MM-dd hh:mm a',
        { zone: 'local' },
      );
      if (!slotStart.isValid || !slotEnd.isValid) continue;
      const slotMinutes = slotEnd.diff(slotStart, 'minutes').minutes;
      if (slotMinutes >= totalDurationMinutes) {
        return slotStart.toFormat('hh:mm a');
      }
    }
    // fallback to first slot start if none fit exactly
    const first = freeSlots[0];
    if (first) {
      const fallback = DateTime.fromFormat(
        `${date} ${first.start}`,
        'yyyy-MM-dd hh:mm a',
        { zone: 'local' },
      );
      return fallback.isValid ? fallback.toFormat('hh:mm a') : undefined;
    }
    return undefined;
  };

  // 1. Basic validation
  if (!fullName || !date || !Array.isArray(services) || services.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'fullName, date and services are required',
    );
  }

  // Only allow queue for the current local date
  const dateObj = DateTime.fromISO(date, { zone: 'local' });
  if (!dateObj.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
  }
  const todayLocal = DateTime.now().setZone('local').toISODate();
  if (dateObj.toISODate() !== todayLocal) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Queue bookings can only be created for the current date',
    );
  }

  // 2. Get service records & totals
  const serviceRecords = await prisma.service.findMany({
    where: { id: { in: services } },
    select: { id: true, price: true, duration: true },
  });
  if (serviceRecords.length !== services.length) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Some services not found');
  }
  const totalDuration = serviceRecords.reduce(
    (sum, s) => sum + (s.duration || 0),
    0,
  );
  if (totalDuration <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Total service duration must be greater than zero',
    );
  }
  const totalPrice = serviceRecords.reduce(
    (sum, s) => sum + Number(s.price),
    0,
  );

  // 3. Create non-registered user record (customer)
  const nonRegisteredUser = await prisma.nonRegisteredUser.create({
    data: {
      fullName,
      email: email ?? null,
      phone: phone ?? null,
      saloonOwnerId: saloonOwnerId,
    },
  });

  // 4. Find available barbers for walking-in (uses existing helper)
  // pass the newly created non-registered id as userId so queue/order info can include them
  const availableBarbers = await getAvailableBarbersForWalkingInFromDb1(
    nonRegisteredUser.id,
    saloonOwnerId,
    date,
    bookingType as ScheduleType,
  );

  if (
    !availableBarbers ||
    !Array.isArray(availableBarbers) ||
    availableBarbers.length === 0
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'No available barbers found for queue on this date',
    );
  }

  // 5. If appointmentAt not provided, choose barber/slot that can accommodate totalDuration earliest (prefers immediate free barbers)
  // Otherwise fall back to choosing by estimated wait time + totalInQueue as before.
  let chosen: any = null;
  let chosenAppointmentAt: string | undefined = appointmentAt;

  // Build a list sorted by estimated wait time and queue length as tie-breaker
  const sorted = availableBarbers.filter(Boolean).sort((a: any, b: any) => {
    const aw = a.queue?.estimatedWaitTime ?? 0;
    const bw = b.queue?.estimatedWaitTime ?? 0;
    if (aw !== bw) return aw - bw;
    const at = a.queue?.totalInQueue ?? 0;
    const bt = b.queue?.totalInQueue ?? 0;
    return at - bt;
  });

  if (!appointmentAt) {
    // For each barber, try to pick earliest free slot that can accommodate totalDuration
    const nowLocal = DateTime.now().setZone('local');

    type Candidate = {
      barber: any;
      slotStartStr?: string;
      slotStartDt?: DateTime;
    };

    const candidates: Candidate[] = [];

    for (const b of sorted) {
      // skip null/undefined entries (safety for TypeScript)
      if (!b) continue;
      // b.freeSlots should be provided by getAvailableBarbersForWalkingInFromDb1
      const slotStartStr = pickEarliestSlotForBarber(
        b.freeSlots,
        totalDuration,
      );
      if (!slotStartStr) continue;
      const slotDt = DateTime.fromFormat(
        `${date} ${slotStartStr}`,
        'yyyy-MM-dd hh:mm a',
        { zone: 'local' },
      );
      if (!slotDt.isValid) continue;
      // prefer slots that are not in the past (allow tiny tolerance)
      if (slotDt < nowLocal.minus({ minutes: 1 })) continue;
      candidates.push({ barber: b, slotStartStr, slotStartDt: slotDt });
    }

    if (candidates.length > 0) {
      // choose the candidate with the earliest slotStartDt
      candidates.sort((x, y) => {
        if (!x.slotStartDt || !y.slotStartDt) return 0;
        return x.slotStartDt.valueOf() - y.slotStartDt.valueOf();
      });
      chosen = candidates[0].barber;
      chosenAppointmentAt = candidates[0].slotStartStr;
    } else {
      // Try to find a barber in sorted list that has at least one free slot starting now or in future.
      const nowLocalForFallback = DateTime.now().setZone('local');
      let found = null as any | null;
      let pickedTime: string | undefined = undefined;

      for (const b of sorted) {
        if (!b || !b.freeSlots || b.freeSlots.length === 0) continue;
        // find first free slot start that's not in the past
        for (const slot of b.freeSlots) {
          const slotStart = DateTime.fromFormat(
            `${date} ${slot.start}`,
            'yyyy-MM-dd hh:mm a',
            { zone: 'local' },
          );
          if (!slotStart.isValid) continue;
          if (slotStart >= nowLocalForFallback.minus({ minutes: 1 })) {
            found = b;
            pickedTime = slotStart.toFormat('hh:mm a');
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        // No future slot across all sorted barbers — return explicit error so caller can react
        throw new AppError(
          httpStatus.NOT_FOUND,
          'No suitable future free slot found for any barber',
        );
      }

      chosen = found;
      chosenAppointmentAt = pickedTime;
    }
  } else {
    chosen = sorted[0];
    chosenAppointmentAt = appointmentAt;
  }

  if (!chosen) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Could not auto-select a barber',
    );
  }

  const barberId = chosen.barberId;

  // 6. Determine appointment time (use provided appointmentAt or auto-selected)
  const useAppointmentAt =
    chosenAppointmentAt ?? DateTime.now().setZone('local').toFormat('hh:mm a');

  const localDateTime = DateTime.fromFormat(
    `${date} ${useAppointmentAt}`,
    'yyyy-MM-dd hh:mm a',
    { zone: 'local' },
  );
  if (!localDateTime.isValid) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid appointment time format',
    );
  }
  // appointment can't be in the past (local)
  const nowLocal = DateTime.now().setZone('local');
  // allow the booking if the service would still be running now (i.e. end time is in the future)
  const endLocal = localDateTime.plus({ minutes: totalDuration });
  if (endLocal < nowLocal.minus({ minutes: 1 })) {
    // booking would have already finished — reject
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Appointment time cannot be in the past',
    );
  }
  const utcDateTime = localDateTime.toUTC().toJSDate();

  // 7. Transaction: create/update queue, create queueSlot, booking, bookedServices, barberRealTimeStatus
  const result = await prisma.$transaction(async tx => {
    // cleanup old inactive queues (keep behavior from existing code)
    await tx.queue.deleteMany({
      where: {
        barberId,
        saloonOwnerId,
        isActive: false,
        date: { lt: new Date() },
      },
    });

    // find or create today's queue for this barber
    const queueDate = new Date(date);
    let queue = await tx.queue.findFirst({
      where: {
        barberId,
        saloonOwnerId,
        date: queueDate,
      },
    });

    if (!queue) {
      queue = await tx.queue.create({
        data: {
          barberId,
          saloonOwnerId,
          date: queueDate,
          currentPosition: 1,
        },
      });
      if (!queue) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Error creating queue');
      }
    } else {
      queue = await tx.queue.update({
        where: { id: queue.id },
        data: { currentPosition: queue.currentPosition + 1 },
      });
      if (!queue) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Error updating queue');
      }
    }

    // get existing slots ordered by startedAt
    const existingSlots = await tx.queueSlot.findMany({
      where: { queueId: queue.id },
      orderBy: { startedAt: 'asc' },
    });

    // determine insert position based on startedAt ordering (insert by utcDateTime)
    let insertPosition = 1;
    for (let i = 0; i < existingSlots.length; i++) {
      const slot = existingSlots[i];
      if (slot && slot.startedAt && utcDateTime > slot.startedAt) {
        insertPosition = i + 2; // (1-based)
      } else {
        break;
      }
    }

    // Before shifting positions or creating a slot, ensure the barber is not already booked/unavailable
    const endDateTimeForCheck = DateTime.fromJSDate(utcDateTime)
      .plus({ minutes: totalDuration })
      .toJSDate();

    const overlappingStatus = await tx.barberRealTimeStatus.findFirst({
      where: {
        barberId,
        AND: [
          { startDateTime: { lt: endDateTimeForCheck } },
          { endDateTime: { gt: utcDateTime } },
        ],
      },
    });

    const overlappingBooking = await tx.booking.findFirst({
      where: {
        barberId,
        AND: [
          { startDateTime: { lt: endDateTimeForCheck } },
          { endDateTime: { gt: utcDateTime } },
        ],
      },
    });

    console.log('Overlapping status:', overlappingStatus);
    console.log('Overlapping booking:', overlappingBooking);

    if (overlappingStatus || overlappingBooking) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Barber is unavailable during the requested time slot',
      );
    }

    // shift following slots positions
    for (let i = existingSlots.length - 1; i >= insertPosition - 1; i--) {
      await tx.queueSlot.update({
        where: { id: existingSlots[i].id },
        data: { position: existingSlots[i].position + 1 },
      });
    }

    // create the new queue slot
    const queueSlot = await tx.queueSlot.create({
      data: {
        queueId: queue.id,
        customerId: nonRegisteredUser.id,
        barberId,
        position: insertPosition,
        startedAt: utcDateTime,
      },
    });
    if (!queueSlot) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Error creating queue slot');
    }

    // create booking for the non-registered customer
    const booking = await tx.booking.create({
      data: {
        userId: nonRegisteredUser.id,
        barberId,
        saloonOwnerId,
        appointmentAt: utcDateTime,
        date: new Date(date),
        notes: notes ?? null,
        bookingType: BookingType.QUEUE,
        isInQueue: true,
        totalPrice,
        startDateTime: utcDateTime,
        endDateTime: DateTime.fromJSDate(utcDateTime)
          .plus({ minutes: totalDuration })
          .toJSDate(),
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(utcDateTime)
          .plus({ minutes: totalDuration })
          .toFormat('hh:mm a'),
        loyaltySchemeId: null,
        loyaltyUsed: false,
      },
    });

    // attach bookingId and completedAt to the queue slot
    await tx.queueSlot.update({
      where: { id: queueSlot.id },
      data: {
        bookingId: booking.id,
        completedAt: DateTime.fromJSDate(utcDateTime)
          .plus({ minutes: totalDuration })
          .toJSDate(),
      },
    });

    // create booked services
    await Promise.all(
      serviceRecords.map(s =>
        tx.bookedServices.create({
          data: {
            bookingId: booking.id,
            customerId: nonRegisteredUser.id,
            serviceId: s.id,
            price: s.price,
          },
        }),
      ),
    );

    // create barber real time status to block this time
    const endDateTime = DateTime.fromJSDate(utcDateTime)
      .plus({ minutes: totalDuration })
      .toJSDate();

    await tx.barberRealTimeStatus.create({
      data: {
        barberId,
        startDateTime: utcDateTime,
        endDateTime,
        isAvailable: false,
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
      },
    });

    return {
      booking,
      queue,
      queueSlot: { ...queueSlot, bookingId: booking.id },
    };
  });

  return result;
};

const createBookingIntoDb = async (userId: string, data: any) => {
  const {
    barberId,
    saloonOwnerId,
    appointmentAt,
    date,
    services,
    notes,
    loyaltySchemeId,
  } = data;

  // 1. Validate saloon exists & verified
  const saloonStatus = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId, isVerified: true },
  });
  if (!saloonStatus) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Saloon not found or not verified',
    );
  }

  // 2. Validate date / time inputs
  const dateObj = DateTime.fromISO(date, { zone: 'local' });
  const today = DateTime.now().startOf('day');
  if (!dateObj.isValid || dateObj < today) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Date cannot be in the past');
  }

  const localDateTime = DateTime.fromFormat(
    `${date} ${appointmentAt}`,
    'yyyy-MM-dd hh:mm a',
    { zone: 'local' },
  );
  if (!localDateTime.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date or time format');
  }
  const utcDateTime = localDateTime.toUTC().toJSDate();

  // max 3 weeks ahead (business rule)
  const threeWeeksFromNow = DateTime.now().plus({ weeks: 4 });
  if (localDateTime > threeWeeksFromNow) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Booking cannot be made more than 3 weeks in advance',
    );
  }

  // 3. Fetch services and compute totals
  const serviceRecords = await prisma.service.findMany({
    where: { id: { in: services } },
    select: { id: true, price: true, duration: true },
  });
  if (serviceRecords.length !== services.length) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Some services not found');
  }
  const totalDuration = serviceRecords.reduce(
    (sum, s) => sum + (s.duration || 0),
    0,
  );
  if (totalDuration <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Total service duration must be greater than zero',
    );
  }
  let totalPrice = serviceRecords.reduce((sum, s) => sum + Number(s.price), 0);

  // 4. Run DB operations in a transaction (booking + booked services + real-time status + loyalty handling)
  const result = await prisma.$transaction(async tx => {
    // 4a. Check barber existence
    const barber = await tx.barber.findUnique({
      where: { userId: barberId },
      select: {
        id: true,
        user: {
          select: { id: true, fullName: true, image: true },
        },
      },
    });
    if (!barber) {
      throw new AppError(httpStatus.NOT_FOUND, 'Barber not found');
    }

    // 4b. Barber day off (holiday) check (we keep this)
    const barberHoliday = await tx.barberDayOff.findFirst({
      where: {
        barberId: barber.id,
        date: localDateTime.toJSDate(),
        saloonOwnerId: saloonOwnerId,
      },
    });
    if (barberHoliday) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Barber is on holiday');
    }

    // 4c. Prevent overlapping bookings using barberRealTimeStatus
    const bookingStart = utcDateTime;
    const bookingEnd = DateTime.fromJSDate(utcDateTime)
      .plus({ minutes: totalDuration })
      .toJSDate();

    const overlappingStatus = await tx.barberRealTimeStatus.findFirst({
      where: {
        barberId,
        AND: [
          { startDateTime: { lt: bookingEnd } },
          { endDateTime: { gt: bookingStart } },
        ],
      },
    });
    if (overlappingStatus) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Barber already has a booking or is unavailable during the requested time slot',
      );
    }

    // 4d. Loyalty handling (deduct points, compute discounted price) — do this BEFORE creating booking
    let loyaltyUsed = null;
    if (loyaltySchemeId) {
      const loyaltyScheme = await tx.loyaltyScheme.findUnique({
        where: { id: loyaltySchemeId, userId: saloonOwnerId },
      });
      if (!loyaltyScheme) {
        throw new AppError(httpStatus.NOT_FOUND, 'Loyalty scheme not found');
      }

      const customerLoyalty = await tx.customerLoyalty.findUnique({
        where: { userId },
        select: { id: true, totalPoints: true },
      });

      if (
        !customerLoyalty ||
        (customerLoyalty.totalPoints || 0) < loyaltyScheme.pointThreshold
      ) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Not enough loyalty points');
      }

      // Deduct points
      await tx.customerLoyalty.update({
        where: { userId },
        data: { totalPoints: { decrement: loyaltyScheme.pointThreshold } },
      });

      // Create redemption record
      loyaltyUsed = await tx.loyaltyRedemption.create({
        data: {
          customerId: userId,
          customerLoyaltyId: customerLoyalty.id,
          pointsUsed: loyaltyScheme.pointThreshold,
        },
      });

      // Apply discount
      totalPrice = totalPrice - totalPrice * (loyaltyScheme.percentage / 100);
      if (totalPrice < 0) totalPrice = 0;
    }

    // 4e. Create booking
    const booking = await tx.booking.create({
      data: {
        userId,
        barberId,
        saloonOwnerId,
        appointmentAt: utcDateTime,
        date: new Date(date),
        notes: notes ?? null,
        bookingType: BookingType.BOOKING,
        isInQueue: false,
        totalPrice: totalPrice,
        startDateTime: bookingStart,
        endDateTime: bookingEnd,
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(bookingEnd).toFormat('hh:mm a'),
        loyaltySchemeId: loyaltySchemeId ?? null,
        loyaltyUsed: !!loyaltyUsed,
      },
    });

    // 4f. Attach loyalty redemptions to booking if any
    if (loyaltyUsed) {
      await tx.loyaltyRedemption.update({
        where: { id: loyaltyUsed.id },
        data: { bookingId: booking.id },
      });
    }

    // 4g. Create booked services
    await Promise.all(
      serviceRecords.map(s =>
        tx.bookedServices.create({
          data: {
            bookingId: booking.id,
            customerId: userId,
            serviceId: s.id,
            price: s.price,
          },
        }),
      ),
    );

    // 4h. Block time in barberRealTimeStatus (so others cannot double-book)
    await tx.barberRealTimeStatus.create({
      data: {
        barberId,
        startDateTime: bookingStart,
        endDateTime: bookingEnd,
        isAvailable: false,
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(bookingEnd).toFormat('hh:mm a'),
      },
    });

    // Return the booking + price to caller
    return {
      booking,
      totalPrice,
    };
  });

  return result;
};

const getBookingListFromDb = async (userId: string) => {
  const result = await prisma.booking.findMany({
    where: {
      userId: userId,
    },
    select: {
      id: true,
      userId: true,
      barberId: true,
      saloonOwnerId: true,
      date: true,
      notes: true,
      isInQueue: true,
      totalPrice: true,
      startTime: true,
      endTime: true,
      status: true,
      queueSlot: {
        select: {
          id: true,
          queueId: true,
          customerId: true,
          barberId: true,
          position: true,
          startedAt: true,
          bookingId: true,
          barberStatus: {
            select: {
              id: true,
              barberId: true,
              isAvailable: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      },
      BookedServices: {
        select: {
          id: true,
          serviceId: true,
          customerId: true,
          price: true,
          service: {
            select: {
              id: true,
              serviceName: true,
              price: true,
              duration: true,
            },
          },
        },
      },
      barber: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              image: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
  });
  if (result.length === 0) {
    return [];
  }
  // Flatten the result to include barber and booked services details at the top level
  return result.map(booking => {
    // Calculate estimatedWaitTime as the difference in minutes between startTime and now
    let estimatedWaitTime: number | null = null;
    if (booking.startTime) {
      // booking.date is a Date object, booking.startTime is a string like "11:00 AM"
      const startDateTime = DateTime.fromFormat(
        `${DateTime.fromJSDate(booking.date).toFormat('yyyy-MM-dd')} ${booking.startTime}`,
        'yyyy-MM-dd hh:mm a',
      );
      if (startDateTime.isValid) {
        estimatedWaitTime = Math.max(
          0,
          Math.round(startDateTime.diffNow('minutes').minutes),
        );
      }
    }

    return {
      bookingId: booking.id,
      customerId: booking.userId,
      barberId: booking.barberId,
      saloonOwnerId: booking.saloonOwnerId,
      totalPrice: booking.totalPrice,
      notes: booking.notes,
      customerName: booking.user?.fullName || null,
      customerEmail: booking.user?.email || null,
      customerContact: booking.user?.phoneNumber || null,
      date: booking.date,
      time: booking.startTime,
      estimatedWaitTime,
      position: booking.queueSlot[0]?.position || null,
      serviceNames:
        booking.BookedServices?.map(bs => bs.service?.serviceName) || [],
      barberName: booking.barber?.user?.fullName || null,
      status: booking.status || null,
    };
  });
};

const getBookingByIdFromDb = async (userId: string, bookingId: string) => {
  const result = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      userId: userId,
    },
    select: {
      id: true,
      userId: true,
      barberId: true,
      saloonOwnerId: true,
      date: true,
      notes: true,
      isInQueue: true,
      totalPrice: true,
      startTime: true,
      endTime: true,
      status: true,
      queueSlot: {
        select: {
          id: true,
          queueId: true,
          customerId: true,
          barberId: true,
          position: true,
          startedAt: true,
          bookingId: true,
          barberStatus: {
            select: {
              id: true,
              barberId: true,
              isAvailable: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      },
      BookedServices: {
        select: {
          id: true,
          serviceId: true,
          customerId: true,
          price: true,
          service: {
            select: {
              id: true,
              serviceName: true,
              price: true,
              duration: true,
            },
          },
        },
      },
      barber: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              image: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
  });
  if (!result) {
    return {
      message: 'Booking not found or you do not have permission to view it',
    };
  }
  return {
    bookingId: result.id,
    customerId: result.userId,
    barberId: result.barberId,
    saloonOwnerId: result.saloonOwnerId,
    totalPrice: result.totalPrice,
    notes: result.notes,
    customerName: result.user?.fullName || null,
    customerEmail: result.user?.email || null,
    customerContact: result.user?.phoneNumber || null,
    date: result.date,
    time: result.startTime,
    position: result.queueSlot[0]?.position || null,
    serviceNames:
      result.BookedServices?.map(bs => bs.service?.serviceName) || [],
    barberName: result.barber?.user?.fullName || null,
    status: result.status || null,
  };
};

const getAllBarbersForQueueFromDb = async (
  userId: string,
  saloonOwnerId: string,
  type: ScheduleType,
  specificDate?: string,
  role?: string,
) => {
  let date;
  if (specificDate) {
    date = DateTime.fromISO(specificDate!, { zone: 'local' }).startOf('day');
  } else {
    date = DateTime.now().startOf('day');
  }

  // Check if salon is closed
  const salon = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId },
    select: { userId: true, isQueueEnabled: true, shopLogo: true },
  });
  if (!salon) throw new AppError(httpStatus.NOT_FOUND, 'Salon not found');

  if (
    role === UserRoleEnum.CUSTOMER &&
    salon.isQueueEnabled === false &&
    type === ScheduleType.QUEUE
  ) {
    return { message: 'Queue system is not enabled for this salon' };
  }

  // Convert the local calendar date to a UTC-midnight Date so it matches DB entries stored at 00:00 UTC
  // const holidayDateUtc = DateTime.fromObject(
  //   { year: date.year, month: date.month, day: date.day },
  //   { zone: 'utc' },
  // ).toJSDate();

  // const holiday = await prisma.saloonHoliday.findFirst({
  //   where: { userId: salon.userId, date: holidayDateUtc },
  // });
  // if (holiday) return { message: 'Salon is closed on this date' };

  let barbers = await prisma.barber.findMany({
    where: { saloonOwnerId: saloonOwnerId },
    include: {
      user: { select: { id: true, fullName: true, image: true, status: true } },
    },
  });

  // Only barbers with schedules
  const barberIdsWithSchedule = await prisma.barberSchedule.findMany({
    where: {
      barber: { saloonOwnerId: saloonOwnerId },
      type:
        type === ScheduleType.QUEUE ? ScheduleType.QUEUE : ScheduleType.BOOKING,
    },
    select: { barberId: true },
    distinct: ['barberId'],
  });
  const barberIdsSet = new Set(barberIdsWithSchedule.map(b => b.barberId));
  const filteredBarbers = barbers.filter(b => barberIdsSet.has(b.userId));
  if (filteredBarbers.length === 0) {
    return { message: 'No barbers with schedules found for this salon' };
  }
  barbers = filteredBarbers;

  const results = await Promise.all(
    barbers.map(async barber => {
      // Skip if day off
      const dayOff = await prisma.barberDayOff.findFirst({
        where: { barberId: barber.userId, date: date.toUTC().toJSDate() },
      });
      if (dayOff) return null;

      // Get schedule
      const schedule = await prisma.barberSchedule.findFirst({
        where: {
          barberId: barber.userId,
          dayName: date.toFormat('cccc').toLowerCase(),
        },
      });

      if (!schedule) return null;

      // find bookings only if type is QUEUE
      let totalQueueLength = 0;
      if (type === ScheduleType.QUEUE) {
        // Get bookings (fixed status filter -> use 'in' array)
        const bookings = await prisma.booking.findMany({
          where: {
            barberId: barber.userId,
            bookingType: BookingType.QUEUE,
            status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
            startDateTime: {
              gte: date.startOf('day').toJSDate(),
            },
            endDateTime: {
              lte: date.endOf('day').toJSDate(),
            },
          },
          orderBy: { startDateTime: 'asc' },
        });
        totalQueueLength = bookings.length;
      }

      return {
        barberId: barber.user.id,
        name: barber.user.fullName,
        image: barber.user.image,
        status: barber.user.status,
        totalQueueLength: totalQueueLength || 0,
        schedule: {
          start: schedule.openingTime,
          end: schedule.closingTime,
        },
      };
    }),
  );

  return {
    isQueueEnabled: salon.isQueueEnabled,
    shopLogo: salon.shopLogo || null,
    barbers: results.filter(r => r !== null),
  };
};

const getAvailableBarbersForWalkingInFromDb = async (
  userId: string,
  saloonOwnerId: string,
  specificDate?: string,
) => {
  // Always use today's date or provided specificDate (local)
  let date;
  if (specificDate) {
    date = DateTime.fromISO(specificDate!, { zone: 'local' }).startOf('day');
  } else {
    date = DateTime.now().startOf('day');
  }
  // Use the local-day JS Date bounds (do not force to UTC here) so queries match local-day expectations
  const startOfDay = date.toJSDate();
  const endOfDay = date.endOf('day').toJSDate();

  // Check if salon is closed
  const salon = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId },
    select: {
      userId: true,
      isQueueEnabled: true,
      shopLogo: true,
      user: {
        select: {
          Queue: { select: { id: true } },
        },
      },
    },
  });
  if (!salon) throw new AppError(httpStatus.NOT_FOUND, 'Salon not found');

  let barbers = await prisma.barber.findMany({
    where: { saloonOwnerId: saloonOwnerId },
    include: {
      user: { select: { id: true, fullName: true, image: true, status: true } },
      Queue: { select: { id: true } },
    },
  });

  // Only barbers with schedules
  const barberIdsWithSchedule = await prisma.barberSchedule.findMany({
    where: { barber: { saloonOwnerId: saloonOwnerId } },
    select: { barberId: true },
    distinct: ['barberId'],
  });
  const barberIdsSet = new Set(barberIdsWithSchedule.map(b => b.barberId));
  const filteredBarbers = barbers.filter(b => barberIdsSet.has(b.userId));
  if (filteredBarbers.length === 0) {
    return { message: 'No barbers with schedules found for this salon' };
  }
  barbers = filteredBarbers;

  const results = await Promise.all(
    barbers.map(async barber => {
      // Skip if day off
      const dayOff = await prisma.barberDayOff.findFirst({
        where: { barberId: barber.userId, date: date.toJSDate() },
      });
      if (dayOff) return null;

      // Get schedule
      const schedule = await prisma.barberSchedule.findFirst({
        where: {
          barberId: barber.userId,
          dayName: date.toFormat('cccc').toLowerCase(),
        },
      });

      // Get bookings (fixed status filter -> use 'in' array)
      let bookings = await prisma.booking.findMany({
        where: {
          barberId: barber.userId,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          startDateTime: { gte: startOfDay },
          endDateTime: { lte: endOfDay },
        },
        include: {
          BookedServices: {
            select: {
              id: true,
              service: {
                select: { id: true, serviceName: true, duration: true },
              },
            },
          },
          // NOTE: do not include the `user` relation here because some DB rows may have inconsistent/null relation data
          // which causes Prisma to throw "Field user is required to return data, got `null` instead."
        },
        orderBy: { startDateTime: 'asc' },
      });

      // Estimate wait time = sum of current bookings lengths (use local zone consistently)
      const estimatedWaitTime = bookings.reduce((sum, b) => {
        const start = DateTime.fromJSDate(b.startDateTime!).setZone('local');
        const end = DateTime.fromJSDate(b.endDateTime!).setZone('local');
        return sum + end.diff(start, 'minutes').minutes;
      }, 0);

      // Default queue info (always return an object)
      let queueInfo: {
        queueId?: string | null;
        currentPosition?: number | null;
        totalInQueue: number;
        estimatedWaitTime: number;
        queueOrder: number | null;
      } = {
        queueId: null,
        currentPosition: null,
        totalInQueue: 0,
        estimatedWaitTime: 0,
        queueOrder: null,
      };

      const currentDate = new Date();
      currentDate.setUTCHours(0, 0, 0, 0);

      if (salon.isQueueEnabled) {
        const queue = await prisma.queue.findFirst({
          where: {
            barberId: barber.userId,
            saloonOwnerId: saloonOwnerId,
            date: currentDate,
          },
          select: {
            id: true,
            currentPosition: true,
          },
        });

        if (queue) {
          // Fetch slots separately to ensure ordering and presence
          const slots = await prisma.queueSlot.findMany({
            where: { queueId: queue.id },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              customerId: true,
              position: true,
              startedAt: true,
              bookingId: true,
            },
          });

          const mySlotIndex = slots.findIndex(
            slot => slot.customerId === userId,
          );
          // Positions are 1-based; set queueOrder accordingly
          const queueOrder = mySlotIndex >= 0 ? mySlotIndex + 1 : null;

          queueInfo = {
            queueId: queue.id,
            currentPosition: queue.currentPosition ?? null,
            totalInQueue: slots.length,
            estimatedWaitTime,
            queueOrder,
          };
        } else {
          // keep default queueInfo but include estimated wait
          queueInfo.estimatedWaitTime = estimatedWaitTime;
        }
      } else {
        // if queue not enabled, still provide estimatedWaitTime
        queueInfo.estimatedWaitTime = estimatedWaitTime;
      }

      // Calculate free slots based on schedule and bookings
      let freeSlots: { start: string; end: string }[] = [];
      if (schedule) {
        // Opening and closing times as DateTime in local zone
        const opening = DateTime.fromFormat(
          `${date.toFormat('yyyy-MM-dd')} ${schedule.openingTime}`,
          'yyyy-MM-dd hh:mm a',
          { zone: 'local' },
        );
        const closing = DateTime.fromFormat(
          `${date.toFormat('yyyy-MM-dd')} ${schedule.closingTime}`,
          'yyyy-MM-dd hh:mm a',
          { zone: 'local' },
        );

        // Build an array of busy intervals (sorted) — convert and clamp to [opening, closing]
        const busyIntervals = bookings
          .map(b => {
            // Prefer stored startTime/endTime (local strings) when available because they reflect local schedule
            let s: DateTime;
            let e: DateTime;

            if (b.startTime) {
              s = DateTime.fromFormat(
                `${date.toFormat('yyyy-MM-dd')} ${b.startTime}`,
                'yyyy-MM-dd hh:mm a',
                { zone: 'local' },
              );
            } else {
              s = DateTime.fromJSDate(b.startDateTime!).setZone('local');
            }

            if (b.endTime) {
              e = DateTime.fromFormat(
                `${date.toFormat('yyyy-MM-dd')} ${b.endTime}`,
                'yyyy-MM-dd hh:mm a',
                { zone: 'local' },
              );
            } else if (b.endDateTime) {
              e = DateTime.fromJSDate(b.endDateTime!).setZone('local');
            } else {
              // fallback: compute end using services duration sum
              const totalTime = b.BookedServices.reduce(
                (sum, bs) => sum + (bs.service?.duration || 0),
                0,
              );
              e = s.plus({ minutes: totalTime });
            }

            // If parsing failed, skip this booking
            if (!s.isValid || !e.isValid) return null;

            // clamp to opening/closing so any booking that spills outside working hours doesn't expand freeSlots beyond closing
            const startClamped = s < opening ? opening : s;
            const endClamped = e > closing ? closing : e;
            return { start: startClamped, end: endClamped };
          })
          .filter(
            (interval): interval is { start: DateTime; end: DateTime } =>
              !!interval && interval.end > interval.start,
          )
          .sort((a, b) => a.start.toMillis() - b.start.toMillis());

        // If no busy intervals, entire working window is free
        if (busyIntervals.length === 0) {
          // Only provide free slot if opening < closing
          if (opening < closing) {
            freeSlots.push({
              start: opening.toFormat('hh:mm a'),
              end: closing.toFormat('hh:mm a'),
            });
          }
        } else {
          // Merge overlapping busy intervals first
          const merged: { start: DateTime; end: DateTime }[] = [];
          for (const iv of busyIntervals) {
            if (merged.length === 0) {
              merged.push({ start: iv.start, end: iv.end });
            } else {
              const last = merged[merged.length - 1];
              if (iv.start <= last.end) {
                // overlap or contiguous -> extend end if needed
                last.end = iv.end > last.end ? iv.end : last.end;
              } else {
                merged.push({ start: iv.start, end: iv.end });
              }
            }
          }

          // Generate free slots between opening and closing using merged busy intervals
          let cursor = opening;
          for (const iv of merged) {
            if (iv.start > cursor) {
              freeSlots.push({
                start: cursor.toFormat('hh:mm a'),
                end: iv.start.toFormat('hh:mm a'),
              });
            }
            // move cursor forward
            if (iv.end > cursor) cursor = iv.end;
          }
          // After last busy interval until closing
          if (cursor < closing) {
            freeSlots.push({
              start: cursor.toFormat('hh:mm a'),
              end: closing.toFormat('hh:mm a'),
            });
          }
        }
      }

      return {
        shopLogo: salon.shopLogo || null,
        barberId: barber.userId,
        barberBookingType: schedule?.type || null,
        image: barber.user.image,
        name: barber.user.fullName,
        status: barber.user.status,
        schedule: schedule
          ? { start: schedule.openingTime, end: schedule.closingTime }
          : null,
        bookings: bookings.map(b => ({
          customerName: (b as any).user?.fullName || null,
          customerImage: (b as any).user?.image || null,
          // Prefer the stored startTime/endTime strings (they reflect the intended local times);
          // fall back to formatting the Date if the string is not present.
          startTime:
            b.startTime ??
            DateTime.fromJSDate(b.startDateTime!)
              .setZone('local')
              .toFormat('hh:mm a'),
          endTime:
            b.endTime ??
            DateTime.fromJSDate(b.endDateTime!)
              .setZone('local')
              .toFormat('hh:mm a'),
          services: b.BookedServices.map(bs => bs.service?.serviceName),
          totalTime: b.BookedServices.reduce(
            (sum, bs) => sum + (bs.service?.duration || 0),
            0,
          ),
        })),
        freeSlots,
        queue: queueInfo,
      };
    }),
  );

  return results.filter(Boolean);
};
const getAvailableBarbersForWalkingInFromDb1 = async (
  userId: string,
  saloonOwnerId: string,
  specificDate?: string,
  type?: ScheduleType,
) => {
  // Always use today's date or provided specificDate (local)
  let date;
  if (specificDate) {
    date = DateTime.fromISO(specificDate!, { zone: 'local' }).startOf('day');
  } else {
    date = DateTime.now().startOf('day');
  }
  // Use the local-day JS Date bounds (do not force to UTC here) so queries match local-day expectations
  const startOfDay = date.toJSDate();
  const endOfDay = date.endOf('day').toJSDate();

  // Check if salon is closed
  const salon = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId },
    select: {
      userId: true,
      isQueueEnabled: true,
      shopLogo: true,
      user: {
        select: {
          Queue: { select: { id: true } },
        },
      },
    },
  });
  if (!salon) throw new AppError(httpStatus.NOT_FOUND, 'Salon not found');

  let barbers = await prisma.barber.findMany({
    where: { saloonOwnerId: saloonOwnerId },
    include: {
      user: { select: { id: true, fullName: true, image: true, status: true } },
      Queue: { select: { id: true } },
    },
  });

  // Only barbers with schedules
  const barberIdsWithSchedule = await prisma.barberSchedule.findMany({
    where: {
      barber: { saloonOwnerId: saloonOwnerId },
      type: type ? type : undefined,
    },
    select: { barberId: true },
    distinct: ['barberId'],
  });
  const barberIdsSet = new Set(barberIdsWithSchedule.map(b => b.barberId));
  const filteredBarbers = barbers.filter(b => barberIdsSet.has(b.userId));
  if (filteredBarbers.length === 0) {
    return { message: 'No barbers with schedules found for this salon' };
  }
  barbers = filteredBarbers;

  const results = await Promise.all(
    barbers.map(async barber => {
      // Skip if day off
      const dayOff = await prisma.barberDayOff.findFirst({
        where: { barberId: barber.userId, date: date.toJSDate() },
      });
      if (dayOff) return null;

      // Get schedule
      const schedule = await prisma.barberSchedule.findFirst({
        where: {
          barberId: barber.userId,
          dayName: date.toFormat('cccc').toLowerCase(),
        },
      });

      // find the non registered users bookings only if type is QUEUE
      const findUser = await prisma.nonRegisteredUser.findMany({
        where: { saloonOwnerId: userId },
      });
      if (!findUser) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
      }

      // Get bookings (fixed status filter -> use 'in' array)
      let bookings = await prisma.booking.findMany({
        where: {
          barberId: barber.userId,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          startDateTime: { gte: startOfDay },
          endDateTime: { lte: endOfDay },
        },
        include: {
          BookedServices: {
            select: {
              id: true,
              service: {
                select: { id: true, serviceName: true, duration: true },
              },
            },
          },
        },
        orderBy: { startDateTime: 'asc' },
      });
      // Ensure each booking has a predictable `user` object.
      // Query both registered and non-registered users referenced by bookings and attach them.
      const bookingUserIds = Array.from(
        new Set(bookings.map(b => b.userId).filter(Boolean)),
      );

      const registeredUsersMap: Record<string, any> = {};
      if (bookingUserIds.length > 0) {
        const registeredUsers = await prisma.user.findMany({
          where: { id: { in: bookingUserIds } },
          select: { id: true, fullName: true, image: true },
        });
        for (const u of registeredUsers) {
          registeredUsersMap[u.id] = u;
        }
      }

      const nonRegisteredUsersMap: Record<string, any> = {};
      const nonRegIds = bookingUserIds.filter(id => !registeredUsersMap[id]);
      if (nonRegIds.length > 0) {
        const nonRegisteredUsers = await prisma.nonRegisteredUser.findMany({
          where: { id: { in: nonRegIds } },
          select: { id: true, fullName: true, email: true },
        });
        for (const nr of nonRegisteredUsers) {
          nonRegisteredUsersMap[nr.id] = nr;
        }
      }

      bookings = bookings.map(b => {
        const uid = b.userId as string | null;
        const userObj = (uid && registeredUsersMap[uid]) ||
          (uid && nonRegisteredUsersMap[uid]) || {
            id: null,
            fullName: null,
            image: null,
          };
        return { ...b, user: userObj };
      });
      bookings = bookings.map(b => ({
        ...b,
        user: (b as any).user ?? { id: null, fullName: null, image: null },
      }));

      // Estimate wait time = sum of current bookings lengths (use local zone consistently)
      const estimatedWaitTime = bookings.reduce((sum, b) => {
        const start = DateTime.fromJSDate(b.startDateTime!).setZone('local');
        const end = DateTime.fromJSDate(b.endDateTime!).setZone('local');
        return sum + end.diff(start, 'minutes').minutes;
      }, 0);

      // Default queue info (always return an object)
      let queueInfo: {
        queueId?: string | null;
        currentPosition?: number | null;
        totalInQueue: number;
        estimatedWaitTime: number;
        queueOrder: number | null;
      } = {
        queueId: null,
        currentPosition: null,
        totalInQueue: 0,
        estimatedWaitTime: 0,
        queueOrder: null,
      };

      const currentDate = new Date();
      currentDate.setUTCHours(0, 0, 0, 0);

      if (salon.isQueueEnabled) {
        const queue = await prisma.queue.findFirst({
          where: {
            barberId: barber.userId,
            saloonOwnerId: saloonOwnerId,
            date: currentDate,
          },
          select: {
            id: true,
            currentPosition: true,
          },
        });

        if (queue) {
          // Fetch slots separately to ensure ordering and presence
          const slots = await prisma.queueSlot.findMany({
            where: { queueId: queue.id },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              customerId: true,
              position: true,
              startedAt: true,
              bookingId: true,
            },
          });

          const mySlotIndex = slots.findIndex(
            slot => slot.customerId === userId,
          );
          // Positions are 1-based; set queueOrder accordingly
          const queueOrder = mySlotIndex >= 0 ? mySlotIndex + 1 : null;

          queueInfo = {
            queueId: queue.id,
            currentPosition: queue.currentPosition ?? null,
            totalInQueue: slots.length,
            estimatedWaitTime,
            queueOrder,
          };
        } else {
          // keep default queueInfo but include estimated wait
          queueInfo.estimatedWaitTime = estimatedWaitTime;
        }
      } else {
        // if queue not enabled, still provide estimatedWaitTime
        queueInfo.estimatedWaitTime = estimatedWaitTime;
      }

      // Calculate free slots based on schedule and bookings
      let freeSlots: { start: string; end: string }[] = [];
      if (schedule) {
        // Opening and closing times as DateTime in local zone
        const opening = DateTime.fromFormat(
          `${date.toFormat('yyyy-MM-dd')} ${schedule.openingTime}`,
          'yyyy-MM-dd hh:mm a',
          { zone: 'local' },
        );
        const closing = DateTime.fromFormat(
          `${date.toFormat('yyyy-MM-dd')} ${schedule.closingTime}`,
          'yyyy-MM-dd hh:mm a',
          { zone: 'local' },
        );

        // Build an array of busy intervals (sorted) — convert and clamp to [opening, closing]
        const busyIntervals = bookings
          .map(b => {
            // Prefer stored startTime/endTime (local strings) when available because they reflect local schedule
            let s: DateTime;
            let e: DateTime;

            if (b.startTime) {
              s = DateTime.fromFormat(
                `${date.toFormat('yyyy-MM-dd')} ${b.startTime}`,
                'yyyy-MM-dd hh:mm a',
                { zone: 'local' },
              );
            } else {
              s = DateTime.fromJSDate(b.startDateTime!).setZone('local');
            }

            if (b.endTime) {
              e = DateTime.fromFormat(
                `${date.toFormat('yyyy-MM-dd')} ${b.endTime}`,
                'yyyy-MM-dd hh:mm a',
                { zone: 'local' },
              );
            } else if (b.endDateTime) {
              e = DateTime.fromJSDate(b.endDateTime!).setZone('local');
            } else {
              // fallback: compute end using services duration sum
              const totalTime = b.BookedServices.reduce(
                (sum, bs) => sum + (bs.service?.duration || 0),
                0,
              );
              e = s.plus({ minutes: totalTime });
            }

            // If parsing failed, skip this booking
            if (!s.isValid || !e.isValid) return null;

            // clamp to opening/closing so any booking that spills outside working hours doesn't expand freeSlots beyond closing
            const startClamped = s < opening ? opening : s;
            const endClamped = e > closing ? closing : e;
            return { start: startClamped, end: endClamped };
          })
          .filter(
            (interval): interval is { start: DateTime; end: DateTime } =>
              !!interval && interval.end > interval.start,
          )
          .sort((a, b) => a.start.toMillis() - b.start.toMillis());

        // If no busy intervals, entire working window is free
        if (busyIntervals.length === 0) {
          // Only provide free slot if opening < closing
          if (opening < closing) {
            freeSlots.push({
              start: opening.toFormat('hh:mm a'),
              end: closing.toFormat('hh:mm a'),
            });
          }
        } else {
          // Merge overlapping busy intervals first
          const merged: { start: DateTime; end: DateTime }[] = [];
          for (const iv of busyIntervals) {
            if (merged.length === 0) {
              merged.push({ start: iv.start, end: iv.end });
            } else {
              const last = merged[merged.length - 1];
              if (iv.start <= last.end) {
                // overlap or contiguous -> extend end if needed
                last.end = iv.end > last.end ? iv.end : last.end;
              } else {
                merged.push({ start: iv.start, end: iv.end });
              }
            }
          }

          // Generate free slots between opening and closing using merged busy intervals
          let cursor = opening;
          for (const iv of merged) {
            if (iv.start > cursor) {
              freeSlots.push({
                start: cursor.toFormat('hh:mm a'),
                end: iv.start.toFormat('hh:mm a'),
              });
            }
            // move cursor forward
            if (iv.end > cursor) cursor = iv.end;
          }
          // After last busy interval until closing
          if (cursor < closing) {
            freeSlots.push({
              start: cursor.toFormat('hh:mm a'),
              end: closing.toFormat('hh:mm a'),
            });
          }
        }
      }

      return {
        shopLogo: salon.shopLogo || null,
        barberId: barber.userId,
        barberBookingType: schedule?.type || null,
        image: barber.user.image,
        name: barber.user.fullName,
        status: barber.user.status,
        schedule: schedule
          ? { start: schedule.openingTime, end: schedule.closingTime }
          : null,
        bookings: bookings.map(b => ({
          customerName: (b as any).user?.fullName || null,
          customerImage: (b as any).user?.image || null,
          // Prefer the stored startTime/endTime strings (they reflect the intended local times);
          // fall back to formatting the Date if the string is not present.
          startTime:
            b.startTime ??
            DateTime.fromJSDate(b.startDateTime!)
              .setZone('local')
              .toFormat('hh:mm a'),
          endTime:
            b.endTime ??
            DateTime.fromJSDate(b.endDateTime!)
              .setZone('local')
              .toFormat('hh:mm a'),
          services: b.BookedServices.map(bs => bs.service?.serviceName),
          totalTime: b.BookedServices.reduce(
            (sum, bs) => sum + (bs.service?.duration || 0),
            0,
          ),
        })),
        freeSlots,
        queue: queueInfo,
      };
    }),
  );

  return results.filter(Boolean);
};

const getAvailableABarberForWalkingInFromDb = async (
  userId: string,
  saloonOwnerId: string,
  barberId: string,
  date?: string,
  role?: UserRoleEnum,
) => {
  let allBarbers;
  if ((role === UserRoleEnum.SALOON_OWNER, UserRoleEnum.BARBER)) {
    allBarbers = await getAvailableBarbersForWalkingInFromDb1(
      userId,
      saloonOwnerId,
      date,
    );
  }
  if (role === UserRoleEnum.CUSTOMER) {
    allBarbers = await getAvailableBarbersForWalkingInFromDb(
      userId,
      saloonOwnerId,
      date,
    );
  }

  if (allBarbers && Array.isArray(allBarbers)) {
    const barber = allBarbers.find(b => b && b.barberId === barberId);
    if (!barber) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Barber not found or unavailable',
      );
    }
    return barber;
  }
  return { message: 'No barbers available' };
};

const getAvailableBarbersFromDb = async (
  userId: string,
  data: {
    saloonOwnerId: string;
    utcDateTime: string; // ISO string
    totalServiceTime: number;
    type?: BookingType;
  },
) => {
  if (data.type === BookingType.QUEUE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Use the queue-specific query to get available barbers for queue bookings',
    );
  }

  const requestedUtc = DateTime.fromISO(data.utcDateTime, { zone: 'utc' });
  if (!requestedUtc.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid datetime');
  }

  // must be in the future
  if (requestedUtc.toJSDate() <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Date and time must be in the future',
    );
  }

  // must be within next 3 weeks
  const threeWeeksFromNow = DateTime.now().plus({ weeks: 4 });
  if (requestedUtc > threeWeeksFromNow) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Date cannot be more than 3 weeks in the future',
    );
  }

  const requestedLocal = requestedUtc.setZone('local');
  const requestedEndLocal = requestedLocal.plus({
    minutes: data.totalServiceTime,
  });
  const requestedEndUtc = requestedUtc.plus({ minutes: data.totalServiceTime });

  // 1. Check salon & holiday using local-day
  const salon = await prisma.saloonOwner.findUnique({
    where: { userId: data.saloonOwnerId },
    select: { userId: true },
  });
  if (!salon || !salon.userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Salon not found for user');
  }

  const salonHoliday = await prisma.saloonHoliday.findFirst({
    where: {
      userId: salon.userId,
      date: DateTime.fromObject(
        {
          year: requestedLocal.year,
          month: requestedLocal.month,
          day: requestedLocal.day,
        },
        { zone: 'local' },
      ).toJSDate(),
    },
  });
  if (salonHoliday) {
    return { message: 'Salon is closed on this date' };
  }

  // 2. Get barbers for salon and only those with a schedule for BOOKING (or provided type)
  let barbers = await prisma.barber.findMany({
    where: { saloonOwnerId: data.saloonOwnerId },
    include: {
      user: { select: { id: true, fullName: true, status: true } },
    },
  });

  const scheduleType = data.type || BookingType.BOOKING;
  const barberIdsWithSchedule = await prisma.barberSchedule.findMany({
    where: {
      barber: { saloonOwnerId: data.saloonOwnerId },
      type: scheduleType,
    },
    select: { barberId: true },
    distinct: ['barberId'],
  });
  const barberIdsSet = new Set(barberIdsWithSchedule.map(b => b.barberId));
  const filteredBarbers = barbers.filter(b => barberIdsSet.has(b.userId));
  if (filteredBarbers.length === 0) {
    return { message: 'No barbers with schedules found for this salon' };
  }
  barbers = filteredBarbers;

  // 3. Parallel per-barber checks
  const availableBarbers = await Promise.all(
    barbers.map(async barber => {
      // 3a. Day off (local-day)
      const dayOff = await prisma.barberDayOff.findFirst({
        where: {
          saloonOwnerId: data.saloonOwnerId,
          barberId: barber.userId,
          date: DateTime.fromObject(
            {
              year: requestedLocal.year,
              month: requestedLocal.month,
              day: requestedLocal.day,
            },
            { zone: 'local' },
          ).toJSDate(),
        },
      });
      if (dayOff) return null;

      // 3b. Fetch schedule for local day
      const dayName = requestedLocal.toFormat('cccc').toLowerCase();
      const schedule = await prisma.barberSchedule.findFirst({
        where: {
          barberId: barber.userId,
          dayName,
          type: scheduleType,
          isActive: true,
        },
      });
      if (!schedule) return null;

      // Parse opening/closing as local DateTimes on requestedLocal date
      const openingLocal = DateTime.fromFormat(
        `${requestedLocal.toFormat('yyyy-MM-dd')} ${schedule.openingTime}`,
        'yyyy-MM-dd hh:mm a',
        { zone: 'local' },
      );
      const closingLocal = DateTime.fromFormat(
        `${requestedLocal.toFormat('yyyy-MM-dd')} ${schedule.closingTime}`,
        'yyyy-MM-dd hh:mm a',
        { zone: 'local' },
      );
      if (
        !openingLocal.isValid ||
        !closingLocal.isValid ||
        openingLocal >= closingLocal
      ) {
        return null;
      }

      // 3c. Ensure requestedLocal start/end fit into working window
      // If requested start is before opening OR requested end is after closing -> skip
      if (requestedLocal < openingLocal || requestedEndLocal > closingLocal) {
        return null;
      }

      // 3d. Check overlapping real-time statuses using UTC interval
      const overlappingStatuses = await prisma.barberRealTimeStatus.findFirst({
        where: {
          barberId: barber.userId,
          AND: [
            { startDateTime: { lt: requestedEndUtc.toJSDate() } },
            { endDateTime: { gt: requestedUtc.toJSDate() } },
          ],
        },
      });
      if (overlappingStatuses) return null;

      // 3e. Check overlapping bookings using UTC interval
      const overlappingBooking = await prisma.booking.findFirst({
        where: {
          barberId: barber.userId,
          AND: [
            { startDateTime: { lt: requestedEndUtc.toJSDate() } },
            { endDateTime: { gt: requestedUtc.toJSDate() } },
          ],
        },
      });
      if (overlappingBooking) return null;

      // Passed all checks — return the barber (same shape as before)
      return barber;
    }),
  );

  return availableBarbers.filter(Boolean);
};

const getAvailableBarbersForQueueFromDb = async (
  userId: string,
  data: {
    saloonOwnerId: string;
    utcDateTime: string; // ISO string in UTC
    totalServiceTime: number;
    type?: BookingType;
  },
) => {
  if (data.type === BookingType.BOOKING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Use the booking-specific query to get available barbers for queue bookings',
    );
  }

  const requestedUtc = DateTime.fromISO(data.utcDateTime, { zone: 'utc' });
  if (!requestedUtc.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid datetime');
  }

  // must be in the future
  if (requestedUtc.toJSDate() <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Date and time must be in the future',
    );
  }

  // Only allow queue queries for the current local date
  const requestedLocalDay = requestedUtc.setZone('local').toISODate();
  const todayLocalDay = DateTime.now().setZone('local').toISODate();
  if (requestedLocalDay !== todayLocalDay) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Queue availability can only be queried for the current date',
    );
  }

  // Convert to local zone and compute end times
  const requestedLocal = requestedUtc.setZone('local');
  const requestedEndLocal = requestedLocal.plus({
    minutes: data.totalServiceTime,
  });
  const requestedEndUtc = requestedUtc.plus({ minutes: data.totalServiceTime });

  // 1. Check salon & holiday using local-day
  const salon = await prisma.saloonOwner.findUnique({
    where: { userId: data.saloonOwnerId },
    select: { userId: true },
  });
  if (!salon || !salon.userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Salon not found for user');
  }

  const salonHoliday = await prisma.saloonHoliday.findFirst({
    where: {
      userId: salon.userId,
      date: DateTime.fromObject(
        {
          year: requestedLocal.year,
          month: requestedLocal.month,
          day: requestedLocal.day,
        },
        { zone: 'local' },
      ).toJSDate(),
    },
  });
  if (salonHoliday) {
    return { message: 'Salon is closed on this date' };
  }

  // 2. Get barbers for salon and only those with a schedule for QUEUE
  let barbers = await prisma.barber.findMany({
    where: { saloonOwnerId: data.saloonOwnerId },
    include: {
      user: { select: { id: true, fullName: true, status: true, image: true } },
    },
  });

  const barberIdsWithSchedule = await prisma.barberSchedule.findMany({
    where: {
      barber: { saloonOwnerId: data.saloonOwnerId },
      type: BookingType.QUEUE,
    },
    select: { barberId: true },
    distinct: ['barberId'],
  });
  const barberIdsSet = new Set(barberIdsWithSchedule.map(b => b.barberId));
  const filteredBarbers = barbers.filter(b => barberIdsSet.has(b.userId));
  if (filteredBarbers.length === 0) {
    return { message: 'No barbers with schedules found for this salon' };
  }
  barbers = filteredBarbers;

  // 3. Parallel per-barber checks
  const availableBarbers = await Promise.all(
    barbers.map(async barber => {
      // 3a. Day off (local-day)
      const dayOff = await prisma.barberDayOff.findFirst({
        where: {
          saloonOwnerId: data.saloonOwnerId,
          barberId: barber.userId,
          date: DateTime.fromObject(
            {
              year: requestedLocal.year,
              month: requestedLocal.month,
              day: requestedLocal.day,
            },
            { zone: 'local' },
          ).toJSDate(),
        },
      });
      if (dayOff) return null;

      // 3b. Fetch schedule for local day
      const dayName = requestedLocal.toFormat('cccc').toLowerCase();
      const schedule = await prisma.barberSchedule.findFirst({
        where: {
          barberId: barber.userId,
          dayName,
          type: BookingType.QUEUE,
          isActive: false,
        },
      });
      if (!schedule) return null;

      // Parse opening/closing as local DateTimes on requestedLocal date
      const openingLocal = DateTime.fromFormat(
        `${requestedLocal.toFormat('yyyy-MM-dd')} ${schedule.openingTime}`,
        'yyyy-MM-dd hh:mm a',
        { zone: 'local' },
      );
      const closingLocal = DateTime.fromFormat(
        `${requestedLocal.toFormat('yyyy-MM-dd')} ${schedule.closingTime}`,
        'yyyy-MM-dd hh:mm a',
        { zone: 'local' },
      );
      if (
        !openingLocal.isValid ||
        !closingLocal.isValid ||
        openingLocal >= closingLocal
      ) {
        return null;
      }

      // If requested start is before opening OR requested end is after closing -> skip
      if (requestedLocal < openingLocal || requestedEndLocal > closingLocal) {
        return null;
      }

      // 3c. Check overlapping real-time statuses using UTC interval
      const overlappingStatuses = await prisma.barberRealTimeStatus.findFirst({
        where: {
          barberId: barber.userId,
          AND: [
            { startDateTime: { lt: requestedEndUtc.toJSDate() } },
            { endDateTime: { gt: requestedUtc.toJSDate() } },
          ],
        },
      });
      if (overlappingStatuses) return null;

      // 3d. Check overlapping bookings using UTC interval
      const overlappingBooking = await prisma.booking.findFirst({
        where: {
          barberId: barber.userId,
          AND: [
            { startDateTime: { lt: requestedEndUtc.toJSDate() } },
            { endDateTime: { gt: requestedUtc.toJSDate() } },
          ],
        },
      });
      if (overlappingBooking) return null;

      // Passed all checks — return barber (same shape as before)
      return barber;
    }),
  );

  return availableBarbers.filter(Boolean);
};

// getBookingListForSalonOwnerFromDb (fixed)
const getBookingListForSalonOwnerFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {},
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const searchTerm = options.searchTerm?.trim();
  const searchClause = searchTerm
    ? {
        OR: [
          {
            user: {
              fullName: { contains: searchTerm, mode: 'insensitive' as const },
            },
          },
          {
            user: {
              email: { contains: searchTerm, mode: 'insensitive' as const },
            },
          },
          {
            user: {
              phoneNumber: {
                contains: searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            barber: {
              user: {
                fullName: {
                  contains: searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
        ],
      }
    : {};

  const allowedStatuses = [BookingStatus.CONFIRMED, BookingStatus.PENDING];

  const date = options.date
    ? (() => {
        // appointmentAt is stored as UTC; build local-day range then convert to UTC bounds
        const localStart = DateTime.fromISO(String(options.date), {
          zone: 'local',
        }).startOf('day');
        const localEnd = localStart.plus({ days: 1 });
        return {
          appointmentAt: {
            gte: localStart.toUTC().toJSDate(),
            lt: localEnd.toUTC().toJSDate(),
          },
        };
      })()
    : {};

  const whereClause: any = {
    saloonOwnerId: userId,
    status: { in: allowedStatuses },
    ...searchClause,
    ...date,
  };

  // 1) fetch bookings; NOTE: do NOT select the `user` relation here to avoid Prisma's "required relation returned null" problem.
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        userId: true, // keep the scalar id
        barberId: true,
        saloonOwnerId: true,
        date: true,
        notes: true,
        isInQueue: true,
        totalPrice: true,
        startTime: true,
        endTime: true,
        status: true,
        queueSlot: {
          select: { id: true, position: true },
          orderBy: { position: 'asc' },
        },
        BookedServices: {
          select: {
            id: true,
            service: {
              select: {
                id: true,
                price: true,
                availableTo: true,
                serviceName: true,
              },
            },
          },
        },
        barber: {
          select: {
            user: { select: { id: true, fullName: true, image: true } },
          },
        },
      },
    }),
    prisma.booking.count({ where: whereClause }),
  ]);

  // 2) collect unique userIds present in bookings
  const userIds = Array.from(
    new Set(bookings.map(b => b.userId).filter(Boolean)),
  );

  // 3) fetch registered users that match those ids
  const registeredUsers = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          image: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      })
    : [];

  const regUserMap = registeredUsers.reduce<Record<string, any>>((acc, u) => {
    acc[u.id] = u;
    return acc;
  }, {});

  // 4) remaining ids -> non-registered users
  const nonRegisteredIds = userIds.filter(id => !regUserMap[id]);
  const nonRegisteredUsers = nonRegisteredIds.length
    ? await prisma.nonRegisteredUser.findMany({
        where: { id: { in: nonRegisteredIds } },
        select: { id: true, fullName: true, email: true, phone: true },
      })
    : [];

  const nonRegMap = nonRegisteredUsers.reduce<Record<string, any>>(
    (acc, nr) => {
      acc[nr.id] = nr;
      return acc;
    },
    {},
  );

  // 5) map bookings to response shape using the lookup maps
  const mapped = bookings.map(b => {
    const userInfo = regUserMap[b.userId]
      ? {
          id: regUserMap[b.userId].id,
          image: regUserMap[b.userId].image ?? null,
          fullName: regUserMap[b.userId].fullName ?? null,
          email: regUserMap[b.userId].email ?? null,
          phoneNumber: regUserMap[b.userId].phoneNumber ?? null,
        }
      : nonRegMap[b.userId]
        ? {
            id: nonRegMap[b.userId].id,
            image: null,
            fullName: nonRegMap[b.userId].fullName,
            email: nonRegMap[b.userId].email ?? null,
            phoneNumber: nonRegMap[b.userId].phone ?? null,
          }
        : {
            id: b.userId,
            image: null,
            fullName: 'Unknown',
            email: null,
            phoneNumber: null,
          };

    return {
      bookingId: b.id,
      customerId: b.userId,
      barberId: b.barberId,
      saloonOwnerId: b.saloonOwnerId,
      totalPrice: b.totalPrice,
      notes: b.notes,
      customerImage: userInfo.image,
      customerName: userInfo.fullName,
      customerEmail: userInfo.email,
      customerPhone: userInfo.phoneNumber,
      bookingDate: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      services: b.BookedServices.map(s => ({
        serviceId: s.service.id,
        serviceName: s.service.serviceName,
        price: s.service.price,
        availableTo: s.service.availableTo,
      })),
      barberName: b.barber?.user?.fullName ?? null,
      barberImage: b.barber?.user?.image ?? null,
      status: b.status ?? null,
      position: b.queueSlot?.[0]?.position ?? null,
    };
  });

  return {
    data: mapped,
    meta: {
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
    },
  };
};

const getBookingListForBarberFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {},
) => {
  // Similar to salon owner version but filter by barberId
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  const searchTerm = options.searchTerm?.trim();
  const searchClause = searchTerm
    ? {
        OR: [
          {
            user: {
              fullName: { contains: searchTerm, mode: 'insensitive' as const },
            },
          },
          {
            user: {
              email: { contains: searchTerm, mode: 'insensitive' as const },
            },
          },
          {
            user: {
              phoneNumber: {
                contains: searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
        ],
      }
    : {};
  const allowedStatuses = [BookingStatus.CONFIRMED, BookingStatus.PENDING];

  const date = options.date
    ? (() => {
        const localStart = DateTime.fromISO(String(options.date), {
          zone: 'local',
        }).startOf('day');
        const localEnd = localStart.plus({ days: 1 });
        return {
          appointmentAt: {
            gte: localStart.toUTC().toJSDate(),
            lt: localEnd.toUTC().toJSDate(),
          },
        };
      })()
    : {};
  const whereClause: any = {
    barberId: userId,
    status: { in: allowedStatuses },
    ...searchClause,
    ...date,
  };
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        userId: true,
        barberId: true,
        saloonOwnerId: true,
        date: true,
        notes: true,
        isInQueue: true,
        totalPrice: true,
        startTime: true,
        endTime: true,
        status: true,
        BookedServices: {
          select: {
            id: true,
            service: {
              select: {
                id: true,
                price: true,
                availableTo: true,
                serviceName: true,
              },
            },
          },
        },
        barber: {
          select: {
            BarberSchedule: {
              select: {
                id: true,
                type: true,
                openingTime: true,
                closingTime: true,
                dayName: true,
              },
            },
          },
        },
      },
    }),
    prisma.booking.count({ where: whereClause }),
  ]);

  const userIds = Array.from(
    new Set(bookings.map(b => b.userId).filter(Boolean)),
  );
  const registeredUsers = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          image: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      })
    : [];
  const regUserMap = registeredUsers.reduce<Record<string, any>>((acc, u) => {
    acc[u.id] = u;
    return acc;
  }, {});
  const nonRegisteredIds = userIds.filter(id => !regUserMap[id]);
  const nonRegisteredUsers = nonRegisteredIds.length
    ? await prisma.nonRegisteredUser.findMany({
        where: { id: { in: nonRegisteredIds } },
        select: { id: true, fullName: true, email: true, phone: true },
      })
    : [];
  const nonRegMap = nonRegisteredUsers.reduce<Record<string, any>>(
    (acc, nr) => {
      acc[nr.id] = nr;
      return acc;
    },
    {},
  );
  const mapped = bookings.map(b => {
    const userInfo = regUserMap[b.userId]
      ? {
          id: regUserMap[b.userId].id,
          image: regUserMap[b.userId].image ?? null,
          fullName: regUserMap[b.userId].fullName ?? null,
          email: regUserMap[b.userId].email ?? null,
          phoneNumber: regUserMap[b.userId].phoneNumber ?? null,
        }
      : nonRegMap[b.userId]
        ? {
            id: nonRegMap[b.userId].id,
            image: null,
            fullName: nonRegMap[b.userId].fullName,
            email: nonRegMap[b.userId].email ?? null,
            phoneNumber: nonRegMap[b.userId].phone ?? null,
          }
        : {
            id: b.userId,
            image: null,
            fullName: 'Unknown',
            email: null,
            phoneNumber: null,
          };
    return {
      bookingId: b.id,
      customerId: b.userId,
      barberId: b.barberId,
      saloonOwnerId: b.saloonOwnerId,
      totalPrice: b.totalPrice,
      notes: b.notes,
      customerImage: userInfo.image,
      customerName: userInfo.fullName,
      // customerEmail: userInfo.email,
      // customerPhone: userInfo.phoneNumber,
      bookingDate: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      services: b.BookedServices.map(s => ({
        serviceId: s.service.id,
        serviceName: s.service.serviceName,
        price: s.service.price,
        availableTo: s.service.availableTo,
      })),
      status: b.status ?? null,
    };
  });
  return {
    // statTime: bookings[0]?.barber?.BarberSchedule?.[0]?.openingTime || null,
    // endTime: bookings[0]?.barber?.BarberSchedule?.[0]?.closingTime || null,
    data: mapped,
    meta: {
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit)
    },
  };
};

const getBookingByIdFromDbForSalon = async (
  userId: string,
  bookingId: string,
) => {
  const result = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      saloonOwnerId: userId,
    },
    select: {
      id: true,
      userId: true,
      barberId: true,
      saloonOwnerId: true,
      date: true,
      notes: true,
      isInQueue: true,
      totalPrice: true,
      startTime: true,
      endTime: true,
      status: true,
      queueSlot: {
        select: {
          id: true,
          queueId: true,
          customerId: true,
          barberId: true,
          position: true,
          startedAt: true,
          bookingId: true,
          barberStatus: {
            select: {
              id: true,
              barberId: true,
              isAvailable: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      },
      BookedServices: {
        select: {
          id: true,
          serviceId: true,
          customerId: true,
          price: true,
          service: {
            select: {
              id: true,
              serviceName: true,
              price: true,
              duration: true,
            },
          },
        },
      },
      barber: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              image: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
  });
  if (!result) {
    return {
      message: 'Booking not found or you do not have permission to view it',
    };
  }
  return {
    bookingId: result.id,
    customerId: result.userId,
    barberId: result.barberId,
    saloonOwnerId: result.saloonOwnerId,
    totalPrice: result.totalPrice,
    notes: result.notes,
    customerName: result.user?.fullName || null,
    customerEmail: result.user?.email || null,
    customerContact: result.user?.phoneNumber || null,
    date: result.date,
    time: result.startTime,
    serviceNames:
      result.BookedServices?.map(bs => bs.service?.serviceName) || [],
    barberName: result.barber?.user?.fullName || null,
    status: result.status || null,
  };
};

const updateBookingIntoDb = async (userId: string, data: any) => {
  // Only allow customer to update the schedule (date and appointmentAt/time)
  const { bookingId, date, appointmentAt } = data;

  if (!date || !appointmentAt) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only date and appointmentAt can be updated',
    );
  }

  // Fetch the existing booking to verify ownership and get related info
  const existingBooking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      userId: userId,
    },
    include: {
      BookedServices: {
        select: { serviceId: true, service: { select: { duration: true } } },
      },
      queueSlot: true,
      barber: true,
    },
  });

  if (!existingBooking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  // Calculate totalDuration from booked services
  const totalDuration = existingBooking.BookedServices.reduce(
    (sum, bs) => sum + (bs.service?.duration || 0),
    0,
  );

  // Combine date and appointmentAt to get new startDateTime
  const localDateTime = DateTime.fromFormat(
    `${date} ${appointmentAt}`,
    'yyyy-MM-dd hh:mm a',
    { zone: 'local' },
  );
  if (!localDateTime.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date or time format');
  }
  const utcDateTime = localDateTime.toUTC().toJSDate();

  // Calculate new endDateTime
  const endDateTime = DateTime.fromJSDate(utcDateTime)
    .plus({ minutes: totalDuration })
    .toJSDate();

  // Check for overlapping bookings for this barber
  const overlappingBooking = await prisma.booking.findFirst({
    where: {
      barberId: existingBooking.barberId,
      id: { not: bookingId },
      AND: [
        { startDateTime: { lt: endDateTime } },
        { endDateTime: { gt: utcDateTime } },
      ],
    },
  });
  if (overlappingBooking) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Barber already has a booking or is unavailable during the requested time slot',
    );
  }

  // Transaction to update booking, queueSlot, and barberRealTimeStatus
  const result = await prisma.$transaction(async tx => {
    // 1. Update booking
    const updatedBooking = await tx.booking.update({
      where: {
        id: bookingId,
        userId: userId,
      },
      data: {
        date: new Date(date),
        appointmentAt: utcDateTime,
        startDateTime: utcDateTime,
        endDateTime: endDateTime,
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
        loyaltySchemeId: data.loyaltySchemeId || null,
        loyaltyUsed: data.loyaltyProgramId ? true : false,
      },
    });

    // 2. Update queueSlot if exists
    if (existingBooking.queueSlot) {
      // Update the current slot's startedAt before reordering
      await tx.queueSlot.update({
        where: { id: existingBooking.queueSlot[0].id },
        data: {
          startedAt: utcDateTime,
          completedAt: endDateTime,
        },
      });

      // Fetch all slots again, ordered by startedAt
      const queueSlots = await tx.queueSlot.findMany({
        where: {
          queueId: existingBooking.queueSlot[0]?.queueId,
        },
        orderBy: { startedAt: 'asc' },
      });

      // Re-assign positions sequentially based on startedAt
      for (let i = 0; i < queueSlots.length; i++) {
        await tx.queueSlot.update({
          where: { id: queueSlots[i].id },
          data: { position: i + 1 },
        });
      }
    }

    // 3. Update barberRealTimeStatus for this booking if exists
    await tx.barberRealTimeStatus.deleteMany({
      where: {
        barberId: existingBooking.barberId,
        startDateTime: existingBooking.startDateTime || utcDateTime,
        endDateTime: existingBooking.endDateTime || endDateTime,
      },
    });

    await tx.barberRealTimeStatus.create({
      data: {
        barberId: existingBooking.barberId,
        startDateTime: utcDateTime,
        endDateTime: endDateTime,
        isAvailable: false,
        startTime: localDateTime.toFormat('hh:mm a'),
        endTime: DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
      },
    });

    return updatedBooking;
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'bookingId, not updated');
  }

  return result;
};

const updateBookingStatusIntoDb = async (
  userId: string,
  data: {
    bookingId: string;
    status: BookingStatus;
  },
) => {
  const { bookingId, status } = data;
  console.log('Current booking status:', status);

  // Only allow salon owner to update the status
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      saloonOwnerId: userId,
    },
  });
  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }
  if (!['CONFIRMED', 'RESCHEDULED', 'PENDING'].includes(status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid status. Allowed value is CONFIRMED',
    );
  }

  // if (booking.status === BookingStatus.COMPLETED) {
  //   const findBookingEndTime = await prisma.booking.findFirst({
  //     where: {
  //       id: bookingId,
  //       saloonOwnerId: userId,
  //     },
  //     select: {
  //       endDateTime: true,
  //     },
  //   });
  //   if (findBookingEndTime && findBookingEndTime.endDateTime) {
  //     const currentTime = new Date();
  //     // Allow COMPLETED status only if current time is within 15 minutes before or after endDateTime
  //     const fifteenMinutesBeforeEnd = new Date(
  //       findBookingEndTime.endDateTime.getTime() - 15 * 60 * 1000,
  //     );
  //     if (currentTime < fifteenMinutesBeforeEnd) {
  //       throw new AppError(
  //         httpStatus.BAD_REQUEST,
  //         'Cannot change status to COMPLETED before 15 minutes prior to the booking end time',
  //       );
  //     }
  //     throw new AppError(
  //       httpStatus.BAD_REQUEST,
  //       'Cannot change status to COMPLETED before the booking end time',
  //     );
  //   }
  // }

  // If status is CANCELED or COMPLETED, update related records in a transaction
  // If CANCELED: delete queueSlot and barberRealTimeStatus, decrement queue currentPosition
  // If COMPLETED: delete barberRealTimeStatus, update queueSlot status to COMPLETED, decrement queue currentPosition
  // If CONFIRMED: just update the booking status
  // If RESCHEDULED: just update the booking status

  const result = await prisma.$transaction(async tx => {
    // const updatedBooking = await tx.booking.update({
    //   where: {
    //     id: bookingId,
    //     saloonOwnerId: userId,
    //   },
    //   data: {
    //     status:
    //       status === 'COMPLETED'
    //         ? BookingStatus.COMPLETED
    //         : BookingStatus.PENDING,
    //   },
    // });
    // if (!updatedBooking) {
    //   throw new AppError(httpStatus.BAD_REQUEST, 'Booking status not updated');
    // }
    // If status is COMPLETED, update barber's real-time status to available
    if (status === BookingStatus.CONFIRMED) {
      const checkPending = await tx.booking.update({
        where: {
          id: bookingId,
          saloonOwnerId: userId,
          status: BookingStatus.PENDING,
        },
        data: {
          status: BookingStatus.CONFIRMED,
        },
      });
      if (!checkPending) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Only PENDING bookings can be CONFIRMED',
        );
      }
      return checkPending;
    }
    // If status is CANCELED, delete the queueSlot and barberRealTimeStatus
    if (status === BookingStatus.PENDING) {
      const checkConfirmed = await tx.booking.findFirst({
        where: {
          id: bookingId,
          saloonOwnerId: userId,
        },
      });
      if (checkConfirmed) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Bookings can not be set to PENDING by salon owner',
        );
      }

      return checkConfirmed;
    }
  });

  return result;
};

const cancelBookingIntoDb = async (userId: string, bookingId: string) => {
  // Only allow customer to cancel their own booking if it's in PENDING or CONFIRMED status
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      userId: userId,
    },
    include: { queueSlot: true, barber: true, BookedServices: true },
  });
  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }
  if (
    ![
      BookingStatus.PENDING as BookingStatus,
      BookingStatus.CONFIRMED as BookingStatus,
    ].includes(booking.status)
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only bookings in PENDING or CONFIRMED status can be canceled',
    );
  }
  console.log('Canceling booking with ID:', booking);

  const result = await prisma.$transaction(async tx => {
    // 1. Update booking status to CANCELED
    const updatedBooking = await tx.booking.update({
      where: {
        id: bookingId,
        userId: userId,
      },
      data: {
        status: BookingStatus.CANCELLED,
      },
    });
    if (!updatedBooking) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Booking not canceled');
    }

    // 2. Delete associated queueSlot if exists
    if (booking.queueSlot && booking.queueSlot.length > 0) {
      // Delete the queueSlot for this booking
      // await tx.queueSlot.deleteMany({
      //   where: { bookingId: bookingId },
      // });

      // Read the slot first so we still have its queueId after deletion
      const slot = await tx.queueSlot.findUnique({
        where: { id: booking.queueSlot[0].id },
      });

      if (slot) {
        // Get all slots for this queue, ordered by startedAt
        const slots = await tx.queueSlot.findMany({
          where: { queueId: slot.queueId },
          orderBy: { startedAt: 'asc' },
        });

        // Re-assign positions sequentially
        for (let i = 0; i < slots.length; i++) {
          await tx.queueSlot.update({
            where: { id: slots[i].id },
            data: { position: i + 1 },
          });
        }
        console.log('Reassigned queue slot positions after deletion', slots);
        // Now delete the queueSlot(s) for this booking
        await tx.queueSlot.deleteMany({
          where: { bookingId: bookingId },
        });

        // If no slots remain, delete the queue
        if (slots.length === 0) {
          await tx.queue.delete({
            where: { id: slot.queueId },
          });
          console.log('Queue deleted as no slots remain');
        } else {
          // Otherwise, update currentPosition to slots.length
          await tx.queue.update({
            where: { id: slot.queueId },
            data: { currentPosition: slots.length },
          });
        }
      }
    }

    // 3. Delete associated barberRealTimeStatus if exists
    await tx.barberRealTimeStatus.deleteMany({
      where: {
        barberId: booking.barberId,
        startDateTime: booking.startDateTime || new Date(),
        endDateTime: booking.endDateTime || new Date(),
      },
    });

    return updatedBooking;
  });

  return result;
};

const deleteBookingItemFromDb = async (userId: string, bookingId: string) => {
  const deletedItem = await prisma.booking.delete({
    where: {
      id: bookingId,
      saloonOwnerId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'bookingId, not deleted');
  }

  return deletedItem;
};

const getLoyaltySchemesForCustomerFromDb = async (
  userId: string,
  saloonOwnerId: string,
) => {
  const totalPoints = await prisma.customerLoyalty.aggregate({
    where: { userId: userId },
    _sum: { totalPoints: true },
  });
  const schemes = await prisma.loyaltyScheme.findMany({
    where: {
      userId: saloonOwnerId,
    },
    orderBy: { pointThreshold: 'asc' },
  });

  const availableSchemes = schemes.filter(
    scheme =>
      totalPoints._sum.totalPoints !== null &&
      scheme.pointThreshold <= totalPoints._sum.totalPoints,
  );

  return {
    totalPoints: totalPoints._sum.totalPoints || 0,
    schemes: availableSchemes,
  };
};

export const bookingService = {
  createQueueBookingIntoDb,
  createQueueBookingForSalonOwnerIntoDb,
  createBookingIntoDb,
  getBookingListFromDb,
  getBookingListForBarberFromDb,
  getBookingListForSalonOwnerFromDb,
  getBookingByIdFromDbForSalon,
  getAllBarbersForQueueFromDb,
  getAvailableBarbersForQueueFromDb,
  getAvailableBarbersForWalkingInFromDb,
  getAvailableABarberForWalkingInFromDb,
  getAvailableBarbersForWalkingInFromDb1,
  getAvailableBarbersFromDb,
  getBookingByIdFromDb,
  updateBookingIntoDb,
  updateBookingStatusIntoDb,
  cancelBookingIntoDb,
  deleteBookingItemFromDb,
  getLoyaltySchemesForCustomerFromDb,
};

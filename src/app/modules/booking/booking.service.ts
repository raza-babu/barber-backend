import { StripeServices } from './../payment/payment.service';
import Stripe from 'stripe';
import prisma from '../../utils/prisma';
import {
  BookingStatus,
  BookingType,
  DiscountType,
  PaymentStatus,
  QueueStatus,
  RedemptionStatus,
  ScheduleType,
  UserRoleEnum,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { calculatePagination } from '../../utils/pagination';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { customerService } from '../customer/customer.service';
import config from '../../../config';
import { notificationService } from '../notification/notification.service';
import { blockService } from '../block/block.service';
import {
  getSalonTimezone,
  resolveTimezone,
  DEFAULT_TIMEZONE,
  getDayBoundsInZone,
  parseDateInZone,
  parseDateTimeInZone,
  getNowInZone,
  getTodayISODate,
  toUTCJSDate,
  moment,
} from '../../utils/timezone.helper';

// Initialize Stripe
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

const getPersonalizedEstimatedDurationMinutes = async (
  db: any,
  customerId: string,
  barberId: string,
  serviceIds: string[],
  defaultDurationMinutes: number,
) => {
  const sortedServiceIds = [...serviceIds].sort();

  const historicalBookings = await db.booking.findMany({
    where: {
      userId: customerId,
      barberId,
      status: BookingStatus.COMPLETED,
      actualDurationMinutes: { not: null },
      BookedServices: {
        some: {
          serviceId: { in: sortedServiceIds },
        },
      },
    },
    select: {
      actualDurationMinutes: true,
      BookedServices: {
        select: {
          serviceId: true,
        },
      },
    },
    orderBy: { actualEndedAt: 'desc' },
    take: 10,
  });

  const matchingDurations = historicalBookings
    .filter((booking: any) => {
      const bookedServiceIds = booking.BookedServices.map(
        (service: any) => service.serviceId,
      ).sort();

      return (
        bookedServiceIds.length === sortedServiceIds.length &&
        bookedServiceIds.every(
          (serviceId: string, index: number) =>
            serviceId === sortedServiceIds[index],
        )
      );
    })
    .slice(0, 5)
    .map((booking: any) => booking.actualDurationMinutes)
    .filter(
      (duration: number | null): duration is number =>
        typeof duration === 'number' && duration > 0,
    );

  if (matchingDurations.length === 0) {
    return defaultDurationMinutes;
  }

  const averageDuration =
    matchingDurations.reduce(
      (sum: number, duration: number) => sum + duration,
      0,
    ) / matchingDurations.length;

  return Math.round(averageDuration);
};

interface IApplyDiscountParams {
  tx: any;
  customerId: string;
  saloonOwnerId: string;
  discountOfferId?: string;
  discountCode?: string;
  subtotal: number;
}

interface IApplyDiscountResult {
  discountOffer: any | null;
  discountAmount: number;
  finalPrice: number;
}

const applyDiscountOfferInTransaction = async ({
  tx,
  customerId,
  saloonOwnerId,
  discountOfferId,
  discountCode,
  subtotal,
}: IApplyDiscountParams): Promise<IApplyDiscountResult> => {
  if (!discountOfferId && !discountCode) {
    return {
      discountOffer: null,
      discountAmount: 0,
      finalPrice: subtotal,
    };
  }

  const whereClause: any = {
    saloonOwnerId,
  };

  if (discountOfferId) {
    whereClause.id = discountOfferId;
  } else if (discountCode) {
    whereClause.code = discountCode.trim().toUpperCase();
  }

  const offer = await tx.salonDiscountOffer.findFirst({
    where: whereClause,
  });

  if (!offer) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Discount offer or promo code not found for this salon',
    );
  }

  if (!offer.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This discount offer is currently inactive',
    );
  }

  const now = new Date();
  if (now < offer.startDate) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This discount offer has not started yet',
    );
  }

  if (now > offer.endDate) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This discount offer has expired',
    );
  }

  if (offer.usageLimit !== null && offer.usageCount >= offer.usageLimit) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This discount offer has reached its maximum total usage limit',
    );
  }

  if (offer.perUserLimit) {
    const userUsagesCount = await tx.booking.count({
      where: {
        userId: customerId,
        discountOfferId: offer.id,
        status: { not: BookingStatus.CANCELLED },
      },
    });

    if (userUsagesCount >= offer.perUserLimit) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `You have already reached the maximum limit (${offer.perUserLimit}) for this discount offer`,
      );
    }
  }

  if (offer.minBookingAmount && subtotal < offer.minBookingAmount) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Minimum booking amount to use this offer is £${offer.minBookingAmount}`,
    );
  }

  let discountAmount = 0;
  if (offer.discountType === DiscountType.PERCENTAGE) {
    discountAmount = (subtotal * offer.discountValue) / 100;
    if (offer.maxDiscountAmount && discountAmount > offer.maxDiscountAmount) {
      discountAmount = offer.maxDiscountAmount;
    }
  } else if (offer.discountType === DiscountType.FIXED) {
    discountAmount = Math.min(offer.discountValue, subtotal);
  }

  discountAmount = Math.round(discountAmount * 100) / 100;
  const finalPrice = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

  // Increment usage count inside transaction
  await tx.salonDiscountOffer.update({
    where: { id: offer.id },
    data: { usageCount: { increment: 1 } },
  });

  return {
    discountOffer: offer,
    discountAmount,
    finalPrice,
  };
};

// Helper function to send booking confirmation notification
const sendBookingConfirmationNotification = async (
  userId: string,
  bookingType: string,
  barberId?: string,
) => {
  try {
    if (!userId) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (user) {
      const title =
        bookingType === 'QUEUE' ? 'Queue Confirmed' : 'Booking Confirmed';
      const body =
        bookingType === 'QUEUE'
          ? "You have been added to the queue. You will be notified when it's your turn."
          : 'Your appointment booking has been confirmed. Please arrive on time.';

      await notificationService.sendNotification(
        user.fcmToken,
        title,
        body,
        userId,
        barberId,
      );
    }
  } catch (error) {
    console.error('Error sending booking confirmation notification:', error);
  }
};

const createQueueBookingIntoDb = async (userId: string, data: any) => {
  const {
    barberId,
    saloonOwnerId,
    date,
    services,
    notes,
    isInQueue,
    loyaltySchemeId,
    discountOfferId,
    discountCode,
    remoteQueue,
  } = data;

  // Note: Handle account deactivation : exclude deactivated salons when creating a queue booking
  const saloonStatus = await prisma.saloonOwner.findUnique({
    where: {
      userId: saloonOwnerId,
      isVerified: true,
      user: { isDeactivated: false },
    },
  });
  if (!saloonStatus) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Saloon not found or not verified',
    );
  }

  // Check if customer is blocked by saloon owner
  const isBlockedBySaloon = await blockService.checkIfBlockedFromDb(
    userId,
    saloonOwnerId,
  );
  if (isBlockedBySaloon) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are blocked by this salon owner',
    );
  }

  // Check if customer blocked the saloon owner
  const hasBlockedSaloon = await blockService.checkIfBlockedFromDb(
    saloonOwnerId,
    userId,
  );
  if (hasBlockedSaloon) {
    throw new AppError(httpStatus.FORBIDDEN, 'This salon owner is blocked');
  }

  // 1. Fetch saloonOwner to check queue status
  // Note: Handle account deactivation : ensure only active salon owners can create queue bookings
  const saloonOwner = await prisma.saloonOwner.findUnique({
    where: {
      userId: saloonOwnerId,
      user: { isDeactivated: false },
    },
    select: { isQueueEnabled: true, timezone: true },
  });
  if (!saloonOwner) {
    throw new AppError(httpStatus.NOT_FOUND, 'Salon owner not found');
  }

  const salonZone = getSalonTimezone(saloonOwner);

  // 2. Validate and enforce current date only
  const dateObj = parseDateInZone(date, salonZone);
  if (!dateObj.isValid()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
  }
  const todayISO = getTodayISODate(salonZone);
  if (dateObj.format('YYYY-MM-DD') !== todayISO) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Date must be the current date');
  }

  // 3. Calculate total price and duration using service model
  const serviceRecords = await prisma.service.findMany({
    where: { id: { in: services } },
    select: { id: true, price: true, duration: true },
  });
  if (serviceRecords.length !== services.length) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Some services not found');
  }

  const serviceIds = serviceRecords.map(s => s.id).sort(); // Sort for consistent matching

  // Calculate default total duration from services
  let totalDuration = serviceRecords.reduce(
    (sum, s) => sum + (s.duration || 0),
    0,
  );

  // 🔥 Check QueueTime model for this barber + saloon + service combination
  const queueTimeRecord = await prisma.queueTime.findFirst({
    where: {
      saloonId: saloonOwnerId,
      barberId: barberId,
      serviceIds: {
        hasEvery: serviceIds, // Must contain all service IDs
        // equals: serviceIds,    // Must be exact match
      },
    },
    select: {
      saloonId: true,
      barberId: true,
      serviceIds: true,
      averageMin: true,
    },
  });

  // Use historical average duration if available
  if (queueTimeRecord?.averageMin) {
    totalDuration = queueTimeRecord.averageMin;
    console.log(
      `Using historical duration: ${totalDuration}min (${queueTimeRecord.serviceIds?.length || 0} services matched)`,
    );
  } else {
    console.log(
      `Using default service duration: ${totalDuration}min (no historical data)`,
    );
  }

  totalDuration = await getPersonalizedEstimatedDurationMinutes(
    prisma,
    userId,
    barberId,
    serviceIds,
    totalDuration,
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

  // 4. Get available barbers with free slots
  const availableBarbers = await getAvailableBarbersForWalkingInFromDb1(
    userId,
    saloonOwnerId,
    date,
    BookingType.QUEUE,
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

  // 5. Find the specified barber
  const selectedBarber = availableBarbers.find(
    (b: any) => b && b.barberId === barberId,
  );

  if (!selectedBarber) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Selected barber not available or not found',
    );
  }

  // console.log('Selected barber free slots:', selectedBarber.freeSlots);
  // console.log('Selected barber schedule:', selectedBarber.schedule);

  // 6. Pick earliest available time slot
  const pickEarliestSlot = (
    freeSlots: { start: string; end: string }[] | undefined,
    schedule: { start: string; end: string } | null,
    totalDurationMinutes: number,
  ): string | undefined => {
    const nowLocal = getNowInZone(salonZone);
    // console.log('Current time:', nowLocal.format('YYYY-MM-DD hh:mm A'));
    // console.log('Required duration:', totalDurationMinutes, 'minutes');

    if (!freeSlots || freeSlots.length === 0) {
      // console.log('No free slots available');

      // FALLBACK: If no free slots but barber schedule exists and it's still within working hours
      if (schedule) {
        const closingTime = parseDateTimeInZone(
          date,
          schedule.end,
          salonZone,
        );

        // console.log('Barber closing time:', closingTime.format('hh:mm A'));

        // If current time is before closing time, allow booking from current time
        if (nowLocal.isBefore(closingTime)) {
          const selectedTime = nowLocal.format('hh:mm A');
          // console.log('Using current time as fallback slot:', selectedTime);
          return selectedTime;
        }
      }

      return undefined;
    }

    for (const slot of freeSlots) {
      console.log('Checking slot:', slot);

      const slotStart = parseDateTimeInZone(
        date,
        slot.start,
        salonZone,
      );
      const slotEnd = parseDateTimeInZone(
        date,
        slot.end,
        salonZone,
      );

      // console.log('Slot start valid:', slotStart.isValid(), slotStart.toISOString());
      // console.log('Slot end valid:', slotEnd.isValid(), slotEnd.toISOString());

      if (!slotStart.isValid() || !slotEnd.isValid()) {
        // console.log('Invalid slot times, skipping');
        continue;
      }

      // Skip slots that have completely ended
      if (slotEnd.isSameOrBefore(nowLocal)) {
        // console.log('Slot has ended, skipping');
        continue;
      }

      // If slot starts in the past but ends in the future, use current time as start
      const effectiveStart = slotStart.isBefore(nowLocal) ? nowLocal : slotStart;
      // console.log('Effective start:', effectiveStart.format('hh:mm A'));

      const slotMinutes = slotEnd.diff(effectiveStart, 'minutes');
      // console.log('Available minutes in slot:', slotMinutes);

      // For queue bookings, allow booking if there's any time available
      if (slotMinutes > 0) {
        const selectedTime = effectiveStart.format('hh:mm A');
        // console.log('Selected time slot:', selectedTime);
        return selectedTime;
      }
    }

    // console.log('No suitable slot found in free slots');

    // FALLBACK: If all slots are in past but schedule allows, use current time
    if (schedule) {
      const closingTime = parseDateTimeInZone(
        date,
        schedule.end,
        salonZone,
      );

      if (nowLocal.isBefore(closingTime)) {
        const selectedTime = nowLocal.format('hh:mm A');
        // console.log(
        //   'Using current time as fallback (all slots past):',
        //   selectedTime,
        // );
        return selectedTime;
      }
    }

    return undefined;
  };

  const appointmentAt = pickEarliestSlot(
    selectedBarber.freeSlots,
    selectedBarber.schedule,
    totalDuration,
  );

  if (!appointmentAt) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      `No available time remaining today. Current time: ${getNowInZone(salonZone).format('hh:mm A')}. Barber's working hours have ended or are fully booked. Please try again tomorrow.`,
    );
  }

  // console.log('Final appointment time:', appointmentAt);
  // console.log('Final total duration:', totalDuration, 'minutes');

  // 7. Combine date and appointmentAt
  const localDateTime = parseDateTimeInZone(date, appointmentAt, salonZone);
  if (!localDateTime.isValid()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date or time format');
  }

  const nowLocal = getNowInZone(salonZone);
  const endLocal = localDateTime.clone().add(totalDuration, 'minutes');

  // Allow bookings that end in the future
  if (endLocal.isBefore(nowLocal)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Appointment time has already passed',
    );
  }

  const utcDateTime = localDateTime.toDate();

  // 8. Transaction for all DB operations
  const result = await prisma.$transaction(
    async tx => {
      // 8a. Clean up stale PENDING bookings (>5 mins old with no completed payment) if remoteQueue
      if (remoteQueue) {
        const fiveMinutesAgo = moment().subtract(5, 'minutes').toDate();
        const stalePendingBookings = await tx.booking.findMany({
          where: {
            barberId,
            saloonOwnerId,
            bookingType: BookingType.QUEUE,
            status: BookingStatus.PENDING,
            createdAt: { lt: fiveMinutesAgo },
          },
        });

        if (stalePendingBookings.length > 0) {
          const staleBookingIds = stalePendingBookings.map(b => b.id);
          const payments = await tx.payment.findMany({
            where: {
              bookingId: { in: staleBookingIds },
              status: { not: PaymentStatus.COMPLETED },
            },
          });

          // Delete stale unpaid bookings and cleanup related records
          for (const staleBooking of stalePendingBookings) {
            if (payments.length > 0) {
              if (staleBooking.discountOfferId && staleBooking.discountUsed) {
                await tx.salonDiscountOffer
                  .update({
                    where: { id: staleBooking.discountOfferId },
                    data: { usageCount: { decrement: 1 } },
                  })
                  .catch(() => {});
              }
              await tx.bookedServices.deleteMany({
                where: { bookingId: staleBooking.id },
              });
              await tx.barberRealTimeStatus.deleteMany({
                where: {
                  barberId,
                  startDateTime: staleBooking.startDateTime || new Date(),
                  endDateTime: staleBooking.endDateTime || new Date(),
                },
              });
              await tx.queueSlot.deleteMany({
                where: { bookingId: staleBooking.id },
              });
              await tx.booking.delete({
                where: { id: staleBooking.id },
              });
            }
          }
        }
      }

      // 8b. Check if barber exists and is not deactivated
      // Note: Handle account deactivation : exclude deactivated barbers from queue booking creation
      const barber = await tx.barber.findUnique({
        where: { userId: barberId },
        select: {
          id: true,
          user: {
            select: {
              id: true,
              fullName: true,
              image: true,
              isDeactivated: true,
            },
          },
        },
      });
      if (!barber || barber.user?.isDeactivated) {
        throw new AppError(httpStatus.NOT_FOUND, 'Barber not found');
      }

      // Check if salon or barber is on holiday
      const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(
        localDateTime,
        salonZone,
      );

      const salonHoliday = await tx.saloonHoliday.findFirst({
        where: {
          userId: saloonOwnerId,
          date: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });
      if (salonHoliday) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Salon is closed on this date: ${salonHoliday.holidayName || 'Holiday'}`,
        );
      }

      const barberHoliday = await tx.barberDayOff.findFirst({
        where: {
          barberId: barber.id,
          saloonOwnerId: saloonOwnerId,
          date: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });
      if (barberHoliday) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Barber is on holiday');
      }

      // Check lunch/break time overlap
      const barberBreak = await tx.lunch.findFirst({
        where: {
          saloonOwnerId: saloonOwnerId,
        },
      });

      if (barberBreak && barberBreak.startTime && barberBreak.endTime) {
        const bookingStartTime = parseDateTimeInZone(date, appointmentAt, salonZone);
        const bookingEndTime = bookingStartTime.clone().add(totalDuration, 'minutes');

        const breakStartTime = parseDateTimeInZone(
          date,
          barberBreak.startTime,
          salonZone,
        );
        const breakEndTime = parseDateTimeInZone(
          date,
          barberBreak.endTime,
          salonZone,
        );

        if (
          (bookingStartTime.isSameOrAfter(breakStartTime) &&
            bookingStartTime.isBefore(breakEndTime)) ||
          (bookingEndTime.isAfter(breakStartTime) &&
            bookingEndTime.isSameOrBefore(breakEndTime)) ||
          (bookingStartTime.isSameOrBefore(breakStartTime) &&
            bookingEndTime.isSameOrAfter(breakEndTime))
        ) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Barber is unavailable during break/lunch time',
          );
        }
      }

      // Clean up old queues
      await tx.queue.deleteMany({
        where: {
          barberId,
          saloonOwnerId,
          isActive: false,
          date: { lt: new Date() },
        },
      });

      // Find or create queue
      let queue = await tx.queue.findFirst({
        where: {
          barberId,
          saloonOwnerId,
          date: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });

      if (!queue) {
        queue = await tx.queue.create({
          data: {
            barberId,
            saloonOwnerId,
            date: startOfDayUTC,
            currentPosition: 1,
          },
        });
      } else {
        queue = await tx.queue.update({
          where: { id: queue.id },
          data: {
            currentPosition: queue.currentPosition + 1,
          },
        });
      }

      // Get existing slots and determine insert position
      const existingSlots = await tx.queueSlot.findMany({
        where: { queueId: queue.id },
        orderBy: { startedAt: 'asc' },
      });

      let insertPosition = 1;
      for (let i = 0; i < existingSlots.length; i++) {
        const slot = existingSlots[i];
        if (slot && slot.startedAt && utcDateTime > slot.startedAt) {
          insertPosition = i + 2;
        } else {
          break;
        }
      }

      // Shift positions
      for (let i = existingSlots.length - 1; i >= insertPosition - 1; i--) {
        await tx.queueSlot.update({
          where: { id: existingSlots[i].id },
          data: { position: existingSlots[i].position + 1 },
        });
      }

      // Create queue slot
      const queueSlot = await tx.queueSlot.create({
        data: {
          queueId: queue.id,
          customerId: userId,
          barberId: barberId,
          position: insertPosition,
          startedAt: utcDateTime,
        },
      });

      // Apply discount offer if provided
      const discountResult = await applyDiscountOfferInTransaction({
        tx,
        customerId: userId,
        saloonOwnerId,
        discountOfferId,
        discountCode,
        subtotal: totalPrice,
      });

      // Handle loyalty
      let price = discountResult.finalPrice;
      let loyaltyUsed = null;

      if (loyaltySchemeId) {
        const loyaltyScheme = await tx.loyaltyScheme.findUnique({
          where: { id: loyaltySchemeId, userId: saloonOwnerId },
        });
        if (!loyaltyScheme) {
          throw new AppError(httpStatus.NOT_FOUND, 'Loyalty scheme not found');
        }

        const customerLoyalty = await tx.customerLoyalty.findFirst({
          where: { userId: userId, saloonOwnerId: saloonOwnerId },
          select: { id: true, totalPoints: true },
        });

        if (
          !customerLoyalty ||
          (customerLoyalty.totalPoints || 0) < loyaltyScheme.pointThreshold
        ) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Not enough loyalty points',
          );
        }

        await tx.customerLoyalty.update({
          where: { id: customerLoyalty.id },
          data: { totalPoints: { decrement: loyaltyScheme.pointThreshold } },
        });

        loyaltyUsed = await tx.loyaltyRedemption.create({
          data: {
            customerId: userId,
            loyaltySchemeId: customerLoyalty.id,
            pointsUsed: loyaltyScheme.pointThreshold,
          },
        });

        price = price - price * (loyaltyScheme.percentage / 100);
        if (price < 0) price = 0;
      }

      // Create booking
      const booking = await tx.booking.create({
        data: {
          userId,
          barberId,
          saloonOwnerId,
          appointmentAt: utcDateTime,
          date: startOfDayUTC,
          notes,
          bookingType: BookingType.QUEUE,
          isInQueue: !!(saloonOwner.isQueueEnabled && isInQueue),
          originalPrice: totalPrice,
          discountAmount: discountResult.discountAmount,
          discountOfferId: discountResult.discountOffer?.id ?? null,
          discountUsed: !!discountResult.discountOffer,
          totalPrice: price,
          startDateTime: utcDateTime,
          endDateTime: moment.utc(utcDateTime)
            .add(totalDuration, 'minutes')
            .toDate(),
          startTime: localDateTime.format('hh:mm A'),
          endTime: moment.utc(utcDateTime)
            .add(totalDuration, 'minutes')
            .tz(salonZone)
            .format('hh:mm A'),
          estimatedDurationMinutes: totalDuration,
          loyaltySchemeId: loyaltySchemeId || null,
          loyaltyUsed: !!loyaltyUsed,
          remoteQueue: remoteQueue ?? false,
          status: remoteQueue ? BookingStatus.PENDING : BookingStatus.CONFIRMED,
        },
      });

      // Create payment record with PENDING status (will be updated after authorization)
      // let paymentRecord = null;
      // if (isInQueue && booking) {
      //   paymentRecord = await tx.payment.create({
      //     data: {
      //       userId: userId,
      //       bookingId: booking.id,
      //       paymentAmount: price,
      //       status: PaymentStatus.COMPLETED,
      //       paymentDate: new Date(),
      //     },
      //   });
      // }

      // Update loyalty redemption with bookingId
      if (loyaltyUsed) {
        await tx.loyaltyRedemption.update({
          where: { id: loyaltyUsed.id },
          data: { bookingId: booking.id },
        });
      }

      // Create booked services
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

      // Update queue slot with booking details
      await tx.queueSlot.update({
        where: { id: queueSlot.id },
        data: {
          bookingId: booking.id,
          completedAt: moment.utc(utcDateTime)
            .add(totalDuration, 'minutes')
            .toDate(),
        },
      });

      // Create barber real-time status
      const endDateTime = moment.utc(utcDateTime)
        .add(totalDuration, 'minutes')
        .toDate();

      const dayName = moment(utcDateTime).tz(salonZone).format('dddd').toLowerCase();

      const barberSchedule = await tx.barberSchedule.findFirst({
        where: {
          barberId: barberId,
          dayName: dayName,
          isActive: true,
          type: ScheduleType.QUEUE,
        },
      });

      if (!barberSchedule) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Barber schedule not found for this day',
        );
      }

      const openingDateTime = parseDateTimeInZone(
        date,
        barberSchedule.openingTime,
        salonZone,
      );
      const closingDateTime = parseDateTimeInZone(
        date,
        barberSchedule.closingTime,
        salonZone,
      );

      // For QUEUE bookings: only check if START time is within working hours
      // Allow the booking to extend beyond closing time
      if (localDateTime.isBefore(openingDateTime)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Booking cannot start before barber opening time',
        );
      }

      // Check that booking starts before closing time
      if (localDateTime.isSameOrAfter(closingDateTime)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Booking must start before barber closing time',
        );
      }

      // Check for overlapping barber status (keep this to prevent double booking)
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
          startTime: localDateTime.format('hh:mm A'),
          endTime: moment(endDateTime).tz(salonZone).format('hh:mm A'),
        },
      });

      // Create payment only if remoteQueue is true
      let payment = null;
      if (remoteQueue) {
        if (price > 0) {
          try {
            payment = await StripeServices.authorizeAndSplitPayment(userId, {
              bookingId: booking.id as string,
              booking: booking,
              tx: tx,
            });
            if (!payment) {
              throw new AppError(
                httpStatus.BAD_REQUEST,
                'Unable to create checkout session. Booking cancelled.',
              );
            }
          } catch (paymentError: any) {
            console.error(
              'Payment initialization error (queue booking):',
              paymentError,
            );
            throw new AppError(
              httpStatus.BAD_REQUEST,
              paymentError instanceof AppError
                ? paymentError.message
                : paymentError?.message ||
                  'Payment initialization failed. Booking cancelled.',
            );
          }
        } else {
          // Free queue booking - confirm directly
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.CONFIRMED },
          });
          booking.status = BookingStatus.CONFIRMED;
        }
      }

      return {
        booking,
        queue,
        queueSlot,
        totalPrice: price,
        appointmentAt: localDateTime.format('hh:mm A'),
        payment,
      };
    },
    {
      timeout: 25000,
    },
  );

  // Send booking confirmation notification
  // await sendBookingConfirmationNotification(userId, 'queue');

  return result;
};

const createQueueBookingForSalonOwnerIntoDb = async (
  saloonOwnerId: string,
  data: any,
) => {
  const {
    fullName,
    email,
    phone,
    date,
    services,
    notes,
    type,
    discountOfferId,
    discountCode,
  } = data;

  const saloon = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(saloon);

  // appointmentAt may be omitted — we'll choose it based on barber free slots later.
  let appointmentAt: string | undefined = data.appointmentAt;

  // Helper: pick the earliest free slot start that can accommodate totalDuration (minutes).
  const pickEarliestSlotForBarber = (
    freeSlots: { start: string; end: string }[] | undefined,
    totalDurationMinutes: number,
  ): string | undefined => {
    if (!freeSlots || freeSlots.length === 0) return undefined;
    for (const slot of freeSlots) {
      const slotStart = parseDateTimeInZone(
        date,
        slot.start,
        salonZone,
      );
      const slotEnd = parseDateTimeInZone(
        date,
        slot.end,
        salonZone,
      );
      if (!slotStart.isValid() || !slotEnd.isValid()) continue;
      const slotMinutes = slotEnd.diff(slotStart, 'minutes');
      if (slotMinutes >= totalDurationMinutes) {
        return slotStart.format('hh:mm A');
      }
    }
    // fallback to first slot start if none fit exactly
    const first = freeSlots[0];
    if (first) {
      const fallback = parseDateTimeInZone(
        date,
        first.start,
        salonZone,
      );
      return fallback.isValid() ? fallback.format('hh:mm A') : undefined;
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
  const dateObj = parseDateInZone(date, salonZone);
  if (!dateObj.isValid()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
  }
  const todayLocal = getTodayISODate(salonZone);
  if (dateObj.format('YYYY-MM-DD') !== todayLocal) {
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
  const serviceIds = serviceRecords.map(s => s.id).sort();
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

  // Execute all operations within a single transaction
  const result = await prisma.$transaction(async tx => {
    // 3. Create non-registered user record (customer)
    const nonRegisteredUser = await tx.nonRegisteredUser.create({
      data: {
        fullName,
        email: email ?? null,
        phone: phone ?? null,
        saloonOwnerId: saloonOwnerId,
      },
    });

    // 4. Find available barbers for walking-in
    const availableBarbers = await getAvailableBarbersForWalkingInFromDb1(
      nonRegisteredUser.id,
      saloonOwnerId,
      date,
      type as BookingType,
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

    // 5. Choose barber and slot
    let chosen: any = null;
    let chosenAppointmentAt: string | undefined = appointmentAt;

    const sorted = availableBarbers.filter(Boolean).sort((a: any, b: any) => {
      const aw = a.queue?.estimatedWaitTime ?? 0;
      const bw = b.queue?.estimatedWaitTime ?? 0;
      if (aw !== bw) return aw - bw;
      const at = a.queue?.totalInQueue ?? 0;
      const bt = b.queue?.totalInQueue ?? 0;
      return at - bt;
    });

    if (!appointmentAt) {
      const nowLocal = getNowInZone(salonZone);

      type Candidate = {
        barber: any;
        slotStartStr?: string;
        slotStartDt?: moment.Moment;
      };

      const candidates: Candidate[] = [];

      for (const b of sorted) {
        if (!b) continue;
        const slotStartStr = pickEarliestSlotForBarber(
          b.freeSlots,
          totalDuration,
        );

        if (!slotStartStr) continue;
        const slotDt = parseDateTimeInZone(
          date,
          slotStartStr,
          salonZone,
        );
        if (!slotDt.isValid()) continue;
        if (slotDt.isBefore(nowLocal.clone().subtract(1, 'minutes'))) continue;
        candidates.push({ barber: b, slotStartStr, slotStartDt: slotDt });
      }

      if (candidates.length > 0) {
        candidates.sort((x, y) => {
          if (!x.slotStartDt || !y.slotStartDt) return 0;
          return x.slotStartDt.valueOf() - y.slotStartDt.valueOf();
        });
        chosen = candidates[0].barber;
        chosenAppointmentAt = candidates[0].slotStartStr;
      } else {
        const nowLocalForFallback = getNowInZone(salonZone);
        let found = null as any | null;
        let pickedTime: string | undefined = undefined;

        for (const b of sorted) {
          if (!b || !b.freeSlots || b.freeSlots.length === 0) continue;
          for (const slot of b.freeSlots) {
            const slotStart = parseDateTimeInZone(
              date,
              slot.start,
              salonZone,
            );
            if (!slotStart.isValid()) continue;
            if (slotStart.isSameOrAfter(nowLocalForFallback.clone().subtract(1, 'minutes'))) {
              found = b;
              pickedTime = slotStart.format('hh:mm A');
              break;
            }
          }
          if (found) break;
        }

        if (!found) {
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
    const estimatedDurationMinutes =
      await getPersonalizedEstimatedDurationMinutes(
        prisma,
        nonRegisteredUser.id,
        barberId,
        serviceIds,
        totalDuration,
      );

    // 6. Determine appointment time
    const useAppointmentAt =
      chosenAppointmentAt ??
      getNowInZone(salonZone).format('hh:mm A');

    const localDateTime = parseDateTimeInZone(
      date,
      useAppointmentAt,
      salonZone,
    );
    if (!localDateTime.isValid()) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Invalid appointment time format',
      );
    }

    const nowLocal = getNowInZone(salonZone);
    const endLocal = localDateTime.clone().add(estimatedDurationMinutes, 'minutes');
    if (endLocal.isBefore(nowLocal.clone().subtract(1, 'minutes'))) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Appointment time cannot be in the past',
      );
    }
    const utcDateTime = localDateTime.toDate();
    const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(
      localDateTime,
      salonZone,
    );

    // 7. Create queue and booking
    await tx.queue.deleteMany({
      where: {
        barberId,
        saloonOwnerId,
        isActive: false,
        date: { lt: new Date() },
      },
    });

    let queue = await tx.queue.findFirst({
      where: {
        barberId,
        saloonOwnerId,
        date: { gte: startOfDayUTC, lte: endOfDayUTC },
      },
    });

    if (!queue) {
      queue = await tx.queue.create({
        data: {
          barberId,
          saloonOwnerId,
          date: startOfDayUTC,
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

    const existingSlots = await tx.queueSlot.findMany({
      where: { queueId: queue.id },
      orderBy: { startedAt: 'asc' },
    });

    let insertPosition = 1;
    for (let i = 0; i < existingSlots.length; i++) {
      const slot = existingSlots[i];
      if (slot && slot.startedAt && utcDateTime > slot.startedAt) {
        insertPosition = i + 2;
      } else {
        break;
      }
    }

    const endDateTimeForCheck = moment.utc(utcDateTime)
      .add(estimatedDurationMinutes, 'minutes')
      .toDate();

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

    if (overlappingStatus || overlappingBooking) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Barber is unavailable during the requested time slot',
      );
    }

    for (let i = existingSlots.length - 1; i >= insertPosition - 1; i--) {
      await tx.queueSlot.update({
        where: { id: existingSlots[i].id },
        data: { position: existingSlots[i].position + 1 },
      });
    }

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

    // Apply discount offer if provided
    const discountResult = await applyDiscountOfferInTransaction({
      tx,
      customerId: nonRegisteredUser.id,
      saloonOwnerId,
      discountOfferId,
      discountCode,
      subtotal: totalPrice,
    });

    const booking = await tx.booking.create({
      data: {
        userId: nonRegisteredUser.id,
        barberId,
        saloonOwnerId,
        appointmentAt: utcDateTime,
        date: startOfDayUTC,
        notes: notes ?? null,
        bookingType: BookingType.QUEUE,
        isInQueue: true,
        originalPrice: totalPrice,
        discountAmount: discountResult.discountAmount,
        discountOfferId: discountResult.discountOffer?.id ?? null,
        discountUsed: !!discountResult.discountOffer,
        totalPrice: discountResult.finalPrice,
        startDateTime: utcDateTime,
        endDateTime: moment.utc(utcDateTime)
          .add(estimatedDurationMinutes, 'minutes')
          .toDate(),
        startTime: localDateTime.format('hh:mm A'),
        endTime: moment.utc(utcDateTime)
          .add(estimatedDurationMinutes, 'minutes')
          .tz(salonZone)
          .format('hh:mm A'),
        estimatedDurationMinutes,
        loyaltySchemeId: null,
        loyaltyUsed: false,
      },
    });

    await tx.queueSlot.update({
      where: { id: queueSlot.id },
      data: {
        bookingId: booking.id,
        completedAt: moment.utc(utcDateTime)
          .add(estimatedDurationMinutes, 'minutes')
          .toDate(),
      },
    });

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

    const endDateTime = moment.utc(utcDateTime)
      .add(estimatedDurationMinutes, 'minutes')
      .toDate();

    await tx.barberRealTimeStatus.create({
      data: {
        barberId,
        startDateTime: utcDateTime,
        endDateTime,
        isAvailable: false,
        startTime: localDateTime.format('hh:mm A'),
        endTime: moment(endDateTime).tz(salonZone).format('hh:mm A'),
      },
    });

    return {
      booking,
      queue,
      queueSlot: { ...queueSlot, bookingId: booking.id },
    };
  });

  // Send booking confirmation notification to customer if available
  if (result.booking?.userId) {
    await sendBookingConfirmationNotification(
      result.booking.userId,
      'queue',
      saloonOwnerId,
    );
  }

  return result;
};

const createQueueBookingForCustomerIntoDb = async (
  userId: string,
  saloonOwnerId: string,
  data: any,
) => {
  const {
    date,
    services,
    notes,
    type,
    remoteQueue,
    loyaltySchemeId,
    discountOfferId,
    discountCode,
  } = data;
  const saloon = await prisma.saloonOwner.findUnique({
    where: { userId: saloonOwnerId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(saloon);

  let appointmentAt: string | undefined = data.appointmentAt;

  // Helper: pick the earliest free slot start that can accommodate totalDuration (minutes).
  const pickEarliestSlotForBarber = (
    freeSlots: { start: string; end: string }[] | undefined,
    totalDurationMinutes: number,
  ): string | undefined => {
    if (!freeSlots || freeSlots.length === 0) return undefined;

    const nowLocal = getNowInZone(salonZone);

    for (const slot of freeSlots) {
      const slotStart = parseDateTimeInZone(
        date,
        slot.start,
        salonZone,
      );
      const slotEnd = parseDateTimeInZone(
        date,
        slot.end,
        salonZone,
      );

      if (!slotStart.isValid() || !slotEnd.isValid()) continue;

      // Skip slots that have completely ended
      if (slotEnd.isSameOrBefore(nowLocal)) continue;

      // If slot starts in the past but ends in the future, use current time as start
      const effectiveStart = slotStart.isBefore(nowLocal) ? nowLocal : slotStart;

      const slotMinutes = slotEnd.diff(effectiveStart, 'minutes');

      // For queue bookings, allow booking if there's ANY time available
      if (slotMinutes > 0) {
        return effectiveStart.format('hh:mm A');
      }
    }

    return undefined;
  };

  // 1. Basic validation
  if (!date || !Array.isArray(services) || services.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'date and services are required',
    );
  }

  // Only allow queue for the current local date
  const dateObj = parseDateInZone(date, salonZone);
  if (!dateObj.isValid()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
  }
  const todayLocal = getTodayISODate(salonZone);
  if (dateObj.format('YYYY-MM-DD') !== todayLocal) {
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

  const serviceIds = serviceRecords.map(s => s.id).sort(); // Sort for consistent matching

  // Calculate default total duration from services
  let totalDuration = serviceRecords.reduce(
    (sum, s) => sum + (s.duration || 0),
    0,
  );

  // console.log('=== Duration Calculation ===');
  // console.log('Service IDs:', serviceIds);
  // console.log('Default total duration from services:', totalDuration);

  // 3. Find available barbers for walking-in
  const availableBarbers = await getAvailableBarbersForWalkingInFromDb1(
    userId,
    saloonOwnerId,
    date,
    type as BookingType,
  );

  // console.log(
  //   'Available barbers for walking-in for customer:',
  //   JSON.stringify(availableBarbers, null, 2),
  // );

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

  // 4. Choose barber/slot
  let chosen: any = null;
  let chosenAppointmentAt: string | undefined = appointmentAt;

  const sorted = availableBarbers.filter(Boolean).sort((a: any, b: any) => {
    const aw = a.queue?.estimatedWaitTime ?? 0;
    const bw = b.queue?.estimatedWaitTime ?? 0;
    if (aw !== bw) return aw - bw;
    const at = a.queue?.totalInQueue ?? 0;
    const bt = b.queue?.totalInQueue ?? 0;
    return at - bt;
  });

  if (!appointmentAt) {
    const nowLocal = getNowInZone(salonZone);

    type Candidate = {
      barber: any;
      slotStartStr?: string;
      slotStartDt?: moment.Moment;
      historicalDuration?: number;
    };

    const candidates: Candidate[] = [];

    // Check each barber for historical duration data
    for (const b of sorted) {
      if (!b) continue;
      // console.log(`Checking barber ${b.barberId}, free slots:`, b.freeSlots);

      // 🔥 Check QueueTime model for this barber + saloon + service combination
      const queueTimeRecord = await prisma.queueTime.findFirst({
        where: {
          saloonId: saloonOwnerId,
          barberId: b.barberId,
          serviceIds: {
            hasEvery: serviceIds, // Must contain all service IDs
          },
        },
        select: {
          saloonId: true,
          barberId: true,
          serviceIds: true,
          averageMin: true,
        },
      });

      // Use historical average duration if available
      const effectiveDuration = queueTimeRecord?.averageMin || totalDuration;

      // console.log(`Barber ${b.barberId} - Queue time record:`, queueTimeRecord);
      // console.log(
      //   `Using duration: ${effectiveDuration}min (${queueTimeRecord ? 'historical' : 'default'})`,
      // );

      const slotStartStr = pickEarliestSlotForBarber(
        b.freeSlots,
        effectiveDuration, // Use historical duration here
      );

      // console.log(`Selected slot for barber ${b.barberId}:`, slotStartStr);

      if (!slotStartStr) continue;

      const slotDt = parseDateTimeInZone(date, slotStartStr, salonZone);

      if (!slotDt.isValid()) {
        console.log(`Invalid slot DateTime for barber ${b.barberId}`);
        continue;
      }

      // Allow slots that start now or in the future (5 minute grace period)
      if (slotDt.isBefore(nowLocal.clone().subtract(5, 'minutes'))) {
        console.log(`Slot too far in past for barber ${b.barberId}`);
        continue;
      }

      candidates.push({
        barber: b,
        slotStartStr,
        slotStartDt: slotDt,
        historicalDuration: effectiveDuration,
      });
    }

    // console.log(`Found ${candidates.length} candidate barbers`);

    if (candidates.length > 0) {
      candidates.sort((x, y) => {
        if (!x.slotStartDt || !y.slotStartDt) return 0;
        return x.slotStartDt.valueOf() - y.slotStartDt.valueOf();
      });
      chosen = candidates[0].barber;
      chosenAppointmentAt = candidates[0].slotStartStr;

      // 🔥 Use historical duration for the chosen barber
      totalDuration = candidates[0].historicalDuration || totalDuration;

      // console.log('Selected barber from candidates:', chosen.barberId);
      // console.log('Final total duration:', totalDuration);
    } else {
      // Fallback: find any barber with free slots that have any remaining time
      // console.log('No candidates found, trying fallback logic');

      for (const b of sorted) {
        if (!b || !b.freeSlots || b.freeSlots.length === 0) continue;

        // Check historical duration for fallback barber too
        const queueTimeRecord = await prisma.queueTime.findFirst({
          where: {
            saloonId: saloonOwnerId,
            barberId: b.barberId,
            serviceIds: {
              hasEvery: serviceIds,
              // equals: serviceIds,
            },
          },
          select: {
            averageMin: true,
          },
        });

        const effectiveDuration = queueTimeRecord?.averageMin || totalDuration;

        for (const slot of b.freeSlots) {
          const slotStart = parseDateTimeInZone(date, slot.start, salonZone);
          const slotEnd = parseDateTimeInZone(date, slot.end, salonZone);

          if (!slotStart.isValid() || !slotEnd.isValid()) continue;

          // Check if slot is still valid (ends in the future)
          if (slotEnd.isAfter(nowLocal)) {
            // Use current time if slot started in the past
            const effectiveStart = slotStart.isBefore(nowLocal) ? nowLocal : slotStart;
            const remainingMinutes = slotEnd.diff(effectiveStart, 'minutes');

            // console.log(
            //   `Fallback: Barber ${b.barberId}, slot ${slot.start}-${slot.end}, remaining: ${remainingMinutes}min`,
            // );

            // Allow booking if there's any time remaining
            if (remainingMinutes > 0) {
              chosen = b;
              chosenAppointmentAt = effectiveStart.format('hh:mm A');
              totalDuration = effectiveDuration; // 🔥 Use historical duration
              // console.log(
              //   `Fallback selected barber ${b.barberId} at ${chosenAppointmentAt} with duration ${totalDuration}min`,
              // );
              break;
            }
          }
        }

        if (chosen) break;
      }

      if (!chosen) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          `No available time slots found. Current time: ${nowLocal.format('hh:mm A')}. Available barbers checked: ${sorted.length}. Please try again later or contact the salon.`,
        );
      }
    }
  } else {
    // If appointment time is provided, still check for historical duration
    chosen = sorted[0];
    chosenAppointmentAt = appointmentAt;

    // 🔥 Check historical duration for manually selected time
    if (chosen) {
      const queueTimeRecord = await prisma.queueTime.findFirst({
        where: {
          saloonId: saloonOwnerId,
          barberId: chosen.barberId,
          serviceIds: {
            hasEvery: serviceIds,
            // equals: serviceIds,
          },
        },
        select: {
          averageMin: true,
        },
      });

      if (queueTimeRecord?.averageMin) {
        totalDuration = queueTimeRecord.averageMin;
        // console.log(
        //   `Using historical duration for manual selection: ${totalDuration}min`,
        // );
      }
    }
  }

  if (!chosen) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Could not auto-select a barber',
    );
  }

  const barberId = chosen.barberId;
  const estimatedDurationMinutes =
    await getPersonalizedEstimatedDurationMinutes(
      prisma,
      userId,
      barberId,
      serviceIds,
      totalDuration,
    );

  console.log(
    `Final selection: Barber ${barberId} at ${chosenAppointmentAt} with duration ${estimatedDurationMinutes}min`,
  );

  // 5. Calculate total price
  const totalPrice = serviceRecords.reduce(
    (sum, s) => sum + Number(s.price),
    0,
  );

  // 6. Determine appointment time
  const useAppointmentAt =
    chosenAppointmentAt ??
    getNowInZone(salonZone).format('hh:mm A');

  const localDateTime = parseDateTimeInZone(
    date,
    useAppointmentAt,
    salonZone,
  );
  if (!localDateTime.isValid()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid appointment time format',
    );
  }

  const nowLocal = getNowInZone(salonZone);
  const endLocal = localDateTime.clone().add(estimatedDurationMinutes, 'minutes');

  // Allow bookings that end in the future
  if (endLocal.isBefore(nowLocal)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Appointment time has already passed',
    );
  }

  const utcDateTime = toUTCJSDate(localDateTime);
  const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(
    localDateTime,
    salonZone,
  );

  // 7. Create booking in transaction
  const result = await prisma.$transaction(
    async tx => {
      // 7a. Clean up stale PENDING bookings (>5 mins old with no completed payment) if remoteQueue
      if (remoteQueue) {
        const fiveMinutesAgo = moment().subtract(5, 'minutes').toDate();
        const stalePendingBookings = await tx.booking.findMany({
          where: {
            barberId,
            userId,
            saloonOwnerId,
            bookingType: BookingType.QUEUE,
            status: BookingStatus.PENDING,
            createdAt: { lt: fiveMinutesAgo },
          },
        });

        if (stalePendingBookings.length > 0) {
          const staleBookingIds = stalePendingBookings.map(b => b.id);
          const payments = await tx.payment.findMany({
            where: {
              userId,
              bookingId: { in: staleBookingIds },
              status: { not: PaymentStatus.COMPLETED },
            },
          });

          // Delete stale unpaid bookings and cleanup related records
          for (const staleBooking of stalePendingBookings) {
            if (payments.length > 0) {
              if (staleBooking.discountOfferId && staleBooking.discountUsed) {
                await tx.salonDiscountOffer
                  .update({
                    where: { id: staleBooking.discountOfferId },
                    data: { usageCount: { decrement: 1 } },
                  })
                  .catch(() => {});
              }
              await tx.bookedServices.deleteMany({
                where: { bookingId: staleBooking.id },
              });
              await tx.barberRealTimeStatus.deleteMany({
                where: {
                  barberId,
                  startDateTime: staleBooking.startDateTime || new Date(),
                  endDateTime: staleBooking.endDateTime || new Date(),
                },
              });
              await tx.queueSlot.deleteMany({
                where: { bookingId: staleBooking.id },
              });
              await tx.booking.delete({
                where: { id: staleBooking.id },
              });
            }
          }
        }
      }

      // 7b. Clean up old inactive queues
      await tx.queue.deleteMany({
        where: {
          barberId,
          saloonOwnerId,
          isActive: false,
          date: { lt: new Date() },
        },
      });

      let queue = await tx.queue.findFirst({
        where: {
          barberId,
          saloonOwnerId,
          date: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });

      if (!queue) {
        queue = await tx.queue.create({
          data: {
            barberId,
            saloonOwnerId,
            date: startOfDayUTC,
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

      const existingSlots = await tx.queueSlot.findMany({
        where: { queueId: queue.id },
        orderBy: { startedAt: 'asc' },
      });

      let insertPosition = 1;
      for (let i = 0; i < existingSlots.length; i++) {
        const slot = existingSlots[i];
        if (slot && slot.startedAt && utcDateTime > slot.startedAt) {
          insertPosition = i + 2;
        } else {
          break;
        }
      }

      const endDateTimeForCheck = moment
        .utc(utcDateTime)
        .add(estimatedDurationMinutes, 'minutes')
        .toDate();

      const overlappingStatus = await tx.barberRealTimeStatus.findFirst({
        where: {
          barberId,
          isAvailable: false, // Only check active (unavailable) status records
          AND: [
            { startDateTime: { lt: endDateTimeForCheck } },
            { endDateTime: { gt: utcDateTime } },
          ],
        },
      });

      const overlappingBooking = await tx.booking.findFirst({
        where: {
          barberId,
          // Exclude cancelled bookings - only check active bookings
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.PENDING,
              BookingStatus.COMPLETED,
            ],
          },
          AND: [
            { startDateTime: { lt: endDateTimeForCheck } },
            { endDateTime: { gt: utcDateTime } },
          ],
        },
      });

      if (overlappingStatus || overlappingBooking) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          'Barber is unavailable during the requested time slot',
        );
      }

      for (let i = existingSlots.length - 1; i >= insertPosition - 1; i--) {
        await tx.queueSlot.update({
          where: { id: existingSlots[i].id },
          data: { position: existingSlots[i].position + 1 },
        });
      }

      const queueSlot = await tx.queueSlot.create({
        data: {
          queueId: queue.id,
          customerId: userId,
          barberId,
          position: insertPosition,
          startedAt: utcDateTime,
        },
      });
      if (!queueSlot) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Error creating queue slot');
      }

      // Set booking status based on remoteQueue flag
      const bookingStatus = remoteQueue
        ? BookingStatus.PENDING
        : BookingStatus.CONFIRMED;

      // Apply discount offer if provided
      const discountResult = await applyDiscountOfferInTransaction({
        tx,
        customerId: userId,
        saloonOwnerId,
        discountOfferId,
        discountCode,
        subtotal: totalPrice,
      });

      const booking = await tx.booking.create({
        data: {
          userId: userId,
          barberId,
          saloonOwnerId,
          appointmentAt: utcDateTime,
          date: startOfDayUTC,
          notes: notes ?? null,
          bookingType: BookingType.QUEUE,
          isInQueue: true,
          originalPrice: totalPrice,
          discountAmount: discountResult.discountAmount,
          discountOfferId: discountResult.discountOffer?.id ?? null,
          discountUsed: !!discountResult.discountOffer,
          totalPrice: discountResult.finalPrice,
          startDateTime: utcDateTime,
          endDateTime: moment
            .utc(utcDateTime)
            .add(estimatedDurationMinutes, 'minutes')
            .toDate(),
          startTime: localDateTime.format('hh:mm A'),
          endTime: moment
            .utc(utcDateTime)
            .add(estimatedDurationMinutes, 'minutes')
            .tz(salonZone)
            .format('hh:mm A'),
          estimatedDurationMinutes,
          loyaltySchemeId: null,
          loyaltyUsed: false,
          remoteQueue: remoteQueue ?? false,
          status: bookingStatus,
        },
      });

      await tx.queueSlot.update({
        where: { id: queueSlot.id },
        data: {
          bookingId: booking.id,
          completedAt: moment
            .utc(utcDateTime)
            .add(estimatedDurationMinutes, 'minutes')
            .toDate(),
        },
      });

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

      const endDateTime = moment.utc(utcDateTime)
        .add(estimatedDurationMinutes, 'minutes')
        .toDate();

      await tx.barberRealTimeStatus.create({
        data: {
          barberId,
          startDateTime: utcDateTime,
          endDateTime,
          isAvailable: false,
          startTime: localDateTime.format('hh:mm A'),
          endTime: moment(endDateTime).tz(salonZone).format('hh:mm A'),
        },
      });

      // Create payment only if remoteQueue is true
      let payment = null;
      if (remoteQueue) {
        if (discountResult.finalPrice > 0) {
          try {
            payment = await StripeServices.authorizeAndSplitPayment(userId, {
              bookingId: booking.id as string,
              booking: booking,
              tx: tx,
            });
            if (!payment) {
              throw new AppError(
                httpStatus.BAD_REQUEST,
                'Unable to create checkout session. Booking cancelled.',
              );
            }
          } catch (paymentError: any) {
            console.error(
              'Payment initialization error (remote queue):',
              paymentError,
            );
            throw new AppError(
              httpStatus.BAD_REQUEST,
              paymentError instanceof AppError
                ? paymentError.message
                : paymentError?.message ||
                  'Payment initialization failed. Booking cancelled.',
            );
          }
        } else {
          // Free queue booking - confirm directly
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.CONFIRMED },
          });
          booking.status = BookingStatus.CONFIRMED;
        }
      }

      return {
        booking,
        queue,
        queueSlot: { ...queueSlot, bookingId: booking.id },
        payment,
      };
    },
    {
      timeout: 25000,
    },
  );

  // Send booking confirmation notification
  // await sendBookingConfirmationNotification(userId, 'queue');

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
    discountOfferId,
    discountCode,
  } = data;

  // 1. Validate saloon exists & verified
  // Note: Handle account deactivation : exclude deactivated salons when creating an appointment booking
  const saloonStatus = await prisma.saloonOwner.findUnique({
    where: {
      userId: saloonOwnerId,
      isVerified: true,
      user: { isDeactivated: false },
    },
  });
  if (!saloonStatus) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Saloon not found or not verified',
    );
  }

  // 2. Validate date / time inputs
  const salonZone = getSalonTimezone(saloonStatus);
  const dateObj = parseDateInZone(date, salonZone);
  const today = getNowInZone(salonZone).startOf('day');
  if (!dateObj.isValid() || dateObj.isBefore(today)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Date cannot be in the past');
  }

  const localDateTime = parseDateTimeInZone(date, appointmentAt, salonZone);
  if (!localDateTime.isValid()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date or time format');
  }
  const utcDateTime = localDateTime.toDate();

  // max 4 weeks ahead (business rule)
  const fourWeeksFromNow = getNowInZone(salonZone).add(4, 'weeks');
  if (localDateTime.isAfter(fourWeeksFromNow)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Booking cannot be made more than 4 weeks in advance',
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
  const defaultDuration = serviceRecords.reduce(
    (sum, s) => sum + (s.duration || 0),
    0,
  );
  if (defaultDuration <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Total service duration must be greater than zero',
    );
  }
  const serviceIds = serviceRecords.map(service => service.id).sort();
  const totalDuration = await getPersonalizedEstimatedDurationMinutes(
    prisma,
    userId,
    barberId,
    serviceIds,
    defaultDuration,
  );
  let totalPrice = serviceRecords.reduce((sum, s) => sum + Number(s.price), 0);

  // 4. Run DB operations in a transaction (booking + booked services + real-time status + loyalty handling)
  const result = await prisma.$transaction(
    async tx => {
      // 4a. Check barber existence
      // Note: Handle account deactivation : exclude deactivated barbers from appointment booking creation
      const barber = await tx.barber.findUnique({
        where: { userId: barberId },
        select: {
          id: true,
          user: {
            select: {
              id: true,
              fullName: true,
              image: true,
              isDeactivated: true,
            },
          },
        },
      });
      if (!barber || barber.user?.isDeactivated) {
        throw new AppError(httpStatus.NOT_FOUND, 'Barber not found');
      }

      // 4b. Salon holiday & Barber day off check
      const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(
        localDateTime,
        salonZone,
      );

      const salonHoliday = await tx.saloonHoliday.findFirst({
        where: {
          userId: saloonOwnerId,
          date: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });
      if (salonHoliday) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Salon is closed on this date: ${salonHoliday.holidayName || 'Holiday'}`,
        );
      }

      const barberHoliday = await tx.barberDayOff.findFirst({
        where: {
          barberId: barber.id,
          saloonOwnerId: saloonOwnerId,
          date: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });
      if (barberHoliday) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Barber is on holiday');
      }

      const bookingStart = utcDateTime;
      const bookingEnd = moment.utc(utcDateTime)
        .add(totalDuration, 'minutes')
        .toDate();

      // 4c. Clean up stale PENDING bookings (>5 mins old with no completed payment)
      const fiveMinutesAgo = moment().subtract(5, 'minutes').toDate();
      const stalePendingBookings = await tx.booking.findMany({
        where: {
          barberId,
          userId,
          saloonOwnerId,
          bookingType: BookingType.BOOKING,
          status: BookingStatus.PENDING,
          createdAt: { lt: fiveMinutesAgo },
        },
        // include: {
        //   Payment: {
        //     where: {
        //       status: { not: PaymentStatus.COMPLETED },
        //     },
        //   },
        // },
      });

      if (stalePendingBookings.length > 0) {
        // find payments for these bookings
        const staleBookingIds = stalePendingBookings.map(b => b.id);
        const payments = await tx.payment.findMany({
          where: {
            userId,
            bookingId: { in: staleBookingIds },
            status: { not: PaymentStatus.COMPLETED },
          },
        });

        // Delete stale unpaid bookings and cleanup related records
        for (const staleBooking of stalePendingBookings) {
          if (payments.length > 0) {
            if (staleBooking.discountOfferId && staleBooking.discountUsed) {
              await tx.salonDiscountOffer
                .update({
                  where: { id: staleBooking.discountOfferId },
                  data: { usageCount: { decrement: 1 } },
                })
                .catch(() => {});
            }
            // Has unpaid payments - cleanup
            await tx.bookedServices.deleteMany({
              where: { bookingId: staleBooking.id },
            });
            await tx.barberRealTimeStatus.deleteMany({
              where: {
                barberId,
                startDateTime: staleBooking.startDateTime!,
                endDateTime: staleBooking.endDateTime!,
              },
            });
            await tx.booking.delete({
              where: { id: staleBooking.id },
            });
          }
        }
      }

      // 4d. Check for time slot conflicts with other PENDING/CONFIRMED bookings

      const conflictingBookings = await tx.booking.findMany({
        where: {
          barberId,
          saloonOwnerId,
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
          AND: [
            { startDateTime: { lt: bookingEnd } },
            { endDateTime: { gt: bookingStart } },
          ],
        },
      });

      if (conflictingBookings.length > 0) {
        const firstConflict = conflictingBookings[0];
        throw new AppError(
          httpStatus.CONFLICT,
          `Time slot unavailable. Barber is booked from ${moment(
            firstConflict.startDateTime || new Date(),
          )
            .tz(salonZone)
            .format('hh:mm A')} to ${moment(
            firstConflict.endDateTime || new Date(),
          )
            .tz(salonZone)
            .format('hh:mm A')}. Please select a different time.`,
        );
      }
      // check from real-time status as well to prevent booking into unavailable slots
      // const conflictingStatus = await tx.barberRealTimeStatus.findFirst({
      //   where: {
      //     barberId,
      //     AND: [
      //       { startDateTime: { lt: bookingEnd } },
      //       { endDateTime: { gt: bookingStart } },
      //     ],
      //   },
      // });
      // if (conflictingStatus) {
      //   throw new AppError(
      //     httpStatus.CONFLICT,
      //     `Time slot unavailable due to barber's schedule. Please select a different time.`,
      //   );
      // }

      // 4e-1. Apply salon discount offer if provided
      const discountResult = await applyDiscountOfferInTransaction({
        tx,
        customerId: userId,
        saloonOwnerId,
        discountOfferId,
        discountCode,
        subtotal: totalPrice,
      });

      totalPrice = discountResult.finalPrice;

      // 4e-2. Loyalty handling (deduct points, compute discounted price)
      let loyaltyUsed = null;
      if (loyaltySchemeId) {
        const loyaltyScheme = await tx.loyaltyScheme.findUnique({
          where: { id: loyaltySchemeId, userId: saloonOwnerId },
        });
        if (!loyaltyScheme) {
          throw new AppError(httpStatus.NOT_FOUND, 'Loyalty scheme not found');
        }

        const customerLoyalty = await customerService.getMyLoyaltyOffersFromDb(
          userId,
          saloonOwnerId,
        );
        if (!customerLoyalty) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Customer has no loyalty offers for this saloon',
          );
        }

        const currentPoints = customerLoyalty.totalPoints;
        if (currentPoints < loyaltyScheme.pointThreshold) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Insufficient loyalty points for this redemption',
          );
        }

        // Create redemption record
        loyaltyUsed = await tx.loyaltyRedemption.create({
          data: {
            customerId: userId,
            loyaltySchemeId: loyaltyScheme.id,
            pointsUsed: loyaltyScheme.pointThreshold,
            status: RedemptionStatus.APPLIED,
            redeemedAt: new Date(),
          },
        });

        // Apply discount
        totalPrice = totalPrice - totalPrice * (loyaltyScheme.percentage / 100);
        if (totalPrice < 0) totalPrice = 0;
      }

      // 4f. Create PENDING booking (payment not yet confirmed)
      const booking = await tx.booking.create({
        data: {
          userId,
          barberId,
          saloonOwnerId,
          appointmentAt: utcDateTime,
          date: startOfDayUTC,
          notes: notes ?? null,
          bookingType: BookingType.BOOKING,
          isInQueue: false,
          originalPrice: serviceRecords.reduce((sum, s) => sum + Number(s.price), 0),
          discountAmount: discountResult.discountAmount,
          discountOfferId: discountResult.discountOffer?.id ?? null,
          discountUsed: !!discountResult.discountOffer,
          totalPrice: totalPrice,
          startDateTime: bookingStart,
          endDateTime: bookingEnd,
          startTime: localDateTime.format('hh:mm A'),
          endTime: moment(bookingEnd).tz(salonZone).format('hh:mm A'),
          estimatedDurationMinutes: totalDuration,
          loyaltySchemeId: loyaltySchemeId ?? null,
          loyaltyUsed: !!loyaltyUsed,
          status: BookingStatus.PENDING,
        },
      });

      // 4g. Attach loyalty redemptions if any
      if (loyaltyUsed) {
        await tx.loyaltyRedemption.update({
          where: { id: loyaltyUsed.id },
          data: { bookingId: booking.id },
        });
      }

      // 4h. Create booked services
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

      // 4i. Reserve time slot with barberRealTimeStatus (hold for 10 mins until payment confirmed)
      await tx.barberRealTimeStatus.create({
        data: {
          barberId,
          startDateTime: bookingStart,
          endDateTime: bookingEnd,
          isAvailable: false,
          startTime: localDateTime.format('hh:mm A'),
          endTime: moment(bookingEnd).tz(salonZone).format('hh:mm A'),
        },
      });

      // 4j. Create Stripe Checkout Session (payment still pending if totalPrice > 0)
      let payment = null;
      if (totalPrice > 0) {
        try {
          payment = await StripeServices.authorizeAndSplitPayment(userId, {
            bookingId: booking.id as string,
            booking: booking,
            tx: tx,
          });
          if (!payment) {
            throw new AppError(
              httpStatus.BAD_REQUEST,
              'Unable to create checkout session. Booking cancelled.',
            );
          }
        } catch (paymentError: any) {
          console.error(
            'Payment initialization error (appointment booking):',
            paymentError,
          );
          // Transaction will automatically rollback on error
          throw new AppError(
            httpStatus.BAD_REQUEST,
            paymentError instanceof AppError
              ? paymentError.message
              : paymentError?.message ||
                'Payment initialization failed. Booking cancelled.',
          );
        }
      } else {
        // Free booking (100% discount / loyalty) - mark as CONFIRMED directly
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.CONFIRMED },
        });
        booking.status = BookingStatus.CONFIRMED;
      }

      // Return PENDING booking with checkout session
      return {
        booking,
        totalPrice,
        payment,
      };
    },
    {
      timeout: 25000,
    },
  );

  // Send booking confirmation notification
  // await sendBookingConfirmationNotification(userId, 'booking');

  return result;
};

const getBookingListFromDb = async (
  userId: string,
  query: {
    searchTerm?: string;
    type?: BookingType;
    status?: BookingStatus;
    date?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
    limit?: string;
    sortBy?: 'date' | 'createdAt' | 'price';
    sortOrder?: 'asc' | 'desc';
    timezone?: string;
  } = {},
) => {
  const {
    searchTerm,
    type,
    status,
    date,
    startDate,
    endDate,
    page = 1,
    limit = 10,
    sortBy = 'date',
    sortOrder = 'desc',
    timezone: queryTimezone,
  } = query;

  const targetZone = queryTimezone || DEFAULT_TIMEZONE;

  // Convert page and limit to numbers
  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const limitNum = Math.max(1, parseInt(String(limit), 10) || 10);

  // Build where clause
  const whereConditions: any = {
    userId,
  };

  // Filter by booking type
  if (type) {
    whereConditions.bookingType = type;
  }

  //  TODO: TO HIDE THE DATA WITHOUT PAYMENT
  whereConditions.Payment = {
    some: {},
  };

  if (status) {
    // delete whereConditions.status;
    whereConditions.status = status;
  }

  // Filter by specific date
  if (date) {
    const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(date, targetZone);
    whereConditions.date = {
      gte: startOfDayUTC,
      lte: endOfDayUTC,
    };
  }

  // Filter by date range
  if (startDate && endDate) {
    const start = parseDateInZone(startDate, targetZone);
    const end = parseDateInZone(endDate, targetZone);
    if (start.isValid() && end.isValid()) {
      whereConditions.date = {
        gte: start.startOf('day').toDate(),
        lte: end.endOf('day').toDate(),
      };
    }
  } else if (startDate) {
    const start = parseDateInZone(startDate, targetZone);
    if (start.isValid()) {
      whereConditions.date = {
        gte: start.startOf('day').toDate(),
      };
    }
  } else if (endDate) {
    const end = parseDateInZone(endDate, targetZone);
    if (end.isValid()) {
      whereConditions.date = {
        lte: end.endOf('day').toDate(),
      };
    }
  }

  // Search term (search in notes, barber name, salon name)
  if (searchTerm) {
    whereConditions.OR = [
      {
        notes: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      },
      {
        barber: {
          user: {
            fullName: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        },
      },
      {
        saloonOwner: {
          shopName: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      },
    ];
  }

  // Sorting
  const orderBy: any = {};
  if (sortBy === 'date') {
    orderBy.date = sortOrder;
  } else if (sortBy === 'createdAt') {
    orderBy.createdAt = sortOrder;
  } else if (sortBy === 'price') {
    orderBy.totalPrice = sortOrder;
  }

  // Pagination
  const skip = (pageNum - 1) * limitNum;

  // Get total count
  const total = await prisma.booking.count({
    where: whereConditions,
  });

  // Get bookings with relations
  const bookings = await prisma.booking.findMany({
    where: whereConditions,
    skip,
    take: limitNum,
    orderBy,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          phoneNumber: true,
        },
      },
      barber: {
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              image: true,
              phoneNumber: true,
            },
          },
        },
      },
      saloonOwner: {
        select: {
          userId: true,
          timezone: true,
          shopName: true,
          shopAddress: true,
          shopLogo: true,
          latitude: true,
          longitude: true,
          avgRating: true,
          ratingCount: true,
        },
      },
      BookedServices: {
        include: {
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
      Payment: {
        select: {
          id: true,
          paymentAmount: true,
          status: true,
          paymentDate: true,
        },
      },
      loyaltyScheme: {
        select: {
          id: true,
          percentage: true,
          pointThreshold: true,
        },
      },
      queueSlot: {
        select: {
          id: true,
          position: true,
        },
      },
      discountOffer: {
        select: {
          id: true,
          name: true,
          code: true,
          discountType: true,
          discountValue: true,
        },
      },
    },
  });

  const formattedBookings = bookings.map(b => {
    const salonZone = getSalonTimezone(b.saloonOwner);
    // Get the current time in salon's zone
    const now = getNowInZone(salonZone);

    // Parse booking start and end times in salon's zone
    const bookingStart = moment(b.startDateTime || new Date()).tz(salonZone);
    const bookingEnd = moment(b.endDateTime || new Date()).tz(salonZone);

    console.log(
      `Booking ID: ${b.id}, Now: ${now.toISOString()}, Start: ${bookingStart.toISOString()}, End: ${bookingEnd.toISOString()}`,
    );

    // Determine current position in queue based on current time
    let currentPosition = null;
    if (b.queueSlot && b.queueSlot.length > 0) {
      if (now.isSameOrBefore(bookingStart) && now.isBefore(bookingEnd)) {
        currentPosition = 1;
      } else if (now.isAfter(bookingStart) && now.isBefore(bookingEnd)) {
        currentPosition = b.queueSlot[0]?.position || null;
      } else {
        currentPosition = 'Completed';
      }
    }

    console.log('payment:', b.Payment.length);

    return {
      bookingId: b.id,
      customerId: b.userId,
      barberId: b.barberId,
      saloonOwnerId: b.saloonOwnerId,
      saloonName: b.saloonOwner?.shopName || null,
      saloonAddress: b.saloonOwner?.shopAddress || null,
      saloonLogo: b.saloonOwner?.shopLogo || null,
      totalPrice: b.totalPrice,
      originalPrice: b.originalPrice ?? b.totalPrice,
      discountAmount: b.discountAmount ?? 0,
      discountUsed: b.discountUsed ?? false,
      discountOffer: b.discountOffer || null,
      notes: b.notes,
      customerImage: b.user?.image || null,
      customerName: b.user?.fullName || null,
      customerEmail: b.user?.email || null,
      customerContact: b.user?.phoneNumber || null,
      date: b.date,
      appointmentAt: b.appointmentAt,
      startDateTime: b.startDateTime,
      endDateTime: b.endDateTime,
      startTime: b.startTime,
      endTime: b.endTime,
      estimatedDurationMinutes: b.estimatedDurationMinutes,
      actualStartedAt: b.actualStartedAt,
      actualEndedAt: b.actualEndedAt,
      actualDurationMinutes: b.actualDurationMinutes,
      bookingType: b.bookingType,
      status: b.status,
      createdAt: b.createdAt,
      barberName: b.barber?.user?.fullName || null,
      barberImage: b.barber?.user?.image || null,
      position: b.queueSlot[0]?.position || null,
      currentPosition: currentPosition,
      remoteQueue: b.remoteQueue,
      checkIn: b.checkIn,
      serviceNames: b.BookedServices?.map(bs => bs.service?.serviceName) || [],
      serviceDurations: b.BookedServices?.map(bs => bs.service?.duration) || [],
      payment:
        b.Payment && b.Payment.length > 0
          ? {
              id: b.Payment[0].id,
              paymentAmount: b.Payment[0].paymentAmount,
              status: b.Payment[0].status,
              paymentDate: b.Payment[0].paymentDate,
            }
          : null,
      loyaltyScheme: b.loyaltyScheme
        ? {
            id: b.loyaltyScheme.id,
            percentage: b.loyaltyScheme.percentage,
            pointThreshold: b.loyaltyScheme.pointThreshold,
          }
        : null,
    };
  });

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  return {
    formattedBookings,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },
    filters: {
      type: type || null,
      status: status || null,
      date: date || null,
      startDate: startDate || null,
      endDate: endDate || null,
      searchTerm: searchTerm || null,
    },
  };
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
      originalPrice: true,
      discountAmount: true,
      discountOfferId: true,
      discountUsed: true,
      discountOffer: {
        select: {
          id: true,
          name: true,
          code: true,
          discountType: true,
          discountValue: true,
        },
      },
      startTime: true,
      endTime: true,
      estimatedDurationMinutes: true,
      actualStartedAt: true,
      actualEndedAt: true,
      actualDurationMinutes: true,
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
    originalPrice: result.originalPrice ?? result.totalPrice,
    discountAmount: result.discountAmount ?? 0,
    discountUsed: result.discountUsed ?? false,
    discountOffer: result.discountOffer || null,
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
  // Check if salon is closed
  // Note: Handle account deactivation : exclude deactivated salons from queue barber lookup
  const salon = await prisma.saloonOwner.findUnique({
    where: {
      userId: saloonOwnerId,
      user: { isDeactivated: false },
    },
    select: {
      userId: true,
      timezone: true,
      isQueueEnabled: true,
      shopLogo: true,
      shopAddress: true,
      shopName: true,
      ratingCount: true,
      avgRating: true,
      latitude: true,
      longitude: true,
    },
  });
  if (!salon)
    throw new AppError(httpStatus.NOT_FOUND, 'Salon not found or deactivated');

  const salonZone = getSalonTimezone(salon);
  let date: moment.Moment;
  if (specificDate) {
    date = parseDateInZone(specificDate, salonZone).startOf('day');
  } else {
    date = getNowInZone(salonZone).startOf('day');
  }

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
    where: {
      saloonOwnerId: saloonOwnerId,
      user: {
        isDeactivated: false,
      },
    },
    include: {
      user: { select: { id: true, fullName: true, image: true, status: true } },
    },
  });

  // Only barbers with schedules
  const barberIdsWithSchedule = await prisma.barberSchedule.findMany({
    where: {
      barber: { saloonOwnerId: saloonOwnerId },
      isActive: true,
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

  const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(date, salonZone);

  const results = await Promise.all(
    barbers.map(async barber => {
      // Skip if day off
      const dayOff = await prisma.barberDayOff.findFirst({
        where: {
          barberId: barber.userId,
          date: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });
      if (dayOff) return null;

      // Get schedule
      const schedule = await prisma.barberSchedule.findFirst({
        where: {
          barberId: barber.userId,
          isActive: true,
          type:
            type === ScheduleType.QUEUE
              ? ScheduleType.QUEUE
              : ScheduleType.BOOKING,
          dayName: date.format('dddd').toLowerCase(),
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
              gte: startOfDayUTC,
            },
            endDateTime: {
              lte: endOfDayUTC,
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
    saloonOwnerId: salon.userId,
    timezone: salonZone,
    shopLogo: salon.shopLogo || null,
    shopName: salon.shopName || null,
    shopAddress: salon.shopAddress || null,
    ratingCount: salon.ratingCount || 0,
    avgRating: salon.avgRating || 0,
    latitude: salon.latitude || null,
    longitude: salon.longitude || null,
    barbers: results.filter(r => r !== null),
  };
};

const getAvailableBarbersForWalkingInFromDb = async (
  userId: string,
  saloonOwnerId: string,
  specificDate?: string,
) => {
  // Check if salon is closed
  // Note: Handle account deactivation : exclude deactivated salons from walk-in availability lookup
  const salon = await prisma.saloonOwner.findUnique({
    where: {
      userId: saloonOwnerId,
      user: { isDeactivated: false },
    },
    select: {
      userId: true,
      timezone: true,
      isQueueEnabled: true,
      shopLogo: true,
      user: {
        select: {
          Queue: { select: { id: true } },
        },
      },
    },
  });
  if (!salon)
    throw new AppError(httpStatus.NOT_FOUND, 'Salon not found or deactivated');

  const salonZone = getSalonTimezone(salon);

  // Always use today's date or provided specificDate (local)
  let date: moment.Moment;
  if (specificDate) {
    date = parseDateInZone(specificDate, salonZone).startOf('day');
  } else {
    date = getNowInZone(salonZone).startOf('day');
  }
  const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(date, salonZone);
  const startOfDay = startOfDayUTC;
  const endOfDay = endOfDayUTC;

  // Check if customer is blocked by saloon owner
  if (userId) {
    const isBlockedBySaloon = await blockService.checkIfBlockedFromDb(
      userId,
      saloonOwnerId,
    );
    if (isBlockedBySaloon) {
      return { message: 'You are blocked by this salon owner' };
    }

    const hasBlockedSaloon = await blockService.checkIfBlockedFromDb(
      saloonOwnerId,
      userId,
    );
    if (hasBlockedSaloon) {
      return { message: 'This salon owner is blocked' };
    }
  }

  let barbers = await prisma.barber.findMany({
    where: {
      saloonOwnerId: saloonOwnerId,
      user: { isDeactivated: false },
    },
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
        where: {
          barberId: barber.userId,
          date: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });
      if (dayOff) return null;

      // Get schedule
      const schedule = await prisma.barberSchedule.findFirst({
        where: {
          barberId: barber.userId,
          dayName: date.format('dddd').toLowerCase(),
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
        const start = moment(b.startDateTime!).tz(salonZone);
        const end = moment(b.endDateTime!).tz(salonZone);
        return sum + end.diff(start, 'minutes');
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

      if (salon.isQueueEnabled) {
        const queue = await prisma.queue.findFirst({
          where: {
            barberId: barber.userId,
            saloonOwnerId: saloonOwnerId,
            date: { gte: startOfDayUTC, lte: endOfDayUTC },
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
        // Opening and closing times as Moment in local zone
        const opening = parseDateTimeInZone(
          date.format('YYYY-MM-DD'),
          schedule.openingTime,
          salonZone,
        );
        const closing = parseDateTimeInZone(
          date.format('YYYY-MM-DD'),
          schedule.closingTime,
          salonZone,
        );

        // Build an array of busy intervals (sorted) — convert and clamp to [opening, closing]
        const busyIntervals = bookings
          .map(b => {
            // Prefer stored startTime/endTime (local strings) when available because they reflect local schedule
            let s: moment.Moment;
            let e: moment.Moment;

            if (b.startTime) {
              s = parseDateTimeInZone(
                date.format('YYYY-MM-DD'),
                b.startTime,
                salonZone,
              );
            } else {
              s = moment(b.startDateTime!).tz(salonZone);
            }

            if (b.endTime) {
              e = parseDateTimeInZone(
                date.format('YYYY-MM-DD'),
                b.endTime,
                salonZone,
              );
            } else if (b.endDateTime) {
              e = moment(b.endDateTime!).tz(salonZone);
            } else {
              // fallback: compute end using services duration sum
              const totalTime = b.BookedServices.reduce(
                (sum, bs) => sum + (bs.service?.duration || 0),
                0,
              );
              e = s.clone().add(totalTime, 'minutes');
            }

            // If parsing failed, skip this booking
            if (!s.isValid() || !e.isValid()) return null;

            // clamp to opening/closing so any booking that spills outside working hours doesn't expand freeSlots beyond closing
            const startClamped = s.isBefore(opening) ? opening : s;
            const endClamped = e.isAfter(closing) ? closing : e;
            return { start: startClamped, end: endClamped };
          })
          .filter(
            (interval): interval is { start: moment.Moment; end: moment.Moment } =>
              !!interval && interval.end.isAfter(interval.start),
          )
          .sort((a, b) => a.start.valueOf() - b.start.valueOf());

        // If no busy intervals, entire working window is free
        if (busyIntervals.length === 0) {
          // Only provide free slot if opening < closing
          if (opening.isBefore(closing)) {
            freeSlots.push({
              start: opening.format('hh:mm A'),
              end: closing.format('hh:mm A'),
            });
          }
        } else {
          // Merge overlapping busy intervals first
          const merged: { start: moment.Moment; end: moment.Moment }[] = [];
          for (const iv of busyIntervals) {
            if (merged.length === 0) {
              merged.push({ start: iv.start, end: iv.end });
            } else {
              const last = merged[merged.length - 1];
              if (iv.start.isSameOrBefore(last.end)) {
                // overlap or contiguous -> extend end if needed
                last.end = iv.end.isAfter(last.end) ? iv.end : last.end;
              } else {
                merged.push({ start: iv.start, end: iv.end });
              }
            }
          }

          // Generate free slots between opening and closing using merged busy intervals
          let cursor = opening;
          for (const iv of merged) {
            if (iv.start.isAfter(cursor)) {
              freeSlots.push({
                start: cursor.format('hh:mm A'),
                end: iv.start.format('hh:mm A'),
              });
            }
            // move cursor forward
            if (iv.end.isAfter(cursor)) cursor = iv.end;
          }
          // After last busy interval until closing
          if (cursor.isBefore(closing)) {
            freeSlots.push({
              start: cursor.format('hh:mm A'),
              end: closing.format('hh:mm A'),
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
            moment(b.startDateTime!)
              .tz(salonZone)
              .format('hh:mm A'),
          endTime:
            b.endTime ??
            moment(b.endDateTime!)
              .tz(salonZone)
              .format('hh:mm A'),
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
  type?: BookingType,
) => {
  // Check if salon is closed
  // Note: Handle account deactivation : exclude deactivated salons from walk-in availability lookup
  const salon = await prisma.saloonOwner.findUnique({
    where: {
      userId: saloonOwnerId,
      user: { isDeactivated: false },
    },
    select: {
      userId: true,
      timezone: true,
      isQueueEnabled: true,
      shopLogo: true,
      user: {
        select: {
          Queue: { select: { id: true } },
        },
      },
    },
  });
  if (!salon)
    throw new AppError(httpStatus.NOT_FOUND, 'Salon not found or deactivated');

  const salonZone = getSalonTimezone(salon);

  // Always use today's date or provided specificDate (local)
  let date: moment.Moment;
  if (specificDate) {
    date = parseDateInZone(specificDate, salonZone).startOf('day');
  } else {
    date = getNowInZone(salonZone).startOf('day');
  }
  const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(date, salonZone);
  const startOfDay = startOfDayUTC;
  const endOfDay = endOfDayUTC;

  let barbers = await prisma.barber.findMany({
    where: {
      saloonOwnerId: saloonOwnerId,
      user: { isDeactivated: false },
    },
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
        where: {
          barberId: barber.userId,
          date: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });
      if (dayOff) return null;

      // Get schedule
      const schedule = await prisma.barberSchedule.findFirst({
        where: {
          barberId: barber.userId,
          dayName: date.format('dddd').toLowerCase(),
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
        const start = moment(b.startDateTime!).tz(salonZone);
        const end = moment(b.endDateTime!).tz(salonZone);
        return sum + end.diff(start, 'minutes');
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

      if (salon.isQueueEnabled) {
        const queue = await prisma.queue.findFirst({
          where: {
            barberId: barber.userId,
            saloonOwnerId: saloonOwnerId,
            date: { gte: startOfDayUTC, lte: endOfDayUTC },
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
        // Opening and closing times as Moment in local zone
        const opening = parseDateTimeInZone(
          date.format('YYYY-MM-DD'),
          schedule.openingTime,
          salonZone,
        );
        const closing = parseDateTimeInZone(
          date.format('YYYY-MM-DD'),
          schedule.closingTime,
          salonZone,
        );

        // Build an array of busy intervals (sorted) — convert and clamp to [opening, closing]
        const busyIntervals = bookings
          .map(b => {
            // Prefer stored startTime/endTime (local strings) when available because they reflect local schedule
            let s: moment.Moment;
            let e: moment.Moment;

            if (b.startTime) {
              s = parseDateTimeInZone(
                date.format('YYYY-MM-DD'),
                b.startTime,
                salonZone,
              );
            } else {
              s = moment(b.startDateTime!).tz(salonZone);
            }

            if (b.endTime) {
              e = parseDateTimeInZone(
                date.format('YYYY-MM-DD'),
                b.endTime,
                salonZone,
              );
            } else if (b.endDateTime) {
              e = moment(b.endDateTime!).tz(salonZone);
            } else {
              // fallback: compute end using services duration sum
              const totalTime = b.BookedServices.reduce(
                (sum, bs) => sum + (bs.service?.duration || 0),
                0,
              );
              e = s.clone().add(totalTime, 'minutes');
            }

            // If parsing failed, skip this booking
            if (!s.isValid() || !e.isValid()) return null;

            // clamp to opening/closing so any booking that spills outside working hours doesn't expand freeSlots beyond closing
            const startClamped = s.isBefore(opening) ? opening : s;
            const endClamped = e.isAfter(closing) ? closing : e;
            return { start: startClamped, end: endClamped };
          })
          .filter(
            (interval): interval is { start: moment.Moment; end: moment.Moment } =>
              !!interval && interval.end.isAfter(interval.start),
          )
          .sort((a, b) => a.start.valueOf() - b.start.valueOf());

        // If no busy intervals, entire working window is free
        if (busyIntervals.length === 0) {
          // Only provide free slot if opening < closing
          if (opening.isBefore(closing)) {
            freeSlots.push({
              start: opening.format('hh:mm A'),
              end: closing.format('hh:mm A'),
            });
          }
        } else {
          // Merge overlapping busy intervals first
          const merged: { start: moment.Moment; end: moment.Moment }[] = [];
          for (const iv of busyIntervals) {
            if (merged.length === 0) {
              merged.push({ start: iv.start, end: iv.end });
            } else {
              const last = merged[merged.length - 1];
              if (iv.start.isSameOrBefore(last.end)) {
                // overlap or contiguous -> extend end if needed
                last.end = iv.end.isAfter(last.end) ? iv.end : last.end;
              } else {
                merged.push({ start: iv.start, end: iv.end });
              }
            }
          }

          // Generate free slots between opening and closing using merged busy intervals
          let cursor = opening;
          for (const iv of merged) {
            if (iv.start.isAfter(cursor)) {
              freeSlots.push({
                start: cursor.format('hh:mm A'),
                end: iv.start.format('hh:mm A'),
              });
            }
            // move cursor forward
            if (iv.end.isAfter(cursor)) cursor = iv.end;
          }
          // After last busy interval until closing
          if (cursor.isBefore(closing)) {
            freeSlots.push({
              start: cursor.format('hh:mm A'),
              end: closing.format('hh:mm A'),
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
          bookingId: b.id,
          customerId: b.userId,
          customerName: (b as any).user?.fullName || null,
          customerImage: (b as any).user?.image || null,
          startTime:
            b.startTime ??
            moment(b.startDateTime!)
              .tz(salonZone)
              .format('hh:mm A'),
          endTime:
            b.endTime ??
            moment(b.endDateTime!)
              .tz(salonZone)
              .format('hh:mm A'),
          services: b.BookedServices.map(bs => bs.service?.serviceName),
          appointmentAt: b.appointmentAt,
          totalTime: b.BookedServices.reduce(
            (sum, bs) => sum + (bs.service?.duration || 0),
            0,
          ),
          estimatedDurationMinutes: b.estimatedDurationMinutes,
          actualStartTime: b.actualStartedAt,
          actualEndTime: b.actualEndedAt,
          actualDurationMinutes: b.actualDurationMinutes,
          status: b.status,
        })),
        freeSlots: freeSlots
          .map(slot => {
            const slotStart = parseDateTimeInZone(
              date.format('YYYY-MM-DD'),
              slot.start,
              salonZone,
            );
            const slotEnd = parseDateTimeInZone(
              date.format('YYYY-MM-DD'),
              slot.end,
              salonZone,
            );
            const nowLocal = getNowInZone(salonZone);

            // If slot has ended, skip it
            if (slotEnd.isSameOrBefore(nowLocal)) return null;

            // If slot started in past but ends in future, adjust start to current time
            const adjustedStart = slotStart.isBefore(nowLocal) ? nowLocal : slotStart;

            return {
              start: adjustedStart.format('hh:mm A'),
              end: slotEnd.format('hh:mm A'),
            };
          })
          .filter(
            (slot): slot is { start: string; end: string } => slot !== null,
          ),
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
    allBarbers = await getAvailableBarbersForWalkingInFromDb1(
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
    date?: string;
    time?: string;
  },
) => {
  if (data.type === BookingType.QUEUE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Use the queue-specific query to get available barbers for queue bookings',
    );
  }

  // 1. Check salon & holiday using local-day
  const salon = await prisma.saloonOwner.findUnique({
    where: {
      userId: data.saloonOwnerId,
      user: {
        isDeactivated: false,
      },
    },
    select: { userId: true, timezone: true },
  });
  if (!salon || !salon.userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Salon not found for user');
  }

  const salonZone = getSalonTimezone(salon);

  let requestedUtc: moment.Moment;
  let requestedLocal: moment.Moment;

  if (data.date && data.time) {
    requestedLocal = parseDateTimeInZone(data.date, data.time, salonZone);
    requestedUtc = requestedLocal.clone().utc();
  } else {
    requestedUtc = moment.utc(data.utcDateTime);
    if (!requestedUtc.isValid()) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid datetime');
    }
    requestedLocal = requestedUtc.clone().tz(salonZone);
  }

  // must be in the future
  if (requestedUtc.toDate() <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Date and time must be in the future',
    );
  }

  // must be within next 3 weeks
  const threeWeeksFromNow = moment.tz(salonZone).add(4, 'weeks');
  if (requestedUtc.isAfter(threeWeeksFromNow)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Date cannot be more than 3 weeks in the future',
    );
  }

  const requestedEndLocal = requestedLocal.clone().add(
    data.totalServiceTime,
    'minutes',
  );
  const requestedEndUtc = requestedUtc.clone().add(data.totalServiceTime, 'minutes');

  const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(
    requestedLocal,
    salonZone,
  );

  const salonHoliday = await prisma.saloonHoliday.findFirst({
    where: {
      userId: salon.userId,
      date: { gte: startOfDayUTC, lte: endOfDayUTC },
    },
  });
  if (salonHoliday) {
    return { message: 'Salon is closed on this date' };
  }

  // 2. Get barbers for salon and only those with a schedule for BOOKING (or provided type)
  let barbers = await prisma.barber.findMany({
    where: {
      saloonOwnerId: data.saloonOwnerId,
      user: {
        isDeactivated: false,
      },
    },
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

  console.log({ barbers });

  // 3. Parallel per-barber checks
  const availableBarbers = await Promise.all(
    barbers.map(async barber => {
      // 3a. Day off (local-day)
      const dayOff = await prisma.barberDayOff.findFirst({
        where: {
          saloonOwnerId: data.saloonOwnerId,
          barberId: barber.userId,
          date: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });
      if (dayOff) return null;

      // 3b. Fetch schedule for local day
      const dayName = requestedLocal.format('dddd').toLowerCase();
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
      const openingLocal = parseDateTimeInZone(
        requestedLocal.format('YYYY-MM-DD'),
        schedule.openingTime,
        salonZone,
      );
      const closingLocal = parseDateTimeInZone(
        requestedLocal.format('YYYY-MM-DD'),
        schedule.closingTime,
        salonZone,
      );
      if (
        !openingLocal.isValid() ||
        !closingLocal.isValid() ||
        openingLocal.isSameOrAfter(closingLocal)
      ) {
        return null;
      }

      // 3c. Ensure requestedLocal start/end fit into working window
      // If requested start is before opening OR requested end is after closing -> skip
      if (requestedLocal.isBefore(openingLocal) || requestedEndLocal.isAfter(closingLocal)) {
        return null;
      }

      // 3d. Check overlapping real-time statuses using UTC interval
      const overlappingStatuses = await prisma.barberRealTimeStatus.findFirst({
        where: {
          barberId: barber.userId,
          AND: [
            { startDateTime: { lt: requestedEndUtc.toDate() } },
            { endDateTime: { gt: requestedUtc.toDate() } },
          ],
        },
      });
      if (overlappingStatuses) return null;

      // 3e. Check overlapping bookings using UTC interval
      const overlappingBooking = await prisma.booking.findFirst({
        where: {
          barberId: barber.userId,
          AND: [
            { startDateTime: { lt: requestedEndUtc.toDate() } },
            { endDateTime: { gt: requestedUtc.toDate() } },
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
    date?: string;
    time?: string;
  },
) => {
  if (data.type === BookingType.BOOKING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Use the booking-specific query to get available barbers for queue bookings',
    );
  }

  // 1. Check salon & holiday using local-day
  const salon = await prisma.saloonOwner.findUnique({
    where: {
      userId: data.saloonOwnerId,
      user: {
        isDeactivated: false,
      },
    },
    select: { userId: true, timezone: true },
  });
  if (!salon || !salon.userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Salon not found for user');
  }

  const salonZone = getSalonTimezone(salon);

  let requestedUtc: moment.Moment;
  let requestedLocal: moment.Moment;

  if (data.date && data.time) {
    requestedLocal = parseDateTimeInZone(data.date, data.time, salonZone);
    requestedUtc = requestedLocal.clone().utc();
  } else {
    requestedUtc = moment.utc(data.utcDateTime);
    if (!requestedUtc.isValid()) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid datetime');
    }
    requestedLocal = requestedUtc.clone().tz(salonZone);
  }

  // must be in the future
  if (requestedUtc.toDate() <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Date and time must be in the future',
    );
  }

  // Only allow queue queries for the current local date
  const requestedLocalDay = requestedLocal.format('YYYY-MM-DD');
  const todayLocalDay = getTodayISODate(salonZone);
  if (requestedLocalDay !== todayLocalDay) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Queue availability can only be queried for the current date',
    );
  }

  // Convert to local zone and compute end times
  const requestedEndLocal = requestedLocal.clone().add(
    data.totalServiceTime,
    'minutes',
  );
  const requestedEndUtc = requestedUtc.clone().add(data.totalServiceTime, 'minutes');

  const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(
    requestedLocal,
    salonZone,
  );

  const salonHoliday = await prisma.saloonHoliday.findFirst({
    where: {
      userId: salon.userId,
      date: { gte: startOfDayUTC, lte: endOfDayUTC },
    },
  });
  if (salonHoliday) {
    return { message: 'Salon is closed on this date' };
  }

  // 2. Get barbers for salon and only those with a schedule for QUEUE
  let barbers = await prisma.barber.findMany({
    where: {
      saloonOwnerId: data.saloonOwnerId,
      user: {
        isDeactivated: false,
      },
    },
    include: {
      user: { select: { id: true, fullName: true, status: true, image: true } },
    },
  });

  const barberIdsWithSchedule = await prisma.barberSchedule.findMany({
    where: {
      barber: {
        saloonOwnerId: data.saloonOwnerId,
        user: {
          isDeactivated: false,
        },
      },
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
          date: { gte: startOfDayUTC, lte: endOfDayUTC },
        },
      });
      if (dayOff) return null;

      // 3b. Fetch schedule for local day
      const dayName = requestedLocal.format('dddd').toLowerCase();
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
      const openingLocal = parseDateTimeInZone(
        requestedLocal.format('YYYY-MM-DD'),
        schedule.openingTime,
        salonZone,
      );
      const closingLocal = parseDateTimeInZone(
        requestedLocal.format('YYYY-MM-DD'),
        schedule.closingTime,
        salonZone,
      );
      if (
        !openingLocal.isValid() ||
        !closingLocal.isValid() ||
        openingLocal.isSameOrAfter(closingLocal)
      ) {
        return null;
      }

      // If requested start is before opening OR requested end is after closing -> skip
      if (requestedLocal.isBefore(openingLocal) || requestedEndLocal.isAfter(closingLocal)) {
        return null;
      }

      // 3c. Check overlapping real-time statuses using UTC interval
      const overlappingStatuses = await prisma.barberRealTimeStatus.findFirst({
        where: {
          barberId: barber.userId,
          AND: [
            { startDateTime: { lt: requestedEndUtc.toDate() } },
            { endDateTime: { gt: requestedUtc.toDate() } },
          ],
        },
      });
      if (overlappingStatuses) return null;

      // 3d. Check overlapping bookings using UTC interval
      const overlappingBooking = await prisma.booking.findFirst({
        where: {
          barberId: barber.userId,
          AND: [
            { startDateTime: { lt: requestedEndUtc.toDate() } },
            { endDateTime: { gt: requestedUtc.toDate() } },
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
// image missing while UploadPartOutputFilterSensitiveLog;
// getBookingListForSalonOwnerFromDb (fixed)
const getBookingListForSalonOwnerFromDb = async (
  userId: string,
  query: {
    searchTerm?: string;
    type?: BookingType;
    status?: BookingStatus;
    date?: string;
    startDate?: string;
    endDate?: string;
    page?: string | number;
    limit?: string | number;
    sortBy?: 'date' | 'createdAt' | 'price';
    sortOrder?: 'asc' | 'desc';
  } = {},
) => {
  const {
    searchTerm,
    type,
    status,
    date,
    startDate,
    endDate,
    page = 1,
    limit = 10,
    sortBy = 'date',
    sortOrder = 'desc',
  } = query;

  // Convert page and limit to numbers
  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const limitNum = Math.max(1, parseInt(String(limit), 10) || 10);

  // Build where clause
  const whereConditions: any = {
    saloonOwnerId: userId,
  };

  // Filter by booking type
  if (type) {
    whereConditions.bookingType = type;
  }

  // Filter by status
  if (status) {
    whereConditions.status = status;
  }

  const salon = await prisma.saloonOwner.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const salonZone = getSalonTimezone(salon);

  // Filter by specific date
  if (date) {
    const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(date, salonZone);
    whereConditions.date = {
      gte: startOfDayUTC,
      lte: endOfDayUTC,
    };
  }

  // Filter by date range
  if (startDate && endDate) {
    const start = parseDateInZone(startDate, salonZone);
    const end = parseDateInZone(endDate, salonZone);
    if (start.isValid() && end.isValid()) {
      whereConditions.date = {
        gte: start.startOf('day').toDate(),
        lte: end.endOf('day').toDate(),
      };
    }
  } else if (startDate) {
    const start = parseDateInZone(startDate, salonZone);
    if (start.isValid()) {
      whereConditions.date = {
        gte: start.startOf('day').toDate(),
      };
    }
  } else if (endDate) {
    const end = parseDateInZone(endDate, salonZone);
    if (end.isValid()) {
      whereConditions.date = {
        lte: end.endOf('day').toDate(),
      };
    }
  }

  // Search term (search in notes, customer name, barber name, customer email, phone)
  if (searchTerm) {
    whereConditions.OR = [
      {
        notes: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      },
      {
        user: {
          fullName: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      },
      {
        user: {
          email: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      },
      {
        user: {
          phoneNumber: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      },
      {
        barber: {
          user: {
            fullName: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        },
      },
    ];
  }

  // Sorting
  const orderBy: any = {};
  if (sortBy === 'date') {
    orderBy.date = sortOrder;
  } else if (sortBy === 'createdAt') {
    orderBy.createdAt = sortOrder;
  } else if (sortBy === 'price') {
    orderBy.totalPrice = sortOrder;
  }

  // Pagination
  const skip = (pageNum - 1) * limitNum;

  // Get total count
  const total = await prisma.booking.count({
    where: whereConditions,
  });

  // Get bookings with relations
  const bookings = await prisma.booking.findMany({
    where: whereConditions,
    skip,
    take: limitNum,
    orderBy,
    select: {
      id: true,
      userId: true,
      barberId: true,
      saloonOwnerId: true,
      date: true,
      notes: true,
      isInQueue: true,
      totalPrice: true,
      originalPrice: true,
      discountAmount: true,
      discountOfferId: true,
      discountUsed: true,
      discountOffer: {
        select: {
          id: true,
          name: true,
          code: true,
          discountType: true,
          discountValue: true,
        },
      },
      startTime: true,
      endTime: true,
      estimatedDurationMinutes: true,
      actualStartedAt: true,
      actualEndedAt: true,
      actualDurationMinutes: true,
      status: true,
      bookingType: true,
      remoteQueue: true,
      createdAt: true,
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
  });

  // Collect unique userIds present in bookings
  const userIds = Array.from(
    new Set(bookings.map(b => b.userId).filter(Boolean)),
  );

  // Fetch registered users that match those ids
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

  // Remaining ids -> non-registered users
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

  // Map bookings to response shape using the lookup maps
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
      originalPrice: b.originalPrice ?? b.totalPrice,
      discountAmount: b.discountAmount ?? 0,
      discountUsed: b.discountUsed ?? false,
      discountOffer: b.discountOffer || null,
      notes: b.notes,
      customerImage: userInfo.image,
      customerName: userInfo.fullName,
      customerEmail: userInfo.email,
      customerPhone: userInfo.phoneNumber,
      isRegistered: !!regUserMap[b.userId], // true if user is in registered users map, false otherwise
      bookingDate: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      estimatedDurationMinutes: b.estimatedDurationMinutes,
      actualStartedAt: b.actualStartedAt,
      actualEndedAt: b.actualEndedAt,
      actualDurationMinutes: b.actualDurationMinutes,
      bookingType: b.bookingType,
      remoteQueue: b.remoteQueue,
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

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  return {
    data: mapped,
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },
    filters: {
      type: type || null,
      status: status || null,
      date: date || null,
      startDate: startDate || null,
      endDate: endDate || null,
      searchTerm: searchTerm || null,
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
  const allowedStatuses = [
    BookingStatus.CONFIRMED,
    BookingStatus.STARTED,
    BookingStatus.ENDED,
  ];

  const barberData = await prisma.barber.findUnique({
    where: { userId },
    select: {
      saloonOwner: {
        select: { timezone: true },
      },
    },
  });
  const salonZone = getSalonTimezone(barberData?.saloonOwner);

  const date = options.date
    ? (() => {
        const { startOfDayUTC, endOfDayUTC } = getDayBoundsInZone(
          String(options.date),
          salonZone,
        );
        return {
          appointmentAt: {
            gte: startOfDayUTC,
            lte: endOfDayUTC,
          },
        };
      })()
    : options.startDate || options.endDate
    ? (() => {
        const startM = options.startDate
          ? parseDateInZone(String(options.startDate), salonZone)
          : null;
        const endM = options.endDate
          ? parseDateInZone(String(options.endDate), salonZone)
          : null;
        return {
          appointmentAt: {
            ...(startM?.isValid() && { gte: startM.startOf('day').toDate() }),
            ...(endM?.isValid() && { lte: endM.endOf('day').toDate() }),
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
        originalPrice: true,
        discountAmount: true,
        discountOfferId: true,
        discountUsed: true,
        discountOffer: {
          select: {
            id: true,
            name: true,
            code: true,
            discountType: true,
            discountValue: true,
          },
        },
        startTime: true,
        endTime: true,
        estimatedDurationMinutes: true,
        actualStartedAt: true,
        actualEndedAt: true,
        actualDurationMinutes: true,
        status: true,
        remoteQueue: true,
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
      originalPrice: b.originalPrice ?? b.totalPrice,
      discountAmount: b.discountAmount ?? 0,
      discountUsed: b.discountUsed ?? false,
      discountOffer: b.discountOffer || null,
      notes: b.notes,
      customerImage: userInfo.image,
      customerName: userInfo.fullName,
      // customerEmail: userInfo.email,
      // customerPhone: userInfo.phoneNumber,
      remoteQueue: b.remoteQueue,
      bookingDate: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      estimatedDurationMinutes: b.estimatedDurationMinutes,
      actualStartedAt: b.actualStartedAt,
      actualEndedAt: b.actualEndedAt,
      actualDurationMinutes: b.actualDurationMinutes,
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
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
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
      originalPrice: true,
      discountAmount: true,
      discountOfferId: true,
      discountUsed: true,
      discountOffer: {
        select: {
          id: true,
          name: true,
          code: true,
          discountType: true,
          discountValue: true,
        },
      },
      startTime: true,
      endTime: true,
      estimatedDurationMinutes: true,
      actualStartedAt: true,
      actualEndedAt: true,
      actualDurationMinutes: true,
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
    originalPrice: result.originalPrice ?? result.totalPrice,
    discountAmount: result.discountAmount ?? 0,
    discountUsed: result.discountUsed ?? false,
    discountOffer: result.discountOffer || null,
    notes: result.notes,
    customerName: result.user?.fullName || null,
    customerEmail: result.user?.email || null,
    customerContact: result.user?.phoneNumber || null,
    date: result.date,
    time: result.startTime,
    estimatedDurationMinutes: result.estimatedDurationMinutes,
    actualStartedAt: result.actualStartedAt,
    actualEndedAt: result.actualEndedAt,
    actualDurationMinutes: result.actualDurationMinutes,
    serviceNames:
      result.BookedServices?.map(bs => bs.service?.serviceName) || [],
    barberName: result.barber?.user?.fullName || null,
    status: result.status || null,
  };
};

const updateBookingIntoDb = async (
  userId: string,
  data: any,
  bookingId: string,
) => {
  // Only allow customer to update the schedule (date and appointmentAt/time)
  const { barberId, date, appointmentAt } = data;

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
      // bookingType: BookingType.BOOKING,
      status: {
        in: [
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
          BookingStatus.RESCHEDULED,
        ],
      },
    },
    include: {
      saloonOwner: {
        select: { timezone: true },
      },
      BookedServices: {
        select: { serviceId: true, service: { select: { duration: true } } },
      },
      // queueSlot: true,
      // barber: true,
    },
  });

  if (!existingBooking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  const salonZone = getSalonTimezone(existingBooking.saloonOwner);

  const targetBarberId = barberId || existingBooking.barberId;
  const serviceIds = existingBooking.BookedServices.map(bs => bs.serviceId);

  // Calculate totalDuration from booked services
  const defaultDuration = existingBooking.BookedServices.reduce(
    (sum, bs) => sum + (bs.service?.duration || 0),
    0,
  );
  const totalDuration = await getPersonalizedEstimatedDurationMinutes(
    prisma,
    userId,
    targetBarberId,
    serviceIds,
    defaultDuration,
  );

  // Combine date and appointmentAt to get new startDateTime
  const localDateTime = parseDateTimeInZone(date, appointmentAt, salonZone);
  if (!localDateTime.isValid()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date or time format');
  }
  const utcDateTime = localDateTime.toDate();
  const { startOfDayUTC } = getDayBoundsInZone(localDateTime, salonZone);

  // Calculate new endDateTime
  const endDateTime = moment.utc(utcDateTime)
    .add(totalDuration, 'minutes')
    .toDate();

  // Check for overlapping bookings for this barber
  const overlappingBooking = await prisma.booking.findFirst({
    where: {
      barberId: targetBarberId,
      status: {
        in: [
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
          BookingStatus.RESCHEDULED,
        ],
      },
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
        barberId: targetBarberId,
        date: startOfDayUTC,
        appointmentAt: utcDateTime,
        startDateTime: utcDateTime,
        endDateTime: endDateTime,
        startTime: localDateTime.format('hh:mm A'),
        endTime: moment(endDateTime).tz(salonZone).format('hh:mm A'),
        estimatedDurationMinutes: totalDuration,
      },
    });

    // 2. Update queueSlot if exists
    // if (existingBooking.queueSlot) {
    //   // Update the current slot's startedAt before reordering
    //   await tx.queueSlot.update({
    //     where: { id: existingBooking.queueSlot[0].id },
    //     data: {
    //       startedAt: utcDateTime,
    //       completedAt: endDateTime,
    //     },
    //   });

    //   // Fetch all slots again, ordered by startedAt
    //   const queueSlots = await tx.queueSlot.findMany({
    //     where: {
    //       queueId: existingBooking.queueSlot[0]?.queueId,
    //     },
    //     orderBy: { startedAt: 'asc' },
    //   });

    //   // Re-assign positions sequentially based on startedAt
    //   for (let i = 0; i < queueSlots.length; i++) {
    //     await tx.queueSlot.update({
    //       where: { id: queueSlots[i].id },
    //       data: { position: i + 1 },
    //     });
    //   }
    // }

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
        barberId: targetBarberId,
        startDateTime: utcDateTime,
        endDateTime: endDateTime,
        isAvailable: false,
        startTime: localDateTime.format('hh:mm A'),
        endTime: moment(endDateTime).tz(salonZone).format('hh:mm A'),
      },
    });

    return updatedBooking;
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'bookingId, not updated');
  }

  // Send rescheduling notification to customer
  try {
    if (result?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { fcmToken: true },
      });

      if (user) {
        await notificationService.sendNotification(
          user.fcmToken,
          'Booking Rescheduled',
          `Your booking has been rescheduled to ${result.startDateTime ? new Date(result.startDateTime).toLocaleString() : 'a new time'}.`,
          result.userId,
        );
      }
    }
  } catch (error) {
    console.error('Error sending reschedule notification:', error);
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
    include: {
      queueSlot: true,
    },
  });
  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }
  if (!['NO_SHOW', 'COMPLETED'].includes(status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid status. Allowed value is NO_SHOW or COMPLETED',
    );
  }

  if (booking.status === BookingStatus.COMPLETED) {
    const findBookingEndTime = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        saloonOwnerId: userId,
      },
      select: {
        endDateTime: true,
      },
    });
    if (findBookingEndTime && findBookingEndTime.endDateTime) {
      const currentTime = new Date();
      // Allow COMPLETED status only if current time is within 15 minutes before or after endDateTime
      const fifteenMinutesBeforeEnd = new Date(
        findBookingEndTime.endDateTime.getTime() - 15 * 60 * 1000,
      );
      if (currentTime < fifteenMinutesBeforeEnd) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Cannot change status to COMPLETED before 15 minutes prior to the booking end time',
        );
      }
      // replace the current block with this
      if (status === BookingStatus.COMPLETED) {
        const findBookingEndTime = await prisma.booking.findUnique({
          where: {
            id: bookingId,
            saloonOwnerId: userId,
          },
          select: {
            endDateTime: true,
            BookedServices: {
              select: {
                serviceId: true,
                price: true,
              },
            },
          },
        });
        if (findBookingEndTime && findBookingEndTime.endDateTime) {
          const currentTime = new Date();
          const fifteenMinutesBeforeEnd = new Date(
            findBookingEndTime.endDateTime.getTime() - 15 * 60 * 1000,
          );
          if (currentTime < fifteenMinutesBeforeEnd) {
            throw new AppError(
              httpStatus.BAD_REQUEST,
              'Cannot change status to COMPLETED before 15 minutes prior to the booking end time',
            );
          }
        }
      }
    }
  }

  // If status is CANCELED or COMPLETED, update related records in a transaction
  // If CANCELED: delete queueSlot and barberRealTimeStatus, decrement queue currentPosition
  // If COMPLETED: delete barberRealTimeStatus, update queueSlot status to COMPLETED, decrement queue currentPosition
  // If CONFIRMED: just update the booking status
  // If RESCHEDULED: just update the booking status

  const result = await prisma.$transaction(async tx => {
    // if (status === BookingStatus.CONFIRMED) {
    //   const checkPending = await tx.booking.update({
    //     where: {
    //       id: bookingId,
    //       saloonOwnerId: userId,
    //       status: BookingStatus.PENDING,
    //     },
    //     data: {
    //       status: BookingStatus.CONFIRMED,
    //     },
    //   });
    //   if (!checkPending) {
    //     throw new AppError(
    //       httpStatus.BAD_REQUEST,
    //       'Only PENDING bookings can be CONFIRMED',
    //     );
    //   }
    //   return checkPending;
    // }

    if (status === BookingStatus.COMPLETED) {
      // Get booked services and calculate loyalty points
      const bookingWithServices = await tx.booking.findUnique({
        where: { id: bookingId, saloonOwnerId: userId },
        include: {
          BookedServices: {
            include: {
              service: true,
            },
          },
          queueSlot: true,
        },
      });

      if (bookingWithServices) {
        const serviceIds = bookingWithServices.BookedServices.map(
          bs => bs.serviceId,
        );
        const totalAmount = bookingWithServices.BookedServices.reduce(
          (sum, bs) => sum + Number(bs.price),
          0,
        );

        // Find loyalty points for services
        const findPoints = await tx.loyaltyProgram.findFirst({
          where: {
            userId: userId,
            serviceId: { in: serviceIds },
          },
          select: { points: true, id: true },
        });

        let pointsToAdd = 0;
        if (findPoints) {
          pointsToAdd = (findPoints.points || 0) * serviceIds.length;
        }

        // Upsert customer loyalty
        await tx.customerLoyalty.upsert({
          where: {
            userId_saloonOwnerId: {
              userId: bookingWithServices.userId,
              saloonOwnerId: userId,
            },
          },
          create: {
            userId: bookingWithServices.userId,
            saloonOwnerId: userId,
            totalPoints: pointsToAdd,
          },
          update: {
            totalPoints: { increment: pointsToAdd },
          },
        });

        // Create customer visit record
        await tx.customerVisit.create({
          data: {
            customerId: bookingWithServices.userId,
            saloonOwnerId: userId,
            visitDate: new Date(),
            amountSpent: bookingWithServices.totalPrice ?? totalAmount,
            serviceId: serviceIds,
          },
        });

        // Update booking status to COMPLETED
        const completedBooking = await tx.booking.update({
          where: { id: bookingId, saloonOwnerId: userId },
          data: { status: BookingStatus.COMPLETED },
        });

        await tx.barberRealTimeStatus.deleteMany({
          where: {
            barberId: bookingWithServices.barberId,
            startDateTime: bookingWithServices.startDateTime!,
            endDateTime: bookingWithServices.endDateTime!,
          },
        });

        await tx.queueSlot.updateMany({
          where: { bookingId: bookingId },
          data: { status: 'COMPLETED' },
        });

        await tx.queue.updateMany({
          where: { id: bookingWithServices.queueSlot?.[0]?.queueId },
          data: { currentPosition: { decrement: 1 } },
        });

        await StripeServices.capturePaymentRequestToStripe(
          userId,
          {
            bookingId,
            status: BookingStatus.COMPLETED,
          },
          tx,
        );

        return completedBooking;
      }
    }
    if (status === BookingStatus.NO_SHOW) {
      // Get booked services and calculate loyalty points
      const bookingWithServices = await tx.booking.findUnique({
        where: { id: bookingId, saloonOwnerId: userId },
        include: {
          BookedServices: {
            include: {
              service: true,
            },
          },
          queueSlot: true,
        },
      });

      if (bookingWithServices) {
        const serviceIds = bookingWithServices.BookedServices.map(
          bs => bs.serviceId,
        );
        const totalAmount = bookingWithServices.BookedServices.reduce(
          (sum, bs) => sum + Number(bs.price),
          0,
        );

        // Find loyalty points for services
        const findPoints = await tx.loyaltyProgram.findFirst({
          where: {
            userId: userId,
            serviceId: { in: serviceIds },
          },
          select: { points: true, id: true },
        });

        let pointsToAdd = 0;
        if (findPoints) {
          pointsToAdd = (findPoints.points || 0) * serviceIds.length;
        }

        // Upsert customer loyalty
        await tx.customerLoyalty.upsert({
          where: {
            userId_saloonOwnerId: {
              userId: bookingWithServices.userId,
              saloonOwnerId: userId,
            },
          },
          create: {
            userId: bookingWithServices.userId,
            saloonOwnerId: userId,
            totalPoints: pointsToAdd,
          },
          update: {
            totalPoints: { increment: pointsToAdd },
          },
        });

        // Create customer visit record
        await tx.customerVisit.create({
          data: {
            customerId: bookingWithServices.userId,
            saloonOwnerId: userId,
            visitDate: new Date(),
            amountSpent: totalAmount,
            serviceId: serviceIds,
          },
        });

        // Update booking status to COMPLETED
        const completedBooking = await tx.booking.update({
          where: { id: bookingId, saloonOwnerId: userId },
          data: { status: BookingStatus.NO_SHOW },
        });

        await tx.barberRealTimeStatus.deleteMany({
          where: {
            barberId: bookingWithServices.barberId,
            startDateTime: bookingWithServices.startDateTime!,
            endDateTime: bookingWithServices.endDateTime!,
          },
        });

        await tx.queueSlot.updateMany({
          where: { bookingId: bookingId },
          data: { status: QueueStatus.NO_SHOW },
        });

        await tx.queue.updateMany({
          where: { id: bookingWithServices.queueSlot?.[0]?.queueId },
          data: { currentPosition: { decrement: 1 } },
        });

        await StripeServices.capturePaymentRequestToStripe(
          userId,
          {
            bookingId,
            status: BookingStatus.NO_SHOW,
          },
          tx,
        );

        return completedBooking;
      }
    }

    return null;
  });

  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Failed to update booking status',
    );
  }

  // Send status update notification to customer
  try {
    if (result?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { fcmToken: true },
      });

      if (user) {
        let notificationTitle = 'Booking Status Updated';
        let notificationBody = '';

        switch (result.status) {
          case BookingStatus.COMPLETED:
            notificationTitle = 'Service Completed';
            notificationBody =
              'Your service has been completed. Please leave a review!';
            break;
          case BookingStatus.CANCELLED:
            notificationTitle = 'Booking Cancelled';
            notificationBody = 'Your booking has been cancelled.';
            break;
          case BookingStatus.STARTED:
            notificationTitle = 'Service Started';
            notificationBody = 'Your service has started.';
            break;
          case BookingStatus.NO_SHOW:
            notificationTitle = 'No Show Recorded';
            notificationBody =
              'You have been marked as a no-show for your booking.';
            break;
          case BookingStatus.ENDED:
            notificationTitle = 'Service Ended';
            notificationBody = 'Your service has ended.';
            break;
        }

        if (notificationBody) {
          await notificationService.sendNotification(
            user.fcmToken,
            notificationTitle,
            notificationBody,
            result.userId,
            userId,
          );
        }
      }
    }
  } catch (error) {
    console.error('Error sending booking status notification:', error);
  }

  return result;
};

const cancelBookingIntoDb = async (userId: string, bookingId: string) => {
  // Fetch the existing booking to verify ownership and get payment info
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      userId: userId,
      status: {
        in: [
          BookingStatus.PENDING,
          BookingStatus.CONFIRMED,
          BookingStatus.RESCHEDULED,
        ],
      },
    },
    include: {
      queueSlot: true,
      Payment: true,
    },
  });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  /* ---------------------------------------------------- */
  /* Calculate Time to Booking Start                    */
  /* ---------------------------------------------------- */

  const now = new Date();
  const bookingStartTime = booking.startDateTime || new Date();
  const hoursUntilBooking =
    (bookingStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isMoreThanOneDayBefore = hoursUntilBooking > 24;

  /* ---------------------------------------------------- */
  /* Handle Payment Cancellation                        */
  /* ---------------------------------------------------- */

  if (booking.Payment && booking.Payment.length > 0) {
    const payment = booking.Payment[0];

    const SERVICE_FEE_PENCE = 50; // £0.50

    try {
      // CASE 1: Cancelled LESS than 1 day before booking
      // NO REFUND - App keeps full amount as cancellation penalty (last-minute cancellation)
      if (!isMoreThanOneDayBefore) {
        console.log(
          'Cancellation < 1 day before booking: NO REFUND - last-minute cancellation penalty',
        );

        if (payment.checkoutSessionId) {
          const session = await stripe.checkout.sessions.retrieve(
            payment.checkoutSessionId,
          );

          // If not yet paid, expire the session (no charge)
          if (session.payment_status !== 'paid') {
            await stripe.checkout.sessions.expire(payment.checkoutSessionId);
            console.log('Checkout Session expired (no payment taken)');
          } else {
            // If already paid, keep the money - NO REFUND
            console.log(
              'Checkout Session already paid - NO REFUND applied (last-minute penalty)',
            );
          }
        } else if (payment.paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            payment.paymentIntentId,
          );

          if (paymentIntent.status === 'requires_capture') {
            // Just cancel without capturing - releases authorization, NO REFUND
            await stripe.paymentIntents.cancel(payment.paymentIntentId);
            console.log(
              'PaymentIntent canceled - NO REFUND (last-minute penalty)',
            );
          } else if (paymentIntent.status === 'succeeded') {
            // Already succeeded - keep the money, NO REFUND
            console.log(
              'Payment already succeeded - NO REFUND (last-minute penalty)',
            );
          }
        }

        // Update payment to COMPLETED - app keeps full amount
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            paymentAmount: payment.paymentAmount || 0, // App keeps entire amount
          },
        });
      }
      // CASE 2: Cancelled MORE than 1 day before booking
      // Customer gets refund (totalAmount - £0.50), Admin keeps £0.50 service fee
      else {
        console.log(
          'Cancellation > 1 day before booking: Refund (totalAmount - £0.50), admin keeps service fee',
        );

        if (payment.checkoutSessionId) {
          const session = await stripe.checkout.sessions.retrieve(
            payment.checkoutSessionId,
          );

          // If payment is already completed, refund amount minus service fee
          if (session.payment_status === 'paid') {
            console.log(
              'Checkout Session already paid, creating refund for customer',
            );
            const refundAmount = Math.max(
              0,
              (payment.paymentAmount || 0) - SERVICE_FEE_PENCE,
            );
            if (refundAmount > 0 && session.payment_intent) {
              await stripe.refunds.create({
                payment_intent: session.payment_intent as string,
                amount: refundAmount,
              });
            }
          } else {
            // If not yet paid, try to expire
            try {
              await stripe.checkout.sessions.expire(payment.checkoutSessionId);
            } catch (error) {
              console.warn('Could not expire session:', error);
            }
          }
        } else if (payment.paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            payment.paymentIntentId,
          );

          if (paymentIntent.status === 'requires_capture') {
            // FIRST: Capture the full amount to settle the payment
            await stripe.paymentIntents.capture(payment.paymentIntentId);

            // THEN: Immediately refund amount minus service fee (£0.50)
            const refundAmount = Math.max(
              0,
              paymentIntent.amount - SERVICE_FEE_PENCE,
            );
            if (refundAmount > 0) {
              await stripe.refunds.create({
                payment_intent: payment.paymentIntentId,
                amount: refundAmount,
              });
            }
          } else if (paymentIntent.status === 'succeeded') {
            // Already succeeded, refund amount minus service fee
            const refundAmount = Math.max(
              0,
              paymentIntent.amount - SERVICE_FEE_PENCE,
            );
            if (refundAmount > 0) {
              await stripe.refunds.create({
                payment_intent: payment.paymentIntentId,
                amount: refundAmount,
              });
            }
          }
        }

        // Update payment to COMPLETED with service fee kept (£0.50)
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            paymentAmount: SERVICE_FEE_PENCE,
          },
        });
      }
    } catch (error: any) {
      console.error('❌ Error processing payment cancellation:', {
        message: error.message,
        code: error.code,
        type: error.type,
      });
      // Continue with booking cancellation - payment error should not block booking cancellation
    }
  }

  /* ---------------------------------------------------- */
  /* Update Booking and Related Records                 */
  /* ---------------------------------------------------- */

  const result = await prisma.$transaction(async tx => {
    // 1. Update booking status to CANCELLED
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

    // Restore discount offer usage count if discount was applied
    if (booking.discountOfferId && booking.discountUsed) {
      await tx.salonDiscountOffer.update({
        where: { id: booking.discountOfferId },
        data: { usageCount: { decrement: 1 } },
      });
    }

    // 2. Delete associated queueSlot if exists
    if (booking.queueSlot && booking.queueSlot.length > 0) {
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

    // delete the loyalty redemption record if exists for this booking
    await tx.loyaltyRedemption.deleteMany({
      where: {
        bookingId: bookingId,
      },
    });

    return updatedBooking;
  });

  // Send cancellation notification to customer
  try {
    if (result?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { fcmToken: true },
      });

      if (user) {
        await notificationService.sendNotification(
          user.fcmToken,
          'Booking Cancelled',
          'Your booking has been cancelled successfully.',
          result.userId,
        );
      }
    }
  } catch (error) {
    console.error('Error sending cancellation notification:', error);
  }

  return result;
};

const deleteBookingItemFromDb = async (userId: string, bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
      saloonOwnerId: userId,
    },
  });
  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  const deletedItem = await prisma.booking.delete({
    where: {
      id: bookingId,
      saloonOwnerId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'bookingId, not deleted');
  }

  if (
    deletedItem.discountOfferId &&
    deletedItem.discountUsed &&
    deletedItem.status !== BookingStatus.COMPLETED
  ) {
    await prisma.salonDiscountOffer
      .update({
        where: { id: deletedItem.discountOfferId },
        data: { usageCount: { decrement: 1 } },
      })
      .catch(err => {
        console.error('Failed to restore discount offer usage on deletion:', err);
      });
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
  // Note: Handle account deactivation : exclude loyalty schemes for deactivated salons
  const schemes = await prisma.loyaltyScheme.findMany({
    where: {
      userId: saloonOwnerId,
      user: { isDeactivated: false },
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
  createQueueBookingForCustomerIntoDb,
  getAvailableBarbersFromDb,
  getBookingByIdFromDb,
  updateBookingIntoDb,
  updateBookingStatusIntoDb,
  cancelBookingIntoDb,
  deleteBookingItemFromDb,
  getLoyaltySchemesForCustomerFromDb,
};

import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { buildCompleteQuery } from '../../utils/searchFilter';
import { calculatePagination, formatPaginationResponse } from '../../utils/pagination';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { UserRoleEnum } from '@prisma/client';
import config from '../../../config';
import { DateTime } from 'luxon';

const createGroupIntoDb = async (userId: string, groupData: any) => {
  const { data, groupImage } = groupData;

  const result = await prisma.room.create({
    data: {
      ...data,
      groupImage: groupImage,
      creatorId: userId,
      participants: {
        create: {
          userId: userId, // Add the creator as the first participant
        },
      },
    },
    include: {
      participants: true,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Group not created');
  }

  return result;
};

const getGroupListFromDb = async () => {
  const result = await prisma.room.findMany({
    include: {
      participants: {
        include: {
          user: {
            select: {
              image: true,
            },
          },
        },
      },
    },
  });

  if (result.length === 0) {
    return { message: 'No group found' };
  }

  const groupsWithParticipantDetails = result.map(group => ({
    ...group,
    participants: group.participants.map(participant => ({
      ...participant,
    })),
    participantCount: group.participants.length,
  }));

  return groupsWithParticipantDetails;
};

const getGroupByIdFromDb = async (groupId: string) => {
  const result = await prisma.room.findUnique({
    where: {
      id: groupId,
    },
    include: {
      participants: true,
      chat: true,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Group not found');
  }

  return result;
};

const updateGroupIntoDb = async (
  userId: string,
  groupId: string,
  groupData: any,
) => {
  const { data, groupImage } = groupData;

  const result = await prisma.room.update({
    where: {
      id: groupId,
      creatorId: userId,
    },
    data: {
      ...data,
      groupImage: groupImage,
    },
    include: {
      participants: true,
      chat: true,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Group not updated');
  }

  return result;
};

const deleteGroupItemFromDb = async (userId: string, groupId: string) => {
  try {
    const deletedItem = await prisma.$transaction(async prisma => {
      // Step 1: Delete all related chats
      await prisma.chat.deleteMany({
        where: { roomId: groupId },
      });

      // Step 2: Delete all related room participants
      await prisma.roomUser.deleteMany({
        where: { roomId: groupId },
      });

      // Step 3: Delete the room (group)
      const deletedRoom = await prisma.room.delete({
        where: {
          id: groupId,
          creatorId: userId,
        },
      });

      if (!deletedRoom) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Group not found or you are not the creator',
        );
      }

      return deletedRoom;
    });

    return deletedItem;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to delete group and related data',
    );
  }
};

const getBarbersListFromDb = async (options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  const whereClause = buildCompleteQuery(
    {
      searchTerm: options.searchTerm,
      searchFields: ['fullName', 'email', 'phoneNumber'],
    },
    {
      role: UserRoleEnum.BARBER,
      status: options.status,
    },
    {
      startDate: options.startDate,
      endDate: options.endDate,
      dateField: 'createdAt',
    },
  );

  // Handle Barber specific filters
  if (options.experienceYears !== undefined) {
    whereClause.Barber = {
      experienceYears: {
        gte: Number(options.experienceYears),
      },
    };
  }

  const [barbers, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        status: true,
        Barber: {
          select: {
            userId: true,
            portfolio: true,
            experienceYears: true,
            skills: true,
            bio: true,
            ratingCount: true,
            avgRating: true,
            saloonOwner: {
              select: {
                id: true,
                shopName: true,
                shopAddress: true,
              },
            },
            HiredBarber: {
              select: {
                id: true,
                hourlyRate: true,
              },
            },        
          },
        },
      },
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  // Flatten the response so that Barber fields are at the top level
  const flattenedBarbers = barbers.map(barber => {
    const {Barber, ...userFields } = barber;
    return {
      ...userFields,
      userId: Barber?.userId || userFields.id,
      portfolio: Barber?.portfolio,
      experienceYears: Barber?.experienceYears,
      skills: Barber?.skills,
      bio: Barber?.bio,
      hourlyRate: Barber?.HiredBarber?.[0]?.hourlyRate || null,
      shopId: Barber?.saloonOwner?.id ?? null,
      shopName: Barber?.saloonOwner?.shopName ?? null,
      shopAddress: Barber?.saloonOwner?.shopAddress ?? null,
    };
  });

  return formatPaginationResponse(flattenedBarbers, total, page, limit);
};

const getBarberByIdFromDb = async (userId: string, barberId: string) => {
  const result = await prisma.user.findUnique({
    where: {
      id: barberId,
      role: UserRoleEnum.BARBER,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      status: true,
      stripeAccountId: true,
      stripeAccountUrl: true,
      createdAt: true,
      Barber: {
        select: {
          userId: true,
          portfolio: true,
          experienceYears: true,
          skills: true,
          bio: true,
          ratingCount: true,
          avgRating: true,
          saloonOwner: {
            select: {
              id: true,
              shopName: true,
              shopAddress: true,
              shopLogo: true,
              shopImages: true,
              shopVideo: true,
            },
          },
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Barber not found');
  }

  //get bank details from the stripe
  const stripe = require('stripe')(config.stripe.stripe_secret_key);
  let account = null;
  let bankName = null;
  let accountHolderName = null;
  let branchCity = null;
  let branchCode = null;
  let accountNumber = null;

  if (result.stripeAccountId) {
    account = await stripe.accounts.retrieve(result.stripeAccountId);

    // Stripe external_accounts may contain bank details
    interface StripeBankAccount {
      object: string;
      bank_name?: string;
      routing_number?: string;
      last4?: string;
      [key: string]: any;
    }

    interface StripeExternalAccounts {
      data?: StripeBankAccount[];
      [key: string]: any;
    }

    interface StripeAccount {
      external_accounts?: StripeExternalAccounts;
      [key: string]: any;
    }

    const bankAccount: StripeBankAccount | undefined = (
      account as StripeAccount
    )?.external_accounts?.data?.find(
      (acc: StripeBankAccount) => acc.object === 'bank_account',
    );
    bankName = bankAccount?.bank_name || null;
    accountHolderName =
      account?.individual?.first_name && account?.individual?.last_name
        ? `${account.individual.first_name} ${account.individual.last_name}`
        : null;

    branchCity = bankAccount?.bank_name || null;
    branchCode = bankAccount?.routing_number || null;
    accountNumber = bankAccount?.last4 ? `****${bankAccount.last4}` : null;
  }

  return {
    barberIdd: result.id,
    fullName: result.fullName,
    email: result.email,
    phoneNumber: result.phoneNumber,
    status: result.status,
    portfolio: result.Barber?.portfolio || [],
    experienceYears: result.Barber?.experienceYears || 0,
    skills: result.Barber?.skills || [],
    bio: result.Barber?.bio || '',
    shopId: result.Barber?.saloonOwner?.id || null,
    shopName: result.Barber?.saloonOwner?.shopName || null,
    shopAddress: result.Barber?.saloonOwner?.shopAddress || null,
    shopLogo: result.Barber?.saloonOwner?.shopLogo || null,
    shopImages: result.Barber?.saloonOwner?.shopImages || [],
    shopVideo: result.Barber?.saloonOwner?.shopVideo || null,
    ratingCount: result.Barber?.ratingCount || 0,
    avgRating: result.Barber?.avgRating || 0,
    bankDetails: {
      bankName,
      accountHolderName,
      accountNumber,
      branchCity,
      branchCode,
    },
  };
};

// const createQueueBookingForCustomerIntoDb1 = async (
//   userId: string,
//   saloonOwnerId: string,
//   data: any,
// ) => {
//   const { date, services, notes, type } = data;
//   let appointmentAt: string | undefined = data.appointmentAt;

//   // Helper: pick the earliest free slot start that can accommodate totalDuration (minutes).
//   const pickEarliestSlotForBarber = (
//     freeSlots: { start: string; end: string }[] | undefined,
//     totalDurationMinutes: number,
//   ): string | undefined => {
//     if (!freeSlots || freeSlots.length === 0) return undefined;

//     const nowLocal = DateTime.now().setZone(config.timezone);

//     for (const slot of freeSlots) {
//       const slotStart = DateTime.fromFormat(
//         `${date} ${slot.start}`,
//         'yyyy-MM-dd hh:mm a',
//         { zone: config.timezone },
//       );
//       const slotEnd = DateTime.fromFormat(
//         `${date} ${slot.end}`,
//         'yyyy-MM-dd hh:mm a',
//         { zone: config.timezone },
//       );

//       if (!slotStart.isValid || !slotEnd.isValid) continue;

//       // Skip slots that have completely ended
//       if (slotEnd <= nowLocal) continue;

//       // If slot starts in the past but ends in the future, use current time as start
//       const effectiveStart = slotStart < nowLocal ? nowLocal : slotStart;

//       const slotMinutes = slotEnd.diff(effectiveStart, 'minutes').minutes;

//       // For queue bookings, allow booking if there's ANY time available
//       // (booking can extend beyond the free slot)
//       if (slotMinutes > 0) {
//         return effectiveStart.toFormat('hh:mm a');
//       }
//     }

//     return undefined;
//   };

//   // 1. Basic validation
//   if (!date || !Array.isArray(services) || services.length === 0) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       'date and services are required',
//     );
//   }

//   // Only allow queue for the current local date
//   const dateObj = DateTime.fromISO(date, { zone: config.timezone });
//   if (!dateObj.isValid) {
//     throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
//   }
//   const todayLocal = DateTime.now().setZone(config.timezone).toISODate();
//   if (dateObj.toISODate() !== todayLocal) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       'Queue bookings can only be created for the current date',
//     );
//   }

//   // 2. Get service records & totals
//   const serviceRecords = await prisma.service.findMany({
//     where: { id: { in: services } },
//     select: { id: true, price: true, duration: true },
//   });
//   if (serviceRecords.length !== services.length) {
//     throw new AppError(httpStatus.BAD_REQUEST, 'Some services not found');
//   }
//   //////////
//   const serviceIds = serviceRecords.map(s => s.id);

//   // need to check from the queueTime model to get the total duration if exists of related services
//   const avgDuration = await prisma.queueTime.findMany({
//     where: {
//       serviceIds: {
//         hasEvery: serviceIds, // Must contain all service IDs
//         equals: serviceIds, // Must be exact match
//       },
//     },
//     select: {
//       saloonId: true,
//       barberId: true,
//       serviceIds: true,
//       averageMin: true,
//     },
//   });
//   if (avgDuration && avgDuration.length > 0) {
//     const matched = avgDuration.find(qt => {
//       if (
//         qt.serviceIds.length === serviceIds.length &&
//         qt.serviceIds.every(id => serviceIds.includes(id))
//       ) {
//         return true;
//       }
//       return false;
//     });
//     if (matched) {
//       // override the serviceRecords duration with averageMin from queueTime
//       serviceRecords.forEach(s => {
//         s.duration = matched.averageMin;
//       });
//     }
//   }
//   /////////
//   const totalDuration = serviceRecords.reduce(
//     (sum, s) => sum + (s.duration || 0),
//     0,
//   );
//   if (totalDuration <= 0) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       'Total service duration must be greater than zero',
//     );
//   }
//   const totalPrice = serviceRecords.reduce(
//     (sum, s) => sum + Number(s.price),
//     0,
//   );

//   // 3. Find available barbers for walking-in
//   const availableBarbers = await getAvailableBarbersForWalkingInFromDb1(
//     userId,
//     saloonOwnerId,
//     date,
//     type as BookingType,
//   );

//   console.log(
//     'Available barbers for walking-in for customer:',
//     JSON.stringify(availableBarbers, null, 2),
//   );

//   if (
//     !availableBarbers ||
//     !Array.isArray(availableBarbers) ||
//     availableBarbers.length === 0
//   ) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       'No available barbers found for queue on this date',
//     );
//   }

//   // 4. Choose barber/slot
//   let chosen: any = null;
//   let chosenAppointmentAt: string | undefined = appointmentAt;

//   const sorted = availableBarbers.filter(Boolean).sort((a: any, b: any) => {
//     const aw = a.queue?.estimatedWaitTime ?? 0;
//     const bw = b.queue?.estimatedWaitTime ?? 0;
//     if (aw !== bw) return aw - bw;
//     const at = a.queue?.totalInQueue ?? 0;
//     const bt = b.queue?.totalInQueue ?? 0;
//     return at - bt;
//   });

//   if (!appointmentAt) {
//     const nowLocal = DateTime.now().setZone(config.timezone);

//     type Candidate = {
//       barber: any;
//       slotStartStr?: string;
//       slotStartDt?: DateTime;
//     };

//     const candidates: Candidate[] = [];

//     for (const b of sorted) {
//       if (!b) continue;
//       console.log(`Checking barber ${b.barberId}, free slots:`, b.freeSlots);

//       const slotStartStr = pickEarliestSlotForBarber(
//         b.freeSlots,
//         totalDuration,
//       );

//       console.log(`Selected slot for barber ${b.barberId}:`, slotStartStr);

//       if (!slotStartStr) continue;

//       const slotDt = DateTime.fromFormat(
//         `${date} ${slotStartStr}`,
//         'yyyy-MM-dd hh:mm a',
//         { zone: config.timezone },
//       );

//       if (!slotDt.isValid) {
//         console.log(`Invalid slot DateTime for barber ${b.barberId}`);
//         continue;
//       }

//       // Allow slots that start now or in the future (5 minute grace period)
//       if (slotDt < nowLocal.minus({ minutes: 5 })) {
//         console.log(`Slot too far in past for barber ${b.barberId}`);
//         continue;
//       }

//       candidates.push({ barber: b, slotStartStr, slotStartDt: slotDt });
//     }

//     console.log(`Found ${candidates.length} candidate barbers`);

//     if (candidates.length > 0) {
//       candidates.sort((x, y) => {
//         if (!x.slotStartDt || !y.slotStartDt) return 0;
//         return x.slotStartDt.valueOf() - y.slotStartDt.valueOf();
//       });
//       chosen = candidates[0].barber;
//       chosenAppointmentAt = candidates[0].slotStartStr;
//       console.log('Selected barber from candidates:', chosen.barberId);
//     } else {
//       // Fallback: find any barber with free slots that have any remaining time
//       console.log('No candidates found, trying fallback logic');

//       for (const b of sorted) {
//         if (!b || !b.freeSlots || b.freeSlots.length === 0) continue;

//         for (const slot of b.freeSlots) {
//           const slotStart = DateTime.fromFormat(
//             `${date} ${slot.start}`,
//             'yyyy-MM-dd hh:mm a',
//             { zone: config.timezone },
//           );
//           const slotEnd = DateTime.fromFormat(
//             `${date} ${slot.end}`,
//             'yyyy-MM-dd hh:mm a',
//             { zone: config.timezone },
//           );

//           if (!slotStart.isValid || !slotEnd.isValid) continue;

//           // Check if slot is still valid (ends in the future)
//           if (slotEnd > nowLocal) {
//             // Use current time if slot started in the past
//             const effectiveStart = slotStart < nowLocal ? nowLocal : slotStart;
//             const remainingMinutes = slotEnd.diff(
//               effectiveStart,
//               'minutes',
//             ).minutes;

//             console.log(
//               `Fallback: Barber ${b.barberId}, slot ${slot.start}-${slot.end}, remaining: ${remainingMinutes}min`,
//             );

//             // Allow booking if there's any time remaining
//             if (remainingMinutes > 0) {
//               chosen = b;
//               chosenAppointmentAt = effectiveStart.toFormat('hh:mm a');
//               console.log(
//                 `Fallback selected barber ${b.barberId} at ${chosenAppointmentAt}`,
//               );
//               break;
//             }
//           }
//         }

//         if (chosen) break;
//       }

//       if (!chosen) {
//         throw new AppError(
//           httpStatus.NOT_FOUND,
//           `No available time slots found. Current time: ${nowLocal.toFormat('hh:mm a')}. Available barbers checked: ${sorted.length}. Please try again later or contact the salon.`,
//         );
//       }
//     }
//   } else {
//     chosen = sorted[0];
//     chosenAppointmentAt = appointmentAt;
//   }

//   if (!chosen) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       'Could not auto-select a barber',
//     );
//   }

//   const barberId = chosen.barberId;

//   console.log(`Final selection: Barber ${barberId} at ${chosenAppointmentAt}`);

//   // 5. Determine appointment time
//   const useAppointmentAt =
//     chosenAppointmentAt ??
//     DateTime.now().setZone(config.timezone).toFormat('hh:mm a');

//   const localDateTime = DateTime.fromFormat(
//     `${date} ${useAppointmentAt}`,
//     'yyyy-MM-dd hh:mm a',
//     { zone: config.timezone },
//   );
//   if (!localDateTime.isValid) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       'Invalid appointment time format',
//     );
//   }

//   const nowLocal = DateTime.now().setZone(config.timezone);
//   const endLocal = localDateTime.plus({ minutes: totalDuration });

//   // Allow bookings that end in the future (even if they start slightly in the past due to processing time)
//   if (endLocal < nowLocal) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       'Appointment time has already passed',
//     );
//   }

//   const utcDateTime = localDateTime.toUTC().toJSDate();

//   // ...existing code for transaction...
//   const result = await prisma.$transaction(async tx => {
//     await tx.queue.deleteMany({
//       where: {
//         barberId,
//         saloonOwnerId,
//         isActive: false,
//         date: { lt: new Date() },
//       },
//     });

//     const queueDate = new Date(date);
//     let queue = await tx.queue.findFirst({
//       where: {
//         barberId,
//         saloonOwnerId,
//         date: queueDate,
//       },
//     });

//     if (!queue) {
//       queue = await tx.queue.create({
//         data: {
//           barberId,
//           saloonOwnerId,
//           date: queueDate,
//           currentPosition: 1,
//         },
//       });
//       if (!queue) {
//         throw new AppError(httpStatus.BAD_REQUEST, 'Error creating queue');
//       }
//     } else {
//       queue = await tx.queue.update({
//         where: { id: queue.id },
//         data: { currentPosition: queue.currentPosition + 1 },
//       });
//       if (!queue) {
//         throw new AppError(httpStatus.BAD_REQUEST, 'Error updating queue');
//       }
//     }

//     const existingSlots = await tx.queueSlot.findMany({
//       where: { queueId: queue.id },
//       orderBy: { startedAt: 'asc' },
//     });

//     let insertPosition = 1;
//     for (let i = 0; i < existingSlots.length; i++) {
//       const slot = existingSlots[i];
//       if (slot && slot.startedAt && utcDateTime > slot.startedAt) {
//         insertPosition = i + 2;
//       } else {
//         break;
//       }
//     }

//     const endDateTimeForCheck = DateTime.fromJSDate(utcDateTime)
//       .plus({ minutes: totalDuration })
//       .toJSDate();

//     const overlappingStatus = await tx.barberRealTimeStatus.findFirst({
//       where: {
//         barberId,
//         AND: [
//           { startDateTime: { lt: endDateTimeForCheck } },
//           { endDateTime: { gt: utcDateTime } },
//         ],
//       },
//     });

//     const overlappingBooking = await tx.booking.findFirst({
//       where: {
//         barberId,
//         AND: [
//           { startDateTime: { lt: endDateTimeForCheck } },
//           { endDateTime: { gt: utcDateTime } },
//         ],
//       },
//     });

//     if (overlappingStatus || overlappingBooking) {
//       throw new AppError(
//         httpStatus.NOT_FOUND,
//         'Barber is unavailable during the requested time slot',
//       );
//     }

//     for (let i = existingSlots.length - 1; i >= insertPosition - 1; i--) {
//       await tx.queueSlot.update({
//         where: { id: existingSlots[i].id },
//         data: { position: existingSlots[i].position + 1 },
//       });
//     }

//     const queueSlot = await tx.queueSlot.create({
//       data: {
//         queueId: queue.id,
//         customerId: userId,
//         barberId,
//         position: insertPosition,
//         startedAt: utcDateTime,
//       },
//     });
//     if (!queueSlot) {
//       throw new AppError(httpStatus.BAD_REQUEST, 'Error creating queue slot');
//     }

//     const booking = await tx.booking.create({
//       data: {
//         userId: userId,
//         barberId,
//         saloonOwnerId,
//         appointmentAt: utcDateTime,
//         date: new Date(date),
//         notes: notes ?? null,
//         bookingType: BookingType.QUEUE,
//         isInQueue: true,
//         totalPrice,
//         startDateTime: utcDateTime,
//         endDateTime: DateTime.fromJSDate(utcDateTime)
//           .plus({ minutes: totalDuration })
//           .toJSDate(),
//         startTime: localDateTime.toFormat('hh:mm a'),
//         endTime: DateTime.fromJSDate(utcDateTime)
//           .plus({ minutes: totalDuration })
//           .toFormat('hh:mm a'),
//         loyaltySchemeId: null,
//         loyaltyUsed: false,
//       },
//     });

//     await tx.queueSlot.update({
//       where: { id: queueSlot.id },
//       data: {
//         bookingId: booking.id,
//         completedAt: DateTime.fromJSDate(utcDateTime)
//           .plus({ minutes: totalDuration })
//           .toJSDate(),
//       },
//     });

//     await Promise.all(
//       serviceRecords.map(s =>
//         tx.bookedServices.create({
//           data: {
//             bookingId: booking.id,
//             customerId: userId,
//             serviceId: s.id,
//             price: s.price,
//           },
//         }),
//       ),
//     );

//     const endDateTime = DateTime.fromJSDate(utcDateTime)
//       .plus({ minutes: totalDuration })
//       .toJSDate();

//     await tx.barberRealTimeStatus.create({
//       data: {
//         barberId,
//         startDateTime: utcDateTime,
//         endDateTime,
//         isAvailable: false,
//         startTime: localDateTime.toFormat('hh:mm a'),
//         endTime: DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
//       },
//     });

//     return {
//       booking,
//       queue,
//       queueSlot: { ...queueSlot, bookingId: booking.id },
//     };
//   });

//   return result;
// };

// const getTopRatedSaloonsFromDb = async (
//   userId: string,
//   query: {
//     searchTerm?: string;
//     page?: number;
//     limit?: number;
//     minRating?: number;
//   },
// ) => {
//   const { searchTerm = '', page = 1, limit = 10, minRating } = query;

//   // Build where clause
//   const where: any = {
//     isVerified: true,
//   };

//   if (searchTerm) {
//     where.OR = [
//       { shopName: { contains: searchTerm, mode: 'insensitive' } },
//       { shopAddress: { contains: searchTerm, mode: 'insensitive' } },
//     ];
//   }

//   if (minRating) {
//     where.avgRating = { gte: minRating };
//   }

//   // Get all saloons
//   const allSaloons = await prisma.saloonOwner.findMany({
//     where,
//     select: {
//       id: true,
//       userId: true,
//       shopName: true,
//       shopAddress: true,
//       shopImages: true,
//       shopLogo: true,
//       shopVideo: true,
//       latitude: true,
//       longitude: true,
//       ratingCount: true,
//       avgRating: true,
//       Booking: {
//         where: {
//           bookingType: BookingType.QUEUE,
//           date: {
//             gte: new Date(new Date().setHours(0, 0, 0, 0)),
//             lt: new Date(new Date().setHours(23, 59, 59, 999)),
//           },
//           status: {
//             in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
//           },
//         },
//         select: {
//           id: true,
//           barberId: true,
//         },
//       },
//       user: {
//         select: {
//           phoneNumber: true,
//           email: true,
//           HiredBarber: {
//             select: {
//               barberId: true,
//               barber: {
//                 select: {
//                   userId: true,
//                   user: {
//                     select: {
//                       id: true,
//                       fullName: true,
//                       image: true,
//                     },
//                   },
//                   Booking: {
//                     where: {
//                       bookingType: BookingType.QUEUE,
//                       date: {
//                         gte: new Date(new Date().setHours(0, 0, 0, 0)),
//                         lt: new Date(new Date().setHours(23, 59, 59, 999)),
//                       },
//                       status: {
//                         in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
//                       },
//                     },
//                     select: {
//                       id: true,
//                     },
//                   },
//                 },
//               },
//             },
//           },
//           Service: {
//             select: {
//               serviceName: true
//             }
//           }
//         },
//       },
//       FavoriteShop: { select: { id: true, userId: true } },
//     },
//     orderBy: {
//       avgRating: 'desc', // Sort by rating descending
//     },
//   });

//   // Process saloons with shop status and barber availability
//   const processedSaloons = await Promise.all(
//     allSaloons.map(async saloon => {
//       // Check if user favorited this shop
//       const isFavorite = userId
//         ? saloon.FavoriteShop.some(fav => fav.userId === userId)
//         : false;

//       // Check shop open/closed status using models
//       const shopStatus = await checkShopStatus(saloon.userId);

//       // Calculate total queue for the shop
//       const totalShopQueue = Array.isArray(saloon.Booking)
//         ? saloon.Booking.length
//         : 0;

//       // Process barbers
//       const availableBarbers = await Promise.all(
//         (saloon.user?.HiredBarber || []).map(async (hiredBarber: any) => {
//           const barber = hiredBarber.barber;
//           if (!barber) return null;

//           const availability = await checkBarberAvailability(barber.userId);

//           // Skip barbers not available today
//           if (!availability.isAvailableToday) {
//             return null;
//           }

//           const barberQueueCount = Array.isArray(barber.Booking)
//             ? barber.Booking.length
//             : 0;

//           return {
//             barberId: barber.userId,
//             barberName: barber.user?.fullName || 'Unknown',
//             barberImage: barber.user?.image || null,
//             queueCount: barberQueueCount,
//             availableForQueue: availability.availableForQueue,
//             availableForBooking: availability.availableForBooking,
//             serviceType: availability.type, // 'QUEUE' or 'BOOKING'
//             workingHours: {
//               openingTime: availability.openingTime || null,
//               closingTime: availability.closingTime || null,
//             },
//           };
//         }),
//       );

//       const filteredBarbers = availableBarbers.filter(Boolean);

//       return {
//         // Shop Details
//         // shopId: saloon.id,
//         userId: saloon.userId,
//         shopName: saloon.shopName,
//         shopAddress: saloon.shopAddress,
//         shopLogo: saloon.shopLogo,
//         shopImages: saloon.shopImages || [],
//         shopVideo: saloon.shopVideo || [],
//         phoneNumber: saloon.user?.phoneNumber || null,
//         email: saloon.user?.email || null,

//         // Location
//         latitude: Number(saloon.latitude),
//         longitude: Number(saloon.longitude),
//         distance: 0, // No distance calculation for top-rated

//         // Ratings
//         avgRating: saloon.avgRating ? Number(saloon.avgRating) : 0,
//         ratingCount: saloon.ratingCount || 0,

//         // Status
//         isOpen: shopStatus.isOpen,
//         shopStatus: shopStatus.status,
//         statusReason: shopStatus.reason || null,
//         todayWorkingHours: {
//           openingTime: shopStatus.openingTime || null,
//           closingTime: shopStatus.closingTime || null,
//         },

//         // Queue Info
//         totalQueueCount: totalShopQueue,

//         // Barbers
//         availableBarbers: filteredBarbers,
//         totalAvailableBarbers: filteredBarbers.length,

//         // User specific
//         isFavorite,
//         isServiceAvailable: saloon.user.Service.length > 0
//       };
//     }),
//   );

//   // Sort by avgRating descending (already sorted in query, but ensure it)
//   const sortedSaloons = processedSaloons.sort(
//     (a, b) => b.avgRating - a.avgRating,
//   );

//   // Apply pagination
//   const total = sortedSaloons.length;
//   const skip = (page - 1) * limit;
//   const paginatedSaloons = sortedSaloons.slice(skip, skip + limit);
//   const hasNextPage = page < total / limit;
//   const hasPrevPage = page > 1;

//   return {
//     data: paginatedSaloons,
//     meta: {
//       total,
//       page,
//       limit,
//       totalPages: Math.ceil(total / limit),
//       hasNextPage,
//       hasPrevPage,
//     },
//   };
// };

export const groupService = {
  createGroupIntoDb,
  getGroupListFromDb,
  getGroupByIdFromDb,
  updateGroupIntoDb,
  deleteGroupItemFromDb,
};

import { customerRoutes } from './../customer/customer.routes';
import Stripe from 'stripe';
import {
  BookingStatus,
  BookingType,
  PaymentStatus,
  QueueStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { DateTime } from 'luxon';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import {
  calculatePagination,
  formatPaginationResponse,
} from '../../utils/pagination';
import prisma from '../../utils/prisma';
import config from '../../../config';

// Initialize Stripe
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

const manageBookingsIntoDb = async (
  userId: string,
  data: {
    bookingId: string;
    status: BookingStatus;
  },
) => {
  const booking = await prisma.booking.findUnique({
    where: {
      id: data.bookingId,
      saloonOwnerId: userId,
    },
    include: {
      BookedServices: true,
      Payment: true,
    },
  });

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  const currentStatus = booking.status;
  const targetStatus = data.status;

  /* ---------------------------------------------------- */
  /* Status Transition Validation                       */
  /* ---------------------------------------------------- */
  
  switch (targetStatus) {
    case BookingStatus.PENDING:
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Status cannot be changed back to pending',
      );

    case BookingStatus.COMPLETED:
      // COMPLETED validations - check for invalid states first
      if (currentStatus === BookingStatus.CANCELLED) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Cancelled bookings cannot be marked as completed',
        );
      }
      if (currentStatus === BookingStatus.NO_SHOW) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'No-show bookings cannot be marked as completed',
        );
      }
      if (currentStatus !== (BookingStatus.CONFIRMED || BookingStatus.ENDED)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Only confirmed and ended bookings can be marked as completed',
        );
      }
      // Check 15 minutes before end time
      if (booking.endDateTime) {
        const currentTime = new Date();
        const fifteenMinutesBeforeEnd = new Date(
          booking.endDateTime.getTime() - 15 * 60 * 1000,
        );
        if (currentTime < fifteenMinutesBeforeEnd) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Cannot complete booking before 15 minutes prior to end time',
          );
        }
      }
      break;

    case BookingStatus.NO_SHOW:
      // NO_SHOW validations - check for invalid states first
      if (currentStatus === BookingStatus.COMPLETED) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Completed bookings cannot be marked as no-show',
        );
      }
      if (currentStatus === BookingStatus.CANCELLED) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Cancelled bookings cannot be marked as no-show',
        );
      }
      if (currentStatus === BookingStatus.NO_SHOW) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Booking is already marked as no-show',
        );
      }
      if (currentStatus !== BookingStatus.CONFIRMED) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Only confirmed bookings can be marked as no-show',
        );
      }
      // Check 15 minutes before end time
      if (booking.endDateTime) {
        const currentTime = new Date();
        const fifteenMinutesBeforeEnd = new Date(
          booking.endDateTime.getTime() - 15 * 60 * 1000,
        );
        if (currentTime < fifteenMinutesBeforeEnd) {
          throw new AppError(
            httpStatus.BAD_REQUEST,
            'Cannot mark as no-show before 15 minutes prior to end time',
          );
        }
      }
      break;

    case BookingStatus.CANCELLED:
      // CANCELLED validations
      if (currentStatus === BookingStatus.COMPLETED) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Completed bookings cannot be cancelled',
        );
      }
      if (currentStatus === BookingStatus.CANCELLED) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Booking is already cancelled',
        );
      }
      if (currentStatus === BookingStatus.NO_SHOW) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'No-show bookings cannot be cancelled',
        );
      }
      break;

    default:
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid status transition');
  }

  /* ---------------------------------------------------- */
  /* Handle Payment Operations                          */
  /* ---------------------------------------------------- */

  if (booking.Payment && booking.Payment.length > 0) {
    const payment = booking.Payment[0];

    // COMPLETED or NO_SHOW: Capture the payment
    if (targetStatus === BookingStatus.COMPLETED || targetStatus === BookingStatus.NO_SHOW) {
      try {
        // Only capture if payment is in REQUIRES_CAPTURE status
        if (payment.status === PaymentStatus.REQUIRES_CAPTURE && payment.paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            payment.paymentIntentId,
          );

          if (paymentIntent.status === 'requires_capture') {
            // Capture the payment - triggers transfer_data to shop owner
            await stripe.paymentIntents.capture(payment.paymentIntentId);
            console.log('Payment captured for booking:', { bookingId: booking.id, paymentId: payment.id });
          }
        }

        // Update payment to COMPLETED
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.COMPLETED },
        });
      } catch (error: any) {
        console.error('Error capturing payment:', error.message);
        throw new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to process payment capture',
        );
      }
    }

    // CANCELLED: Full refund (no service fee)
    if (targetStatus === BookingStatus.CANCELLED) {
      try {
        // Check if payment is uncaptured (REQUIRES_CAPTURE)
        if (payment.status === PaymentStatus.REQUIRES_CAPTURE && payment.paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            payment.paymentIntentId,
          );

          if (paymentIntent.status === 'requires_capture') {
            // Cancel the uncaptured payment intent
            await stripe.paymentIntents.cancel(payment.paymentIntentId);
            console.log('Uncaptured payment cancelled (full refund):', { bookingId: booking.id, paymentId: payment.id });
          } else if (paymentIntent.status === 'succeeded') {
            // If already captured, create full refund (entire amount)
            await stripe.refunds.create({
              payment_intent: payment.paymentIntentId,
              amount: paymentIntent.amount, // Full refund without deducting service fee
            });
            console.log('Full refund issued for captured payment:', { bookingId: booking.id, paymentId: payment.id });
          }
        } else if (payment.status === PaymentStatus.COMPLETED && payment.paymentIntentId) {
          // Already captured, issue full refund
          const paymentIntent = await stripe.paymentIntents.retrieve(
            payment.paymentIntentId,
          );

          await stripe.refunds.create({
            payment_intent: payment.paymentIntentId,
            amount: paymentIntent.amount, // Full refund
          });
          console.log('Full refund issued for completed payment:', { bookingId: booking.id, paymentId: payment.id });
        }

        // Update payment to REFUNDED
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.REFUNDED },
        });
      } catch (error: any) {
        console.error('Error processing refund:', error.message);
        throw new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to process payment refund',
        );
      }
    }
  }

  /* ---------------------------------------------------- */
  /* Update Booking Status                              */
  /* ---------------------------------------------------- */

  return await prisma.$transaction(async tx => {
    const updatedBooking = await tx.booking.update({
      where: {
        id: data.bookingId,
        saloonOwnerId: userId,
      },
      data: {
        status: targetStatus,
      },
    });

    // ---------- Handle Post-Completion/NO_SHOW Tasks ----------
    if (targetStatus === BookingStatus.COMPLETED || targetStatus === BookingStatus.NO_SHOW) {
      // Delete barber real-time availability
      if (updatedBooking.startDateTime && updatedBooking.endDateTime) {
        const barberRealTimeStatus = await tx.barberRealTimeStatus.findFirst({
          where: {
            barberId: booking.barberId,
            barber: {
              saloonOwnerId: userId,
            },
            startDateTime: updatedBooking.startDateTime,
            endDateTime: updatedBooking.endDateTime,
          },
        });
        if (barberRealTimeStatus) {
          console.log(
            'Deleted barber real-time status for completed/no-show booking',
            barberRealTimeStatus.id,
          );
          await tx.barberRealTimeStatus.delete({
            where: {
              id: barberRealTimeStatus.id,
            },
          });
        }
      }

      // Handle queue bookings
      if (updatedBooking.bookingType === BookingType.QUEUE) {
        const saloonQueue = await tx.queue.findFirst({
          where: {
            saloonOwnerId: userId,
            barberId: booking.barberId,
            isActive: true,
            date: updatedBooking.date,
          },
        });
        if (saloonQueue && saloonQueue.currentPosition > 0) {
          await tx.queue.update({
            where: {
              id: saloonQueue.id,
            },
            data: {
              currentPosition: { decrement: 1 },
            },
          });

          console.log('Updating queue slots for completed/no-show booking');

          await tx.queueSlot.updateMany({
            where: {
              queueId: saloonQueue.id,
              bookingId: updatedBooking.id,
            },
            data: {
              status: targetStatus === BookingStatus.COMPLETED ? QueueStatus.COMPLETED : QueueStatus.CANCELLED,
              position: 0,
            },
          });
        }
      }

      // ---------- Handle Loyalty Points (Registered Users Only) ----------
      // Only add loyalty points if COMPLETED (not for NO_SHOW)
      if (targetStatus === BookingStatus.COMPLETED) {
        const checkRegUser = await tx.user.findUnique({
          where: { id: booking.userId },
        });

        if (!checkRegUser) {
          return updatedBooking;
        }

        const serviceIds = booking.BookedServices.map(bs => bs.serviceId);

        const loyaltyPrograms = await tx.loyaltyProgram.findMany({
          where: {
            userId: userId,
            serviceId: { in: serviceIds },
          },
        });

        if (loyaltyPrograms.length > 0) {
          const totalPoints = loyaltyPrograms.reduce(
            (sum, lp) => sum + lp.points,
            0,
          );

          if (totalPoints > 0) {
            await tx.customerLoyalty.create({
              data: {
                userId: booking.userId,
                saloonOwnerId: userId,
                totalPoints: totalPoints,
              },
            });

            await tx.customerVisit.create({
              data: {
                customerId: booking.userId,
                saloonOwnerId: userId,
                serviceId: serviceIds,
                visitDate: new Date(),
                amountSpent: booking.totalPrice,
                earnedPoints: totalPoints,
              },
            });

            const existingLog = await tx.loyaltyPointLog.findFirst({
              where: {
                customerId: booking.userId,
                saloonId: userId,
              },
            });

            if (existingLog) {
              await tx.loyaltyPointLog.update({
                where: { id: existingLog.id },
                data: { visitCount: { increment: 1 } },
              });
            } else {
              await tx.loyaltyPointLog.create({
                data: {
                  customerId: booking.userId,
                  saloonId: userId,
                  visitCount: 1,
                },
              });
            }
          }
        }
      }
    }

    // ---------- Handle Cancellation Cleanup ----------
    if (targetStatus === BookingStatus.CANCELLED) {
      // Delete barber real-time availability
      if (updatedBooking.startDateTime && updatedBooking.endDateTime) {
        await tx.barberRealTimeStatus.deleteMany({
          where: {
            barberId: booking.barberId,
            startDateTime: updatedBooking.startDateTime,
            endDateTime: updatedBooking.endDateTime,
          },
        });
      }

      // Handle queue bookings
      if (updatedBooking.bookingType === BookingType.QUEUE) {
        const saloonQueue = await tx.queue.findFirst({
          where: {
            saloonOwnerId: userId,
            barberId: booking.barberId,
            isActive: true,
            date: updatedBooking.date,
          },
        });
        if (saloonQueue && saloonQueue.currentPosition > 0) {
          await tx.queue.update({
            where: {
              id: saloonQueue.id,
            },
            data: {
              currentPosition: { decrement: 1 },
            },
          });

          await tx.queueSlot.updateMany({
            where: {
              queueId: saloonQueue.id,
              bookingId: updatedBooking.id,
            },
            data: {
              status: QueueStatus.CANCELLED,
            },
          });
        }
      }
    }

    return updatedBooking;
  });
};

const getBarberDashboardFromDb = async (userId: string) => {
  const customerCount = await prisma.booking.count({
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
    },
  });
  const totalEarnings = await prisma.booking.aggregate({
    _sum: {
      totalPrice: true,
    },
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
    },
  });

  const barberCount = await prisma.barber.count({
    where: {
      saloonOwnerId: userId,
    },
  });
  const bookingCount = await prisma.booking.count({
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.PENDING,
      bookingType: BookingType.BOOKING
    },
  });

  const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const queueBooking = await prisma.booking.count({
      where: {
        saloonOwnerId: userId,
        bookingType: BookingType.QUEUE,
        status: BookingStatus.PENDING,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

  const jobPostCount = await prisma.jobPost.count({
    where: {
      saloonOwnerId: userId,
    },
  });

  const totalJobApplicants = await prisma.jobApplication.count({
    where: {
      saloonOwnerId: userId,
    },
  });

  // Get customer growth for the last 12 months, grouped by month and year (e.g., Jan 2024)
  const startDate = new Date();
startDate.setUTCHours(0, 0, 0, 0);

  const customerGrowthRaw = await prisma.booking.findMany({
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
      createdAt: {
        gte: startDate,
      },
    },
    select: {
      createdAt: true,
    },
  });

  // Prepare a map for each month in the last 12 months (e.g., Jan 2024)
  const monthlyGrowth: { [key: string]: number } = {};
  for (let i = 0; i < 12; i++) {
    const dt = DateTime.now().minus({ months: 11 - i });
    const monthYear = dt.toFormat('LLL yyyy'); // e.g., Jan 2024
    monthlyGrowth[monthYear] = 0;
  }

  // Count bookings per month-year
  customerGrowthRaw.forEach(item => {
    const monthYear = DateTime.fromJSDate(item.createdAt).toFormat('LLL yyyy');
    if (monthlyGrowth[monthYear] !== undefined) {
      monthlyGrowth[monthYear]++;
    }
  });

  // Calculate earning growth for the last 12 months, grouped by month and year
  const earningGrowthRaw = await prisma.booking.findMany({
    where: {
      saloonOwnerId: userId,
      status: BookingStatus.COMPLETED,
      createdAt: {
        gte: startDate,
      },
    },
    select: {
      createdAt: true,
      totalPrice: true,
    },
  });

  // Prepare a map for each month in the last 12 months for earnings
  const monthlyEarnings: { [key: string]: number } = {};
  for (let i = 0; i < 12; i++) {
    const dt = DateTime.now().minus({ months: 11 - i });
    const monthYear = dt.toFormat('LLL yyyy');
    monthlyEarnings[monthYear] = 0;
  }

  // Sum earnings per month-year
  earningGrowthRaw.forEach(item => {
    const monthYear = DateTime.fromJSDate(item.createdAt).toFormat('LLL yyyy');
    if (monthlyEarnings[monthYear] !== undefined) {
      monthlyEarnings[monthYear] += item.totalPrice ?? 0;
    }
  });

  return {
    totalCustomers: customerCount,
    totalEarnings: totalEarnings._sum.totalPrice || 0,
    totalBarbers: barberCount,
    totalBookings: bookingCount,
    totalJobPosts: jobPostCount,
    totalJobApplicants: totalJobApplicants,
    totalQueuedBookings: queueBooking || 0,
    earningGrowth: Object.entries(monthlyEarnings).map(([month, amount]) => ({
      month,
      amount,
    })),
    customerGrowth: Object.entries(monthlyGrowth).map(([month, count]) => ({
      month,
      count,
    })),
  };
};

const getCustomerBookingsFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {},
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for customer name, email, phone, or barber name
  const searchQuery = options.searchTerm
    ? {
        OR: [
          {
            user: {
              fullName: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            user: {
              email: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            user: {
              phoneNumber: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            barber: {
              user: {
                fullName: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
        ],
      }
    : {};

  // Status filter: exclude PENDING and CONFIRMED by default
  const excludedStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
  const excludedStatusStrings = excludedStatuses.map(s => s.toString());
  const statusFilter =
    options.status && Array.isArray(options.status)
      ? {
          status: {
            in: (options.status as string[]).filter(
              s => !excludedStatusStrings.includes(s),
            ) as BookingStatus[],
          },
        }
      : options.status
        ? excludedStatusStrings.includes(options.status as string)
          ? { status: { notIn: excludedStatuses } }
          : { status: options.status as BookingStatus }
        : { status: { notIn: excludedStatuses } };

  const whereClause = {
    saloonOwnerId: userId,
    ...statusFilter,
    ...(Object.keys(searchQuery).length > 0 && searchQuery),
  };

  // 1) Query bookings but do NOT include `user` relation directly (use userId scalar instead)
  const [result, total] = await Promise.all([
    prisma.booking.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        userId: true, // scalar id (could refer to User OR NonRegisteredUser)
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        totalPrice: true,
        // Barber info (barber.user is expected to exist)
        barber: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                image: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        BookedServices: {
          select: {
            service: {
              select: {
                id: true,
                serviceName: true,
                price: true,
                availableTo: true,
              },
            },
          },
        },
      },
    }),
    prisma.booking.count({ where: whereClause }),
  ]);

  // 2) Collect unique customer ids from this page
  const customerIds = Array.from(
    new Set(result.map(b => b.userId).filter(Boolean as any)),
  );

  // 3) Fetch registered users for these ids
  const registeredUsers =
    customerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: {
            id: true,
            fullName: true,
            image: true,
            email: true,
            phoneNumber: true,
          },
        })
      : [];

  const regUserMap = registeredUsers.reduce<Record<string, any>>((acc, u) => {
    acc[u.id] = u;
    return acc;
  }, {});

  // 4) Identify ids not present in registered users → query non-registered users
  const nonRegisteredIds = customerIds.filter(id => !regUserMap[id]);
  const nonRegisteredUsers =
    nonRegisteredIds.length > 0
      ? await prisma.nonRegisteredUser.findMany({
          where: { id: { in: nonRegisteredIds } },
          select: { id: true, fullName: true, email: true, phone: true },
        })
      : [];

  const nonRegMap = nonRegisteredUsers.reduce<Record<string, any>>((acc, n) => {
    acc[n.id] = n;
    return acc;
  }, {});

  // 5) Map bookings and merge customer info (registered or non-registered)
  const bookings = result.map(booking => {
    // Resolve customer info
    let customerId: string | null = null;
    let customerName: string | null = null;
    let customerImage: string | null = null;
    let customerEmail: string | null = null;
    let customerPhone: string | null = null;

    if (booking.userId) {
      if (regUserMap[booking.userId]) {
        const u = regUserMap[booking.userId];
        customerId = u.id;
        customerName = u.fullName;
        customerImage = u.image ?? null;
        customerEmail = u.email ?? null;
        customerPhone = u.phoneNumber ?? null;
      } else if (nonRegMap[booking.userId]) {
        const n = nonRegMap[booking.userId];
        customerId = n.id;
        customerName = n.fullName;
        customerImage = null;
        customerEmail = n.email ?? null;
        customerPhone = n.phone ?? null;
      } else {
        customerId = booking.userId;
        customerName = 'Unknown Customer';
      }
    }

    const barberUser = booking.barber?.user;

    return {
      bookingId: booking.id,
      customerId,
      customerName,
      customerImage,
      customEmail: customerEmail,
      customerPhone,
      barberId: barberUser?.id ?? null,
      barberName: barberUser?.fullName ?? null,
      barberImage: barberUser?.image ?? null,
      barberEmail: barberUser?.email ?? null,
      barberPhone: barberUser?.phoneNumber ?? null,
      totalPrice: booking.totalPrice,
      bookingDate: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      services: booking.BookedServices.map(s => ({
        serviceId: s.service.id,
        serviceName: s.service.serviceName,
        price: s.service.price,
        availableTo: s.service.availableTo,
      })),
    };
  });

  return formatPaginationResponse(bookings, total, page, limit);
};

const getRemainingBarbersToScheduleFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {},
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for barber name, phone, address, or email
  const searchQuery = options.searchTerm
    ? {
        OR: [
          {
            barber: {
              user: {
                fullName: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
          {
            barber: {
              user: {
                phoneNumber: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
          {
            barber: {
              user: {
                address: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
          {
            barber: {
              user: {
                email: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
        ],
      }
    : {};

  // First, get all hired barbers for this saloon owner with search filter
  const hiredBarbers = await prisma.hiredBarber.findMany({
    where: {
      userId: userId,
      ...(Object.keys(searchQuery).length > 0 && searchQuery),
    },
    select: {
      barberId: true,
      barber: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              image: true,
              phoneNumber: true,
              address: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (hiredBarbers.length === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  const hiredBarberIds = hiredBarbers.map(hb => hb.barberId);

  // Next, find barbers who do not have any schedule entries
  const barbersWithSchedules = await prisma.barberSchedule.findMany({
    where: {
      barberId: { in: hiredBarberIds },
      saloonOwnerId: userId,
    },
    select: {
      barberId: true,
    },
    distinct: ['barberId'],
  });

  const scheduledBarberIds = barbersWithSchedules.map(bs => bs.barberId);

  // Barbers without schedules are those hired but not in the scheduled list
  const allRemainingBarbers = hiredBarbers
    .filter(hb => !scheduledBarberIds.includes(hb.barberId))
    .map(hb => ({
      barberId: hb.barberId,
      barberName: hb.barber.user.fullName,
      barberImage: hb.barber.user.image,
      barberEmail: hb.barber.user.email,
      barberPhone: hb.barber.user.phoneNumber,
      barberAddress: hb.barber.user.address,
    }));

  const total = allRemainingBarbers.length;

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Apply sorting
  const sortedBarbers = allRemainingBarbers.sort((a, b) => {
    const aValue = a[sortBy as keyof typeof a] ?? '';
    const bValue = b[sortBy as keyof typeof b] ?? '';
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Apply pagination
  const paginatedBarbers = sortedBarbers.slice(skip, skip + limit);

  return formatPaginationResponse(paginatedBarbers, total, page, limit);
};

const getFreeBarbersOnADateFromDb = async (
  userId: string,
  date: string,
  options: ISearchAndFilterOptions = {},
) => {
  if (!date) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Date is required');
  }
  const targetDate = DateTime.fromISO(date, { zone: config.timezone });
  if (!targetDate.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date format');
  }
  // const dayName = targetDate.toFormat('cccc'); // e.g., 'Monday'

  // Step 1: Get all hired barbers for this saloon owner
  const hiredBarbers = await prisma.hiredBarber.findMany({
    where: {
      userId: userId,
    },
    select: {
      barberId: true,
      barber: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              image: true,
              phoneNumber: true,
              address: true,
            },
          },
        },
      },
    },
  });

  if (hiredBarbers.length === 0) {
    return { message: 'No hired barbers found' };
  }

  const hiredBarberIds = hiredBarbers.map(hb => hb.barberId);

  // Step 2: Find barbers who have a schedule on the specified day and are active
  const barbersWithDaySchedule = await prisma.barberSchedule.findMany({
    where: {
      barberId: { in: hiredBarberIds },
      saloonOwnerId: userId,
      // dayName: dayName,
      isActive: true,
    },
    select: {
      barberId: true,
      openingTime: true, // e.g., "09:00 AM"
      closingTime: true, // e.g., "05:00 PM"
    },
    distinct: ['barberId'],
  });

  const scheduledBarberIds = barbersWithDaySchedule.map(bs => bs.barberId);

  // Step 3: For each scheduled barber, get their bookings for that date
  const bookings = await prisma.booking.findMany({
    where: {
      barberId: { in: scheduledBarberIds },
      saloonOwnerId: userId,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      date: targetDate.toJSDate(),
    },
    select: {
      barberId: true,
      startTime: true,
      endTime: true,
    },
  });

  console.log('targetDate', targetDate);

  // Group bookings by barberId
  const bookingsByBarber: Record<
    string,
    { startTime: string; endTime: string }[]
  > = {};
  bookings.forEach(b => {
    if (!bookingsByBarber[b.barberId]) bookingsByBarber[b.barberId] = [];
    bookingsByBarber[b.barberId].push({
      startTime: b.startTime!,
      endTime: b.endTime!,
    });
  });

  // For each scheduled barber, calculate free slots
  const freeBarberSlots = barbersWithDaySchedule
    .map(schedule => {
      const hired = hiredBarbers.find(hb => hb.barberId === schedule.barberId);
      if (!schedule.openingTime || !schedule.closingTime) return null;

      const dateStr = targetDate.toFormat('yyyy-MM-dd');
      const opening = DateTime.fromFormat(
        `${dateStr} ${schedule.openingTime}`,
        'yyyy-MM-dd hh:mm a',
        { zone: targetDate.zone },
      );
      const closing = DateTime.fromFormat(
        `${dateStr} ${schedule.closingTime}`,
        'yyyy-MM-dd hh:mm a',
        { zone: targetDate.zone },
      );
      if (!opening.isValid || !closing.isValid) return null;

      // Get all bookings for this barber, sorted by startTime
      const barberBookings = (bookingsByBarber[schedule.barberId] || [])
        .map(b => ({
          start: DateTime.fromFormat(
            `${dateStr} ${b.startTime}`,
            'yyyy-MM-dd hh:mm a',
            { zone: targetDate.zone },
          ),
          end: DateTime.fromFormat(
            `${dateStr} ${b.endTime}`,
            'yyyy-MM-dd hh:mm a',
            { zone: targetDate.zone },
          ),
        }))
        .filter(b => b.start.isValid && b.end.isValid)
        .sort((a, b) => a.start.toMillis() - b.start.toMillis());

      // Find free slots between opening and closing, excluding bookings
      const freeSlots: { start: string; end: string }[] = [];
      let lastEnd = opening;

      for (const booking of barberBookings) {
        if (booking.start > lastEnd) {
          freeSlots.push({
            start: lastEnd.toFormat('hh:mm a'),
            end: booking.start.toFormat('hh:mm a'),
          });
        }
        if (booking.end > lastEnd && booking.end.isValid) {
          lastEnd = booking.end as DateTime;
        }
      }
      if (lastEnd < closing) {
        freeSlots.push({
          start: lastEnd.toFormat('hh:mm a'),
          end: closing.toFormat('hh:mm a'),
        });
      }

      return {
        barberId: hired?.barberId,
        barberName: hired?.barber.user.fullName,
        barberImage: hired?.barber.user.image,
        barberPhone: hired?.barber.user.phoneNumber,
        barberAddress: hired?.barber.user.address,
        freeSlots,
      };
    })
    .filter(Boolean);

  // Barbers who do not have a schedule on that day are not available
  if (freeBarberSlots.length === 0) {
    return { message: 'No free barbers available on the selected date' };
  }
  return freeBarberSlots;
};

const getTransactionsFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions = {},
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  const searchTerm = options.searchTerm?.trim();

  // Build booking-level search conditions (used inside booking where)
  const bookingSearchOr: any[] = [];
  if (searchTerm) {
    bookingSearchOr.push(
      {
        user: {
          fullName: { contains: searchTerm, mode: 'insensitive' as const },
        },
      },
      {
        user: { email: { contains: searchTerm, mode: 'insensitive' as const } },
      },
      {
        user: {
          phoneNumber: { contains: searchTerm, mode: 'insensitive' as const },
        },
      },
      {
        barber: {
          user: {
            fullName: { contains: searchTerm, mode: 'insensitive' as const },
          },
        },
      },
      {
        BookedServices: {
          some: {
            service: {
              serviceName: {
                contains: searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
        },
      },
    );
  }

  // Main where clause (payments that belong to bookings for this salon owner)
  const whereClause: any = {
    status: { in: [PaymentStatus.COMPLETED, PaymentStatus.CASH, PaymentStatus.REFUNDED, PaymentStatus.CANCELLED] },
    booking: {
      saloonOwnerId: userId,
      ...(bookingSearchOr.length ? { AND: [{ OR: bookingSearchOr }] } : {}),
    },
  };

  // Fetch payments (do NOT select booking.user relation — only scalar booking.userId)
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        booking: {
          select: {
            id: true,
            userId: true, // scalar only
            totalPrice: true,
            date: true,
            startTime: true,
            endTime: true,
            status: true,
            // booking -> barber -> user is safe to include (barber.user is actual barber record)
            barber: {
              select: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    image: true,
                    email: true,
                    phoneNumber: true,
                  },
                },
              },
            },
            BookedServices: {
              select: {
                service: {
                  select: {
                    id: true,
                    serviceName: true,
                    price: true,
                    availableTo: true,
                  },
                },
              },
            },
            queueSlot: {
              select: { id: true, position: true },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    }),
    prisma.payment.count({ where: whereClause }),
  ]);

  // Collect unique userIds referenced by bookings
  const userIds = Array.from(
    new Set(payments.map(p => p.booking?.userId).filter(Boolean as any)),
  );

  // Fetch registered users for those ids
  const filteredUserIds = userIds.filter(
    (id): id is string => typeof id === 'string',
  );
  const registeredUsers = filteredUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: filteredUserIds } },
        select: {
          id: true,
          fullName: true,
          image: true,
          email: true,
          phoneNumber: true,
        },
      })
    : [];

  const regMap = registeredUsers.reduce<Record<string, any>>((acc, u) => {
    acc[u.id] = u;
    return acc;
  }, {});

  // Find remaining ids that are not registered users -> non-registered users
  const nonRegisteredIds = userIds.filter(
    (id): id is string => id !== undefined && !regMap[id],
  );
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

  // Map payments to transaction DTO
  const transactions = payments.map(payment => {
    const b = payment.booking;
    const userInfo = b?.userId
      ? regMap[b.userId]
        ? {
            id: regMap[b.userId].id,
            fullName: regMap[b.userId].fullName,
            image: regMap[b.userId].image ?? null,
            email: regMap[b.userId].email ?? null,
            phoneNumber: regMap[b.userId].phoneNumber ?? null,
          }
        : nonRegMap[b.userId]
          ? {
              id: nonRegMap[b.userId].id,
              fullName: nonRegMap[b.userId].fullName,
              image: null,
              email: nonRegMap[b.userId].email ?? null,
              phoneNumber: nonRegMap[b.userId].phone ?? null,
            }
          : {
              id: b.userId,
              fullName: 'Unknown',
              image: null,
              email: null,
              phoneNumber: null,
            }
      : {
          id: null,
          fullName: null,
          image: null,
          email: null,
          phoneNumber: null,
        };

    return {
      paymentId: payment.id,
      bookingId: b?.id ?? null,
      customerId: userInfo.id,
      customerName: userInfo.fullName,
      customerImage: userInfo.image,
      customerEmail: userInfo.email,
      customerPhone: userInfo.phoneNumber,
      barberId: b?.barber?.user?.id ?? null,
      barberName: b?.barber?.user?.fullName ?? null,
      barberImage: b?.barber?.user?.image ?? null,
      barberEmail: b?.barber?.user?.email ?? null,
      barberPhone: b?.barber?.user?.phoneNumber ?? null,
      totalPrice: b?.totalPrice ?? null,
      bookingDate: b?.date ?? null,
      startTime: b?.startTime ?? null,
      endTime: b?.endTime ?? null,
      paymentStatus: payment.status,
      paymentAmount: payment.paymentAmount,
      paymentDate: payment.createdAt,
      bookingStatus: b?.status ?? null,
      services:
        b?.BookedServices?.map(s => ({
          serviceId: s.service.id,
          serviceName: s.service.serviceName,
          price: s.service.price,
          availableTo: s.service.availableTo,
        })) || [],
      queuePosition: b?.queueSlot?.[0]?.position ?? null,
    };
  });

  return formatPaginationResponse(transactions, total, page, limit);
};

const getSaloonListFromDb = async (userId: string) => {
  const result = await prisma.saloonOwner.findMany();
  if (result.length === 0) {
    return { message: 'No saloon found' };
  }
  return result;
};

const getAllBarbersFromDb = async (
  userId: string,
  // saloonId: string,
  options: ISearchAndFilterOptions = {},
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Search by barber name, phone, or address
  const searchQuery = options.searchTerm
    ? {
        OR: [
          {
            barber: {
              user: {
                fullName: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
          {
            barber: {
              user: {
                phoneNumber: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
          {
            barber: {
              user: {
                address: {
                  contains: options.searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            },
          },
        ],
      }
    : {};

  const whereClause = {
    userId: userId,
    ...(Object.keys(searchQuery).length > 0 && searchQuery),
  };

  const [result, total] = await Promise.all([
    prisma.hiredBarber.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        barberId: true,
        hourlyRate: true,
        barber: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                image: true,
                phoneNumber: true,
                address: true,
              },
            },
          },
        },
      },
    }),
    prisma.hiredBarber.count({
      where: whereClause,
    }),
  ]);

  const barbers = result.map(barber => ({
    barberId: barber.barberId,
    barberImage: barber.barber.user.image,
    barberName: barber.barber.user.fullName,
    barberPhone: barber.barber.user.phoneNumber,
    barberAddress: barber.barber.user.address,
    hourlyRate: barber.hourlyRate,
  }));

  return formatPaginationResponse(barbers, total, page, limit);
};

const terminateBarberIntoDb = async (
  userId: string,
  data: {
    barberId: string;
    reason?: string;
    date: DateTime;
  },
) => {
  const { barberId, reason, date } = data;
  if (!barberId || !date || !userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Missing required fields');
  }
  const terminationDate = DateTime.fromISO(date as unknown as string).toUTC();

  return await prisma.$transaction(async tx => {
    // Check if the barber exists
    const barber = await tx.barber.findUnique({
      where: {
        userId: barberId,
        saloonOwnerId: userId,
      },
    });

    if (!barber) {
      throw new AppError(httpStatus.NOT_FOUND, 'Barber not found');
    }

    // Check for future bookings for this barber
    const conflictingBooking = await tx.booking.findFirst({
      where: {
        barberId: data.barberId,
        startDateTime: {
          gte: terminationDate.toJSDate(),
        },
        status: {
          in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    if (conflictingBooking) {
      let startTimeString = 'unknown time';
      if (conflictingBooking.startTime) {
        const date = new Date(conflictingBooking.startTime);
        startTimeString = isNaN(date.getTime())
          ? conflictingBooking.date.toDateString()
          : date.toISOString();
      }
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Cannot terminate barber before ${startTimeString} due to existing bookings.`,
      );
    }

    // Create a termination record
    const terminationRecord = await tx.terminateBarber.create({
      data: {
        barberId: data.barberId,
        reason: data.reason,
        saloonId: userId,
        date: data.date.toJSDate(),
      },
    });

    // Delete the barber
    await tx.barber.delete({
      where: {
        id: data.barberId,
      },
    });

    const deleteFromHiredBarber = await tx.hiredBarber.delete({
      where: {
        barberId: terminationRecord.barberId,
      },
    });
    if (!deleteFromHiredBarber) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Barber not found or not deleted',
      );
    }

    return terminationRecord;
  });
};

const getASaloonByIdFromDb = async (userId: string, saloonOwnerId: string) => {
  const result = await prisma.saloonOwner.findUnique({
    where: {
      userId: saloonOwnerId,
    },
    select: {
      id: true,
      userId: true,
      shopName: true,
      shopBio: true,
      shopAddress: true,
      shopImages: true,
      isVerified: true,
      shopLogo: true,
      shopVideo: true,
      ratingCount: true,
      avgRating: true,
      followerCount: true,
      followingCount: true,
      registrationNumber: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          phoneNumber: true,
          email: true,
          fullName: true,
          dateOfBirth: true,
          followerCount: true,
          followingCount: true,
          Service: {
            select: {
              id: true,
              serviceName: true,
              price: true,
              duration: true,
              isActive: true,
            },
          },
        },
      },
      Barber: {
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              image: true,
            },
          },
          saloonOwnerId: true,
          experienceYears: true,
          bio: true,
          portfolio: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Saloon not found');
  }

  // check following or not
  const isFollowing = await prisma.follow.findFirst({
    where: {
      userId: userId,
      followingId: saloonOwnerId,
    },
  });

  //flatten the salon information
  return {
    isMe: userId === saloonOwnerId,
    id: result.id,
    userId: result.userId,
    isSaloonOwner: true,
    shopOwnerName: result.user?.fullName,
    shopOwnerEmail: result.user?.email,
    shopOwnerPhone: result.user?.phoneNumber,
    shopName: result.shopName,
    shopBio: result.shopBio,
    shopAddress: result.shopAddress,
    shopImages: result.shopImages,
    isVerified: result.isVerified,
    ratingCount: result.ratingCount,
    avgRating: result.avgRating,
    followerCount: result.user?.followerCount,
    followingCount: result.user?.followingCount,
    registrationNumber: result.registrationNumber,
    shopLogo: result.shopLogo,
    shopVideo: result.shopVideo,
    latitude: result.latitude,
    longitude: result.longitude,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    services: result.user?.Service.map(service => ({
      id: service.id,
      serviceName: service.serviceName,
      price: service.price,
      duration: service.duration,
      isActive: service.isActive,
    })),
    barbers: result.Barber.map(barber => ({
      id: barber.user.id,
      fullName: barber.user.fullName,
      email: barber.user.email,
      phoneNumber: barber.user.phoneNumber,
      image: barber.user.image,
      experienceYears: barber.experienceYears,
      bio: barber.bio,
      portfolio: barber.portfolio,
    })),
    isFollowing: isFollowing ? true : false,
  };
};

const getScheduledBarbersFromDb = async (
  userId: string,
  data: {
    utcDateTime: string; // ISO string in UTC
  },
) => {
  const { utcDateTime } = data;
  if (!utcDateTime || !userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Missing required fields');
  }

  // Parse incoming UTC ISO string
  const appointmentDateTime = DateTime.fromISO(utcDateTime, { zone: 'utc' });
  if (!appointmentDateTime.isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid date or time format');
  }
  const appointmentJSDate = appointmentDateTime.toJSDate();

  // Find bookings that contain the given instant (start <= t <= end)
  const bookings = await prisma.booking.findMany({
    where: {
      saloonOwnerId: userId,
      startDateTime: { lte: appointmentJSDate },
      endDateTime: { gte: appointmentJSDate },
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    },
    // Note: we only select booking.userId (scalar) to avoid Prisma inconsistent-result errors
    select: {
      id: true,
      userId: true, // scalar id (could point to User or non-registered user)
      date: true,
      startTime: true,
      endTime: true,
      status: true,
      totalPrice: true,
      // Barber and its user: keep as-is (barber.user should exist)
      barber: {
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              fullName: true,
              image: true,
              phoneNumber: true,
              address: true,
              email: true,
            },
          },
        },
      },
      BookedServices: {
        select: {
          service: {
            select: {
              id: true,
              serviceName: true,
              price: true,
              availableTo: true,
            },
          },
        },
      },
    },
  });

  if (!bookings || bookings.length === 0) return [];

  // Collect unique customer ids referenced by bookings
  const customerIds = Array.from(
    new Set(bookings.map(b => b.userId).filter(Boolean as any)),
  );

  // Fetch registered users for these ids
  const registeredUsers =
    customerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: {
            id: true,
            fullName: true,
            image: true,
            email: true,
            phoneNumber: true,
          },
        })
      : [];

  const regUserMap = registeredUsers.reduce<Record<string, any>>((acc, u) => {
    acc[u.id] = u;
    return acc;
  }, {});

  // Find ids not present in registered users → treat them as non-registered
  const nonRegisteredIds = customerIds.filter(id => !regUserMap[id]);

  const nonRegisteredUsers =
    nonRegisteredIds.length > 0
      ? await prisma.nonRegisteredUser.findMany({
          where: { id: { in: nonRegisteredIds } },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        })
      : [];

  const nonRegMap = nonRegisteredUsers.reduce<Record<string, any>>((acc, n) => {
    acc[n.id] = n;
    return acc;
  }, {});

  // Map bookings into the scheduledBarbers shape and resolve customer info
  const scheduledBarbers = bookings.map(b => {
    // Resolve customer info (registered or non-registered)
    let customer = {
      customerId: null as string | null,
      customerName: null,
      customerImage: null,
      customerEmail: null,
      customerPhone: null,
    };

    if (b.userId) {
      if (regUserMap[b.userId]) {
        customer = {
          customerId: regUserMap[b.userId].id,
          customerName: regUserMap[b.userId].fullName,
          customerImage: regUserMap[b.userId].image ?? null,
          customerEmail: regUserMap[b.userId].email ?? null,
          customerPhone: regUserMap[b.userId].phoneNumber ?? null,
        };
      } else if (nonRegMap[b.userId]) {
        customer = {
          customerId: nonRegMap[b.userId].id,
          customerName: nonRegMap[b.userId].fullName,
          customerImage: null,
          customerEmail: nonRegMap[b.userId].email ?? null,
          customerPhone: nonRegMap[b.userId].phone ?? null,
        };
      } else {
        // Fallback if neither table contains the id
        customer = {
          customerId: b.userId,
          customerName: null,
          customerImage: null,
          customerEmail: null,
          customerPhone: null,
        };
      }
    }

    const barberUser = b.barber?.user;

    return {
      barberId: b.barber?.userId ?? null,
      barberName: barberUser?.fullName ?? null,
      barberImage: barberUser?.image ?? null,
      barberPhone: barberUser?.phoneNumber ?? null,
      barberAddress: barberUser?.address ?? null,
      bookingId: b.id,
      bookingDate: b.date,
      bookingStartTime: b.startTime,
      bookingEndTime: b.endTime,
      bookingStatus: b.status,
      customer,
      services:
        b.BookedServices?.map(s => ({
          serviceId: s.service.id,
          serviceName: s.service.serviceName,
          price: s.service.price,
          availableTo: s.service.availableTo,
        })) ?? [],
      totalPrice: b.totalPrice,
    };
  });

  return scheduledBarbers;
};

const updateSaloonQueueControlIntoDb = async (userId: string) => {
  // Fetch current saloon record
  const saloon = await prisma.saloonOwner.findUnique({
    where: { userId },
    select: { id: true, isQueueEnabled: true },
  });

  if (!saloon) {
    throw new AppError(httpStatus.NOT_FOUND, 'Saloon not found');
  }

  // Toggle the flag (coerce undefined/null to false)
  const newValue = !Boolean(saloon.isQueueEnabled);

  const updatedSaloon = await prisma.saloonOwner.update({
    where: { userId },
    data: { isQueueEnabled: newValue },
    select: { id: true, isQueueEnabled: true },
  });

  if (!updatedSaloon) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Saloon queue control not updated',
    );
  }

  return updatedSaloon;
};

const deleteSaloonItemFromDb = async (userId: string, saloonId: string) => {
  const deletedItem = await prisma.saloonOwner.delete({
    where: {
      id: saloonId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'saloonId, not deleted');
  }

  return deletedItem;
};

export const saloonService = {
  manageBookingsIntoDb,
  getBarberDashboardFromDb,
  getCustomerBookingsFromDb,
  getRemainingBarbersToScheduleFromDb,
  getTransactionsFromDb,
  getSaloonListFromDb,
  getAllBarbersFromDb,
  terminateBarberIntoDb,
  getASaloonByIdFromDb,
  getFreeBarbersOnADateFromDb,
  getScheduledBarbersFromDb,
  updateSaloonQueueControlIntoDb,
  deleteSaloonItemFromDb,
};

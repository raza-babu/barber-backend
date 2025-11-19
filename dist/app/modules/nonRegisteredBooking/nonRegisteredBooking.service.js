"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nonRegisteredBookingService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const luxon_1 = require("luxon");
const createNonRegisteredBookingIntoDb = (userId, // this is the saloonOwnerId in your codebase
data) => __awaiter(void 0, void 0, void 0, function* () {
    const { barberId, appointmentAt, // e.g. "11:00 AM"
    date, // "2025-08-20"
    services, notes, } = data;
    // Validate and parse date
    const dateObj = luxon_1.DateTime.fromISO(date, { zone: 'local' });
    if (!dateObj.isValid) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid date format');
    }
    const today = luxon_1.DateTime.now().startOf('day');
    if (dateObj < today) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Date cannot be in the past');
    }
    // Combine date + time to local DateTime, then convert to UTC JS Date
    const localDateTime = luxon_1.DateTime.fromFormat(`${date} ${appointmentAt}`, 'yyyy-MM-dd hh:mm a', { zone: 'local' });
    if (!localDateTime.isValid) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid date or time format');
    }
    const utcDateTime = localDateTime.toUTC().toJSDate();
    // Prevent booking more than 3 weeks out
    const threeWeeksFromNow = luxon_1.DateTime.now().plus({ weeks: 4 });
    if (localDateTime > threeWeeksFromNow) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking cannot be made more than 4 weeks in advance');
    }
    // Validate services and compute totals
    const serviceRecords = yield prisma_1.default.service.findMany({
        where: { id: { in: services } },
        select: { id: true, price: true, duration: true },
    });
    if (serviceRecords.length !== services.length) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Some services not found');
    }
    const totalDuration = serviceRecords.reduce((sum, s) => sum + (s.duration || 0), 0);
    if (totalDuration <= 0) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Total service duration must be greater than zero');
    }
    const totalPrice = serviceRecords.reduce((sum, s) => sum + Number(s.price), 0);
    // All DB work in a transaction
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        // 1) Ensure salon exists & verified
        const saloonStatus = yield tx.saloonOwner.findUnique({
            where: { userId }, // userId is saloonOwnerId here
            select: { userId: true, isVerified: true, isQueueEnabled: true },
        });
        if (!saloonStatus || !saloonStatus.isVerified) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Saloon not found or not verified');
        }
        // 2) Find or create non-registered customer (scoped to salon owner)
        let nonRegisteredCustomer = yield tx.nonRegisteredUser.findFirst({
            where: {
                saloonOwnerId: userId,
                fullName: data.fullName,
            },
        });
        if (!nonRegisteredCustomer) {
            nonRegisteredCustomer = yield tx.nonRegisteredUser.create({
                data: {
                    saloonOwnerId: userId,
                    fullName: data.fullName,
                    email: (_a = data.email) !== null && _a !== void 0 ? _a : null,
                    phone: (_b = data.phone) !== null && _b !== void 0 ? _b : null,
                },
            });
            if (!nonRegisteredCustomer) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'NonRegistered customer not created');
            }
        }
        // 3) Validate barber and barber day off
        const barber = yield tx.barber.findUnique({
            where: { userId: barberId },
            select: {
                id: true,
                userId: true,
                user: { select: { id: true, fullName: true, image: true } },
            },
        });
        if (!barber) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Barber not found');
        }
        // check the barber is for queue or appointment type
        const barberForQueue = yield tx.barberSchedule.findFirst({
            where: { barberId, saloonOwnerId: userId, isActive: true, type: client_1.ScheduleType.BOOKING },
        });
        if (!barberForQueue) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber not available for queue bookings');
        }
        // Check barber day off
        const barberDayOff = yield tx.barberDayOff.findFirst({
            where: {
                saloonOwnerId: userId,
                barberId: barber.userId,
                date: dateObj.toJSDate(),
            },
        });
        if (barberDayOff) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber is on holiday');
        }
        // 4) Check salon-level lunch/break (time-only overlap)
        const barberBreak = yield tx.lunch.findFirst({
            where: { saloonOwnerId: userId },
        });
        if (barberBreak) {
            if (!barberBreak.startTime || !barberBreak.endTime) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber break start or end time is missing');
            }
            const bookingStartTime = luxon_1.DateTime.fromFormat(appointmentAt, 'hh:mm a', {
                zone: 'local',
            });
            const bookingEndTime = bookingStartTime.plus({ minutes: totalDuration });
            const breakStartTime = luxon_1.DateTime.fromFormat(barberBreak.startTime, 'hh:mm a', { zone: 'local' });
            const breakEndTime = luxon_1.DateTime.fromFormat(barberBreak.endTime, 'hh:mm a', {
                zone: 'local',
            });
            // time-only overlap checks
            if ((bookingStartTime >= breakStartTime &&
                bookingStartTime < breakEndTime) ||
                (bookingEndTime > breakStartTime && bookingEndTime <= breakEndTime) ||
                (bookingStartTime <= breakStartTime && bookingEndTime >= breakEndTime)) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber is unavailable during break/lunch time');
            }
        }
        // 5) Queue handling (if enabled)
        // let queue = null;
        // let queueSlot = null;
        // if (saloonStatus.isQueueEnabled) {
        //   // clean up old queues (optional)
        //   await tx.queue.deleteMany({
        //     where: {
        //       barberId,
        //       saloonOwnerId: userId,
        //       isActive: false,
        //       date: { lt: new Date() },
        //     },
        //   });
        //   // find or create queue for this barber/date
        //   queue = await tx.queue.findFirst({
        //     where: {
        //       barberId,
        //       saloonOwnerId: userId,
        //       date: dateObj.toJSDate(),
        //     },
        //   });
        //   if (!queue) {
        //     queue = await tx.queue.create({
        //       data: {
        //         barberId,
        //         saloonOwnerId: userId,
        //         date: dateObj.toJSDate(),
        //         currentPosition: 1,
        //       },
        //     });
        //   } else {
        //     queue = await tx.queue.update({
        //       where: { id: queue.id },
        //       data: { currentPosition: queue.currentPosition + 1 },
        //     });
        //   }
        //   // existing slots ordered by startedAt
        //   const existingSlots = await tx.queueSlot.findMany({
        //     where: { queueId: queue.id },
        //     orderBy: { startedAt: 'asc' },
        //   });
        //   // compute insert position by comparing utcDateTime to existing startedAt times
        //   let insertPosition = 1;
        //   for (let i = 0; i < existingSlots.length; i++) {
        //     const slot = existingSlots[i];
        //     if (slot && slot.startedAt && utcDateTime > slot.startedAt) {
        //       insertPosition = i + 2; // insert after this
        //     } else {
        //       break;
        //     }
        //   }
        //   // shift later slots positions (iterate backwards)
        //   for (let i = existingSlots.length - 1; i >= insertPosition - 1; i--) {
        //     await tx.queueSlot.update({
        //       where: { id: existingSlots[i].id },
        //       data: { position: existingSlots[i].position + 1 },
        //     });
        //   }
        //   // create queue slot for non-registered customer (use nonRegisteredCustomer.id as customerId)
        //   queueSlot = await tx.queueSlot.create({
        //     data: {
        //       queueId: queue.id,
        //       customerId: nonRegisteredCustomer.id,
        //       barberId,
        //       position: insertPosition,
        //       startedAt: utcDateTime,
        //     },
        //   });
        // }
        // 6) Create booking (userId points to nonRegisteredCustomer id here)
        const booking = yield tx.booking.create({
            data: {
                userId: nonRegisteredCustomer.id, // non-registered customer record id
                barberId,
                saloonOwnerId: userId,
                appointmentAt: utcDateTime,
                bookingType: client_1.BookingType.QUEUE,
                date: dateObj.toJSDate(),
                notes: notes !== null && notes !== void 0 ? notes : null,
                isInQueue: !!saloonStatus.isQueueEnabled,
                totalPrice,
                startDateTime: utcDateTime,
                endDateTime: luxon_1.DateTime.fromJSDate(utcDateTime)
                    .plus({ minutes: totalDuration })
                    .toJSDate(),
                startTime: localDateTime.toFormat('hh:mm a'),
                endTime: luxon_1.DateTime.fromJSDate(utcDateTime)
                    .plus({ minutes: totalDuration })
                    .toFormat('hh:mm a'),
            },
        });
        if (!booking) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking not created');
        }
        // 7) Create bookedServices records for non-registered customer
        yield Promise.all(serviceRecords.map(service => tx.bookedServices.create({
            data: {
                bookingId: booking.id,
                customerId: nonRegisteredCustomer.id,
                serviceId: service.id,
                price: service.price,
            },
        })));
        // 8) Update queueSlot with booking reference and completedAt (if we created one)
        // if (queueSlot) {
        //   await tx.queueSlot.update({
        //     where: { id: queueSlot.id },
        //     data: {
        //       bookingId: booking.id,
        //       completedAt: DateTime.fromJSDate(utcDateTime)
        //         .plus({ minutes: totalDuration })
        //         .toJSDate(),
        //     },
        //   });
        // }
        // 9) Barber schedule and real-time status checks (ensure barber works this day/time)
        const dayName = luxon_1.DateTime.fromJSDate(utcDateTime)
            .toFormat('cccc')
            .toLowerCase();
        const barberSchedule = yield tx.barberSchedule.findFirst({
            where: { barberId, dayName, isActive: true },
        });
        if (!barberSchedule) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber schedule not found for this day');
        }
        const openingDateTime = luxon_1.DateTime.fromFormat(`${date} ${barberSchedule.openingTime}`, 'yyyy-MM-dd hh:mm a', { zone: 'local' }).toUTC();
        const closingDateTime = luxon_1.DateTime.fromFormat(`${date} ${barberSchedule.closingTime}`, 'yyyy-MM-dd hh:mm a', { zone: 'local' }).toUTC();
        if (luxon_1.DateTime.fromJSDate(utcDateTime) < openingDateTime ||
            luxon_1.DateTime.fromJSDate(utcDateTime).plus({ minutes: totalDuration }) >
                closingDateTime) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber is not available during the requested time range');
        }
        // 10) Ensure no overlapping real-time status (barber availability)
        const endDateTime = luxon_1.DateTime.fromJSDate(utcDateTime)
            .plus({ minutes: totalDuration })
            .toJSDate();
        const overlappingStatus = yield tx.barberRealTimeStatus.findFirst({
            where: {
                barberId,
                OR: [
                    {
                        startDateTime: { lt: endDateTime },
                        endDateTime: { gt: utcDateTime },
                    },
                ],
            },
        });
        if (overlappingStatus) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber already has a booking or is unavailable during the requested time slot');
        }
        // 11) Create barberRealTimeStatus to block the time slot
        yield tx.barberRealTimeStatus.create({
            data: {
                barberId,
                startDateTime: utcDateTime,
                endDateTime,
                isAvailable: false,
                startTime: localDateTime.toFormat('hh:mm a'),
                endTime: luxon_1.DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
            },
        });
        yield tx.payment.create({
            data: {
                userId: userId,
                bookingId: booking.id,
                paymentAmount: totalPrice,
                status: client_1.PaymentStatus.CASH,
                amountProvider: nonRegisteredCustomer.id,
            },
        });
        // Return compact response to the client
        return {
            booking,
            // queue: queue
            //   ? { id: queue.id, currentPosition: queue.currentPosition }
            //   : null,
            // queueSlot: queueSlot
            //   ? { id: queueSlot.id, position: queueSlot.position }
            //   : null,
            totalPrice,
        };
    }));
    return result;
});
const getNonRegisteredBookingListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.nonRegisteredUser.findMany();
    if (result.length === 0) {
        return { message: 'No nonRegisteredBooking found' };
    }
    return result;
});
const getNonRegisteredBookingByIdFromDb = (userId, nonRegisteredBookingId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.nonRegisteredUser.findUnique({
        where: {
            id: nonRegisteredBookingId,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'nonRegisteredBooking not found');
    }
    return result;
});
const updateNonRegisteredBookingIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { bookingId, status } = data;
    // Only allow salon owner to update the status (validate existence)
    const booking = yield prisma_1.default.booking.findUnique({
        where: { id: bookingId, saloonOwnerId: userId },
    });
    if (!booking) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Booking not found');
    }
    // Allowed statuses we support here
    const allowedStatuses = [
        'CONFIRMED',
        'RESCHEDULED',
        'PENDING',
        'CANCELLED',
        'COMPLETED',
    ];
    if (!allowedStatuses.includes(status)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`);
    }
    // Prevent meaningless transition
    if (booking.status === status) {
        return booking; // no-op
    }
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // Re-fetch inside transaction to avoid stale reads
        const bookingTx = yield tx.booking.findUnique({
            where: { id: bookingId },
            select: {
                id: true,
                userId: true, // could be a non-registered user id
                barberId: true,
                saloonOwnerId: true,
                startDateTime: true,
                endDateTime: true,
                isInQueue: true,
                status: true,
            },
        });
        if (!bookingTx)
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Booking not found');
        // Helper: find queueSlot for this booking (if any)
        const queueSlot = yield tx.queueSlot.findFirst({
            where: { bookingId: bookingTx.id },
        });
        // Helper: find queue for that slot
        let queue = null;
        if (queueSlot) {
            queue = yield tx.queue.findUnique({ where: { id: queueSlot.queueId } });
        }
        // Helper: find barberRealTimeStatus entry matching this booking timeslot (if any)
        // We match by barberId + startDateTime + endDateTime exactly (stored as Date)
        const rts = yield tx.barberRealTimeStatus.findFirst({
            where: {
                barberId: bookingTx.barberId,
                startDateTime: bookingTx.startDateTime,
                endDateTime: bookingTx.endDateTime,
            },
        });
        // --- Handle CONFIRMED ---
        if (status === client_1.BookingStatus.CONFIRMED) {
            // Only allow confirming PENDING or RESCHEDULED bookings
            if (!['PENDING', 'RESCHEDULED'].includes(bookingTx.status)) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Only PENDING or RESCHEDULED bookings can be confirmed');
            }
            const updated = yield tx.booking.update({
                where: { id: bookingTx.id },
                data: { status: client_1.BookingStatus.CONFIRMED },
            });
            return updated;
        }
        // --- Handle RESCHEDULED ---
        if (status === client_1.BookingStatus.RESCHEDULED) {
            // marking as rescheduled is allowed from many states; actual time changes should be handled elsewhere
            const updated = yield tx.booking.update({
                where: { id: bookingTx.id },
                data: { status: client_1.BookingStatus.RESCHEDULED },
            });
            return updated;
        }
        // --- Handle CANCELED ---
        if (status === client_1.BookingStatus.CANCELLED) {
            // Do not allow cancelling if already completed or already cancelled
            if (['COMPLETED', 'CANCELLED'].includes(bookingTx.status)) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Cannot cancel a completed or already cancelled booking');
            }
            // 1) delete the queueSlot (if exists) and shift subsequent positions
            if (queueSlot && queue) {
                const deletedPosition = queueSlot.position;
                // delete the slot
                yield tx.queueSlot.delete({ where: { id: queueSlot.id } });
                // shift all later slots positions -1
                yield tx.queueSlot.updateMany({
                    where: {
                        queueId: queue.id,
                        position: { gt: deletedPosition },
                    },
                    data: { position: { decrement: 1 } },
                });
                // adjust queue.currentPosition if required:
                // if the removed slot was BEFORE or EQUAL currentPosition, decrement currentPosition (but not below 1)
                if (queue.currentPosition && deletedPosition <= queue.currentPosition) {
                    const newCurrent = Math.max(1, queue.currentPosition - 1);
                    yield tx.queue.update({
                        where: { id: queue.id },
                        data: { currentPosition: newCurrent },
                    });
                }
            }
            // 2) delete the barberRealTimeStatus (if any) that reserved this timeslot
            if (rts) {
                yield tx.barberRealTimeStatus.delete({ where: { id: rts.id } });
            }
            // 3) update booking status to CANCELLED
            const updatedBooking = yield tx.booking.update({
                where: { id: bookingTx.id },
                data: { status: client_1.BookingStatus.CANCELLED },
            });
            return updatedBooking;
        }
        // --- Handle COMPLETED ---
        if (status === client_1.BookingStatus.COMPLETED) {
            // Only allow completing a CONFIRMED booking (or allow if start/end are in the past)
            // Allow if current time >= booking.endDateTime - or if status is CONFIRMED
            const now = new Date();
            const endTime = bookingTx.endDateTime;
            if (bookingTx.status !== client_1.BookingStatus.CONFIRMED &&
                now < (endTime !== null && endTime !== void 0 ? endTime : now)) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Only CONFIRMED bookings can be marked COMPLETED (or wait until end time has passed)');
            }
            // 1) mark queueSlot completedAt (if exists)
            if (queueSlot) {
                yield tx.queueSlot.update({
                    where: { id: queueSlot.id },
                    data: { completedAt: (_a = bookingTx.endDateTime) !== null && _a !== void 0 ? _a : new Date() },
                });
            }
            // 2) delete barberRealTimeStatus (release barber)
            if (rts) {
                yield tx.barberRealTimeStatus.delete({ where: { id: rts.id } });
            }
            // 3) update booking to COMPLETED
            const updatedBooking = yield tx.booking.update({
                where: { id: bookingTx.id },
                data: { status: client_1.BookingStatus.COMPLETED },
            });
            return updatedBooking;
        }
        // Fallback (shouldn't reach here)
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Unhandled status transition');
    }));
    return result;
});
const deleteNonRegisteredBookingItemFromDb = (userId, nonRegisteredBookingId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.nonRegisteredUser.delete({
        where: {
            id: nonRegisteredBookingId,
            saloonOwnerId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'nonRegisteredBookingId, not deleted');
    }
    return deletedItem;
});
exports.nonRegisteredBookingService = {
    createNonRegisteredBookingIntoDb,
    getNonRegisteredBookingListFromDb,
    getNonRegisteredBookingByIdFromDb,
    updateNonRegisteredBookingIntoDb,
    deleteNonRegisteredBookingItemFromDb,
};

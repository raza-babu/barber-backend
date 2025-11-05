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
exports.bookingService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const luxon_1 = require("luxon");
const pagination_1 = require("../../utils/pagination");
const createBookingIntoDb1 = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { barberId, saloonOwnerId, appointmentAt, date, services, notes, isInQueue, loyaltySchemeId, } = data;
    const saloonStatus = yield prisma_1.default.saloonOwner.findUnique({
        where: { userId: saloonOwnerId, isVerified: true },
    });
    if (!saloonStatus) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Saloon not found or not verified');
    }
    // 1. Fetch saloonOwner to check queue status
    const saloonOwner = yield prisma_1.default.saloonOwner.findUnique({
        where: { userId: saloonOwnerId },
        select: { isQueueEnabled: true },
    });
    if (!saloonOwner) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Salon owner not found');
    }
    // 2. Convert date and time to UTC DateTime
    // check the date is not in the past
    const dateObj = luxon_1.DateTime.fromISO(date, { zone: 'local' });
    const today = luxon_1.DateTime.now().startOf('day');
    if (dateObj < today) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Date cannot be in the past');
    }
    // Combine date and appointmentAt (e.g., "2025-08-20" + "11:00 AM")
    const localDateTime = luxon_1.DateTime.fromFormat(`${date} ${appointmentAt}`, 'yyyy-MM-dd hh:mm a', { zone: 'local' });
    if (!localDateTime.isValid) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid date or time format');
    }
    const utcDateTime = localDateTime.toUTC().toJSDate();
    // check the date is grater then 3 weeks from now
    const threeWeeksFromNow = luxon_1.DateTime.now().plus({ weeks: 3 });
    if (localDateTime > threeWeeksFromNow) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking cannot be made more than 3 weeks in advance');
    }
    // 3. Calculate total price using service model
    const serviceRecords = yield prisma_1.default.service.findMany({
        where: { id: { in: services } },
        select: { id: true, price: true, duration: true },
    });
    if (serviceRecords.length !== services.length) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Some services not found');
    }
    const totalDuration = serviceRecords.reduce((sum, s) => sum + (s.duration || 0), // assuming each service has a 'duration' in minutes
    0);
    if (totalDuration <= 0) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Total service duration must be greater than zero');
    }
    const totalPrice = serviceRecords.reduce((sum, s) => sum + Number(s.price), 0);
    // 4. Transaction for all DB operations
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // 4a. Check if barber exists and is available
        const barber = yield tx.barber.findUnique({
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
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Barber not found');
        }
        // 4b. Check if barber is on holiday or not
        const barberHoliday = yield tx.barberDayOff.findFirst({
            where: {
                barberId: barber.id,
                date: localDateTime.toJSDate(),
                saloonOwnerId: saloonOwnerId,
            },
        });
        if (barberHoliday) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber is on holiday');
        }
        // Check if the booking time overlaps with the barber's lunch/break time (time only, ignore date)
        const barberBreak = yield tx.lunch.findFirst({
            where: {
                saloonOwnerId: saloonOwnerId,
            },
        });
        if (barberBreak) {
            // Extract only the time part from the booking start and end
            const bookingStartTime = luxon_1.DateTime.fromFormat(appointmentAt, 'hh:mm a', {
                zone: 'local',
            });
            const bookingEndTime = bookingStartTime.plus({ minutes: totalDuration });
            // Parse lunch break start and end times (time only, ignore date)
            if (!barberBreak.startTime || !barberBreak.endTime) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber break start or end time is missing');
            }
            const breakStartTime = luxon_1.DateTime.fromFormat(barberBreak.startTime, 'hh:mm a', { zone: 'local' });
            const breakEndTime = luxon_1.DateTime.fromFormat(barberBreak.endTime, 'hh:mm a', {
                zone: 'local',
            });
            // Check for overlap (time only)
            if ((bookingStartTime >= breakStartTime &&
                bookingStartTime < breakEndTime) ||
                (bookingEndTime > breakStartTime && bookingEndTime <= breakEndTime) ||
                (bookingStartTime <= breakStartTime && bookingEndTime >= breakEndTime)) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber is unavailable during break/lunch time');
            }
        }
        // 4a. If queue is enabled, create queue and queueSlot
        let queue = null;
        let queueSlot = null;
        // if (saloonOwner.isQueueEnabled && isInQueue) {
        // Find the current max position in the queue for this barber and date
        // Delete any existing queue for this barber for previous days (before today)
        // console.log('Queue found:');
        yield tx.queue.deleteMany({
            where: {
                barberId,
                saloonOwnerId,
                isActive: false,
                date: { lt: new Date() },
            },
        });
        // Try to find an existing queue for this barber and date (only one per day allowed)
        queue = yield tx.queue.findFirst({
            where: {
                barberId,
                saloonOwnerId,
                date: new Date(date),
            },
        });
        if (!queue) {
            // If not found, create a new queue for the given date (today or any future date)
            queue = yield tx.queue.create({
                data: {
                    barberId,
                    saloonOwnerId,
                    date: new Date(date),
                    currentPosition: 1,
                },
            });
            if (!queue) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Error creating queue');
            }
        }
        else {
            // If found, increment currentPosition
            queue = yield tx.queue.update({
                where: { id: queue.id },
                data: {
                    currentPosition: queue.currentPosition + 1,
                },
            });
            if (!queue) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Error updating queue');
            }
        }
        // Find all existing queueSlots for this queue, ordered by startedAt
        const existingSlots = yield tx.queueSlot.findMany({
            where: { queueId: queue.id },
            orderBy: { startedAt: 'asc' },
        });
        // Find the correct position for the new slot based on startedAt (utcDateTime)
        let insertPosition = 1;
        for (let i = 0; i < existingSlots.length; i++) {
            const slot = existingSlots[i];
            if (slot &&
                slot.startedAt !== null &&
                slot.startedAt !== undefined &&
                utcDateTime > slot.startedAt) {
                insertPosition = i + 2; // +2 because positions are 1-based and we want to insert after this slot
            }
            else {
                break;
            }
        }
        // Shift positions of slots that come after the new slot
        for (let i = existingSlots.length - 1; i >= insertPosition - 1; i--) {
            yield tx.queueSlot.update({
                where: { id: existingSlots[i].id },
                data: { position: existingSlots[i].position + 1 },
            });
            if (!queueSlot) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Error updating queue slot position');
            }
        }
        // Create the new queueSlot at the correct position
        queueSlot = yield tx.queueSlot.create({
            data: {
                queueId: queue.id,
                customerId: userId,
                barberId: barberId,
                position: insertPosition,
                startedAt: utcDateTime,
            },
        });
        if (!queueSlot) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Error creating queue slot');
        }
        // }
        let price = totalPrice;
        let loyaltyUsed = null;
        if (loyaltySchemeId) {
            // Verify the loyalty scheme exists and belongs to the saloon owner
            const loyaltyScheme = yield tx.loyaltyScheme.findUnique({
                where: { id: loyaltySchemeId, userId: saloonOwnerId },
            });
            if (!loyaltyScheme) {
                throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Loyalty scheme not found');
            }
            // Check if the customer has enough points
            const customerLoyalty = yield tx.customerLoyalty.findUnique({
                where: { userId: userId },
                select: { id: true, totalPoints: true },
            });
            if (!customerLoyalty ||
                (customerLoyalty.totalPoints || 0) < loyaltyScheme.pointThreshold) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Not enough loyalty points');
            }
            // Deduct points from customerLoyalty
            yield tx.customerLoyalty.update({
                where: { userId: userId },
                data: { totalPoints: { decrement: loyaltyScheme.pointThreshold } },
            });
            // Add a record to loyaltyRedemption
            loyaltyUsed = yield tx.loyaltyRedemption.create({
                data: {
                    customerId: userId,
                    customerLoyaltyId: customerLoyalty.id,
                    pointsUsed: loyaltyScheme.pointThreshold,
                },
            });
            // Reduce the totalPrice by the discountAmount
            price = totalPrice - totalPrice * (loyaltyScheme.percentage / 100);
            if (price < 0)
                price = 0;
        }
        // 4b. Create booking
        const booking = yield tx.booking.create({
            data: {
                userId,
                barberId,
                saloonOwnerId,
                appointmentAt: utcDateTime,
                date: new Date(date),
                notes,
                isInQueue: !!(saloonOwner.isQueueEnabled && isInQueue),
                totalPrice: price,
                startDateTime: utcDateTime,
                endDateTime: luxon_1.DateTime.fromJSDate(utcDateTime)
                    .plus({ minutes: totalDuration })
                    .toJSDate(),
                startTime: localDateTime.toFormat('hh:mm a'),
                endTime: luxon_1.DateTime.fromJSDate(utcDateTime)
                    .plus({ minutes: totalDuration })
                    .toFormat('hh:mm a'),
                loyaltySchemeId: data.loyaltySchemeId || null,
                loyaltyUsed: data.loyaltyProgramId ? true : false,
            },
        });
        if (isInQueue && booking) {
            // add payment status as PAID
            yield tx.payment.create({
                data: {
                    userId: userId,
                    bookingId: booking.id,
                    paymentAmount: price,
                    status: client_1.PaymentStatus.COMPLETED,
                    paymentDate: new Date(),
                },
            });
        }
        if (loyaltyUsed) {
            if (booking && booking.loyaltySchemeId) {
                yield tx.loyaltyRedemption.update({
                    where: { id: loyaltyUsed.id, customerId: userId, bookingId: null },
                    data: { bookingId: booking.id },
                });
            }
        }
        // 4c. Create bookedService records
        yield Promise.all(serviceRecords.map(service => tx.bookedServices.create({
            data: {
                bookingId: booking.id,
                customerId: userId,
                serviceId: service.id,
                price: service.price,
            },
        })));
        if (queueSlot && queueSlot.id) {
            queueSlot = yield tx.queueSlot.update({
                where: { id: queueSlot.id },
                data: {
                    bookingId: booking.id,
                    completedAt: luxon_1.DateTime.fromJSDate(utcDateTime)
                        .plus({ minutes: totalDuration })
                        .toJSDate(),
                },
            });
            if (!queueSlot) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Error updating queue slot');
            }
        }
        // 4d. Add barberRealTimeStatus
        // Calculate endDateTime by adding totalServiceTime (in minutes) to utcDateTime
        const totalServiceTime = serviceRecords.reduce((sum, s) => sum + (s.duration || 0), 0); // assuming each service has a 'duration' in minutes
        const endDateTime = luxon_1.DateTime.fromJSDate(utcDateTime)
            .plus({ minutes: totalServiceTime })
            .toJSDate();
        // Check if the barber is scheduled to work during the requested time range
        // Get the day name (e.g., 'monday') from the appointment date
        const dayName = luxon_1.DateTime.fromJSDate(utcDateTime)
            .toFormat('cccc')
            .toLowerCase();
        const barberSchedule = yield tx.barberSchedule.findFirst({
            where: {
                barberId: barberId,
                dayName: dayName,
                isActive: true,
            },
        });
        if (!barberSchedule) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber schedule not found for this day');
        }
        // Parse openingTime and closingTime (e.g., "09:00 AM") into DateTime objects on the same date as the booking
        const openingDateTime = luxon_1.DateTime.fromFormat(`${date} ${barberSchedule.openingTime}`, 'yyyy-MM-dd hh:mm a', { zone: 'local' }).toUTC();
        const closingDateTime = luxon_1.DateTime.fromFormat(`${date} ${barberSchedule.closingTime}`, 'yyyy-MM-dd hh:mm a', { zone: 'local' }).toUTC();
        if (localDateTime < openingDateTime ||
            luxon_1.DateTime.fromJSDate(endDateTime) > closingDateTime) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber is not available during the requested time range');
        }
        // Check if there is already a barberRealTimeStatus for this barber that overlaps with the requested time slot
        const overlappingStatus = yield tx.barberRealTimeStatus.findFirst({
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
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber already has a booking or is unavailable during the requested time slot');
        }
        yield tx.barberRealTimeStatus.create({
            data: {
                barberId,
                startDateTime: utcDateTime,
                endDateTime: endDateTime,
                isAvailable: false,
                startTime: localDateTime.toFormat('hh:mm a'),
                endTime: luxon_1.DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
            },
        });
        return {
            booking,
            queue,
            queueSlot,
            totalPrice,
        };
    }));
    return result;
});
const createBookingIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { barberId, saloonOwnerId, appointmentAt, date, services, notes, loyaltySchemeId, } = data;
    // 1. Validate saloon exists & verified
    const saloonStatus = yield prisma_1.default.saloonOwner.findUnique({
        where: { userId: saloonOwnerId, isVerified: true },
    });
    if (!saloonStatus) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Saloon not found or not verified');
    }
    // 2. Validate date / time inputs
    const dateObj = luxon_1.DateTime.fromISO(date, { zone: 'local' });
    const today = luxon_1.DateTime.now().startOf('day');
    if (!dateObj.isValid || dateObj < today) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Date cannot be in the past');
    }
    const localDateTime = luxon_1.DateTime.fromFormat(`${date} ${appointmentAt}`, 'yyyy-MM-dd hh:mm a', { zone: 'local' });
    if (!localDateTime.isValid) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid date or time format');
    }
    const utcDateTime = localDateTime.toUTC().toJSDate();
    // max 3 weeks ahead (business rule)
    const threeWeeksFromNow = luxon_1.DateTime.now().plus({ weeks: 3 });
    if (localDateTime > threeWeeksFromNow) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking cannot be made more than 3 weeks in advance');
    }
    // 3. Fetch services and compute totals
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
    let totalPrice = serviceRecords.reduce((sum, s) => sum + Number(s.price), 0);
    // 4. Run DB operations in a transaction (booking + booked services + real-time status + loyalty handling)
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // 4a. Check barber existence
        const barber = yield tx.barber.findUnique({
            where: { userId: barberId },
            select: {
                id: true,
                user: {
                    select: { id: true, fullName: true, image: true },
                },
            },
        });
        if (!barber) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Barber not found');
        }
        // 4b. Barber day off (holiday) check (we keep this)
        const barberHoliday = yield tx.barberDayOff.findFirst({
            where: {
                barberId: barber.id,
                date: localDateTime.toJSDate(),
                saloonOwnerId: saloonOwnerId,
            },
        });
        if (barberHoliday) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber is on holiday');
        }
        // 4c. Prevent overlapping bookings using barberRealTimeStatus
        const bookingStart = utcDateTime;
        const bookingEnd = luxon_1.DateTime.fromJSDate(utcDateTime)
            .plus({ minutes: totalDuration })
            .toJSDate();
        const overlappingStatus = yield tx.barberRealTimeStatus.findFirst({
            where: {
                barberId,
                AND: [
                    { startDateTime: { lt: bookingEnd } },
                    { endDateTime: { gt: bookingStart } },
                ],
            },
        });
        if (overlappingStatus) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber already has a booking or is unavailable during the requested time slot');
        }
        // 4d. Loyalty handling (deduct points, compute discounted price) — do this BEFORE creating booking
        let loyaltyUsed = null;
        if (loyaltySchemeId) {
            const loyaltyScheme = yield tx.loyaltyScheme.findUnique({
                where: { id: loyaltySchemeId, userId: saloonOwnerId },
            });
            if (!loyaltyScheme) {
                throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Loyalty scheme not found');
            }
            const customerLoyalty = yield tx.customerLoyalty.findUnique({
                where: { userId },
                select: { id: true, totalPoints: true },
            });
            if (!customerLoyalty ||
                (customerLoyalty.totalPoints || 0) < loyaltyScheme.pointThreshold) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Not enough loyalty points');
            }
            // Deduct points
            yield tx.customerLoyalty.update({
                where: { userId },
                data: { totalPoints: { decrement: loyaltyScheme.pointThreshold } },
            });
            // Create redemption record
            loyaltyUsed = yield tx.loyaltyRedemption.create({
                data: {
                    customerId: userId,
                    customerLoyaltyId: customerLoyalty.id,
                    pointsUsed: loyaltyScheme.pointThreshold,
                },
            });
            // Apply discount
            totalPrice = totalPrice - totalPrice * (loyaltyScheme.percentage / 100);
            if (totalPrice < 0)
                totalPrice = 0;
        }
        // 4e. Create booking
        const booking = yield tx.booking.create({
            data: {
                userId,
                barberId,
                saloonOwnerId,
                appointmentAt: utcDateTime,
                date: new Date(date),
                notes: notes !== null && notes !== void 0 ? notes : null,
                isInQueue: false, // queue handled separately
                totalPrice: totalPrice,
                startDateTime: bookingStart,
                endDateTime: bookingEnd,
                startTime: localDateTime.toFormat('hh:mm a'),
                endTime: luxon_1.DateTime.fromJSDate(bookingEnd).toFormat('hh:mm a'),
                loyaltySchemeId: loyaltySchemeId !== null && loyaltySchemeId !== void 0 ? loyaltySchemeId : null,
                loyaltyUsed: !!loyaltyUsed,
            },
        });
        // 4f. Attach loyalty redemptions to booking if any
        if (loyaltyUsed) {
            yield tx.loyaltyRedemption.update({
                where: { id: loyaltyUsed.id },
                data: { bookingId: booking.id },
            });
        }
        // 4g. Create booked services
        yield Promise.all(serviceRecords.map(s => tx.bookedServices.create({
            data: {
                bookingId: booking.id,
                customerId: userId,
                serviceId: s.id,
                price: s.price,
            },
        })));
        // 4h. Block time in barberRealTimeStatus (so others cannot double-book)
        yield tx.barberRealTimeStatus.create({
            data: {
                barberId,
                startDateTime: bookingStart,
                endDateTime: bookingEnd,
                isAvailable: false,
                startTime: localDateTime.toFormat('hh:mm a'),
                endTime: luxon_1.DateTime.fromJSDate(bookingEnd).toFormat('hh:mm a'),
            },
        });
        // Return the booking + price to caller
        return {
            booking,
            totalPrice,
        };
    }));
    return result;
});
const getBookingListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.booking.findMany({
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
        var _a, _b, _c, _d, _e, _f, _g;
        // Calculate estimatedWaitTime as the difference in minutes between startTime and now
        let estimatedWaitTime = null;
        if (booking.startTime) {
            // booking.date is a Date object, booking.startTime is a string like "11:00 AM"
            const startDateTime = luxon_1.DateTime.fromFormat(`${luxon_1.DateTime.fromJSDate(booking.date).toFormat('yyyy-MM-dd')} ${booking.startTime}`, 'yyyy-MM-dd hh:mm a');
            if (startDateTime.isValid) {
                estimatedWaitTime = Math.max(0, Math.round(startDateTime.diffNow('minutes').minutes));
            }
        }
        return {
            bookingId: booking.id,
            customerId: booking.userId,
            barberId: booking.barberId,
            saloonOwnerId: booking.saloonOwnerId,
            totalPrice: booking.totalPrice,
            notes: booking.notes,
            customerName: ((_a = booking.user) === null || _a === void 0 ? void 0 : _a.fullName) || null,
            customerEmail: ((_b = booking.user) === null || _b === void 0 ? void 0 : _b.email) || null,
            customerContact: ((_c = booking.user) === null || _c === void 0 ? void 0 : _c.phoneNumber) || null,
            date: booking.date,
            time: booking.startTime,
            estimatedWaitTime,
            position: ((_d = booking.queueSlot[0]) === null || _d === void 0 ? void 0 : _d.position) || null,
            serviceNames: ((_e = booking.BookedServices) === null || _e === void 0 ? void 0 : _e.map(bs => { var _a; return (_a = bs.service) === null || _a === void 0 ? void 0 : _a.serviceName; })) || [],
            barberName: ((_g = (_f = booking.barber) === null || _f === void 0 ? void 0 : _f.user) === null || _g === void 0 ? void 0 : _g.fullName) || null,
            status: booking.status || null,
        };
    });
});
const getBookingByIdFromDb = (userId, bookingId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    const result = yield prisma_1.default.booking.findUnique({
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
        customerName: ((_a = result.user) === null || _a === void 0 ? void 0 : _a.fullName) || null,
        customerEmail: ((_b = result.user) === null || _b === void 0 ? void 0 : _b.email) || null,
        customerContact: ((_c = result.user) === null || _c === void 0 ? void 0 : _c.phoneNumber) || null,
        date: result.date,
        time: result.startTime,
        position: ((_d = result.queueSlot[0]) === null || _d === void 0 ? void 0 : _d.position) || null,
        serviceNames: ((_e = result.BookedServices) === null || _e === void 0 ? void 0 : _e.map(bs => { var _a; return (_a = bs.service) === null || _a === void 0 ? void 0 : _a.serviceName; })) || [],
        barberName: ((_g = (_f = result.barber) === null || _f === void 0 ? void 0 : _f.user) === null || _g === void 0 ? void 0 : _g.fullName) || null,
        status: result.status || null,
    };
});
const getAllBarbersForQueueFromDb = (userId, saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    // Always use today's date
    const date = luxon_1.DateTime.now().startOf('day');
    // Check if salon is closed
    const salon = yield prisma_1.default.saloonOwner.findUnique({
        where: { userId: saloonOwnerId },
        select: { userId: true, isQueueEnabled: true },
    });
    if (!salon)
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Salon not found');
    const holiday = yield prisma_1.default.saloonHoliday.findFirst({
        where: { userId: salon.userId, date: date.toJSDate() },
    });
    if (holiday)
        return { message: 'Salon is closed on this date' };
    let barbers = yield prisma_1.default.barber.findMany({
        where: { saloonOwnerId: saloonOwnerId },
        include: {
            user: { select: { id: true, fullName: true, status: true } },
        },
    });
    // Only barbers with schedules
    const barberIdsWithSchedule = yield prisma_1.default.barberSchedule.findMany({
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
    const results = yield Promise.all(barbers.map((barber) => __awaiter(void 0, void 0, void 0, function* () {
        // Skip if day off
        const dayOff = yield prisma_1.default.barberDayOff.findFirst({
            where: { barberId: barber.userId, date: date.toJSDate() },
        });
        if (dayOff)
            return null;
        // Get schedule
        const schedule = yield prisma_1.default.barberSchedule.findFirst({
            where: {
                barberId: barber.userId,
                dayName: date.toFormat('cccc').toLowerCase(),
            },
        });
        if (!schedule)
            return null;
        return {
            barberId: barber.user.id,
            name: barber.user.fullName,
            status: barber.user.status,
            schedule: {
                start: schedule.openingTime,
                end: schedule.closingTime,
            },
        };
    })));
    return { barbers: results.filter(r => r !== null) };
});
const getAvailableBarbersForWalkingInFromDb = (userId, saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    // Always use today's date
    const date = luxon_1.DateTime.now().startOf('day');
    const startOfDay = date.toJSDate();
    const endOfDay = date.endOf('day').toJSDate();
    // Check if salon is closed
    const salon = yield prisma_1.default.saloonOwner.findUnique({
        where: { userId: saloonOwnerId },
        select: { userId: true, isQueueEnabled: true },
    });
    if (!salon)
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Salon not found');
    const holiday = yield prisma_1.default.saloonHoliday.findFirst({
        where: { userId: salon.userId, date: date.toJSDate() },
    });
    if (holiday)
        return { message: 'Salon is closed on this date' };
    let barbers = yield prisma_1.default.barber.findMany({
        where: { saloonOwnerId: saloonOwnerId },
        include: {
            user: { select: { id: true, fullName: true, status: true } },
        },
    });
    // Only barbers with schedules
    const barberIdsWithSchedule = yield prisma_1.default.barberSchedule.findMany({
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
    const results = yield Promise.all(barbers.map((barber) => __awaiter(void 0, void 0, void 0, function* () {
        // Skip if day off
        const dayOff = yield prisma_1.default.barberDayOff.findFirst({
            where: { barberId: barber.userId, date: date.toJSDate() },
        });
        if (dayOff)
            return null;
        // Get schedule
        const schedule = yield prisma_1.default.barberSchedule.findFirst({
            where: {
                barberId: barber.userId,
                dayName: date.toFormat('cccc').toLowerCase(),
            },
        });
        // Get bookings
        const bookings = yield prisma_1.default.booking.findMany({
            where: {
                barberId: barber.userId,
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
        // Build booking ranges
        const bookingRanges = bookings.map(b => ({
            start: luxon_1.DateTime.fromJSDate(b.startDateTime).toISO(),
            end: luxon_1.DateTime.fromJSDate(b.endDateTime).toISO(),
        }));
        // Estimate wait time = sum of current bookings lengths
        const estimatedWaitTime = bookings.reduce((sum, b) => {
            return (sum +
                luxon_1.DateTime.fromJSDate(b.endDateTime).diff(luxon_1.DateTime.fromJSDate(b.startDateTime), 'minutes').minutes);
        }, 0);
        // Queue info if enabled
        let queueInfo = null;
        let queueOrder = null;
        if (salon.isQueueEnabled) {
            const queue = yield prisma_1.default.queue.findFirst({
                where: {
                    barberId: barber.userId,
                    saloonOwnerId: saloonOwnerId,
                    date: date.toJSDate(),
                },
                select: {
                    id: true,
                    currentPosition: true,
                    queueSlots: {
                        select: {
                            id: true,
                            customerId: true,
                            position: true,
                            startedAt: true,
                            bookingId: true,
                        },
                        orderBy: { position: 'asc' },
                    },
                },
            });
            if (queue) {
                // Find the current user's slot and how many are ahead
                const sortedSlots = queue.queueSlots.sort((a, b) => a.position - b.position);
                const mySlotIndex = sortedSlots.findIndex(slot => slot.customerId === userId);
                queueOrder = mySlotIndex >= 0 ? mySlotIndex : null;
                queueInfo = {
                    queueId: queue.id,
                    currentPosition: queue.currentPosition,
                    totalInQueue: queue.queueSlots.length,
                    estimatedWaitTime,
                    queueOrder, // how many people before this user
                };
            }
            else {
                queueInfo = { totalInQueue: 0, estimatedWaitTime: 0, queueOrder: null };
            }
        }
        // Calculate free slots based on schedule and bookings
        let freeSlots = [];
        if (schedule) {
            // Build an array of busy intervals (sorted)
            const busyIntervals = bookings
                .map(b => ({
                start: luxon_1.DateTime.fromJSDate(b.startDateTime),
                end: luxon_1.DateTime.fromJSDate(b.endDateTime),
            }))
                .sort((a, b) => a.start.toMillis() - b.start.toMillis());
            // Opening and closing times as DateTime
            const opening = luxon_1.DateTime.fromFormat(`${date.toFormat('yyyy-MM-dd')} ${schedule.openingTime}`, 'yyyy-MM-dd hh:mm a');
            const closing = luxon_1.DateTime.fromFormat(`${date.toFormat('yyyy-MM-dd')} ${schedule.closingTime}`, 'yyyy-MM-dd hh:mm a');
            let lastEnd = opening;
            for (const interval of busyIntervals) {
                if (interval.start > lastEnd) {
                    freeSlots.push({
                        start: lastEnd.toFormat('hh:mm a'),
                        end: interval.start.toFormat('hh:mm a'),
                    });
                }
                if (interval.end > lastEnd) {
                    lastEnd = interval.end;
                }
            }
            // Free slot after last booking until closing
            if (lastEnd < closing) {
                freeSlots.push({
                    start: lastEnd.toFormat('hh:mm a'),
                    end: closing.toFormat('hh:mm a'),
                });
            }
        }
        return {
            barberId: barber.userId,
            name: barber.user.fullName,
            status: barber.user.status,
            schedule: schedule
                ? { start: schedule.openingTime, end: schedule.closingTime }
                : null,
            bookings: bookings.map(b => ({
                startTime: luxon_1.DateTime.fromJSDate(b.startDateTime).toFormat('hh:mm a'),
                endTime: luxon_1.DateTime.fromJSDate(b.endDateTime).toFormat('hh:mm a'),
                services: b.BookedServices.map(bs => { var _a; return (_a = bs.service) === null || _a === void 0 ? void 0 : _a.serviceName; }),
                totalTime: b.BookedServices.reduce((sum, bs) => { var _a; return sum + (((_a = bs.service) === null || _a === void 0 ? void 0 : _a.duration) || 0); }, 0),
            })),
            freeSlots,
            queue: queueInfo,
        };
    })));
    return results.filter(Boolean);
});
const getAvailableABarberForWalkingInFromDb = (userId, saloonOwnerId, barberId) => __awaiter(void 0, void 0, void 0, function* () {
    const allBarbers = yield getAvailableBarbersForWalkingInFromDb(userId, saloonOwnerId);
    if (allBarbers && Array.isArray(allBarbers)) {
        const barber = allBarbers.find(b => b && b.barberId === barberId);
        if (!barber) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Barber not found or unavailable');
        }
        return barber;
    }
    return { message: 'No barbers available' };
});
const getAvailableBarbersFromDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const date = new Date(data.utcDateTime);
    // date must be in the future
    if (date <= new Date()) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Date and time must be in the future');
    }
    // date must be within next 3 weeks
    const threeWeeksFromNow = luxon_1.DateTime.now().plus({ weeks: 3 });
    if (luxon_1.DateTime.fromJSDate(date) > threeWeeksFromNow) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Date cannot be more than 3 weeks in the future');
    }
    const luxonDate = luxon_1.DateTime.fromJSDate(date);
    // 1. Check if the salon is on holiday (global filter)
    const salon = yield prisma_1.default.saloonOwner.findUnique({
        where: { userId: data.saloonOwnerId },
        select: {
            userId: true,
        },
    });
    if (!salon || !salon.userId) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Salon not found for user');
    }
    // const salonId = booking.salonId;
    const salonHoliday = yield prisma_1.default.saloonHoliday.findFirst({
        where: {
            userId: salon.userId,
            date: date,
        },
    });
    if (salonHoliday) {
        return { message: 'Salon is closed on this date' };
    }
    // 2. Get all barbers for the salon
    // const barbers = await prisma.barber.findMany({
    //   where: {
    //     saloonOwnerId: data.salonId,
    //   },
    //   include: {
    //     user: {
    //       select: {
    //         id: true,
    //         fullName: true,
    //         email: true,
    //         phoneNumber: true,
    //         status: true,
    //       },
    //     },
    //   },
    // });
    let barbers = yield prisma_1.default.barber.findMany({
        where: { saloonOwnerId: data.saloonOwnerId },
        include: {
            user: { select: { id: true, fullName: true, status: true } },
        },
    });
    // if barber schedule is not added for the saloon owner, that barber should not be shown in the list
    const barberIdsWithSchedule = yield prisma_1.default.barberSchedule.findMany({
        where: { barber: { saloonOwnerId: data.saloonOwnerId } },
        select: { barberId: true },
        distinct: ['barberId'],
    });
    const barberIdsSet = new Set(barberIdsWithSchedule.map(b => b.barberId));
    const filteredBarbers = barbers.filter(b => barberIdsSet.has(b.userId));
    if (filteredBarbers.length === 0) {
        return { message: 'No barbers with schedules found for this salon' };
    }
    barbers = filteredBarbers;
    // 3. Parallelize per-barber checks
    const availableBarbers = yield Promise.all(barbers.map((barber) => __awaiter(void 0, void 0, void 0, function* () {
        // 3a. Check day-off
        const dayOff = yield prisma_1.default.barberDayOff.findFirst({
            where: {
                saloonOwnerId: data.saloonOwnerId,
                barberId: barber.userId,
                date: date,
            },
        });
        if (dayOff)
            return null;
        // 3b. Check real-time availability (from cache/fast source)
        // Assume a function checkBarberRealtimeAvailability(barberId, time) returns boolean
        const isAvailableRealtime = yield prisma_1.default.barberRealTimeStatus.findMany({
            where: {
                barberId: barber.userId,
                AND: [
                    {
                        startDateTime: {
                            lte: date,
                        },
                    },
                    {
                        endDateTime: {
                            gte: date,
                        },
                    },
                ],
            },
        });
        if (!isAvailableRealtime)
            return { message: 'Barber is not available at this time' };
        // 3c. Fetch schedule + bookings if still potentially available
        const schedule = yield prisma_1.default.barberSchedule.findFirst({
            where: {
                barberId: barber.userId,
                dayName: luxonDate.toFormat('cccc').toLowerCase(),
            },
        });
        // if (!schedule) return { message: 'Barber schedule not found' };
        const overlappingBooking = yield prisma_1.default.booking.findFirst({
            where: {
                barberId: barber.userId,
                AND: [
                    {
                        startDateTime: {
                            lte: date,
                        },
                    },
                    {
                        endDateTime: {
                            gte: date,
                        },
                    },
                ],
            },
        });
        if (overlappingBooking)
            return { message: 'No barber is not available for this time' };
        return barber;
    })));
    return availableBarbers.filter(Boolean);
});
// getBookingListForSalonOwnerFromDb (fixed)
const getBookingListForSalonOwnerFromDb = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, options = {}) {
    var _h;
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    const searchTerm = (_h = options.searchTerm) === null || _h === void 0 ? void 0 : _h.trim();
    const searchClause = searchTerm
        ? {
            OR: [
                {
                    user: {
                        fullName: { contains: searchTerm, mode: 'insensitive' },
                    },
                },
                {
                    user: {
                        email: { contains: searchTerm, mode: 'insensitive' },
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
            ],
        }
        : {};
    const allowedStatuses = [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.PENDING];
    const date = options.date
        ? (() => {
            // appointmentAt is stored as UTC; build local-day range then convert to UTC bounds
            const localStart = luxon_1.DateTime.fromISO(String(options.date), { zone: 'local' }).startOf('day');
            const localEnd = localStart.plus({ days: 1 });
            return {
                appointmentAt: {
                    gte: localStart.toUTC().toJSDate(),
                    lt: localEnd.toUTC().toJSDate(),
                },
            };
        })()
        : {};
    const whereClause = Object.assign(Object.assign({ saloonOwnerId: userId, status: { in: allowedStatuses } }, searchClause), date);
    // 1) fetch bookings; NOTE: do NOT select the `user` relation here to avoid Prisma's "required relation returned null" problem.
    const [bookings, total] = yield Promise.all([
        prisma_1.default.booking.findMany({
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
        prisma_1.default.booking.count({ where: whereClause }),
    ]);
    // 2) collect unique userIds present in bookings
    const userIds = Array.from(new Set(bookings.map(b => b.userId).filter(Boolean)));
    // 3) fetch registered users that match those ids
    const registeredUsers = userIds.length
        ? yield prisma_1.default.user.findMany({
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
    const regUserMap = registeredUsers.reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
    }, {});
    // 4) remaining ids -> non-registered users
    const nonRegisteredIds = userIds.filter(id => !regUserMap[id]);
    const nonRegisteredUsers = nonRegisteredIds.length
        ? yield prisma_1.default.nonRegisteredUser.findMany({
            where: { id: { in: nonRegisteredIds } },
            select: { id: true, fullName: true, email: true, phone: true },
        })
        : [];
    const nonRegMap = nonRegisteredUsers.reduce((acc, nr) => {
        acc[nr.id] = nr;
        return acc;
    }, {});
    // 5) map bookings to response shape using the lookup maps
    const mapped = bookings.map(b => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        const userInfo = regUserMap[b.userId]
            ? {
                id: regUserMap[b.userId].id,
                image: (_a = regUserMap[b.userId].image) !== null && _a !== void 0 ? _a : null,
                fullName: (_b = regUserMap[b.userId].fullName) !== null && _b !== void 0 ? _b : null,
                email: (_c = regUserMap[b.userId].email) !== null && _c !== void 0 ? _c : null,
                phoneNumber: (_d = regUserMap[b.userId].phoneNumber) !== null && _d !== void 0 ? _d : null,
            }
            : nonRegMap[b.userId]
                ? {
                    id: nonRegMap[b.userId].id,
                    image: null,
                    fullName: nonRegMap[b.userId].fullName,
                    email: (_e = nonRegMap[b.userId].email) !== null && _e !== void 0 ? _e : null,
                    phoneNumber: (_f = nonRegMap[b.userId].phone) !== null && _f !== void 0 ? _f : null,
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
            barberName: (_j = (_h = (_g = b.barber) === null || _g === void 0 ? void 0 : _g.user) === null || _h === void 0 ? void 0 : _h.fullName) !== null && _j !== void 0 ? _j : null,
            barberImage: (_m = (_l = (_k = b.barber) === null || _k === void 0 ? void 0 : _k.user) === null || _l === void 0 ? void 0 : _l.image) !== null && _m !== void 0 ? _m : null,
            status: (_o = b.status) !== null && _o !== void 0 ? _o : null,
            position: (_r = (_q = (_p = b.queueSlot) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.position) !== null && _r !== void 0 ? _r : null,
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
});
const getBookingByIdFromDbForSalon = (userId, bookingId) => __awaiter(void 0, void 0, void 0, function* () {
    var _j, _k, _l, _m, _o, _p;
    const result = yield prisma_1.default.booking.findUnique({
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
        customerName: ((_j = result.user) === null || _j === void 0 ? void 0 : _j.fullName) || null,
        customerEmail: ((_k = result.user) === null || _k === void 0 ? void 0 : _k.email) || null,
        customerContact: ((_l = result.user) === null || _l === void 0 ? void 0 : _l.phoneNumber) || null,
        date: result.date,
        time: result.startTime,
        serviceNames: ((_m = result.BookedServices) === null || _m === void 0 ? void 0 : _m.map(bs => { var _a; return (_a = bs.service) === null || _a === void 0 ? void 0 : _a.serviceName; })) || [],
        barberName: ((_p = (_o = result.barber) === null || _o === void 0 ? void 0 : _o.user) === null || _p === void 0 ? void 0 : _p.fullName) || null,
        status: result.status || null,
    };
});
const updateBookingIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    // Only allow customer to update the schedule (date and appointmentAt/time)
    const { bookingId, date, appointmentAt } = data;
    if (!date || !appointmentAt) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Only date and appointmentAt can be updated');
    }
    // Fetch the existing booking to verify ownership and get related info
    const existingBooking = yield prisma_1.default.booking.findUnique({
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
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Booking not found');
    }
    // Calculate totalDuration from booked services
    const totalDuration = existingBooking.BookedServices.reduce((sum, bs) => { var _a; return sum + (((_a = bs.service) === null || _a === void 0 ? void 0 : _a.duration) || 0); }, 0);
    // Combine date and appointmentAt to get new startDateTime
    const localDateTime = luxon_1.DateTime.fromFormat(`${date} ${appointmentAt}`, 'yyyy-MM-dd hh:mm a', { zone: 'local' });
    if (!localDateTime.isValid) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid date or time format');
    }
    const utcDateTime = localDateTime.toUTC().toJSDate();
    // Calculate new endDateTime
    const endDateTime = luxon_1.DateTime.fromJSDate(utcDateTime)
        .plus({ minutes: totalDuration })
        .toJSDate();
    // Check for overlapping bookings for this barber
    const overlappingBooking = yield prisma_1.default.booking.findFirst({
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
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber already has a booking or is unavailable during the requested time slot');
    }
    // Transaction to update booking, queueSlot, and barberRealTimeStatus
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _q;
        // 1. Update booking
        const updatedBooking = yield tx.booking.update({
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
                endTime: luxon_1.DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
                loyaltySchemeId: data.loyaltySchemeId || null,
                loyaltyUsed: data.loyaltyProgramId ? true : false,
            },
        });
        // 2. Update queueSlot if exists
        if (existingBooking.queueSlot) {
            // Update the current slot's startedAt before reordering
            yield tx.queueSlot.update({
                where: { id: existingBooking.queueSlot[0].id },
                data: {
                    startedAt: utcDateTime,
                    completedAt: endDateTime,
                },
            });
            // Fetch all slots again, ordered by startedAt
            const queueSlots = yield tx.queueSlot.findMany({
                where: {
                    queueId: (_q = existingBooking.queueSlot[0]) === null || _q === void 0 ? void 0 : _q.queueId,
                },
                orderBy: { startedAt: 'asc' },
            });
            // Re-assign positions sequentially based on startedAt
            for (let i = 0; i < queueSlots.length; i++) {
                yield tx.queueSlot.update({
                    where: { id: queueSlots[i].id },
                    data: { position: i + 1 },
                });
            }
        }
        // 3. Update barberRealTimeStatus for this booking if exists
        yield tx.barberRealTimeStatus.deleteMany({
            where: {
                barberId: existingBooking.barberId,
                startDateTime: existingBooking.startDateTime || utcDateTime,
                endDateTime: existingBooking.endDateTime || endDateTime,
            },
        });
        yield tx.barberRealTimeStatus.create({
            data: {
                barberId: existingBooking.barberId,
                startDateTime: utcDateTime,
                endDateTime: endDateTime,
                isAvailable: false,
                startTime: localDateTime.toFormat('hh:mm a'),
                endTime: luxon_1.DateTime.fromJSDate(endDateTime).toFormat('hh:mm a'),
            },
        });
        return updatedBooking;
    }));
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'bookingId, not updated');
    }
    return result;
});
const updateBookingStatusIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { bookingId, status } = data;
    console.log('Current booking status:', status);
    // Only allow salon owner to update the status
    const booking = yield prisma_1.default.booking.findUnique({
        where: {
            id: bookingId,
            saloonOwnerId: userId,
        },
    });
    if (!booking) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Booking not found');
    }
    if (!['CONFIRMED', 'RESCHEDULED', 'PENDING'].includes(status)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid status. Allowed value is CONFIRMED');
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
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (status === client_1.BookingStatus.CONFIRMED) {
            const checkPending = yield tx.booking.update({
                where: {
                    id: bookingId,
                    saloonOwnerId: userId,
                    status: client_1.BookingStatus.PENDING,
                },
                data: {
                    status: client_1.BookingStatus.CONFIRMED,
                },
            });
            if (!checkPending) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Only PENDING bookings can be CONFIRMED');
            }
            return checkPending;
        }
        // If status is CANCELED, delete the queueSlot and barberRealTimeStatus
        if (status === client_1.BookingStatus.PENDING) {
            const checkConfirmed = yield tx.booking.findFirst({
                where: {
                    id: bookingId,
                    saloonOwnerId: userId,
                },
            });
            if (checkConfirmed) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Bookings can not be set to PENDING by salon owner');
            }
            return checkConfirmed;
        }
    }));
    return result;
});
const cancelBookingIntoDb = (userId, bookingId) => __awaiter(void 0, void 0, void 0, function* () {
    // Only allow customer to cancel their own booking if it's in PENDING or CONFIRMED status
    const booking = yield prisma_1.default.booking.findUnique({
        where: {
            id: bookingId,
            userId: userId,
        },
        include: { queueSlot: true, barber: true, BookedServices: true },
    });
    if (!booking) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Booking not found');
    }
    if (![client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED].includes(booking.status)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Only bookings in PENDING or CONFIRMED status can be canceled');
    }
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // 1. Update booking status to CANCELED
        const updatedBooking = yield tx.booking.update({
            where: {
                id: bookingId,
                userId: userId,
            },
            data: {
                status: client_1.BookingStatus.CANCELLED,
            },
        });
        if (!updatedBooking) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking not canceled');
        }
        // 2. Delete associated queueSlot if exists
        if (booking.queueSlot && booking.queueSlot.length > 0) {
            // Delete the queueSlot for this booking
            yield tx.queueSlot.deleteMany({
                where: { bookingId: bookingId },
            });
            // Get the queueSlot to find the queueId
            const slot = yield tx.queueSlot.findUnique({
                where: { id: booking.queueSlot[0].id },
            });
            if (slot) {
                // Get all slots for this queue, ordered by startedAt
                const slots = yield tx.queueSlot.findMany({
                    where: { queueId: slot.queueId },
                    orderBy: { startedAt: 'asc' },
                });
                // Re-assign positions sequentially
                for (let i = 0; i < slots.length; i++) {
                    yield tx.queueSlot.update({
                        where: { id: slots[i].id },
                        data: { position: i + 1 },
                    });
                }
                // If no slots remain, delete the queue
                if (slots.length === 0) {
                    yield tx.queue.delete({
                        where: { id: slot.queueId },
                    });
                }
                else {
                    // Otherwise, update currentPosition to slots.length
                    yield tx.queue.update({
                        where: { id: slot.queueId },
                        data: { currentPosition: slots.length },
                    });
                }
            }
        }
        // 3. Delete associated barberRealTimeStatus if exists
        yield tx.barberRealTimeStatus.deleteMany({
            where: {
                barberId: booking.barberId,
                startDateTime: booking.startDateTime || new Date(),
                endDateTime: booking.endDateTime || new Date(),
            },
        });
        return updatedBooking;
    }));
    return result;
});
const deleteBookingItemFromDb = (userId, bookingId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.booking.delete({
        where: {
            id: bookingId,
            saloonOwnerId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'bookingId, not deleted');
    }
    return deletedItem;
});
const getLoyaltySchemesForCustomerFromDb = (userId, saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    const totalPoints = yield prisma_1.default.customerLoyalty.aggregate({
        where: { userId: userId },
        _sum: { totalPoints: true },
    });
    const schemes = yield prisma_1.default.loyaltyScheme.findMany({
        where: {
            userId: saloonOwnerId,
        },
        orderBy: { pointThreshold: 'asc' },
    });
    const availableSchemes = schemes.filter(scheme => totalPoints._sum.totalPoints !== null &&
        scheme.pointThreshold <= totalPoints._sum.totalPoints);
    return {
        totalPoints: totalPoints._sum.totalPoints || 0,
        schemes: availableSchemes,
    };
});
exports.bookingService = {
    createBookingIntoDb,
    getBookingListFromDb,
    getBookingListForSalonOwnerFromDb,
    getBookingByIdFromDbForSalon,
    getAllBarbersForQueueFromDb,
    getAvailableBarbersForWalkingInFromDb,
    getAvailableABarberForWalkingInFromDb,
    getAvailableBarbersFromDb,
    getBookingByIdFromDb,
    updateBookingIntoDb,
    updateBookingStatusIntoDb,
    cancelBookingIntoDb,
    deleteBookingItemFromDb,
    getLoyaltySchemesForCustomerFromDb,
};

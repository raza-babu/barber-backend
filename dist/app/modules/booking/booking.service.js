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
const createBookingIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { barberId, saloonOwnerId, appointmentAt, date, services, notes, isInQueue, } = data;
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
        if (saloonOwner.isQueueEnabled && isInQueue) {
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
        return ({
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
            position: ((_d = booking.queueSlot[0]) === null || _d === void 0 ? void 0 : _d.position) || null,
            serviceNames: ((_e = booking.BookedServices) === null || _e === void 0 ? void 0 : _e.map(bs => { var _a; return (_a = bs.service) === null || _a === void 0 ? void 0 : _a.serviceName; })) || [],
            barberName: ((_g = (_f = booking.barber) === null || _f === void 0 ? void 0 : _f.user) === null || _g === void 0 ? void 0 : _g.fullName) || null,
            status: booking.status || null,
        });
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
const getAvailableBarbersFromDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const date = new Date(data.utcDateTime);
    const luxonDate = luxon_1.DateTime.fromJSDate(date);
    // 1. Check if the salon is on holiday (global filter)
    const salon = yield prisma_1.default.saloonOwner.findUnique({
        where: { userId: data.salonId },
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
    const barbers = yield prisma_1.default.barber.findMany({
        where: {
            saloonOwnerId: data.salonId,
        },
    });
    // 3. Parallelize per-barber checks
    const availableBarbers = yield Promise.all(barbers.map((barber) => __awaiter(void 0, void 0, void 0, function* () {
        // 3a. Check day-off
        const dayOff = yield prisma_1.default.barberDayOff.findFirst({
            where: {
                saloonOwnerId: data.salonId,
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
        if (!schedule)
            return { message: 'Barber schedule not found' };
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
const getBookingListForSalonOwnerFromDb = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, options = {}) {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Build search query for customer or barber name/email/phone
    const searchQuery = options.searchTerm
        ? {
            OR: [
                {
                    user: {
                        fullName: {
                            contains: options.searchTerm,
                            mode: 'insensitive',
                        },
                    },
                },
                {
                    user: {
                        email: {
                            contains: options.searchTerm,
                            mode: 'insensitive',
                        },
                    },
                },
                {
                    user: {
                        phoneNumber: {
                            contains: options.searchTerm,
                            mode: 'insensitive',
                        },
                    },
                },
                {
                    barber: {
                        user: {
                            fullName: {
                                contains: options.searchTerm,
                                mode: 'insensitive',
                            },
                        },
                    },
                },
            ],
        }
        : {};
    // ✅ Only CONFIRMED and PENDING bookings
    const allowedStatuses = [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.PENDING];
    const whereClause = Object.assign({ saloonOwnerId: userId, status: { in: allowedStatuses } }, (Object.keys(searchQuery).length > 0 && searchQuery));
    const [result, total] = yield Promise.all([
        prisma_1.default.booking.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
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
                        position: true,
                    },
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
                        image: true,
                        fullName: true,
                        email: true,
                        phoneNumber: true,
                    },
                },
            },
        }),
        prisma_1.default.booking.count({ where: whereClause }),
    ]);
    // Flatten results
    const mapped = result.map(booking => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return ({
            bookingId: booking.id,
            customerId: booking.userId,
            barberId: booking.barberId,
            saloonOwnerId: booking.saloonOwnerId,
            totalPrice: booking.totalPrice,
            notes: booking.notes,
            customerImage: ((_a = booking.user) === null || _a === void 0 ? void 0 : _a.image) || null,
            customerName: ((_b = booking.user) === null || _b === void 0 ? void 0 : _b.fullName) || null,
            customerEmail: ((_c = booking.user) === null || _c === void 0 ? void 0 : _c.email) || null,
            customerPhone: ((_d = booking.user) === null || _d === void 0 ? void 0 : _d.phoneNumber) || null,
            bookingDate: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            services: booking.BookedServices.map(service => ({
                serviceId: service.service.id,
                serviceName: service.service.serviceName,
                price: service.service.price,
                availableTo: service.service.availableTo,
            })),
            barberName: ((_f = (_e = booking.barber) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.fullName) || null,
            barberImage: ((_h = (_g = booking.barber) === null || _g === void 0 ? void 0 : _g.user) === null || _h === void 0 ? void 0 : _h.image) || null,
            status: booking.status || null,
            position: ((_j = booking.queueSlot[0]) === null || _j === void 0 ? void 0 : _j.position) || null,
        });
    });
    // ✅ Return directly in the required shape
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
    var _h, _j, _k, _l, _m, _o;
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
        customerName: ((_h = result.user) === null || _h === void 0 ? void 0 : _h.fullName) || null,
        customerEmail: ((_j = result.user) === null || _j === void 0 ? void 0 : _j.email) || null,
        customerContact: ((_k = result.user) === null || _k === void 0 ? void 0 : _k.phoneNumber) || null,
        date: result.date,
        time: result.startTime,
        serviceNames: ((_l = result.BookedServices) === null || _l === void 0 ? void 0 : _l.map(bs => { var _a; return (_a = bs.service) === null || _a === void 0 ? void 0 : _a.serviceName; })) || [],
        barberName: ((_o = (_m = result.barber) === null || _m === void 0 ? void 0 : _m.user) === null || _o === void 0 ? void 0 : _o.fullName) || null,
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
        var _p;
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
                    queueId: (_p = existingBooking.queueSlot[0]) === null || _p === void 0 ? void 0 : _p.queueId,
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
    if (!['CONFIRMED', 'CANCELED', 'COMPLETED', 'RESCHEDULED'].includes(status)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid status. Allowed values are CONFIRMED, CANCELED, COMPLETED');
    }
    const result = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedBooking = yield tx.booking.update({
            where: {
                id: bookingId,
                saloonOwnerId: userId,
            },
            data: {
                status: status === 'COMPLETED'
                    ? client_1.BookingStatus.COMPLETED
                    : client_1.BookingStatus.PENDING,
            },
        });
        if (!updatedBooking) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking status not updated');
        }
        // If status is COMPLETED, update barber's real-time status to available
        if (status === 'COMPLETED') {
            yield tx.barberRealTimeStatus.deleteMany({
                where: {
                    barberId: booking.barberId,
                    startDateTime: booking.startDateTime,
                    endDateTime: booking.endDateTime,
                },
            });
            // update queueSlot status to completed
            yield tx.queueSlot.updateMany({
                where: {
                    bookingId: bookingId,
                },
                data: {
                    status: client_1.QueueStatus.COMPLETED,
                },
            });
            yield tx.queue.updateMany({
                where: {
                    barberId: booking.barberId,
                    saloonOwnerId: booking.saloonOwnerId,
                    date: booking.date,
                },
                data: {
                    currentPosition: {
                        decrement: 1,
                    },
                },
            });
        }
        // If status is CANCELED, delete the queueSlot and barberRealTimeStatus
        if (status === 'CANCELED') {
            yield tx.booking.update({
                where: {
                    id: bookingId,
                    saloonOwnerId: userId,
                },
                data: {
                    status: status === 'CANCELED'
                        ? client_1.BookingStatus.CANCELLED
                        : client_1.BookingStatus.PENDING,
                },
            });
            // Delete the queueSlot and barberRealTimeStatus
            yield tx.queueSlot.deleteMany({
                where: {
                    bookingId: bookingId,
                },
            });
            yield tx.queue.updateMany({
                where: {
                    barberId: booking.barberId,
                    saloonOwnerId: booking.saloonOwnerId,
                    date: booking.date,
                },
                data: {
                    currentPosition: {
                        decrement: 1,
                    },
                },
            });
            yield tx.barberRealTimeStatus.deleteMany({
                where: {
                    barberId: booking.barberId,
                    startDateTime: booking.startDateTime,
                    endDateTime: booking.endDateTime,
                },
            });
        }
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
exports.bookingService = {
    createBookingIntoDb,
    getBookingListFromDb,
    getBookingListForSalonOwnerFromDb,
    getBookingByIdFromDbForSalon,
    getAvailableBarbersFromDb,
    getBookingByIdFromDb,
    updateBookingIntoDb,
    updateBookingStatusIntoDb,
    deleteBookingItemFromDb,
};

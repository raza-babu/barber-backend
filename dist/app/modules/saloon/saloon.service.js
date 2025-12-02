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
exports.saloonService = void 0;
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const luxon_1 = require("luxon");
const pagination_1 = require("../../utils/pagination");
const prisma_1 = __importDefault(require("../../utils/prisma"));
const manageBookingsIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const booking = yield tx.booking.findUnique({
            where: {
                id: data.bookingId,
                saloonOwnerId: userId,
            },
        });
        if (!booking) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Booking not found');
        }
        const currentStatus = booking.status;
        const targetStatus = data.status;
        const bookingEndTime = luxon_1.DateTime.fromJSDate(booking.endDateTime);
        const now = luxon_1.DateTime.now();
        // ---------- Status Transition Rules ----------
        switch (targetStatus) {
            case client_1.BookingStatus.PENDING:
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Status cannot be changed back to pending');
            case client_1.BookingStatus.CONFIRMED:
                if (currentStatus !== client_1.BookingStatus.PENDING) {
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Only pending bookings can be confirmed');
                }
                break;
            case client_1.BookingStatus.COMPLETED:
                if (currentStatus !== client_1.BookingStatus.CONFIRMED) {
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Only confirmed bookings can be marked as completed');
                }
                if (booking && booking.endDateTime) {
                    const currentTime = new Date();
                    // Allow COMPLETED status only if current time is within 15 minutes before or after endDateTime
                    const fifteenMinutesBeforeEnd = new Date(booking.endDateTime.getTime() - 15 * 60 * 1000);
                    if (currentTime < fifteenMinutesBeforeEnd) {
                        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Cannot change status to COMPLETED before 15 minutes prior to the booking end time');
                    }
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Cannot change status to COMPLETED before the booking end time');
                }
                break;
            case client_1.BookingStatus.CANCELLED:
                if (currentStatus === client_1.BookingStatus.COMPLETED) {
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Completed bookings cannot be cancelled');
                }
                if (currentStatus === client_1.BookingStatus.CANCELLED) {
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking is already cancelled');
                }
                break;
            default:
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid status transition');
        }
        // ---------- Additional Rules ----------
        if (currentStatus === client_1.BookingStatus.RESCHEDULED && now > bookingEndTime) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Cannot change status of a missed booking');
        }
        // ---------- Refund Logic Placeholders ----------
        if ((currentStatus === client_1.BookingStatus.CONFIRMED &&
            targetStatus === client_1.BookingStatus.CANCELLED) ||
            (currentStatus === client_1.BookingStatus.PENDING &&
                targetStatus === client_1.BookingStatus.CANCELLED)) {
            // Refund logic can be implemented here if needed
        }
        // ---------- Update Booking ----------
        const updatedBooking = yield tx.booking.update({
            where: {
                id: data.bookingId,
                saloonOwnerId: userId,
            },
            data: {
                status: targetStatus,
            },
            include: {
                BookedServices: true,
            },
        });
        if (!updatedBooking) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking not found or not updated');
        }
        if (updatedBooking.status === client_1.BookingStatus.COMPLETED) {
            // Increment loyalty points for the customer if a loyalty scheme exist for the saloon owner
            // Get all unique serviceIds from the completed booking
            const serviceIds = updatedBooking.BookedServices.map(bs => bs.serviceId);
            // Find all loyalty programs for the saloon owner that match any of the booked services
            const loyaltyPrograms = yield tx.loyaltyProgram.findMany({
                where: {
                    userId: userId,
                    serviceId: { in: serviceIds },
                },
            });
            if (loyaltyPrograms.length > 0) {
                const totalPoints = loyaltyPrograms.reduce((sum, lp) => sum + lp.points, 0);
                if (totalPoints > 0) {
                    yield tx.customerLoyalty.create({
                        data: {
                            userId: updatedBooking.userId,
                            saloonOwnerId: userId,
                            totalPoints: totalPoints,
                        },
                    });
                }
                const updateVisitLog = yield tx.customerVisit.create({
                    data: {
                        customerId: updatedBooking.userId,
                        saloonOwnerId: userId,
                        serviceId: serviceIds,
                        visitDate: new Date(),
                        amountSpent: updatedBooking.totalPrice,
                        earnedPoints: totalPoints,
                    },
                });
                if (!updateVisitLog) {
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to log customer visit');
                }
                const updatePointLog = yield tx.loyaltyPointLog.updateMany({
                    where: {
                        customerId: updatedBooking.userId,
                        saloonId: userId,
                        visitCount: { gt: 0 }
                    },
                    data: {
                        visitCount: { increment: 1 },
                    },
                });
                if (!updatePointLog) {
                    const createPointLog = yield tx.loyaltyPointLog.create({
                        data: {
                            customerId: updatedBooking.userId,
                            saloonId: userId,
                            visitCount: 1,
                        },
                    });
                    if (!createPointLog) {
                        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to create loyalty point log');
                    }
                }
            }
        }
        return updatedBooking;
    }));
});
const getBarberDashboardFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const customerCount = yield prisma_1.default.booking.count({
        where: {
            saloonOwnerId: userId,
            status: client_1.BookingStatus.COMPLETED,
        },
    });
    const totalEarnings = yield prisma_1.default.booking.aggregate({
        _sum: {
            totalPrice: true,
        },
        where: {
            saloonOwnerId: userId,
            status: client_1.BookingStatus.COMPLETED,
        },
    });
    const barberCount = yield prisma_1.default.barber.count({
        where: {
            saloonOwnerId: userId,
        },
    });
    const bookingCount = yield prisma_1.default.booking.count({
        where: {
            saloonOwnerId: userId,
            status: client_1.BookingStatus.PENDING,
        },
    });
    const queueBooking = yield prisma_1.default.booking.count({
        where: {
            saloonOwnerId: userId,
            // type: 'QUEUE',
            status: client_1.BookingStatus.PENDING,
        },
    });
    const jobPostCount = yield prisma_1.default.jobPost.count({
        where: {
            saloonOwnerId: userId,
        },
    });
    const totalJobApplicants = yield prisma_1.default.jobApplication.count({
        where: {
            saloonOwnerId: userId,
        },
    });
    // Get customer growth for the last 12 months, grouped by month and year (e.g., Jan 2024)
    const startDate = luxon_1.DateTime.now()
        .minus({ months: 11 })
        .startOf('month')
        .toJSDate();
    const customerGrowthRaw = yield prisma_1.default.booking.findMany({
        where: {
            saloonOwnerId: userId,
            status: client_1.BookingStatus.COMPLETED,
            createdAt: {
                gte: startDate,
            },
        },
        select: {
            createdAt: true,
        },
    });
    // Prepare a map for each month in the last 12 months (e.g., Jan 2024)
    const monthlyGrowth = {};
    for (let i = 0; i < 12; i++) {
        const dt = luxon_1.DateTime.now().minus({ months: 11 - i });
        const monthYear = dt.toFormat('LLL yyyy'); // e.g., Jan 2024
        monthlyGrowth[monthYear] = 0;
    }
    // Count bookings per month-year
    customerGrowthRaw.forEach(item => {
        const monthYear = luxon_1.DateTime.fromJSDate(item.createdAt).toFormat('LLL yyyy');
        if (monthlyGrowth[monthYear] !== undefined) {
            monthlyGrowth[monthYear]++;
        }
    });
    // Calculate earning growth for the last 12 months, grouped by month and year
    const earningGrowthRaw = yield prisma_1.default.booking.findMany({
        where: {
            saloonOwnerId: userId,
            status: client_1.BookingStatus.COMPLETED,
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
    const monthlyEarnings = {};
    for (let i = 0; i < 12; i++) {
        const dt = luxon_1.DateTime.now().minus({ months: 11 - i });
        const monthYear = dt.toFormat('LLL yyyy');
        monthlyEarnings[monthYear] = 0;
    }
    // Sum earnings per month-year
    earningGrowthRaw.forEach(item => {
        var _a;
        const monthYear = luxon_1.DateTime.fromJSDate(item.createdAt).toFormat('LLL yyyy');
        if (monthlyEarnings[monthYear] !== undefined) {
            monthlyEarnings[monthYear] += (_a = item.totalPrice) !== null && _a !== void 0 ? _a : 0;
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
});
const getCustomerBookingsFromDb = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, options = {}) {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Build search query for customer name, email, phone, or barber name
    const searchQuery = options.searchTerm
        ? {
            OR: [
                { user: { fullName: { contains: options.searchTerm, mode: 'insensitive' } } },
                { user: { email: { contains: options.searchTerm, mode: 'insensitive' } } },
                { user: { phoneNumber: { contains: options.searchTerm, mode: 'insensitive' } } },
                { barber: { user: { fullName: { contains: options.searchTerm, mode: 'insensitive' } } } },
            ],
        }
        : {};
    // Status filter: exclude PENDING and CONFIRMED by default
    const excludedStatuses = [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED];
    const excludedStatusStrings = excludedStatuses.map(s => s.toString());
    const statusFilter = options.status && Array.isArray(options.status)
        ? { status: { in: options.status.filter(s => !excludedStatusStrings.includes(s)) } }
        : options.status
            ? excludedStatusStrings.includes(options.status)
                ? { status: { notIn: excludedStatuses } }
                : { status: options.status }
            : { status: { notIn: excludedStatuses } };
    const whereClause = Object.assign(Object.assign({ saloonOwnerId: userId }, statusFilter), (Object.keys(searchQuery).length > 0 && searchQuery));
    // 1) Query bookings but do NOT include `user` relation directly (use userId scalar instead)
    const [result, total] = yield Promise.all([
        prisma_1.default.booking.findMany({
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
        prisma_1.default.booking.count({ where: whereClause }),
    ]);
    // 2) Collect unique customer ids from this page
    const customerIds = Array.from(new Set(result.map(b => b.userId).filter(Boolean)));
    // 3) Fetch registered users for these ids
    const registeredUsers = customerIds.length > 0
        ? yield prisma_1.default.user.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, fullName: true, image: true, email: true, phoneNumber: true },
        })
        : [];
    const regUserMap = registeredUsers.reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
    }, {});
    // 4) Identify ids not present in registered users → query non-registered users
    const nonRegisteredIds = customerIds.filter(id => !regUserMap[id]);
    const nonRegisteredUsers = nonRegisteredIds.length > 0
        ? yield prisma_1.default.nonRegisteredUser.findMany({
            where: { id: { in: nonRegisteredIds } },
            select: { id: true, fullName: true, email: true, phone: true },
        })
        : [];
    const nonRegMap = nonRegisteredUsers.reduce((acc, n) => {
        acc[n.id] = n;
        return acc;
    }, {});
    // 5) Map bookings and merge customer info (registered or non-registered)
    const bookings = result.map(booking => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        // Resolve customer info
        let customerId = null;
        let customerName = null;
        let customerImage = null;
        let customerEmail = null;
        let customerPhone = null;
        if (booking.userId) {
            if (regUserMap[booking.userId]) {
                const u = regUserMap[booking.userId];
                customerId = u.id;
                customerName = u.fullName;
                customerImage = (_a = u.image) !== null && _a !== void 0 ? _a : null;
                customerEmail = (_b = u.email) !== null && _b !== void 0 ? _b : null;
                customerPhone = (_c = u.phoneNumber) !== null && _c !== void 0 ? _c : null;
            }
            else if (nonRegMap[booking.userId]) {
                const n = nonRegMap[booking.userId];
                customerId = n.id;
                customerName = n.fullName;
                customerImage = null;
                customerEmail = (_d = n.email) !== null && _d !== void 0 ? _d : null;
                customerPhone = (_e = n.phone) !== null && _e !== void 0 ? _e : null;
            }
            else {
                customerId = booking.userId;
                customerName = 'Unknown Customer';
            }
        }
        const barberUser = (_f = booking.barber) === null || _f === void 0 ? void 0 : _f.user;
        return {
            bookingId: booking.id,
            customerId,
            customerName,
            customerImage,
            customEmail: customerEmail,
            customerPhone,
            barberId: (_g = barberUser === null || barberUser === void 0 ? void 0 : barberUser.id) !== null && _g !== void 0 ? _g : null,
            barberName: (_h = barberUser === null || barberUser === void 0 ? void 0 : barberUser.fullName) !== null && _h !== void 0 ? _h : null,
            barberImage: (_j = barberUser === null || barberUser === void 0 ? void 0 : barberUser.image) !== null && _j !== void 0 ? _j : null,
            barberEmail: (_k = barberUser === null || barberUser === void 0 ? void 0 : barberUser.email) !== null && _k !== void 0 ? _k : null,
            barberPhone: (_l = barberUser === null || barberUser === void 0 ? void 0 : barberUser.phoneNumber) !== null && _l !== void 0 ? _l : null,
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
    return (0, pagination_1.formatPaginationResponse)(bookings, total, page, limit);
});
const getRemainingBarbersToScheduleFromDb = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, options = {}) {
    // First, get all hired barbers for this saloon owner
    const hiredBarbers = yield prisma_1.default.hiredBarber.findMany({
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
    // Next, find barbers who do not have any schedule entries
    const barbersWithSchedules = yield prisma_1.default.barberSchedule.findMany({
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
    const remainingBarbers = hiredBarbers
        .filter(hb => !scheduledBarberIds.includes(hb.barberId))
        .map(hb => ({
        barberId: hb.barberId,
        barberName: hb.barber.user.fullName,
        barberImage: hb.barber.user.image,
        barberPhone: hb.barber.user.phoneNumber,
        barberAddress: hb.barber.user.address,
    }));
    if (remainingBarbers.length === 0) {
        return { message: 'All hired barbers have schedules' };
    }
    return remainingBarbers;
});
const getFreeBarbersOnADateFromDb = (userId_1, date_1, ...args_1) => __awaiter(void 0, [userId_1, date_1, ...args_1], void 0, function* (userId, date, options = {}) {
    if (!date) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Date is required');
    }
    const targetDate = luxon_1.DateTime.fromISO(date, { zone: 'local' });
    if (!targetDate.isValid) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid date format');
    }
    // const dayName = targetDate.toFormat('cccc'); // e.g., 'Monday'
    // Step 1: Get all hired barbers for this saloon owner
    const hiredBarbers = yield prisma_1.default.hiredBarber.findMany({
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
    const barbersWithDaySchedule = yield prisma_1.default.barberSchedule.findMany({
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
    const bookings = yield prisma_1.default.booking.findMany({
        where: {
            barberId: { in: scheduledBarberIds },
            saloonOwnerId: userId,
            status: { in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED] },
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
    const bookingsByBarber = {};
    bookings.forEach(b => {
        if (!bookingsByBarber[b.barberId])
            bookingsByBarber[b.barberId] = [];
        bookingsByBarber[b.barberId].push({
            startTime: b.startTime,
            endTime: b.endTime,
        });
    });
    // For each scheduled barber, calculate free slots
    const freeBarberSlots = barbersWithDaySchedule
        .map(schedule => {
        const hired = hiredBarbers.find(hb => hb.barberId === schedule.barberId);
        if (!schedule.openingTime || !schedule.closingTime)
            return null;
        const dateStr = targetDate.toFormat('yyyy-MM-dd');
        const opening = luxon_1.DateTime.fromFormat(`${dateStr} ${schedule.openingTime}`, 'yyyy-MM-dd hh:mm a', { zone: targetDate.zone });
        const closing = luxon_1.DateTime.fromFormat(`${dateStr} ${schedule.closingTime}`, 'yyyy-MM-dd hh:mm a', { zone: targetDate.zone });
        if (!opening.isValid || !closing.isValid)
            return null;
        // Get all bookings for this barber, sorted by startTime
        const barberBookings = (bookingsByBarber[schedule.barberId] || [])
            .map(b => ({
            start: luxon_1.DateTime.fromFormat(`${dateStr} ${b.startTime}`, 'yyyy-MM-dd hh:mm a', { zone: targetDate.zone }),
            end: luxon_1.DateTime.fromFormat(`${dateStr} ${b.endTime}`, 'yyyy-MM-dd hh:mm a', { zone: targetDate.zone }),
        }))
            .filter(b => b.start.isValid && b.end.isValid)
            .sort((a, b) => a.start.toMillis() - b.start.toMillis());
        // Find free slots between opening and closing, excluding bookings
        const freeSlots = [];
        let lastEnd = opening;
        for (const booking of barberBookings) {
            if (booking.start > lastEnd) {
                freeSlots.push({
                    start: lastEnd.toFormat('hh:mm a'),
                    end: booking.start.toFormat('hh:mm a'),
                });
            }
            if (booking.end > lastEnd && booking.end.isValid) {
                lastEnd = booking.end;
            }
        }
        if (lastEnd < closing) {
            freeSlots.push({
                start: lastEnd.toFormat('hh:mm a'),
                end: closing.toFormat('hh:mm a'),
            });
        }
        return {
            barberId: hired === null || hired === void 0 ? void 0 : hired.barberId,
            barberName: hired === null || hired === void 0 ? void 0 : hired.barber.user.fullName,
            barberImage: hired === null || hired === void 0 ? void 0 : hired.barber.user.image,
            barberPhone: hired === null || hired === void 0 ? void 0 : hired.barber.user.phoneNumber,
            barberAddress: hired === null || hired === void 0 ? void 0 : hired.barber.user.address,
            freeSlots,
        };
    })
        .filter(Boolean);
    // Barbers who do not have a schedule on that day are not available
    if (freeBarberSlots.length === 0) {
        return { message: 'No free barbers available on the selected date' };
    }
    return freeBarberSlots;
});
const getTransactionsFromDb = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, options = {}) {
    var _a;
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    const searchTerm = (_a = options.searchTerm) === null || _a === void 0 ? void 0 : _a.trim();
    // Build booking-level search conditions (used inside booking where)
    const bookingSearchOr = [];
    if (searchTerm) {
        bookingSearchOr.push({ user: { fullName: { contains: searchTerm, mode: 'insensitive' } } }, { user: { email: { contains: searchTerm, mode: 'insensitive' } } }, { user: { phoneNumber: { contains: searchTerm, mode: 'insensitive' } } }, { barber: { user: { fullName: { contains: searchTerm, mode: 'insensitive' } } } }, {
            BookedServices: {
                some: {
                    service: {
                        serviceName: {
                            contains: searchTerm,
                            mode: 'insensitive',
                        },
                    },
                },
            },
        });
    }
    // Main where clause (payments that belong to bookings for this salon owner)
    const whereClause = {
        status: { in: [client_1.PaymentStatus.COMPLETED, client_1.PaymentStatus.REFUNDED] },
        booking: Object.assign({ saloonOwnerId: userId }, (bookingSearchOr.length ? { AND: [{ OR: bookingSearchOr }] } : {})),
    };
    // Fetch payments (do NOT select booking.user relation — only scalar booking.userId)
    const [payments, total] = yield Promise.all([
        prisma_1.default.payment.findMany({
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
        prisma_1.default.payment.count({ where: whereClause }),
    ]);
    // Collect unique userIds referenced by bookings
    const userIds = Array.from(new Set(payments.map(p => { var _a; return (_a = p.booking) === null || _a === void 0 ? void 0 : _a.userId; }).filter(Boolean)));
    // Fetch registered users for those ids
    const filteredUserIds = userIds.filter((id) => typeof id === 'string');
    const registeredUsers = filteredUserIds.length
        ? yield prisma_1.default.user.findMany({
            where: { id: { in: filteredUserIds } },
            select: { id: true, fullName: true, image: true, email: true, phoneNumber: true },
        })
        : [];
    const regMap = registeredUsers.reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
    }, {});
    // Find remaining ids that are not registered users -> non-registered users
    const nonRegisteredIds = userIds.filter((id) => id !== undefined && !regMap[id]);
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
    // Map payments to transaction DTO
    const transactions = payments.map(payment => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5;
        const b = payment.booking;
        const userInfo = (b === null || b === void 0 ? void 0 : b.userId)
            ? regMap[b.userId]
                ? {
                    id: regMap[b.userId].id,
                    fullName: regMap[b.userId].fullName,
                    image: (_a = regMap[b.userId].image) !== null && _a !== void 0 ? _a : null,
                    email: (_b = regMap[b.userId].email) !== null && _b !== void 0 ? _b : null,
                    phoneNumber: (_c = regMap[b.userId].phoneNumber) !== null && _c !== void 0 ? _c : null,
                }
                : nonRegMap[b.userId]
                    ? {
                        id: nonRegMap[b.userId].id,
                        fullName: nonRegMap[b.userId].fullName,
                        image: null,
                        email: (_d = nonRegMap[b.userId].email) !== null && _d !== void 0 ? _d : null,
                        phoneNumber: (_e = nonRegMap[b.userId].phone) !== null && _e !== void 0 ? _e : null,
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
            bookingId: (_f = b === null || b === void 0 ? void 0 : b.id) !== null && _f !== void 0 ? _f : null,
            customerId: userInfo.id,
            customerName: userInfo.fullName,
            customerImage: userInfo.image,
            customerEmail: userInfo.email,
            customerPhone: userInfo.phoneNumber,
            barberId: (_j = (_h = (_g = b === null || b === void 0 ? void 0 : b.barber) === null || _g === void 0 ? void 0 : _g.user) === null || _h === void 0 ? void 0 : _h.id) !== null && _j !== void 0 ? _j : null,
            barberName: (_m = (_l = (_k = b === null || b === void 0 ? void 0 : b.barber) === null || _k === void 0 ? void 0 : _k.user) === null || _l === void 0 ? void 0 : _l.fullName) !== null && _m !== void 0 ? _m : null,
            barberImage: (_q = (_p = (_o = b === null || b === void 0 ? void 0 : b.barber) === null || _o === void 0 ? void 0 : _o.user) === null || _p === void 0 ? void 0 : _p.image) !== null && _q !== void 0 ? _q : null,
            barberEmail: (_t = (_s = (_r = b === null || b === void 0 ? void 0 : b.barber) === null || _r === void 0 ? void 0 : _r.user) === null || _s === void 0 ? void 0 : _s.email) !== null && _t !== void 0 ? _t : null,
            barberPhone: (_w = (_v = (_u = b === null || b === void 0 ? void 0 : b.barber) === null || _u === void 0 ? void 0 : _u.user) === null || _v === void 0 ? void 0 : _v.phoneNumber) !== null && _w !== void 0 ? _w : null,
            totalPrice: (_x = b === null || b === void 0 ? void 0 : b.totalPrice) !== null && _x !== void 0 ? _x : null,
            bookingDate: (_y = b === null || b === void 0 ? void 0 : b.date) !== null && _y !== void 0 ? _y : null,
            startTime: (_z = b === null || b === void 0 ? void 0 : b.startTime) !== null && _z !== void 0 ? _z : null,
            endTime: (_0 = b === null || b === void 0 ? void 0 : b.endTime) !== null && _0 !== void 0 ? _0 : null,
            paymentStatus: payment.status,
            paymentAmount: payment.paymentAmount,
            paymentDate: payment.createdAt,
            bookingStatus: (_1 = b === null || b === void 0 ? void 0 : b.status) !== null && _1 !== void 0 ? _1 : null,
            services: ((_2 = b === null || b === void 0 ? void 0 : b.BookedServices) === null || _2 === void 0 ? void 0 : _2.map(s => ({
                serviceId: s.service.id,
                serviceName: s.service.serviceName,
                price: s.service.price,
                availableTo: s.service.availableTo,
            }))) || [],
            queuePosition: (_5 = (_4 = (_3 = b === null || b === void 0 ? void 0 : b.queueSlot) === null || _3 === void 0 ? void 0 : _3[0]) === null || _4 === void 0 ? void 0 : _4.position) !== null && _5 !== void 0 ? _5 : null,
        };
    });
    return (0, pagination_1.formatPaginationResponse)(transactions, total, page, limit);
});
const getSaloonListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonOwner.findMany();
    if (result.length === 0) {
        return { message: 'No saloon found' };
    }
    return result;
});
const getAllBarbersFromDb = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, 
// saloonId: string,
options = {}) {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
    // Search by barber name, phone, or address
    const searchQuery = options.searchTerm
        ? {
            OR: [
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
                {
                    barber: {
                        user: {
                            phoneNumber: {
                                contains: options.searchTerm,
                                mode: 'insensitive',
                            },
                        },
                    },
                },
                {
                    barber: {
                        user: {
                            address: {
                                contains: options.searchTerm,
                                mode: 'insensitive',
                            },
                        },
                    },
                },
            ],
        }
        : {};
    const whereClause = Object.assign({ userId: userId }, (Object.keys(searchQuery).length > 0 && searchQuery));
    const [result, total] = yield Promise.all([
        prisma_1.default.hiredBarber.findMany({
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
        prisma_1.default.hiredBarber.count({
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
    return (0, pagination_1.formatPaginationResponse)(barbers, total, page, limit);
});
const terminateBarberIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { barberId, reason, date } = data;
    if (!barberId || !date || !userId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required fields');
    }
    const terminationDate = luxon_1.DateTime.fromISO(date).toUTC();
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Check if the barber exists
        const barber = yield tx.barber.findUnique({
            where: {
                userId: barberId,
                saloonOwnerId: userId,
            },
        });
        if (!barber) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Barber not found');
        }
        // Check for future bookings for this barber
        const conflictingBooking = yield tx.booking.findFirst({
            where: {
                barberId: data.barberId,
                startDateTime: {
                    gte: terminationDate.toJSDate(),
                },
                status: {
                    in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED],
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
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, `Cannot terminate barber before ${startTimeString} due to existing bookings.`);
        }
        // Create a termination record
        const terminationRecord = yield tx.terminateBarber.create({
            data: {
                barberId: data.barberId,
                reason: data.reason,
                saloonId: userId,
                date: data.date.toJSDate(),
            },
        });
        // Delete the barber
        yield tx.barber.delete({
            where: {
                id: data.barberId,
            },
        });
        const deleteFromHiredBarber = yield tx.hiredBarber.delete({
            where: {
                barberId: terminationRecord.barberId,
            },
        });
        if (!deleteFromHiredBarber) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Barber not found or not deleted');
        }
        return terminationRecord;
    }));
});
const getASaloonByIdFromDb = (userId, saloonOwnerId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const result = yield prisma_1.default.saloonOwner.findUnique({
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
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Saloon not found');
    }
    // check following or not
    const isFollowing = yield prisma_1.default.follow.findFirst({
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
        shopOwnerName: (_a = result.user) === null || _a === void 0 ? void 0 : _a.fullName,
        shopOwnerEmail: (_b = result.user) === null || _b === void 0 ? void 0 : _b.email,
        shopOwnerPhone: (_c = result.user) === null || _c === void 0 ? void 0 : _c.phoneNumber,
        shopName: result.shopName,
        shopBio: result.shopBio,
        shopAddress: result.shopAddress,
        shopImages: result.shopImages,
        isVerified: result.isVerified,
        ratingCount: result.ratingCount,
        avgRating: result.avgRating,
        followerCount: (_d = result.user) === null || _d === void 0 ? void 0 : _d.followerCount,
        followingCount: (_e = result.user) === null || _e === void 0 ? void 0 : _e.followingCount,
        registrationNumber: result.registrationNumber,
        shopLogo: result.shopLogo,
        shopVideo: result.shopVideo,
        latitude: result.latitude,
        longitude: result.longitude,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        services: (_f = result.user) === null || _f === void 0 ? void 0 : _f.Service.map(service => ({
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
});
const getScheduledBarbersFromDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { utcDateTime } = data;
    if (!utcDateTime || !userId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required fields');
    }
    // Parse incoming UTC ISO string
    const appointmentDateTime = luxon_1.DateTime.fromISO(utcDateTime, { zone: 'utc' });
    if (!appointmentDateTime.isValid) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid date or time format');
    }
    const appointmentJSDate = appointmentDateTime.toJSDate();
    // Find bookings that contain the given instant (start <= t <= end)
    const bookings = yield prisma_1.default.booking.findMany({
        where: {
            saloonOwnerId: userId,
            startDateTime: { lte: appointmentJSDate },
            endDateTime: { gte: appointmentJSDate },
            status: { in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED] },
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
    if (!bookings || bookings.length === 0)
        return [];
    // Collect unique customer ids referenced by bookings
    const customerIds = Array.from(new Set(bookings.map(b => b.userId).filter(Boolean)));
    // Fetch registered users for these ids
    const registeredUsers = customerIds.length > 0
        ? yield prisma_1.default.user.findMany({
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
    const regUserMap = registeredUsers.reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
    }, {});
    // Find ids not present in registered users → treat them as non-registered
    const nonRegisteredIds = customerIds.filter(id => !regUserMap[id]);
    const nonRegisteredUsers = nonRegisteredIds.length > 0
        ? yield prisma_1.default.nonRegisteredUser.findMany({
            where: { id: { in: nonRegisteredIds } },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
            },
        })
        : [];
    const nonRegMap = nonRegisteredUsers.reduce((acc, n) => {
        acc[n.id] = n;
        return acc;
    }, {});
    // Map bookings into the scheduledBarbers shape and resolve customer info
    const scheduledBarbers = bookings.map(b => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        // Resolve customer info (registered or non-registered)
        let customer = {
            customerId: null,
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
                    customerImage: (_a = regUserMap[b.userId].image) !== null && _a !== void 0 ? _a : null,
                    customerEmail: (_b = regUserMap[b.userId].email) !== null && _b !== void 0 ? _b : null,
                    customerPhone: (_c = regUserMap[b.userId].phoneNumber) !== null && _c !== void 0 ? _c : null,
                };
            }
            else if (nonRegMap[b.userId]) {
                customer = {
                    customerId: nonRegMap[b.userId].id,
                    customerName: nonRegMap[b.userId].fullName,
                    customerImage: null,
                    customerEmail: (_d = nonRegMap[b.userId].email) !== null && _d !== void 0 ? _d : null,
                    customerPhone: (_e = nonRegMap[b.userId].phone) !== null && _e !== void 0 ? _e : null,
                };
            }
            else {
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
        const barberUser = (_f = b.barber) === null || _f === void 0 ? void 0 : _f.user;
        return {
            barberId: (_h = (_g = b.barber) === null || _g === void 0 ? void 0 : _g.userId) !== null && _h !== void 0 ? _h : null,
            barberName: (_j = barberUser === null || barberUser === void 0 ? void 0 : barberUser.fullName) !== null && _j !== void 0 ? _j : null,
            barberImage: (_k = barberUser === null || barberUser === void 0 ? void 0 : barberUser.image) !== null && _k !== void 0 ? _k : null,
            barberPhone: (_l = barberUser === null || barberUser === void 0 ? void 0 : barberUser.phoneNumber) !== null && _l !== void 0 ? _l : null,
            barberAddress: (_m = barberUser === null || barberUser === void 0 ? void 0 : barberUser.address) !== null && _m !== void 0 ? _m : null,
            bookingId: b.id,
            bookingDate: b.date,
            bookingStartTime: b.startTime,
            bookingEndTime: b.endTime,
            bookingStatus: b.status,
            customer,
            services: (_p = (_o = b.BookedServices) === null || _o === void 0 ? void 0 : _o.map(s => ({
                serviceId: s.service.id,
                serviceName: s.service.serviceName,
                price: s.service.price,
                availableTo: s.service.availableTo,
            }))) !== null && _p !== void 0 ? _p : [],
            totalPrice: b.totalPrice,
        };
    });
    return scheduledBarbers;
});
const updateSaloonQueueControlIntoDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    // Fetch current saloon record
    const saloon = yield prisma_1.default.saloonOwner.findUnique({
        where: { userId },
        select: { id: true, isQueueEnabled: true },
    });
    if (!saloon) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Saloon not found');
    }
    // Toggle the flag (coerce undefined/null to false)
    const newValue = !Boolean(saloon.isQueueEnabled);
    const updatedSaloon = yield prisma_1.default.saloonOwner.update({
        where: { userId },
        data: { isQueueEnabled: newValue },
        select: { id: true, isQueueEnabled: true },
    });
    if (!updatedSaloon) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Saloon queue control not updated');
    }
    return updatedSaloon;
});
const deleteSaloonItemFromDb = (userId, saloonId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.saloonOwner.delete({
        where: {
            id: saloonId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'saloonId, not deleted');
    }
    return deletedItem;
});
exports.saloonService = {
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

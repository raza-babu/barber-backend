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
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const luxon_1 = require("luxon");
const pagination_1 = require("../../utils/pagination");
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
                if (now < bookingEndTime) {
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Cannot mark an ongoing booking as completed');
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
        });
        if (!updatedBooking) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking not found or not updated');
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
    // Status filter, but always exclude PENDING and CONFIRMED
    const excludedStatuses = [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED];
    const excludedStatusStrings = excludedStatuses.map(s => s.toString());
    const statusFilter = options.status && Array.isArray(options.status)
        ? {
            status: {
                in: options.status.filter(s => !excludedStatusStrings.includes(s)),
            },
        }
        : options.status
            ? excludedStatusStrings.includes(options.status)
                ? { status: { notIn: excludedStatuses } }
                : { status: options.status }
            : { status: { notIn: excludedStatuses } };
    const whereClause = Object.assign(Object.assign({ saloonOwnerId: userId }, statusFilter), (Object.keys(searchQuery).length > 0 && searchQuery));
    const [result, total] = yield Promise.all([
        prisma_1.default.booking.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: 'desc',
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        image: true,
                        email: true,
                        phoneNumber: true,
                    },
                },
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
        prisma_1.default.booking.count({
            where: whereClause,
        }),
    ]);
    const bookings = result.map(booking => ({
        bookingId: booking.id,
        customerId: booking.user.id,
        customerName: booking.user.fullName,
        customerImage: booking.user.image,
        customEmail: booking.user.email,
        customerPhone: booking.user.phoneNumber,
        barberId: booking.barber.user.id,
        barberName: booking.barber.user.fullName,
        barberImage: booking.barber.user.image,
        barberEmail: booking.barber.user.email,
        barberPhone: booking.barber.user.phoneNumber,
        totalPrice: booking.totalPrice,
        bookingDate: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        // paymentStatus: booking.paymentStatus,
        status: booking.status,
        services: booking.BookedServices.map(service => ({
            serviceId: service.service.id,
            serviceName: service.service.serviceName,
            price: service.service.price,
            availableTo: service.service.availableTo,
        })),
    }));
    return (0, pagination_1.formatPaginationResponse)(bookings, total, page, limit);
});
const getTransactionsFromDb = (userId_2, ...args_2) => __awaiter(void 0, [userId_2, ...args_2], void 0, function* (userId, options = {}) {
    const { page, limit, skip, sortBy, sortOrder } = (0, pagination_1.calculatePagination)(options);
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
                {
                    BookedServices: {
                        some: {
                            service: {
                                serviceName: {
                                    contains: options.searchTerm,
                                    mode: 'insensitive',
                                },
                            },
                        },
                    },
                },
                // Removed invalid payment status search by 'contains' since status is an enum
            ],
        }
        : {};
    // Only fetch payments with status 'COMPLETED' and join booking for saloonOwnerId
    const whereClause = {
        status: { in: [client_1.PaymentStatus.COMPLETED, client_1.PaymentStatus.REFUNDED] },
        booking: Object.assign({ saloonOwnerId: userId }, (searchQuery.OR
            ? {
                OR: searchQuery.OR.map((searchCondition) => {
                    // Move booking-related search fields inside booking
                    if (searchCondition.user ||
                        searchCondition.barber ||
                        searchCondition.BookedServices) {
                        return searchCondition;
                    }
                    return undefined;
                }).filter(Boolean),
            }
            : {})),
        // Removed invalid payment status search by 'contains' since status is an enum
    };
    const [result, total] = yield Promise.all([
        prisma_1.default.payment.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: {
                [sortBy]: sortOrder,
            },
            include: {
                booking: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                image: true,
                                email: true,
                                phoneNumber: true,
                            },
                        },
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
                },
            },
        }),
        prisma_1.default.payment.count({
            where: whereClause,
        }),
    ]);
    const transactions = result.map(payment => {
        const booking = payment.booking;
        return {
            paymentId: payment.id,
            bookingId: booking === null || booking === void 0 ? void 0 : booking.id,
            customerId: booking === null || booking === void 0 ? void 0 : booking.user.id,
            customerName: booking === null || booking === void 0 ? void 0 : booking.user.fullName,
            customerImage: booking === null || booking === void 0 ? void 0 : booking.user.image,
            customEmail: booking === null || booking === void 0 ? void 0 : booking.user.email,
            customerPhone: booking === null || booking === void 0 ? void 0 : booking.user.phoneNumber,
            barberId: booking === null || booking === void 0 ? void 0 : booking.barber.user.id,
            barberName: booking === null || booking === void 0 ? void 0 : booking.barber.user.fullName,
            barberImage: booking === null || booking === void 0 ? void 0 : booking.barber.user.image,
            barberEmail: booking === null || booking === void 0 ? void 0 : booking.barber.user.email,
            barberPhone: booking === null || booking === void 0 ? void 0 : booking.barber.user.phoneNumber,
            totalPrice: booking === null || booking === void 0 ? void 0 : booking.totalPrice,
            bookingDate: booking === null || booking === void 0 ? void 0 : booking.date,
            startTime: booking === null || booking === void 0 ? void 0 : booking.startTime,
            endTime: booking === null || booking === void 0 ? void 0 : booking.endTime,
            paymentStatus: payment.status,
            paymentAmount: payment.paymentAmount,
            paymentDate: payment.createdAt,
            status: booking === null || booking === void 0 ? void 0 : booking.status,
            // services: booking?.BookedServices.map(service => ({
            //   serviceId: service.service.id,
            //   serviceName: service.service.serviceName,
            //   price: service.service.price,
            //   availableTo: service.service.availableTo,
            // })) || [],
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
const getAllBarbersFromDb = (userId_3, ...args_3) => __awaiter(void 0, [userId_3, ...args_3], void 0, function* (userId, 
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
const getScheduledBarbersFromDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { utcDateTime } = data;
    if (!utcDateTime || !userId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required fields');
    }
    const appointmentDateTime = luxon_1.DateTime.fromISO(utcDateTime).toUTC();
    if (!appointmentDateTime.isValid) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid date or time format');
    }
    // Find bookings that overlap with the requested time
    const bookings = yield prisma_1.default.booking.findMany({
        where: {
            saloonOwnerId: userId,
            startDateTime: {
                lte: appointmentDateTime.toJSDate(),
            },
            endDateTime: {
                gte: appointmentDateTime.toJSDate(),
            },
            status: {
                in: [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED],
            },
        },
        include: {
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
                        },
                    },
                },
            },
            user: {
                select: {
                    id: true,
                    fullName: true,
                    image: true,
                    email: true,
                    phoneNumber: true,
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
    // Map bookings to include barber and booking details
    const scheduledBarbers = bookings.map(booking => ({
        barberId: booking.barber.userId,
        barberName: booking.barber.user.fullName,
        barberImage: booking.barber.user.image,
        barberPhone: booking.barber.user.phoneNumber,
        barberAddress: booking.barber.user.address,
        bookingId: booking.id,
        bookingStartTime: booking.startDateTime,
        bookingEndTime: booking.endDateTime,
        bookingStatus: booking.status,
        customer: {
            customerId: booking.user.id,
            customerName: booking.user.fullName,
            customerImage: booking.user.image,
            customerEmail: booking.user.email,
            customerPhone: booking.user.phoneNumber,
        },
        services: booking.BookedServices.map(service => ({
            serviceId: service.service.id,
            serviceName: service.service.serviceName,
            price: service.service.price,
            availableTo: service.service.availableTo,
        })),
        totalPrice: booking.totalPrice,
    }));
    return scheduledBarbers;
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
    getTransactionsFromDb,
    getSaloonListFromDb,
    getAllBarbersFromDb,
    terminateBarberIntoDb,
    getScheduledBarbersFromDb,
    deleteSaloonItemFromDb,
};

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
const manageBookingsIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const booking = yield tx.booking.update({
            where: {
                id: data.bookingId,
                saloonOwnerId: userId,
                status: client_1.BookingStatus.PENDING,
            },
            data: {
                status: data.status,
            },
        });
        if (!booking) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Booking not found or not updated');
        }
        return booking;
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
    const customerGrowth = yield prisma_1.default.booking.groupBy({
        by: ['createdAt'],
        _count: {
            id: true,
        },
        where: {
            saloonOwnerId: userId,
            status: client_1.BookingStatus.COMPLETED,
            createdAt: {
                gte: new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
            },
        },
        orderBy: {
            createdAt: 'asc',
        },
    });
    // Group customer growth by month
    const monthlyGrowth = {};
    customerGrowth.forEach(item => {
        const month = `${item.createdAt.getFullYear()}-${String(item.createdAt.getMonth() + 1).padStart(2, '0')}`;
        monthlyGrowth[month] = (monthlyGrowth[month] || 0) + item._count.id;
    });
    return {
        totalCustomers: customerCount,
        totalEarnings: totalEarnings._sum.totalPrice || 0,
        totalBarbers: barberCount,
        totalBookings: bookingCount,
        customerGrowth: Object.entries(monthlyGrowth).map(([month, count]) => ({
            month,
            count,
        })),
    };
});
const getCustomerBookingsFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.booking.findMany({
        where: {
            saloonOwnerId: userId,
            // status: BookingStatus.COMPLETED,
        },
        include: {
            user: {
                select: {
                    id: true,
                    fullName: true,
                    image: true,
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
            BookedServices: {
                select: {
                    service: {
                        select: {
                            id: true,
                            serviceName: true,
                            price: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    if (result.length === 0) {
        return [];
    }
    return result.map(booking => ({
        bookingId: booking.id,
        customerId: booking.user.id,
        customerName: booking.user.fullName,
        customerImage: booking.user.image,
        barberId: booking.barber.user.id,
        barberName: booking.barber.user.fullName,
        barberImage: booking.barber.user.image,
        totalPrice: booking.totalPrice,
        bookingDate: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        services: booking.BookedServices.map(service => ({
            serviceId: service.service.id,
            serviceName: service.service.serviceName,
            price: service.service.price,
        })),
    }));
});
const getSaloonListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.saloonOwner.findMany();
    if (result.length === 0) {
        return { message: 'No saloon found' };
    }
    return result;
});
const getAllBarbersFromDb = (userId, saloonId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.hiredBarber.findMany({
        where: {
            userId: userId,
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
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'saloon not found');
    }
    return result.map(barber => ({
        barberId: barber.barberId,
        barberImage: barber.barber.user.image,
        barberName: barber.barber.user.fullName,
        barberPhone: barber.barber.user.phoneNumber,
        barberAddress: barber.barber.user.address,
        hourlyRate: barber.hourlyRate,
    }));
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
                startTimeString = isNaN(date.getTime()) ? conflictingBooking.date.toDateString() : date.toISOString();
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
    getSaloonListFromDb,
    getAllBarbersFromDb,
    terminateBarberIntoDb,
    deleteSaloonItemFromDb,
};

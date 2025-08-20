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
exports.barberService = void 0;
const prisma_1 = __importDefault(require("../../utils/prisma"));
const client_1 = require("@prisma/client");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createBarberIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barber.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barber not created');
    }
    return result;
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
            status: client_1.BookingStatus.COMPLETED
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
            status: client_1.BookingStatus.COMPLETED,
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
                        }
                    }
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
                }
            }
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    if (result.length === 0) {
        return [];
    }
    return result;
});
const getBarberListFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barber.findMany();
    if (result.length === 0) {
        return { message: 'No barber found' };
    }
    return result;
});
const getBarberByIdFromDb = (userId, barberId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barber.findUnique({
        where: {
            id: barberId,
        }
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'barber not found');
    }
    return result;
});
const updateBarberIntoDb = (userId, barberId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barber.update({
        where: {
            id: barberId,
            userId: userId,
        },
        data: Object.assign({}, data),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barberId, not updated');
    }
    return result;
});
const deleteBarberItemFromDb = (userId, barberId) => __awaiter(void 0, void 0, void 0, function* () {
    const deletedItem = yield prisma_1.default.barber.delete({
        where: {
            id: barberId,
            userId: userId,
        },
    });
    if (!deletedItem) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barberId, not deleted');
    }
    return deletedItem;
});
exports.barberService = {
    createBarberIntoDb,
    getBarberDashboardFromDb,
    getCustomerBookingsFromDb,
    getBarberListFromDb,
    getBarberByIdFromDb,
    updateBarberIntoDb,
    deleteBarberItemFromDb,
};

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
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const client_1 = require("@prisma/client");
const createBarberIntoDb = (userId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barber.create({
        data: Object.assign(Object.assign({}, data), { userId: userId }),
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'barber not created');
    }
    return result;
});
const getMyScheduleFromDb = (userId, dayName) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.barberSchedule.findMany({
        where: {
            barberId: userId,
            // dayName: dayName,
        },
        select: {
            id: true,
            saloonOwnerId: true,
            barberId: true,
            dayName: true,
            openingTime: true,
            closingTime: true,
            isActive: true,
            type: true,
            // openingDateTime: true,
            // closingDateTime: true,
        },
    });
    if (!result) {
        return [];
    }
    return result.map(item => {
        const weekend = item.isActive === false;
        return {
            id: item.id,
            saloonOwnerId: item.saloonOwnerId,
            barberId: item.barberId,
            dayName: item.dayName,
            time: item.isActive
                ? `${item.openingTime} - ${item.closingTime}`
                : 'Closed',
            isActive: item.isActive,
            type: item.type,
            weekend,
            // openingDateTime: item.openingDateTime,
            // closingDateTime: item.closingDateTime,
        };
    });
});
const getMyBookingsFromDb = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield prisma_1.default.booking.findMany({
        where: {
            barberId: userId,
            status: client_1.BookingStatus.CONFIRMED,
        },
        select: {
            id: true,
            userId: true,
            saloonOwnerId: true,
            barberId: true,
            date: true,
            startDateTime: true,
            endDateTime: true,
            status: true,
            totalPrice: true,
            createdAt: true,
            user: {
                select: {
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                    image: true,
                },
            },
            BookedServices: {
                select: {
                    service: {
                        select: {
                            id: true,
                            serviceName: true,
                            availableTo: true,
                            price: true,
                            duration: true,
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
        return { message: 'No bookings found' };
    }
    return result.map(booking => ({
        bookingId: booking.id,
        userId: booking.userId,
        saloonOwnerId: booking.saloonOwnerId,
        barberId: booking.barberId,
        date: booking.date,
        startDateTime: booking.startDateTime,
        endDateTime: booking.endDateTime,
        status: booking.status,
        totalPrice: booking.totalPrice,
        createdAt: booking.createdAt,
        userFullName: booking.user.fullName,
        userEmail: booking.user.email,
        userPhoneNumber: booking.user.phoneNumber,
        userImage: booking.user.image,
        bookedServices: booking.BookedServices.map(bs => ({
            id: bs.service.id,
            serviceName: bs.service.serviceName,
            availableTo: bs.service.availableTo,
            price: bs.service.price,
            duration: bs.service.duration,
        })),
    }));
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
            userId: barberId,
        },
        include: {
            user: {
                select: {
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                    image: true,
                },
            },
        },
    });
    // check following or not
    const isFollowing = yield prisma_1.default.follow.findFirst({
        where: {
            userId: userId,
            followingId: barberId,
        },
    });
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'barber not found');
    }
    return Object.assign(Object.assign({}, result), { isFollowing: isFollowing ? true : false });
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
    getMyScheduleFromDb,
    getBarberListFromDb,
    getMyBookingsFromDb,
    getBarberByIdFromDb,
    updateBarberIntoDb,
    deleteBarberItemFromDb,
};
